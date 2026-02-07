# Supabase Auth Setup (Multi-User)

LifeOS uses Supabase Auth so each user only sees their own data.

## 1. Enable Auth in Supabase

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Providers**.
3. Enable **Email** (and optionally **Email confirmations** if you want users to verify email before signing in).

## 2. Run the migration

1. In Supabase Dashboard go to **SQL Editor**.
2. Open the file `supabase/migrations/20250205000000_add_auth_user_id_and_rls.sql` from this repo.
3. Copy its contents and run the script in the SQL Editor.

This will:

- Add a `user_id` column (references `auth.users`) to all data tables.
- Add triggers so `user_id` is set to the current user on INSERT (no need to send it from the app).
- Replace the old "Public Access" RLS policies with user-scoped policies so each user only sees their own rows.

## 3. Existing data (optional)

If you already have rows in the DB from before auth:

- They will have `user_id = NULL` and **won’t be visible** to any logged-in user (RLS allows only `user_id = auth.uid()`).
- To assign them to a user, run a one-time update in the SQL Editor, for example (replace `YOUR_USER_UUID` with the real `auth.users.id`):

```sql
-- Replace YOUR_USER_UUID with the user's id from auth.users
UPDATE inbody_scans SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;
UPDATE projects SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;
-- ... repeat for other tables if you have existing data
```

## 4. App behavior

- **Unauthenticated:** Redirected to `/login`. Sign up at `/signup`.
- **Authenticated:** Full app access; all Supabase queries are scoped by the current user via RLS.
- **Seed data:** Runs once per user (after first login) and creates sample projects, task lists, tags, and tasks for that user.
- **Sign out:** Settings → Account → Sign out.

## 5. Environment

No extra env vars are required. The app already uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the anon key is used with the session JWT so RLS sees the correct `auth.uid()`.
