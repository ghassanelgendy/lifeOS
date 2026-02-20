// Send Web Push prayer reminders based on prayer_notification_settings.
// Trigger from external cron website or pg_cron.
/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
const cronSecret = Deno.env.get('CRON_SECRET') || Deno.env.get('PRAYER_CRON_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const suppliedSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (cronSecret && suppliedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { data: settings, error: settingsError } = await supabase
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

    let sent = 0;
    let due = 0;
    const now = new Date();

    for (const raw of (settings || []) as any[]) {
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
      const ph = row.prayer_habit;
      if (!ph?.is_active || !ph.default_time || !row.user_id) continue;

      const timezone = row.timezone || 'UTC';
      const local = toLocalDateTime(now, timezone);
      if (isInQuietHours(local.minuteOfDay, row.quiet_hours_start, row.quiet_hours_end)) continue;

      const baseMinute = parseTimeToMinutes(ph.default_time);
      const notifyMinute = baseMinute + (row.offset_minutes ?? 0);
      const normalized = ((notifyMinute % 1440) + 1440) % 1440;
      if (normalized !== local.minuteOfDay) continue;
      due++;

      const idempotencyKey = `prayer:${row.user_id}:${ph.prayer_name}:${local.date}:${local.time}`;
      const { data: existingLog } = await supabase
        .from('notification_delivery_logs')
        .select('id,status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingLog?.id) continue;

      await supabase.from('notification_delivery_logs').insert({
        user_id: row.user_id,
        source_type: 'prayer',
        source_id: ph.id,
        scheduled_for: now.toISOString(),
        status: 'pending',
        idempotency_key: idempotencyKey,
      });

      const { data: subs, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('endpoint,p256dh,auth')
        .eq('user_id', row.user_id);
      if (subsError) {
        await supabase.from('notification_delivery_logs')
          .update({ status: 'failed', error: subsError.message })
          .eq('idempotency_key', idempotencyKey);
        continue;
      }

      const payload = JSON.stringify({
        title: `${ph.prayer_name} reminder`,
        body: `It's time for ${ph.prayer_name}.`,
        prayerName: ph.prayer_name,
      });

      let anySuccess = false;
      for (const sub of (subs || []) as any[]) {
        try {
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          }, payload);
          anySuccess = true;
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }

      await supabase.from('notification_delivery_logs')
        .update({
          status: anySuccess ? 'sent' : 'failed',
          sent_at: anySuccess ? new Date().toISOString() : null,
          error: anySuccess ? null : 'No valid subscriptions',
        })
        .eq('idempotency_key', idempotencyKey);
    }

    return new Response(JSON.stringify({ ok: true, due, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
