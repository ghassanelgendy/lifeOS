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

if (!vapidPublic || !vapidPrivate) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}

webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic!, vapidPrivate!);

const supabase = createClient(supabaseUrl, serviceRoleKey) as SupabaseClient;

function getDueMoment(dueDate: string, dueTime: string | null): Date {
  const datePart = dueDate.split('T')[0];
  const timePart = dueTime ?? '00:00';
  return new Date(`${datePart}T${timePart}:00.000Z`);
}

type TaskRow = { id: string; title: string; due_date: string; due_time: string | null };
type SubRow = { endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setUTCSeconds(0, 0);
    const windowEnd = new Date(windowStart.getTime() + 60_000);

    const tasksRes = await supabase
      .from('tasks')
      .select('id, title, due_date, due_time')
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .is('parent_id', null);
    const tasksResult: { data: TaskRow[] | null; error: { message: string } | null } = tasksRes as unknown as { data: TaskRow[] | null; error: { message: string } | null };
    const { data: tasks, error: tasksError } = tasksResult;

    if (tasksError) {
      console.error(tasksError);
      return new Response(JSON.stringify({ error: tasksError.message }), { status: 500 });
    }

    const dueNow = (tasks ?? []).filter((t: TaskRow) => {
      const due = getDueMoment(t.due_date, t.due_time ?? null);
      return due >= windowStart && due < windowEnd;
    });

    const subsRes = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');
    const subsResult: { data: SubRow[] | null; error: { message: string } | null } = subsRes as unknown as { data: SubRow[] | null; error: { message: string } | null };
    const { data: subs, error: subsError } = subsResult;
    if (subsError || !subs?.length) {
      return new Response(JSON.stringify({ sent: 0, tasks: dueNow.length, subscriptions: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    for (const task of dueNow) {
      const payload = JSON.stringify({ taskId: task.id, title: task.title });
      for (const sub of subs) {
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
        }
      }
    }

    return new Response(
      JSON.stringify({ sent, tasks: dueNow.length, subscriptions: subs.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
