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
6. **Request headers** (you need at least one of these):

   **Option A – Use only your cron secret (recommended)**  
   - Deploy the function with JWT verification off so the cron doesn’t need the Supabase API key:
     ```bash
     supabase functions deploy prayer-notifications-dispatch --no-verify-jwt
     ```
   - In cron-job.org add:
     - **Header name:** `x-cron-secret`  
     - **Header value:** the exact same value as `CRON_SECRET` in Supabase Edge Function secrets.

   **Option B – Use Supabase API key**  
   - **Header name:** `Authorization`  
   - **Header value:** `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`  
   (from Supabase Dashboard → Project Settings → API → **service_role** key, keep it secret).  
   You can also send `x-cron-secret` as above if you set `CRON_SECRET` in secrets.

7. Save the cron job.

## 3. Supabase Edge Function secrets

In Supabase → **Edge Functions** → **Secrets**, ensure you have:

- `CRON_SECRET` or `PRAYER_CRON_SECRET` – same value you use in cron-job.org headers.
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` – for web push (same as for task reminders).

## 4. Test

- In cron-job.org, use **“Execute now”** (or wait for the next run).
- Check Supabase → **Edge Functions** → **prayer-notifications-dispatch** → **Logs** for responses and errors.

**401 Unauthorized:**  
- If you use **Option A**: redeploy with `--no-verify-jwt` and ensure `x-cron-secret` matches `CRON_SECRET` in Supabase (no extra spaces, same case).  
- If you use **Option B**: ensure the `Authorization: Bearer <service_role_key>` header uses the real **service_role** key from Project Settings → API (not the anon key).
