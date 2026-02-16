# iOS Screentime Sync Plan

## 1) Edge Function Contract

Use `supabase/functions/upload-screentime` with:

- `source: "mobile"`
- `platform: "ios"`
- `device_id`: a stable phone identifier (for example `iphone-15-pro`)
- `is_cumulative: true` for repeated uploads during the day

### Supported payload styles

1. Existing Chronos payload (`data.Years`, `daily_summaries`) still works unchanged.
2. New iOS-friendly payload:
- `snapshots[]` for one or many dates
- optional root-level single-date `apps[]`, `websites[]`, `items[]`
- optional `activity_summary` string (newline list like `App (1h 12m)`) if you only have Today’s text output.

## 2) Repeated Uploads Every 40 Minutes (Cumulative)

Send current cumulative totals for today. The function now uses monotonic max merge for cumulative mode, so out-of-order uploads will not reduce totals.

```json
{
  "user_id": "00000000-0000-0000-0000-000000000000",
  "device_id": "iphone-15-pro",
  "platform": "ios",
  "source": "mobile",
  "is_cumulative": true,
  "snapshots": [
    {
      "date": "2026-02-16",
      "apps": [
        { "app_name": "Instagram", "duration_minutes": 42, "session_count": 18 },
        { "app_name": "YouTube", "duration_minutes": 27, "session_count": 9 }
      ],
      "websites": [
        { "domain": "x.com", "duration_minutes": 11, "session_count": 5 },
        { "domain": "youtube.com", "duration_minutes": 7, "session_count": 3 }
      ],
      "total_switches": 163,
      "total_apps": 24
    }
  ]
}
```

## 3) Last-Month Backfill

You can send many days in one request by adding multiple `snapshots` entries.

```json
{
  "user_id": "00000000-0000-0000-0000-000000000000",
  "device_id": "iphone-15-pro",
  "platform": "ios",
  "source": "mobile",
  "is_cumulative": true,
  "snapshots": [
    {
      "date": "2026-01-01",
      "apps": [{ "app_name": "Safari", "duration_minutes": 95 }],
      "websites": [{ "domain": "reddit.com", "duration_minutes": 36 }],
      "total_switches": 210,
      "total_apps": 31
    },
    {
      "date": "2026-01-02",
      "apps": [{ "app_name": "Safari", "duration_minutes": 88 }],
      "websites": [{ "domain": "youtube.com", "duration_minutes": 41 }],
      "total_switches": 195,
      "total_apps": 29
    }
  ]
}
```

## 4) Frontend Graph Coverage

`src/routes/Screentime.tsx` now:

- adds `Last Month` period filter
- aggregates daily chart series by source buckets:
  - `Desktop` (pc/windows/macos/linux)
  - `Phone` (mobile/ios/android)
  - `Other`
- shows stacked daily usage and trend charts that include phone data automatically

## 5) Rollout Checklist

1. Deploy the updated edge function.
2. Update iOS Shortcut to send `is_cumulative: true` and `snapshots`.
3. Run one test upload for today.
4. Run backfill upload for last month.
5. Open Screen Time page and verify:
   - `Last Month` period shows values
   - charts include `Phone` series
   - totals/switches look cumulative (no double counting after repeated runs).
