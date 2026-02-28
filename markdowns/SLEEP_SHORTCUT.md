# Sleep Analysis – iOS Shortcut integration

Sleep stage data (Core, Deep, REM, Awake) is uploaded from an iOS Shortcut to the `upload-sleep` Supabase Edge Function. The app shows **Sleep** in the nav and displays analysis and quality on the Sleep page.

---

## 1. Edge function

- **URL**: `https://<PROJECT_REF>.supabase.co/functions/v1/upload-sleep`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json` and `Authorization: Bearer <ANON_OR_SERVICE_KEY>` (if you require auth).

**Body** (JSON) - **two formats supported**:

**Option 1: Array of segments**
```json
{
  "user_id": "YOUR_USER_UUID",
  "segments": [
    {
      "Started": "2026-02-14T05:17:00+02:00",
      "Ended": "2026-02-14T05:48:00+02:00",
      "Duration": 31,
      "Name": "Core"
    },
    {
      "Started": "2026-02-14T05:09:00+02:00",
      "Ended": "2026-02-14T05:17:00+02:00",
      "Duration": 8,
      "Name": "Deep"
    }
  ]
}
```

**Option 2: File content string** (if your file has comma-separated objects)
```json
{
  "user_id": "YOUR_USER_UUID",
  "file_content": "{\"Started\":\"2026-02-14T05:17:00+02:00\",\"Ended\":\"2026-02-14T05:48:00+02:00\",\"Duration\":31,\"Name\":\"Core\"},\n{\"Started\":\"2026-02-14T05:09:00+02:00\",\"Ended\":\"2026-02-14T05:17:00+02:00\",\"Duration\":8,\"Name\":\"Deep\"},"
}
```

The function automatically:
- Handles trailing commas
- Parses comma-separated JSON objects
- Handles newlines between objects

- **Started** / **Ended**: ISO 8601 timestamps (with timezone). Use Shortcut's "Format Date" → ISO 8601.
- **Duration**: number. Can be **minutes** (e.g. 31) or **seconds** (e.g. 1860). If > 1000, treated as seconds and auto-converted to minutes.
- **Name**: one of `Core`, `Deep`, `REM`, `Awake` (case-insensitive; others default to Core).

The function upserts by `(user_id, started_at)`, so re-uploading the same segment does not create duplicates.

---

## 2. Shortcut modifications

Your Shortcut currently appends segment objects to a file. To send data to LifeOS:

### Current format (what you append to file)

```json
{
  "Started": "2026-02-14T05:17:00+02:00",
  "Ended": "2026-02-14T05:48:00+02:00",
  "Duration": 31,
  "Name": "Core"
}
```

**Notes:**
- `Started` / `Ended`: Must be ISO 8601 timestamps (with timezone). Use Shortcut's "Format Date" → ISO 8601.
- `Duration`: Can be **minutes** (e.g. 31) or **seconds** (e.g. 1860). The function auto-detects: if > 1000, treats as seconds and converts to minutes.
- `Name`: One of `Core`, `Deep`, `REM`, `Awake` (case-insensitive; defaults to Core if invalid).

### Steps to upload

1. **Get your user ID**  
   In LifeOS app: Settings → your profile, or from Supabase Dashboard → Authentication → Users → your user → copy UUID.  
   Format: `12345678-1234-1234-1234-123456789abc`

2. **Choose upload method**:

   **Method A: Send file content directly** (easiest if your file has comma-separated objects)
   - Read your file content as text.
   - Build payload:
     ```json
     {
       "user_id": "YOUR_UUID_HERE",
       "file_content": "<entire file content as string>"
     }
     ```
   - The function will parse comma-separated JSON objects automatically (handles trailing commas).

   **Method B: Parse and send as array** (more control)
   - Read the file (all lines or recent blocks).
   - Parse each JSON object into a segment.
   - Collect all segments into an **array**.
   - Build payload:
     ```json
     {
       "user_id": "YOUR_UUID_HERE",
       "segments": [
         { "Started": "...", "Ended": "...", "Duration": 31, "Name": "Core" },
         { "Started": "...", "Ended": "...", "Duration": 8, "Name": "Deep" },
         ...
       ]
     }
     ```

4. **POST to Edge Function**  
   - Action: **Get Contents of URL** (or **Make HTTP Request**).
   - URL: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/upload-sleep`
   - Method: **POST**
   - Request Body: **JSON** (the payload from step 3)
   - Headers:
     - `Content-Type`: `application/json`
     - (Optional if function requires auth) `Authorization`: `Bearer <SUPABASE_ANON_KEY>`

5. **Handle response**  
   Success: `{ "success": true, "inserted": 25, "total": 25 }`  
   Error: `{ "success": false, "error": "...", "details": [...] }`  
   Check the response and show a notification if needed.

### Example Shortcut flow

**Method A: Send file content directly** (recommended if your file has comma-separated objects)

1. **Get Variable** → your LifeOS user UUID (store in a variable like `LifeOSUserID`).
2. **Get File** → read your sleep data file (get the entire content as text).
3. **Set Variable** → build payload dictionary:
   - `user_id` = `LifeOSUserID`
   - `file_content` = the file content from step 2
4. **Get Dictionary from Input** → convert the payload variable to JSON.
5. **Get Contents of URL**:
   - URL = `https://<PROJECT>.supabase.co/functions/v1/upload-sleep`
   - Method = POST
   - Request Body = the JSON from step 4
   - Headers = `Content-Type: application/json`

**Method B: Parse and send as array**

1. **Get Variable** → your LifeOS user UUID (store in a variable like `LifeOSUserID`).
2. **Get File** → read your sleep data file.
3. **Split Text** → split by newlines or your delimiter.
4. **Repeat with Each** → for each line:
   - **Get Dictionary from Input** → parse the JSON object.
   - **Add to Variable** → add to a `segments` array variable.
5. **Set Variable** → build final payload:
   - Dictionary with keys:
     - `user_id` = `LifeOSUserID`
     - `segments` = your `segments` array
6. **Get Dictionary from Input** → convert the payload variable to JSON.
7. **Get Contents of URL**:
   - URL = `https://<PROJECT>.supabase.co/functions/v1/upload-sleep`
   - Method = POST
   - Request Body = the JSON from step 6
   - Headers = `Content-Type: application/json`

### Troubleshooting

- **"No valid segments to insert"**: Check that `Started`/`Ended` are valid ISO timestamps. Use Shortcut's "Format Date" → ISO 8601.
- **"Invalid user_id format"**: Ensure it's a valid UUID (36 chars with hyphens).
- **Duration issues**: If your "Time Between Dates" returns seconds, that's fine—the function converts if > 1000.
- **Name not recognized**: Must be exactly `Core`, `Deep`, `REM`, or `Awake` (case-insensitive). Others default to Core.

---

## 3. Database

Table: **sleep_stages**

| Column             | Type      | Description                    |
|--------------------|-----------|--------------------------------|
| id                 | uuid      | PK                             |
| user_id            | uuid      | FK to auth.users               |
| started_at         | timestamptz | Segment start (ISO)         |
| ended_at           | timestamptz | Segment end (ISO)           |
| duration_minutes   | integer   | Length in minutes              |
| stage              | text      | 'Core' \| 'Deep' \| 'REM' \| 'Awake' |
| created_at         | timestamptz | Set on insert               |

- Unique constraint: `(user_id, started_at)` for upserts.
- RLS: users can only read/write their own rows.

---

## 4. App (Sleep page)

- **Route**: `/sleep`
- **Nav**: "Sleep" with moon icon.
- Shows for the last 14 days:
  - Summary cards: average sleep, Deep %, REM %, total Awake.
  - Stacked bar chart: minutes per night (Deep, REM, Core, Awake).
  - Per-night breakdown with a small stage bar and Deep/REM %.

No extra Shortcut steps are required beyond building the JSON and POSTing to `upload-sleep` as above.
