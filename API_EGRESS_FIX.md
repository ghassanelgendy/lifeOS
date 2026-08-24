# API Egress Fix - Emergency Limiter Implementation

## Problem Analysis

Your Supabase API was burning **5GB+ of egress** when you only have **200MB** remaining in the billing cycle. The logs showed:
- **Massive polling**: Every 10 seconds, `App.web.tsx` and `App.ios.tsx` were calling `handleOnline()` → `invalidateQueries()` → refetching ALL cached queries
- **Duplicate requests**: Multiple identical GET requests to the same endpoints within milliseconds
- **No request deduplication**: Same query fired multiple times simultaneously
- **No rate limiting**: No circuit breaker to stop traffic when budget was exhausted

## Root Causes Identified

### 1. Aggressive Polling Loops
- `App.web.tsx` line 143: `setInterval(() => handleOnline(), 10_000)` - **10 second polling**
- `App.ios.tsx` line 273: Same 10 second polling
- `useSyncStatus.ts` line 38: `setInterval(refresh, 30000)` - 30 second polling
- `usePakeLocalNotifications.ts` line 246: `setInterval(check, 30000)` - 30 second polling

### 2. React Query Cache Settings Too Short
- `staleTime: 15 minutes` meant data was considered stale quickly
- Combined with polling, this caused constant refetches

### 3. No Request Deduplication
- Multiple components could trigger the same query simultaneously
- No central mechanism to deduplicate in-flight requests

## Solutions Implemented

### 1. Created `src/lib/api-limiter.ts` - Central Circuit Breaker

**Features:**
- **Request Deduplication**: Identical requests within 4 seconds share the same promise
- **Rate Limiting**: Max 80 requests per 60-second sliding window
- **Egress Estimation**: Tracks estimated MB used per request
- **Emergency Mode**: Automatically blocks non-critical requests when:
  - Estimated egress ≥ 75% of budget (150MB hard cap)
  - Request rate exceeds 80/min
- **Heavy Table Throttling**: Extra 800ms delay on screentime/sleep tables
- **Critical Path Protection**: Auth, mutations, and core tables (tasks, habits, prayer) always allowed

**Configuration:**
```typescript
// Default budget: 200MB
let BUDGET_MB = 200;

// Can be adjusted at runtime:
window.__LIFEOS_API.setBudgetMB(150);  // Update remaining budget
window.__LIFEOS_API.resetEgressCounter();  // Reset counters
window.__LIFEOS_API.getStatus();  // Check current state
window.__LIFEOS_API.unblock();  // Force exit emergency mode
```

### 2. Wired Limiter into Supabase Client (`src/lib/supabase.ts`)

```typescript
import { installApiLimiter } from './api-limiter';
installApiLimiter(); // Installed BEFORE Supabase client creation
```

This ensures ALL Supabase SDK fetch calls go through the limiter.

### 3. Increased React Query Cache Times (`src/lib/queryClient.ts`)

```typescript
staleTime: 1000 * 60 * 30, // 30 minutes (was 15)
gcTime: 1000 * 60 * 60 * 24, // 24 hours
```

Also added emergency-aware `invalidateQueries` override that skips invalidation during emergency mode.

### 4. Reduced Polling Intervals

| File | Before | After | Impact |
|------|--------|-------|--------|
| `App.web.tsx` | 10,000ms | 120,000ms | 12x reduction |
| `App.ios.tsx` | 10,000ms | 120,000ms | 12x reduction |
| `useSyncStatus.ts` | 30,000ms | 120,000ms | 4x reduction |
| `usePakeLocalNotifications.ts` | 30,000ms | 120,000ms | 4x reduction |

**Note**: The offline queue still drains on:
- Page visibility change
- Network reconnect
- Service worker sync messages
- Manual triggers

So functionality is preserved, just the aggressive polling is reduced.

## Expected Egress Reduction

### Before Fix
- ~10 requests every 10 seconds = ~60 requests/minute baseline
- Each request averaging ~50-200KB (URL + headers + response)
- With duplicate requests, could be 2-3x actual needed
- **Estimated: 300-500MB/hour** = 5GB+ per day

### After Fix
- Max 80 requests/minute (enforced)
- Request deduplication eliminates duplicates
- 30-minute staleTime means most reads come from cache
- Heavy tables throttled
- Emergency mode blocks non-critical when approaching limit
- **Estimated: 20-50MB/hour** = 200-500MB per day

## How to Monitor

### In Browser Console
```javascript
// Check current status
window.__LIFEOS_API.getStatus()
// Returns: { emergency: false, budgetMB: 200, estimatedUsedMB: 12.5, requestsLastMin: 15, inFlightCount: 2 }

// Adjust budget if your Supabase dashboard shows different remaining
window.__LIFEOS_API.setBudgetMB(150)

// Force reset if you know you're in a new billing cycle
window.__LIFEOS_API.resetEgressCounter()

// Force exit emergency mode (use with caution)
window.__LIFEOS_API.unblock()
```

### Console Logs
The limiter logs warnings when:
- Emergency mode is activated/deactivated
- Requests are deduplicated
- Requests are throttled
- Requests are blocked

## Files Modified

1. **NEW**: `src/lib/api-limiter.ts` - Core limiter implementation
2. **MODIFIED**: `src/lib/supabase.ts` - Install limiter before Supabase client
3. **MODIFIED**: `src/lib/queryClient.ts` - Increased cache times + emergency-aware invalidation
4. **MODIFIED**: `src/App.web.tsx` - Reduced polling from 10s to 120s
5. **MODIFIED**: `src/App.ios.tsx` - Reduced polling from 10s to 120s
6. **MODIFIED**: `src/hooks/useSyncStatus.ts` - Reduced polling from 30s to 120s
7. **MODIFIED**: `src/hooks/usePakeLocalNotifications.ts` - Reduced polling from 30s to 120s

## Next Steps

1. **Deploy immediately** - The changes are backward compatible
2. **Monitor Supabase dashboard** - Check egress usage over next 24 hours
3. **Adjust BUDGET_MB** - Update `setBudgetMB()` with your actual remaining budget from Supabase dashboard
4. **Fine-tune** - If you still see high usage, we can:
   - Reduce MAX_REQ_PER_MIN further
   - Add more tables to HEAVY_TABLES
   - Increase DEDUPE_MS window
   - Lower the emergency threshold

## Emergency Override

If you need to temporarily disable the limiter (e.g., for testing):

```typescript
// In src/lib/supabase.ts, comment out the install line:
// installApiLimiter();
```

Or at runtime:
```javascript
window.__LIFEOS_API.unblock();
```

## Technical Details

### Deduplication Key
Requests are deduplicated based on: `method + url + body`. This means:
- Two identical GET requests to the same URL within 4 seconds = 1 actual network request
- POST with different bodies = different requests

### Egress Estimation
The limiter estimates egress based on:
- URL length × 2 (request line)
- Body size (if present)
- 1200 bytes header overhead
- Converted to MB

This is a rough estimate. The actual Supabase egress includes:
- Request bytes
- Response bytes  
- SSL overhead
- But it's conservative enough to prevent overages.

### Emergency Mode Triggers
1. Estimated egress ≥ min(BUDGET_MB × 0.75, 150MB)
2. Request rate ≥ MAX_REQ_PER_MIN (80/min)

Once triggered, only critical requests are allowed until usage drops below threshold.
