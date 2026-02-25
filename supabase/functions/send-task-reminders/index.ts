// Send Web Push task reminders for tasks whose reminder time is this minute (in each user TZ).
// Reminder time = due_date + due_time - early_reminder_minutes (so "5 min before" fires 5 min before due).
// Call this every minute via cron. Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in Supabase secrets.
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
            .select('id, title, due_date, due_time, reminders_enabled, early_reminder_minutes')
            .eq('is_completed', false)
            .eq('reminders_enabled', true)
            .eq('due_date', targetDate)
            .eq('due_time', targetTime)
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
          .select('endpoint, p256dh, auth')
          .eq('timezone', tz);

        const subList = subs as any[];
        if (subsError || !subList?.length) continue;

        let sent = 0;
        for (const task of taskList) {
          const payload = JSON.stringify({ taskId: task.id, title: task.title });
          for (const sub of subList) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              sent++;
            } catch (e) {
              console.error('Push failed', sub.endpoint.slice(0, 50), e);
              if ((e as any).statusCode === 410 || (e as any).statusCode === 404) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          }
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
