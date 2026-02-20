// Send Web Push task reminders for tasks due this minute (UTC).
// Call this every minute via cron (e.g. cron-job.org) or Supabase pg_cron.
// Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in Supabase secrets.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Get all unique timezones from subscriptions
    const { data: timezones, error: tzError } = await supabase
      .from('push_subscriptions')
      .select('timezone')
      .not('timezone', 'is', null);

    if (tzError) throw tzError;

    // Get unique timezones (e.g. ['America/New_York', 'Europe/London'])
    const uniqueTimezones = [...new Set((timezones as any[]).map((t: any) => t.timezone))];
    const results: any[] = [];

    // 2. Process each timezone
    for (const tz of uniqueTimezones) {
      if (typeof tz !== 'string') continue;

      try {
        // Calculate current local time in this timezone
        const now = new Date();
        const localDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(now); // "YYYY-MM-DD"

        const localTime = new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(now); // "HH:mm"

        // Get tasks due at this local time
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, due_date, due_time, reminders_enabled')
          .eq('is_completed', false)
          .eq('reminders_enabled', true)
          .eq('due_date', localDate)
          .eq('due_time', localTime)
          .is('parent_id', null);

        if (tasksError) {
          console.error(`Error querying tasks for ${tz}:`, tasksError);
          continue;
        }

        const taskList = tasks as any[];
        if (!taskList || taskList.length === 0) continue;

        // Get subscriptions in this timezone
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
              // Clean up dead subscriptions
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
