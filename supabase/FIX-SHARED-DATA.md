# Fix: All users see the same data

If transactions (or other data) added by one user appear for **every** user, the database is not enforcing per-user isolation. You must **enable Row Level Security (RLS)** in Supabase.

## Step 1: Run the RLS script in Supabase

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** → your project.
2. Go to **SQL Editor**.
3. Open the file **`supabase/migrations/20250205100000_enable_rls_on_tables.sql`** from this repo.
4. **Copy its entire contents** and paste into the SQL Editor.
5. Click **Run**.

You should see "Success. No rows returned." That is normal.

## Step 2: Confirm RLS is on (optional)

In the SQL Editor, run:

```sql
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('transactions', 'budgets', 'tasks', 'habits', 'projects')
ORDER BY relname;
```

Every row should show **`rls_enabled = true`**. If any show `false`, run the script from Step 1 again.

## Step 3: Test the app

1. Log in as **User A**, add a transaction, then **Sign out**.
2. Log in as **User B**.
3. User B should **not** see User A’s transaction.

If you still see shared data, check the browser console. If RLS is still off, you may see:

`[LifeOS] transactions: API returned rows belonging to other users. Enable RLS in Supabase.`

The app will still filter to the current user on the client as a safety net, but you should enable RLS so the database enforces isolation.

## Why this happens

Tables created via SQL (or before RLS was added) do **not** have RLS enabled by default. The policies in `20250205000000_add_auth_user_id_and_rls.sql` only take effect **after** RLS is enabled on each table. Until then, the API returns all rows to every user.
