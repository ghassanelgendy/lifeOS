// Send Web Push notifications for calendar events starting now or in 5 minutes.
// Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in Supabase secrets.
/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_ORIGINS') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const isAllowed = !!origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

if (!vapidPublic || !vapidPrivate) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}

webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic!, vapidPrivate!);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function isEventAtTime(event: any, target: Date): boolean {
  const eventStart = new Date(event.start_time);
  if (Number.isNaN(eventStart.getTime())) return false;

  const diffMs = target.getTime() - eventStart.getTime();
  if (diffMs < -30000) return false; // Starts in the future relative to target (with 30s grace)

  if (!event.recurrence || event.recurrence === 'none') {
    // Non-recurring: exact match within 1 minute
    return Math.abs(diffMs) < 60 * 1000;
  }

  // If recurring, check if target falls after recurrence end
  if (event.recurrence_end) {
    const recEnd = new Date(event.recurrence_end);
    // Add full day to recurrence end since it's a date-only field usually
    recEnd.setHours(23, 59, 59, 999);
    if (target > recEnd) return false;
  }

  const diffDays = diffMs / (24 * 60 * 60 * 1000);

  // ponytail: handle weekly days recurrence e.g. 'weekly:1,3,5'
  if (event.recurrence && event.recurrence.startsWith('weekly:')) {
    const days = event.recurrence.split(':')[1].split(',').map(Number);
    if (!days.includes(target.getDay())) return false;
    const targetTimeOfDay = target.getHours() * 60 + target.getMinutes();
    const eventTimeOfDay = eventStart.getHours() * 60 + eventStart.getMinutes();
    return Math.abs(targetTimeOfDay - eventTimeOfDay) < 1; // 1 minute tolerance
  }

  switch (event.recurrence) {
    case 'daily': {
      return Math.abs(diffDays - Math.round(diffDays)) < 0.0007; // ~1 minute tolerance
    }
    case 'weekly': {
      const diffWeeks = diffDays / 7;
      return Math.abs(diffWeeks - Math.round(diffWeeks)) < 0.0001; // ~1 minute tolerance
    }
    case 'monthly': {
      // Must be same day of the month and same time of day
      if (eventStart.getDate() !== target.getDate()) return false;
      return eventStart.getHours() === target.getHours() && eventStart.getMinutes() === target.getMinutes();
    }
    default:
      return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Cron authentication check
  const configuredSecrets = [
    Deno.env.get('CRON_SECRET')?.trim(),
    Deno.env.get('CALENDAR_CRON_SECRET')?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  if (configuredSecrets.length > 0) {
    const headerSecret = req.headers.get('x-cron-secret')?.trim();
    const bearerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const apiKeySecret = req.headers.get('apikey')?.trim();
    const providedSecret = headerSecret ?? bearerSecret ?? apiKeySecret;
    const isAuthorized = !!providedSecret && configuredSecrets.some((s) => s === providedSecret);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const now = new Date();
    // Round now to the minute
    const nowMin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
    const in5Mins = new Date(nowMin.getTime() + 5 * 60 * 1000);

    // Fetch active calendar events (recurring, or non-recurring within active window)
    // To minimize data size, query recurrence != none OR start_time within +/- 30 minutes
    const minBound = new Date(nowMin.getTime() - 30 * 60 * 1000).toISOString();
    const maxBound = new Date(nowMin.getTime() + 30 * 60 * 1000).toISOString();

    const [recurringRes, nonRecurringRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time, recurrence, recurrence_end, user_id')
        .neq('recurrence', 'none')
        .not('user_id', 'is', null)
        .lte('start_time', in5Mins.toISOString())
        .or(`recurrence_end.is.null,recurrence_end.gte.${nowMin.toISOString().split('T')[0]}`),
      supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time, recurrence, recurrence_end, user_id')
        .or('recurrence.eq.none,recurrence.is.null')
        .not('user_id', 'is', null)
        .gte('start_time', minBound)
        .lte('start_time', maxBound)
    ]);

    if (recurringRes.error) throw recurringRes.error;
    if (nonRecurringRes.error) throw nonRecurringRes.error;

    const events = [...(recurringRes.data || []), ...(nonRecurringRes.data || [])];

    const eventList = (events as any[]) || [];
    const dueEvents: Array<{ event: any; type: 'now' | '5min'; targetTime: Date }> = [];

    for (const event of eventList) {
      if (!event.user_id) continue;
      
      // Check if starting "now"
      if (isEventAtTime(event, nowMin)) {
        dueEvents.push({ event, type: 'now', targetTime: nowMin });
      } 
      // Check if starting in 5 mins
      else if (isEventAtTime(event, in5Mins)) {
        dueEvents.push({ event, type: '5min', targetTime: in5Mins });
      }
    }

    if (dueEvents.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No events due now or in 5 minutes.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch subscriptions for relevant users
    const userIds = [...new Set(dueEvents.map((de) => de.event.user_id))];
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', userIds);

    if (subsError) throw subsError;

    const subList = (subs as any[]) || [];
    const subsByUser = new Map<string, any[]>();
    for (const sub of subList) {
      if (sub.user_id) {
        const list = subsByUser.get(sub.user_id) || [];
        list.push(sub);
        subsByUser.set(sub.user_id, list);
      }
    }

    let sentCount = 0;
    for (const { event, type, targetTime } of dueEvents) {
      const isNow = type === 'now';
      const bodyText = isNow ? 'is now' : 'is starting in 5 mins';
      
      // Build idempotency key using targetTime so it only fires once per target slot per event
      const idempotencyKey = `calendar:${event.user_id}:${event.id}:${type}:${targetTime.toISOString()}`;

      // Check delivery logs
      const { data: existingLog } = await (supabase
        .from('notification_delivery_logs')
        .select('id')
        .eq('idempotency_key', idempotencyKey) as any).maybeSingle();

      if (existingLog?.id) continue;

      const userSubs = subsByUser.get(event.user_id) || [];
      if (userSubs.length === 0) continue;

      // Register delivery start (use 'task' type to satisfy DB CHECK constraints safely)
      const { error: insertError } = await supabase.from('notification_delivery_logs').insert({
        user_id: event.user_id,
        source_type: 'task',
        source_id: event.id,
        scheduled_for: now.toISOString(),
        status: 'pending',
        idempotency_key: idempotencyKey,
      });

      if (insertError) {
        if ((insertError as any).code === '23505') continue; // Handle duplicate race conditions
        throw insertError;
      }

      const payload = JSON.stringify({
        calendarEventId: event.id,
        title: event.title,
        body: `${event.title} ${bodyText}`,
      });

      let anySuccess = false;
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sentCount++;
          anySuccess = true;
        } catch (e) {
          console.error('Push failed for calendar subscription:', sub.endpoint.slice(0, 50), e);
          if ((e as any).statusCode === 410 || (e as any).statusCode === 404) {
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

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
