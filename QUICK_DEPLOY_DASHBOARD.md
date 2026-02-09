# Quick Deploy via Supabase Dashboard (No CLI Needed)

Since Supabase CLI is not installed, you can deploy directly from the Dashboard:

## Steps:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Click **Create a new function**

3. **Create the Function**
   - **Function name:** `upload-screentime`
   - **Template:** Start from scratch (or any template, we'll replace it)

4. **Copy Function Code**
   - Open `supabase/functions/upload-screentime/index.ts` in your editor
   - Copy ALL the contents
   - Paste into the Dashboard editor (replace any template code)

5. **Deploy**
   - Click **Deploy** button
   - Wait for deployment to complete

6. **Test the Function**
   - After deployment, you'll see the function URL
   - It should be: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/upload-screentime`
   - You can test it from the Dashboard's "Invoke" tab

## Important Notes:

- The function will deploy even if the database tables don't exist yet
- It will fail at runtime if tables are missing, so make sure to run the migration first
- You can check function logs in the Dashboard if there are errors

## Next Steps:

After deployment, make sure to:
1. Create and run the database migration for screentime tables
2. Test the function with a sample payload
3. Update your C# app to call the function URL
