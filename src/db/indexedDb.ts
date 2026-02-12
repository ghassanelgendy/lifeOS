// Lightweight IndexedDB helper for local-first storage.
// We keep this deliberately small and focused on the tables we care about.
// No deprecated WebSQL / appCache — only modern IndexedDB APIs.

/* eslint-disable @typescript-eslint/no-explicit-any */

const DB_NAME = 'lifeos-indexeddb';
const DB_VERSION = 1;

const STORES = {
  tasks: 'tasks',
  taskLists: 'task_lists',
  tags: 'tags',
  transactions: 'transactions',
  budgets: 'budgets',
  offlineQueue: 'offline_queue',
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
      if (!db.objectStoreNames.contains(STORES.budgets)) {
        db.createObjectStore(STORES.budgets, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.offlineQueue)) {
        db.createObjectStore(STORES.offlineQueue, { keyPath: 'id' });
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

// Budgets
export async function idbSaveBudgets(budgets: any[]): Promise<void> {
  await idbClear(STORES.budgets);
  await idbPutMany(STORES.budgets, budgets);
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

