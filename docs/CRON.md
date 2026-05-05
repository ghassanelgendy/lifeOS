# Cron

This app has a Vercel cron entrypoint at `GET /api/cron/send-task-reminders`.

## What it does

- Vercel calls the route on a schedule.
- The route forwards the request to the Supabase Edge Function `send-task-reminders`.
- The route authenticates with a shared secret passed as `x-cron-secret`.

## Required Vercel env vars

- `SUPABASE_URL`
  Use the project URL, for example `https://<project-ref>.supabase.co`.
- `CRON_SECRET`
  Shared secret used by Vercel Cron and forwarded to the Supabase Edge Function.

Optional:

- `VITE_SUPABASE_URL`
  Fallback only. Prefer `SUPABASE_URL` on Vercel server routes.
- `TASKS_CRON_SECRET`
  If you want a task-reminder-specific secret name, the Vercel route accepts this too.

## Required Supabase Edge Function secrets

For `supabase/functions/send-task-reminders`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET` or `TASKS_CRON_SECRET`

The Vercel route sends the secret in the `x-cron-secret` header, and the Edge Function accepts either env name.

## Important behavior

- Opening `/api/cron/send-task-reminders` directly in a browser is not a valid production test once secrets are configured.
- After setup, a plain browser hit should return `401 Unauthorized` because it will not include `Authorization: Bearer <CRON_SECRET>`.
- If you see `500 Missing SUPABASE_URL... or CRON_SECRET...`, the Vercel deployment is missing runtime env vars.

## Vercel cron config

This repo does not currently declare a `crons` block in `vercel.json`.
If you want Vercel-managed scheduling from the repo, add one there.

Example:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-task-reminders",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

Notes:

- Minute-level schedules require a Vercel plan that supports them.
- Cron jobs run only on production deployments.

## Habit reminders via cron-job.org

Habit reminders now run directly against the Supabase Edge Function instead of the Vercel cron proxy.

Edge Function:

- `POST https://<project-ref>.supabase.co/functions/v1/habit-notifications-dispatch`

Required Supabase Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET` or `HABITS_CRON_SECRET`

Recommended cron-job.org setup:

- Method: `POST`
- URL: `https://<project-ref>.supabase.co/functions/v1/habit-notifications-dispatch`
- Schedule: `* * * * *`
- Header: `x-cron-secret: <your secret>`

Behavior:

- Habits with an explicit `time` notify at that local time on scheduled days.
- Habits without a `time` use the user’s most common completion time, inferred from recent `habit_logs.completed_at`.
- If there is not enough history yet, the reminder falls back to `09:00` local time.
- Push must already be enabled in the app; there is no separate habit reminder toggle.
- Push subscriptions are now authenticated-only: each subscription row must belong to a signed-in user, and the test-notification Edge Function will only send to a subscription owned by the caller.
