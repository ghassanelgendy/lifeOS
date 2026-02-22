// Send Web Push prayer reminders based on prayer_notification_settings.
// Structure mirrors send-task-reminders: iterate by timezone, find due items, get subs, send.
// Trigger from external cron (e.g. every 5 min) or pg_cron.
/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (!vapidPublic || !vapidPrivate) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}
webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic!, vapidPrivate!);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function toLocalDateTime(now: Date, timezone: string): { date: string; time: string; minuteOfDay: number } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const hm = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const [h, m] = hm.split(':').map(Number);
  return { date, time: hm, minuteOfDay: h * 60 + m };
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isInQuietHours(minuteOfDay: number, quietStart?: string | null, quietEnd?: string | null): boolean {
  if (!quietStart || !quietEnd) return false;
  const start = parseTimeToMinutes(quietStart);
  const end = parseTimeToMinutes(quietEnd);
  if (start === end) return false;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

// Due if current minute is within windowMinutes after notify time (so cron every 5 min doesn't miss).
function isDueNow(localMinuteOfDay: number, notifyMinuteNormalized: number, windowMinutes = 2): boolean {
  const delta = (localMinuteOfDay - notifyMinuteNormalized + 1440) % 1440;
  return delta <= windowMinutes;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!vapidPublic || !vapidPrivate) {
    return new Response(
      JSON.stringify({ error: 'Server Misconfiguration: Missing VAPID Keys in Supabase Secrets' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { data: settingsRows, error: settingsError } = await supabase
      .from('prayer_notification_settings')
      .select(`
        id,
        user_id,
        enabled,
        offset_minutes,
        timezone,
        quiet_hours_start,
        quiet_hours_end,
        prayer_habit:prayer_habits!inner(id, prayer_name, default_time, is_active)
      `)
      .eq('enabled', true);

    if (settingsError) throw settingsError;

    const settings = (settingsRows || []) as any[];
    const uniqueTimezones = [...new Set(settings.map((s: any) => s.timezone || 'UTC').filter(Boolean))];
    const results: { timezone: string; due: number; sent: number }[] = [];
    const now = new Date();

    for (const tz of uniqueTimezones) {
      if (typeof tz !== 'string') continue;

      try {
        const local = toLocalDateTime(now, tz);
        const dueInTz: typeof settings = [];

        for (const raw of settings) {
          const row = raw as {
            id: string;
            user_id: string;
            enabled: boolean;
            offset_minutes: number;
            timezone: string;
            quiet_hours_start?: string | null;
            quiet_hours_end?: string | null;
            prayer_habit: { id: string; prayer_name: string; default_time?: string | null; is_active: boolean };
          };
          if ((row.timezone || 'UTC') !== tz || !row.user_id) continue;

          const ph = row.prayer_habit;
          if (!ph?.is_active || !ph.default_time) continue;
          if (isInQuietHours(local.minuteOfDay, row.quiet_hours_start, row.quiet_hours_end)) continue;

          const baseMinute = parseTimeToMinutes(ph.default_time);
          const notifyMinute = baseMinute + (row.offset_minutes ?? 0);
          const normalized = ((notifyMinute % 1440) + 1440) % 1440;
          if (!isDueNow(local.minuteOfDay, normalized)) continue;

          const idempotencyKey = `prayer:${row.user_id}:${ph.prayer_name}:${local.date}`;
          const { data: existingLog } = await (supabase
            .from('notification_delivery_logs')
            .select('id, status')
            .eq('idempotency_key', idempotencyKey) as any).maybeSingle();
          if (existingLog?.id) continue;

          dueInTz.push(row);
        }

        if (dueInTz.length === 0) continue;

        const userIds = [...new Set(dueInTz.map((r: any) => r.user_id))];
        const { data: subs, error: subsError } = await (supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth, user_id') as any).in('user_id', userIds);

        if (subsError) {
          console.error(`Error querying push_subscriptions for ${tz}:`, subsError);
          continue;
        }

        const subList = (subs || []) as any[];
        if (!subList.length) {
          results.push({ timezone: tz, due: dueInTz.length, sent: 0 });
          continue;
        }

        const subsByUser = new Map<string, typeof subList>();
        for (const sub of subList) {
          const uid = sub.user_id as string;
          if (!subsByUser.has(uid)) subsByUser.set(uid, []);
          subsByUser.get(uid)!.push(sub);
        }

        let sent = 0;
        for (const row of dueInTz) {
          const idempotencyKey = `prayer:${row.user_id}:${row.prayer_habit.prayer_name}:${local.date}`;
          await supabase.from('notification_delivery_logs').insert({
            user_id: row.user_id,
            source_type: 'prayer',
            source_id: row.prayer_habit.id,
            scheduled_for: now.toISOString(),
            status: 'pending',
            idempotency_key: idempotencyKey,
          });

          const title = `Time to pray ${row.prayer_habit.prayer_name}`;
          const payload = JSON.stringify({
            title,
            prayerName: row.prayer_habit.prayer_name,
          });

          const userSubs = subsByUser.get(row.user_id) || [];
          let anySuccess = false;
          for (const sub of userSubs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              );
              sent++;
              anySuccess = true;
            } catch (e: any) {
              console.error('Push failed', sub.endpoint?.slice(0, 50), e);
              if (e?.statusCode === 404 || e?.statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          }

          await supabase
            .from('notification_delivery_logs')
            .update({
              status: anySuccess ? 'sent' : 'failed',
              sent_at: anySuccess ? new Date().toISOString() : null,
              error: anySuccess ? null : 'No valid subscriptions',
            })
            .eq('idempotency_key', idempotencyKey);
        }

        results.push({ timezone: tz, due: dueInTz.length, sent });
      } catch (tzErr) {
        console.error(`Failed to process timezone ${tz}`, tzErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
