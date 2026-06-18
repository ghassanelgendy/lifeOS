// Send Web Push task reminders for tasks whose reminder time is this minute (in each user TZ).
// Reminder time = due_date + due_time - early_reminder_minutes (so "5 min before" fires 5 min before due).
// Call this every minute via cron. Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in Supabase secrets.
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

// Early reminder offsets we support (minutes before due time). 0 = at due time.
const EARLY_OFFSETS = [0, 5, 10, 15, 30, 60];

function formatInTz(date: Date, tz: string, dateStyle: 'date' | 'time'): string {
  if (dateStyle === 'date') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date); // YYYY-MM-DD
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date); // HH:mm
}

if (!vapidPublic || !vapidPrivate) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}

webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic!, vapidPrivate!);

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Cron-only endpoint: require shared secret when configured.
  const configuredSecrets = [
    Deno.env.get('CRON_SECRET')?.trim(),
    Deno.env.get('TASKS_CRON_SECRET')?.trim(),
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
    const { data: timezones, error: tzError } = await supabase
      .from('push_subscriptions')
      .select('timezone')
      .not('timezone', 'is', null);

    if (tzError) throw tzError;

    const uniqueTimezones = [...new Set((timezones as any[]).map((t: any) => t.timezone))];
    const results: any[] = [];

    for (const tz of uniqueTimezones) {
      if (typeof tz !== 'string') continue;

      try {
        const now = new Date();
        let taskList: any[] = [];

        // For each early offset E: reminder fires when (due - E) = now in TZ, i.e. due = now + E in TZ.
        // So we compute (targetDate, targetTime) = now + E minutes formatted in tz, and query tasks with that due and early_reminder_minutes = E.
        for (const E of EARLY_OFFSETS) {
          const target = new Date(now.getTime() + E * 60 * 1000);
          const targetDate = formatInTz(target, tz, 'date');
          const targetTime = formatInTz(target, tz, 'time');

          let q = supabase
            .from('tasks')
            .select('id, title, user_id, due_date, due_time, reminders_enabled, early_reminder_minutes')
            .eq('is_completed', false)
            .eq('is_wont_do', false)
            .eq('reminders_enabled', true)
            .eq('due_date', targetDate)
            .in('due_time', [targetTime, `${targetTime}:00`])
            .is('parent_id', null);

          if (E !== 0) {
            q = q.eq('early_reminder_minutes', E);
          }

          const { data: tasks, error: tasksError } = await q;

          if (tasksError) {
            console.error(`Error querying tasks for ${tz} E=${E}:`, tasksError);
            continue;
          }
          const raw = (tasks as any[]) || [];
          const toAdd = E === 0
            ? raw.filter((t: any) => t.early_reminder_minutes == null || t.early_reminder_minutes === 0)
            : raw;
          for (const t of toAdd) {
            if (!taskList.find((x) => x.id === t.id)) taskList.push(t);
          }
        }

        if (taskList.length === 0) continue;

        const { data: subs, error: subsError } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth, user_id')
          .eq('timezone', tz);

        const subList = subs as any[];
        if (subsError || !subList?.length) continue;

        // Group subscriptions by user_id
        const subsByUser = new Map<string, any[]>();
        for (const sub of subList) {
          if (sub.user_id) {
            const list = subsByUser.get(sub.user_id) || [];
            list.push(sub);
            subsByUser.set(sub.user_id, list);
          }
        }

        let sent = 0;
        for (const task of taskList) {
          if (!task.user_id) continue;

          const idempotencyKey = `task:${task.user_id}:${task.id}:${tz}:${task.due_date}:${task.due_time}`;
          
          // Check if already sent
          const { data: existingLog } = await (supabase
            .from('notification_delivery_logs')
            .select('id, status')
            .eq('idempotency_key', idempotencyKey) as any).maybeSingle();
          if (existingLog?.id) continue;

          const userSubs = subsByUser.get(task.user_id) || [];
          if (!userSubs.length) continue;

          // Register delivery start
          const { error: insertError } = await supabase.from('notification_delivery_logs').insert({
            user_id: task.user_id,
            source_type: 'task',
            source_id: task.id,
            scheduled_for: now.toISOString(),
            status: 'pending',
            idempotency_key: idempotencyKey,
          });

          if (insertError) {
            if ((insertError as any).code === '23505') continue; // Unique violation duplicate check
            throw insertError;
          }

          const payload = JSON.stringify({ taskId: task.id, title: task.title });
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
              sent++;
              anySuccess = true;
            } catch (e) {
              console.error('Push failed', sub.endpoint.slice(0, 50), e);
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
        results.push({ timezone: tz, tasks: taskList.length, sent });
      } catch (tzProcError) {
        console.error(`Failed to process timezone ${tz}`, tzProcError);
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
