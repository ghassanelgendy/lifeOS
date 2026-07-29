// Lightweight IndexedDB helper for local-first storage.
// We keep this deliberately small and focused on the tables we care about.
// No deprecated WebSQL / appCache — only modern IndexedDB APIs.

const DB_NAME = 'lifeos-indexeddb';
const DB_VERSION = 5;

const STORES = {
  tasks: 'tasks',
  taskLists: 'task_lists',
  tags: 'tags',
  transactions: 'transactions',
  sleepStages: 'sleep_stages',
  inbodyScans: 'inbody_scans',
  offlineQueue: 'offline_queue',
  pointsTransactions: 'points_transactions',
  customRewards: 'custom_rewards',
  habits: 'habits',
  habitLogs: 'habit_logs',
  prayerHabits: 'prayer_habits',
  prayerLogs: 'prayer_logs',
  calendarEvents: 'calendar_events',
  screentimeAppStats: 'screentime_app_stats',
  screentimeWebsiteStats: 'screentime_website_stats',
  screentimeDailySummaries: 'screentime_daily_summaries',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  if (typeof indexedDB === 'undefined') {
    // In non-browser environments (SSR/tests) fall back to a no-op shim.
    dbPromise = Promise.reject(new Error('IndexedDB is not available in this environment'));
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Simple keyPath-based object stores; we filter by user_id in JS for now.
      if (!db.objectStoreNames.contains(STORES.tasks)) {
        db.createObjectStore(STORES.tasks, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.taskLists)) {
        db.createObjectStore(STORES.taskLists, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.tags)) {
        db.createObjectStore(STORES.tags, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.transactions)) {
        db.createObjectStore(STORES.transactions, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.sleepStages)) {
        db.createObjectStore(STORES.sleepStages, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.inbodyScans)) {
        db.createObjectStore(STORES.inbodyScans, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.offlineQueue)) {
        db.createObjectStore(STORES.offlineQueue, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.pointsTransactions)) {
        db.createObjectStore(STORES.pointsTransactions, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.customRewards)) {
        db.createObjectStore(STORES.customRewards, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.habits)) {
        db.createObjectStore(STORES.habits, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.habitLogs)) {
        db.createObjectStore(STORES.habitLogs, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.prayerHabits)) {
        db.createObjectStore(STORES.prayerHabits, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.prayerLogs)) {
        db.createObjectStore(STORES.prayerLogs, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.calendarEvents)) {
        db.createObjectStore(STORES.calendarEvents, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.screentimeAppStats)) {
        db.createObjectStore(STORES.screentimeAppStats, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.screentimeWebsiteStats)) {
        db.createObjectStore(STORES.screentimeWebsiteStats, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.screentimeDailySummaries)) {
        db.createObjectStore(STORES.screentimeDailySummaries, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => T | Promise<T>,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await fn(store);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
  return result;
}

// ---------- Generic helpers ----------

export async function idbGetAll<T = any>(storeName: StoreName): Promise<T[]> {
  try {
    return await withStore(storeName, 'readonly', (store) => {
      return new Promise<T[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'));
      });
    });
  } catch {
    // If IndexedDB is unavailable, just behave like empty storage.
    return [];
  }
}

export async function idbPut<T extends { id: string }>(storeName: StoreName, value: T): Promise<void> {
  try {
    await withStore(storeName, 'readwrite', (store) => {
      store.put(value);
    });
  } catch {
    // Swallow in production; local cache is best-effort.
  }
}

export async function idbPutMany<T extends { id: string }>(storeName: StoreName, values: T[]): Promise<void> {
  if (!values.length) return;
  try {
    await withStore(storeName, 'readwrite', (store) => {
      values.forEach((v) => store.put(v));
    });
  } catch {
    // best-effort
  }
}

export async function idbDelete(storeName: StoreName, id: string): Promise<void> {
  try {
    await withStore(storeName, 'readwrite', (store) => {
      store.delete(id);
    });
  } catch {
    // best-effort
  }
}

export async function idbClear(storeName: StoreName): Promise<void> {
  try {
    await withStore(storeName, 'readwrite', (store) => {
      store.clear();
    });
  } catch {
    // best-effort
  }
}

// ---------- Table-specific helpers ----------

// Tasks
export async function idbSaveTasks(tasks: any[]): Promise<void> {
  await idbClear(STORES.tasks);
  await idbPutMany(STORES.tasks, tasks);
}

export async function idbGetTasks(): Promise<any[]> {
  return idbGetAll(STORES.tasks);
}

// Task lists
export async function idbSaveTaskLists(lists: any[]): Promise<void> {
  await idbClear(STORES.taskLists);
  await idbPutMany(STORES.taskLists, lists);
}

// Tags
export async function idbSaveTags(tags: any[]): Promise<void> {
  await idbClear(STORES.tags);
  await idbPutMany(STORES.tags, tags);
}

// Transactions
export async function idbSaveTransactions(transactions: any[]): Promise<void> {
  await idbClear(STORES.transactions);
  await idbPutMany(STORES.transactions, transactions);
}

export async function idbGetTransactions(): Promise<any[]> {
  return idbGetAll(STORES.transactions);
}

// Sleep stages (merge by id so multiple range fetches accumulate)
export async function idbSaveSleepStages(stages: { id: string }[]): Promise<void> {
  const existing = await idbGetAll<{ id: string }>(STORES.sleepStages);
  const byId = new Map(existing.map((s) => [s.id, s]));
  stages.forEach((s) => byId.set(s.id, s));
  await idbClear(STORES.sleepStages);
  await idbPutMany(STORES.sleepStages, Array.from(byId.values()));
}

export async function idbGetSleepStages(): Promise<any[]> {
  return idbGetAll(STORES.sleepStages);
}

// InBody scans
export async function idbSaveInBodyScans(scans: { id: string }[]): Promise<void> {
  await idbClear(STORES.inbodyScans);
  await idbPutMany(STORES.inbodyScans, scans);
}

export async function idbGetInBodyScans(): Promise<any[]> {
  return idbGetAll(STORES.inbodyScans);
}

// Habits & Habit Logs
export async function idbSaveHabits(habits: any[]): Promise<void> {
  await idbClear(STORES.habits);
  await idbPutMany(STORES.habits, habits);
}

export async function idbGetHabits(): Promise<any[]> {
  return idbGetAll(STORES.habits);
}

export async function idbSaveHabitLogs(logs: { id: string }[]): Promise<void> {
  const existing = await idbGetAll<{ id: string }>(STORES.habitLogs);
  const byId = new Map(existing.map((l) => [l.id, l]));
  logs.forEach((l) => byId.set(l.id, l));
  await idbClear(STORES.habitLogs);
  await idbPutMany(STORES.habitLogs, Array.from(byId.values()));
}

export async function idbGetHabitLogs(): Promise<any[]> {
  return idbGetAll(STORES.habitLogs);
}

// Prayer Habits & Logs
export async function idbSavePrayerHabits(prayerHabits: any[]): Promise<void> {
  await idbClear(STORES.prayerHabits);
  await idbPutMany(STORES.prayerHabits, prayerHabits);
}

export async function idbGetPrayerHabits(): Promise<any[]> {
  return idbGetAll(STORES.prayerHabits);
}

export async function idbSavePrayerLogs(prayerLogs: { id: string }[]): Promise<void> {
  const existing = await idbGetAll<{ id: string }>(STORES.prayerLogs);
  const byId = new Map(existing.map((pl) => [pl.id, pl]));
  prayerLogs.forEach((pl) => byId.set(pl.id, pl));
  await idbClear(STORES.prayerLogs);
  await idbPutMany(STORES.prayerLogs, Array.from(byId.values()));
}

export async function idbGetPrayerLogs(): Promise<any[]> {
  return idbGetAll(STORES.prayerLogs);
}

// Calendar Events
export async function idbSaveCalendarEvents(events: any[]): Promise<void> {
  await idbClear(STORES.calendarEvents);
  await idbPutMany(STORES.calendarEvents, events);
}

export async function idbGetCalendarEvents(): Promise<any[]> {
  return idbGetAll(STORES.calendarEvents);
}

// Offline queue
export interface IdbQueueEntry {
  id: string;
  op: any;
  at: number;
}

export async function idbGetOfflineQueue(): Promise<IdbQueueEntry[]> {
  return idbGetAll<IdbQueueEntry>(STORES.offlineQueue);
}

export async function idbSetOfflineQueue(entries: IdbQueueEntry[]): Promise<void> {
  await idbClear(STORES.offlineQueue);
  await idbPutMany(STORES.offlineQueue, entries);
}

// Clear ALL IndexedDB stores (used on logout to prevent data leakage between users)
export async function idbClearAll(): Promise<void> {
  const stores: StoreName[] = [
    STORES.tasks,
    STORES.taskLists,
    STORES.tags,
    STORES.transactions,
    STORES.sleepStages,
    STORES.inbodyScans,
    STORES.offlineQueue,
    STORES.pointsTransactions,
    STORES.customRewards,
    STORES.habits,
    STORES.habitLogs,
    STORES.prayerHabits,
    STORES.prayerLogs,
    STORES.calendarEvents,
    STORES.screentimeAppStats,
    STORES.screentimeWebsiteStats,
    STORES.screentimeDailySummaries,
  ];
  
  // Clear all stores in parallel
  await Promise.all(stores.map((store) => idbClear(store)));
}

// Screentime stats helpers
export async function idbSaveScreentimeAppStats(stats: { id: string }[]): Promise<void> {
  const existing = await idbGetAll<{ id: string }>(STORES.screentimeAppStats);
  const byId = new Map(existing.map((s) => [s.id, s]));
  stats.forEach((s) => byId.set(s.id, s));
  await idbClear(STORES.screentimeAppStats);
  await idbPutMany(STORES.screentimeAppStats, Array.from(byId.values()));
}

export async function idbGetScreentimeAppStats(): Promise<any[]> {
  return idbGetAll(STORES.screentimeAppStats);
}

export async function idbSaveScreentimeWebsiteStats(stats: { id: string }[]): Promise<void> {
  const existing = await idbGetAll<{ id: string }>(STORES.screentimeWebsiteStats);
  const byId = new Map(existing.map((s) => [s.id, s]));
  stats.forEach((s) => byId.set(s.id, s));
  await idbClear(STORES.screentimeWebsiteStats);
  await idbPutMany(STORES.screentimeWebsiteStats, Array.from(byId.values()));
}

export async function idbGetScreentimeWebsiteStats(): Promise<any[]> {
  return idbGetAll(STORES.screentimeWebsiteStats);
}

export async function idbSaveScreentimeDailySummaries(summaries: { id: string }[]): Promise<void> {
  const existing = await idbGetAll<{ id: string }>(STORES.screentimeDailySummaries);
  const byId = new Map(existing.map((s) => [s.id, s]));
  summaries.forEach((s) => byId.set(s.id, s));
  await idbClear(STORES.screentimeDailySummaries);
  await idbPutMany(STORES.screentimeDailySummaries, Array.from(byId.values()));
}

export async function idbGetScreentimeDailySummaries(): Promise<any[]> {
  return idbGetAll(STORES.screentimeDailySummaries);
}

// Points transactions
export async function idbSavePointsTransactions(transactions: any[]): Promise<void> {
  await idbClear(STORES.pointsTransactions);
  await idbPutMany(STORES.pointsTransactions, transactions);
}

export async function idbGetPointsTransactions(): Promise<any[]> {
  return idbGetAll(STORES.pointsTransactions);
}

export async function idbAddPointsTransaction(transaction: any): Promise<void> {
  await idbPut(STORES.pointsTransactions, transaction);
}

// Custom rewards
export async function idbSaveCustomRewards(rewards: any[]): Promise<void> {
  await idbClear(STORES.customRewards);
  await idbPutMany(STORES.customRewards, rewards);
}

export async function idbGetCustomRewards(): Promise<any[]> {
  return idbGetAll(STORES.customRewards);
}

export async function idbAddCustomReward(reward: any): Promise<void> {
  await idbPut(STORES.customRewards, reward);
}

export async function idbDeleteCustomReward(id: string): Promise<void> {
  await idbDelete(STORES.customRewards, id);
}

