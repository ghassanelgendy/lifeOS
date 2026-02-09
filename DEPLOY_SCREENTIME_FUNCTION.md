# Deploying upload-screentime Edge Function

## Quick Deploy with npx supabase

### Step 1: Login to Supabase
```bash
npx supabase login
```
This will open your browser to authenticate. Follow the prompts.

### Step 2: Link Your Project
Get your project reference ID from: **Supabase Dashboard → Settings → General → Reference ID**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3: Deploy the Function
```bash
npx supabase functions deploy upload-screentime
```

## Alternative: Using Access Token

If you prefer using an access token (useful for CI/CD):

1. Get your access token from: https://supabase.com/dashboard/account/tokens

2. Set it as an environment variable:
```bash
# Windows PowerShell
$env:SUPABASE_ACCESS_TOKEN="your-access-token-here"

# Windows CMD
set SUPABASE_ACCESS_TOKEN=your-access-token-here

# Linux/Mac
export SUPABASE_ACCESS_TOKEN=your-access-token-here
```

3. Then deploy:
```bash
npx supabase functions deploy upload-screentime
```

## Verify Deployment

After deployment, check the function URL:
```bash
npx supabase functions list
```

Or check in Dashboard: **Edge Functions → upload-screentime**

## Common Issues & Solutions

### Issue 1: "Cannot find project ref"
**Solution:** Make sure you've linked the project:
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Issue 2: "Not logged in"
**Solution:**
```bash
npx supabase login
```

### Issue 3: "Function not found"
**Solution:** Make sure you're in the project root directory:
```bash
cd G:\Github\lifeOS\lifeOS
npx supabase functions deploy upload-screentime
```

### Issue 4: Database tables don't exist
**Note:** Make sure the migration has been run:
- Go to Supabase Dashboard → SQL Editor
- Run the migration: `supabase/migrations/20250210000000_screentime.sql`

## Check Function Logs

After deployment, check logs:
```bash
npx supabase functions logs upload-screentime
```

Or in Dashboard: **Edge Functions → upload-screentime → Logs**

## Test the Function

After deployment, test with curl (replace YOUR_PROJECT_REF and YOUR_ANON_KEY):

```bash
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/upload-screentime' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "user_id": "test-user-id",
    "platform": "windows",
    "source": "pc",
    "data": {
      "Years": {}
    }
  }'
```

## Alternative: Deploy via Supabase Dashboard

If CLI doesn't work, you can deploy via the Dashboard:

1. Go to **Supabase Dashboard → Edge Functions**
2. Click **"Create a new function"**
3. Name it `upload-screentime`
4. Copy the contents of `supabase/functions/upload-screentime/index.ts`
5. Paste into the editor
6. Click **"Deploy"**
