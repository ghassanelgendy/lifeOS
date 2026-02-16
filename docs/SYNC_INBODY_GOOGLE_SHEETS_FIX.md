# Fix: sync-inbody "Missing authorization header" (401)

## Root cause

Supabase's API gateway requires an `Authorization: Bearer <key>` header on **all** Edge Function requests. This check runs **before** your function code. Even with `verify_jwt = false`, the gateway still expects the header to be present.

Your function correctly uses `x-sync-token` for custom auth, but the gateway never lets the request through because `Authorization` is missing.

## Solution

Add the **Supabase anon key** as the `Authorization` header. The anon key is the public key from Supabase Dashboard → Settings → API → "anon" "public". Your `x-sync-token` still enforces real security inside the function.

---

## 1. Add Script Property

In your Google Sheet: **Extensions → Apps Script → Project Settings (gear icon) → Script Properties**, add:

| Property     | Value                              |
|-------------|-------------------------------------|
| `ANON_KEY`  | Your Supabase anon key (starts with `eyJ...`) |

Find it in: **Supabase Dashboard → Project Settings → API → Project API keys → anon public**

---

## 2. Update `syncInbodyToSupabase` and `callEdgeFunction`

Replace your current `syncInbodyToSupabase` and `callEdgeFunction` with this:

```javascript
function syncInbodyToSupabase() {
  const props = PropertiesService.getScriptProperties();

  // ===== REQUIRED SCRIPT PROPERTIES =====
  const SUPABASE_URL = props.getProperty("SUPABASE_URL"); // https://xxxx.supabase.co
  const EDGE_FUNCTION_PATH = props.getProperty("EDGE_FUNCTION_PATH") || "/functions/v1/sync-inbody";
  const SYNC_TOKEN = props.getProperty("SYNC_TOKEN"); // same as Supabase secret SYNC_TOKEN
  const ANON_KEY = props.getProperty("ANON_KEY");     // Supabase anon key (required by gateway)
  const USER_ID = props.getProperty("USER_ID");       // auth.users uuid
  const SHEET_NAME = props.getProperty("SHEET_NAME") || SpreadsheetApp.getActiveSheet().getName();

  if (!SUPABASE_URL || !SYNC_TOKEN || !USER_ID || !ANON_KEY) {
    throw new Error("Missing Script Properties: SUPABASE_URL, SYNC_TOKEN, USER_ID, ANON_KEY");
  }

  // ... rest of your existing syncInbodyToSupabase logic unchanged ...
  // When you call the edge function, pass ANON_KEY:

  const url = SUPABASE_URL + EDGE_FUNCTION_PATH;
  callEdgeFunction(url, SYNC_TOKEN, ANON_KEY, USER_ID, records);

  props.setProperty("LAST_SYNCED_COL", String(maxSyncedCol));
  Logger.log(`Synced ${records.length} record(s). LAST_SYNCED_COL=${maxSyncedCol}`);
}

function callEdgeFunction(url, syncToken, anonKey, userId, records) {
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ user_id: userId, records }),
    headers: {
      "Authorization": "Bearer " + anonKey,   // Required by Supabase gateway
      "x-sync-token": syncToken,              // Your custom auth (used by function)
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Edge Function error ${code}: ${res.getContentText()}`);
  }
}
```

---

## Summary of headers

| Header            | Purpose                                      |
|-------------------|-----------------------------------------------|
| `Authorization: Bearer <ANON_KEY>` | Lets Supabase gateway accept the request |
| `x-sync-token: <SYNC_TOKEN>`       | Your function validates this for auth      |

The anon key is safe to use client-side; your `x-sync-token` remains the actual security.
