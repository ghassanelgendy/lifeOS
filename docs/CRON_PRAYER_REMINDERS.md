# Invoke prayer reminders with cron-job.org

Use [cron-job.org](https://cron-job.org) to call the Supabase Edge Function so prayer push notifications are sent on schedule.

## 1. Get your Supabase details

1. **Project URL**  
   Supabase Dashboard → **Project Settings** → **API** → **Project URL**  
   Example: `https://abcdefghijklmnop.supabase.co`

2. **Edge Function URL**  
   `{Project URL}/functions/v1/prayer-notifications-dispatch`  
   Example: `https://abcdefghijklmnop.supabase.co/functions/v1/prayer-notifications-dispatch`

3. **Cron secret**  
   Set in Supabase: **Project Settings** → **Edge Functions** → **Secrets**  
   Add: `CRON_SECRET` (or `PRAYER_CRON_SECRET`) = any long random string you choose.  
   You’ll send this from cron-job.org so only your cron can call the function.

## 2. Create the cron job on cron-job.org

1. Sign up / log in at [cron-job.org](https://cron-job.org).
2. **Create cron job**.
3. **URL:**  
   Paste: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/prayer-notifications-dispatch`  
   (use your real Project URL from step 1).
4. **Schedule:**  
   Run every **10 minutes** so prayer times are not missed (e.g. `*/10 * * * *` or use the “Every 10 minutes” preset if available).
5. **Request method:** **POST** (or GET; the function accepts both).
6. **Request headers:**  
   Add one of these so the Edge Function accepts the request:
   - **Option A – Header name:** `x-cron-secret`  
     **Header value:** the same value you set for `CRON_SECRET` in Supabase.
   - **Option B – Header name:** `Authorization`  
     **Header value:** `Bearer YOUR_CRON_SECRET`  
     (replace `YOUR_CRON_SECRET` with the same value as in Supabase).
7. Save the cron job.

## 3. Supabase Edge Function secrets

In Supabase → **Edge Functions** → **Secrets**, ensure you have:

- `CRON_SECRET` or `PRAYER_CRON_SECRET` – same value you use in cron-job.org headers.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` – for web push (same as for task reminders).

## 4. Test

- In cron-job.org, use **“Execute now”** (or wait for the next run).
- Check Supabase → **Edge Functions** → **prayer-notifications-dispatch** → **Logs** for responses and errors.

If you get **401 Unauthorized**, the header name/value or `CRON_SECRET` in Supabase doesn’t match what cron-job.org sends.
