# Security Model: RLS vs Frontend Filtering

## ⚠️ CRITICAL: Frontend Filtering is NOT Security

**Frontend filtering is ONLY for UX/performance. Real security MUST come from RLS (Row Level Security) at the database level.**

## Why Frontend Filtering Alone is Dangerous

1. **Users can modify frontend code** - They can remove filters in browser DevTools
2. **Direct API access** - Users can call Supabase API directly, bypassing your frontend
3. **Malicious users** - Attackers can write scripts to access all data
4. **No enforcement** - Frontend code runs on the client, which users control

## The Correct Security Model

### ✅ Layer 1: Database-Level Security (RLS) - PRIMARY SECURITY
- **RLS policies** enforce security at the PostgreSQL level
- **Cannot be bypassed** by frontend code or direct API calls
- **Enforced by Supabase** before returning any data
- **This is your REAL security**

### ✅ Layer 2: Frontend Filtering - UX/DEFENSE-IN-DEPTH
- **Improves UX** - Faster queries, better caching
- **Defense in depth** - Extra layer if RLS misconfigured
- **NOT security** - Can be bypassed, but helps catch issues

## How RLS Works

When a user queries data:

1. **User authenticates** → Gets JWT token with `user_id`
2. **Frontend makes query** → Includes JWT token in request
3. **Supabase receives query** → Checks RLS policies BEFORE executing
4. **RLS policy evaluates** → `using (user_id = auth.uid())` filters rows
5. **Only matching rows returned** → User only sees their own data

**Even if frontend code is removed, RLS still enforces security.**

## Verifying RLS is Working

### Step 1: Check RLS is Enabled

Run this in Supabase SQL Editor:

```sql
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED ✓'
    ELSE 'RLS DISABLED ✗ - SECURITY RISK!'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('inbody_scans', 'transactions', 'tasks', 'habits', 'projects')
ORDER BY tablename;
```

**All tables MUST show "RLS ENABLED ✓"**

### Step 2: Check Policies are Correct

```sql
SELECT 
  tablename,
  policyname,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('inbody_scans', 'transactions', 'tasks')
ORDER BY tablename, policyname;
```

**Policies should have:**
- `using (user_id = auth.uid())` - Filters SELECT queries
- `with check (user_id = auth.uid())` - Validates INSERT/UPDATE

### Step 3: Test RLS Enforcement

**Test as User A:**
1. Log in as User A
2. Add some data (e.g., a transaction)
3. Note the `user_id` of User A

**Test as User B:**
1. Log in as User B (different account)
2. Try to query data directly via SQL Editor (authenticated as User B)
3. Run: `SELECT * FROM transactions;`
4. **You should ONLY see User B's transactions, NOT User A's**

If you see User A's data, **RLS is NOT working!**

### Step 4: Test Direct API Access

**Using curl or Postman:**

```bash
# Get User A's access token (from browser DevTools → Application → Local Storage → supabase.auth.token)
TOKEN_USER_A="your_user_a_token"

# Try to query as User A
curl -H "Authorization: Bearer $TOKEN_USER_A" \
  "https://YOUR_PROJECT.supabase.co/rest/v1/inbody_scans?select=*"

# Should ONLY return User A's data
```

**Then try with User B's token:**
- Should return DIFFERENT data (only User B's)
- Should NOT include User A's data

## What to Do If RLS Isn't Working

1. **Run the comprehensive RLS fix:**
   ```sql
   -- Run: supabase/migrations/20250220000001_fix_all_rls_comprehensive.sql
   ```

2. **Verify RLS is enabled:**
   ```sql
   -- Run: supabase/migrations/20250220000003_verify_rls_enforcement.sql
   ```

3. **Check for conflicting policies:**
   - Look for policies with `qual = true` or `NULL`
   - These allow unrestricted access and must be removed

4. **Ensure policies use `auth.uid()`:**
   - Policies must check `user_id = auth.uid()`
   - Not just `user_id IS NOT NULL` or similar

## Current Status

✅ **Frontend filtering added** - For UX and defense-in-depth
⚠️ **RLS must be verified** - Run verification queries above
✅ **IndexedDB cleared on logout** - Prevents data leakage

## Next Steps

1. **Run RLS verification queries** (see above)
2. **Test with two different user accounts**
3. **Verify direct API access is restricted**
4. **If RLS isn't working, run the comprehensive fix migration**

Remember: **Frontend filtering is nice-to-have, but RLS is MUST-HAVE for security.**
