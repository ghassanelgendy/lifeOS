# iOS Reminders Sync - Shortcuts Integration

This feature syncs LifeOS tasks with iOS Reminders using a Shortcuts workflow and a Supabase Edge Function.

There is no direct API connection. Sync works by:
- iOS -> LifeOS (push): Shortcuts sends reminders to LifeOS.
- LifeOS -> iOS (pull): Shortcuts pulls changed tasks and updates Reminders.

---

## 1) Edge Function

- URL: `https://<PROJECT_REF>.supabase.co/functions/v1/sync-reminders`
- Method: POST
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <SUPABASE_ANON_KEY_OR_ACCESS_TOKEN>`

Auth behavior:
- If bearer token is `SUPABASE_ANON_KEY`, request is accepted with `user_id` from body.
- If bearer token is a user access token, it is validated with Supabase Auth and must match `user_id`.

### Modes

#### A) push (iOS -> LifeOS)
```
{
  "mode": "push",
  "user_id": "YOUR_USER_UUID",
  "reminders": [
    {
      "id": "REMINDER_IDENTIFIER",
      "title": "Buy groceries",
      "notes": "Milk, eggs, bread",
      "due_date": "2026-02-27",
      "due_time": "18:00",
      "completed": false,
      "list": "Personal",
      "priority": 5,
      "updated_at": "2026-02-27T14:30:00Z"
    }
  ],
  "deleted_ids": ["REMINDER_IDENTIFIER_TO_DELETE"]
}
```

#### B) pull (LifeOS -> iOS)
```
{
  "mode": "pull",
  "user_id": "YOUR_USER_UUID",
  "since": "2026-02-27T00:00:00Z"
}
```

Response:
```
{
  "success": true,
  "server_time": "2026-02-27T14:42:11.000Z",
  "tasks": [
    {
      "id": "TASK_UUID",
      "title": "Pay rent",
      "description": "Bank transfer",
      "due_date": "2026-02-28",
      "due_time": "09:00:00",
      "is_completed": false,
      "priority": "high",
      "ios_reminder_id": null,
      "ios_reminder_list": null,
      "updated_at": "2026-02-27T14:40:00Z"
    }
  ]
}
```

#### C) ack (store iOS reminder ID after creation)
```
{
  "mode": "ack",
  "user_id": "YOUR_USER_UUID",
  "task_id": "TASK_UUID",
  "ios_reminder_id": "NEW_REMINDER_IDENTIFIER",
  "ios_reminder_list": "Personal",
  "ios_reminder_updated_at": "2026-02-27T14:44:00Z"
}
```

#### D) delete (iOS -> LifeOS)
```
{
  "mode": "delete",
  "user_id": "YOUR_USER_UUID",
  "deleted_ids": ["REMINDER_IDENTIFIER"]
}
```

---

## 2) Shortcuts Flow (Recommended)

### Shortcut 1 - Push Reminders to LifeOS
1. Find Reminders (list: all or selected list).
2. Build an array of dictionaries with keys:
   - `id`, `title`, `notes`, `due_date`, `due_time`, `completed`, `list`, `priority`, `updated_at`
3. POST to `sync-reminders` with mode `push`.

### Shortcut 2 - Pull LifeOS Changes
1. GET/POST to `sync-reminders` with mode `pull` (pass `since` from last run).
2. For each task:
   - If `ios_reminder_id` exists: find reminder by identifier and update fields.
   - If `ios_reminder_id` is null: create reminder, then call `ack` with `task_id` and the new identifier.

### Shortcut 3 - Optional Delete Sync
1. Track deleted reminders (for example by comparing lists).
2. POST to `sync-reminders` with mode `delete`.

---

## 3) LifeOS UI

Enable "Sync to iOS Reminders" on a task to include it in pull syncs.
Tasks created from iOS Reminders automatically set this flag.

---

## 4) Notes

- Two-way sync requires a periodic Shortcut automation.
- App deletions are not automatically sent to iOS in this MVP.
- Conflicts are resolved by timestamp; the newest update wins.
