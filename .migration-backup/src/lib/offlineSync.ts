/**
 * Offline sync: persist mutations and flush pending changes when back online.
 * - When online: push (replay queued mutations) and React Query will refetch.
 * - When offline: mutations are queued and replayed when online.
 *
 * Queue storage is backed by IndexedDB (modern offline storage), not localStorage.
 */

import { supabase } from './supabase';
import { idbGetOfflineQueue, idbSetOfflineQueue, type IdbQueueEntry } from '../db/indexedDb';

let lastSyncAt: string | null = null;
const LAST_SYNC_KEY = 'lifeos_last_sync_at';

function loadLastSyncFromStorage() {
  if (lastSyncAt !== null) return;
  if (typeof window === 'undefined') return;
  try {
    const stored = window.localStorage.getItem(LAST_SYNC_KEY);
    if (stored) lastSyncAt = stored;
  } catch {
    // ignore
  }
}

export type QueuedOp =
  | { entity: 'tasks'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'tasks'; op: 'update'; id: string; payload: Record<string, unknown> }
  | { entity: 'tasks'; op: 'delete'; id: string }
  | { entity: 'task_lists'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'tags'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'habits'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'habits'; op: 'update'; id: string; payload: Record<string, unknown> }
  | { entity: 'habits'; op: 'delete'; id: string }
  | { entity: 'habit_logs'; op: 'upsert'; payload: Record<string, unknown> }
  | { entity: 'transactions'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'transactions'; op: 'update'; id: string; payload: Record<string, unknown> }
  | { entity: 'transactions'; op: 'delete'; id: string }
  | { entity: 'calendar_events'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'calendar_events'; op: 'update'; id: string; payload: Record<string, unknown> }
  | { entity: 'calendar_events'; op: 'delete'; id: string }
  | { entity: 'projects'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'projects'; op: 'update'; id: string; payload: Record<string, unknown> }
  | { entity: 'budgets'; op: 'upsert'; payload: Record<string, unknown> }
  | { entity: 'investment_transactions'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'investment_transactions'; op: 'update'; id: string; payload: Record<string, unknown> }
  | { entity: 'investment_transactions'; op: 'delete'; id: string }
  | { entity: 'inbody_scans'; op: 'create'; payload: Record<string, unknown> }
  | { entity: 'inbody_scans'; op: 'update'; id: string; payload: Record<string, unknown> }
  | { entity: 'inbody_scans'; op: 'delete'; id: string };

export function addToOfflineQueue(op: QueuedOp): void {
  // Fire-and-forget; best-effort persistence.
  void (async () => {
    const queue = await idbGetOfflineQueue();
    const entry: IdbQueueEntry = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      op,
      at: Date.now(),
    };
    queue.push(entry);
    await idbSetOfflineQueue(queue);
  })();
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === true;
}

async function replayOne(entry: IdbQueueEntry): Promise<void> {
  const { entity, op } = entry.op as QueuedOp & { entity: string; op: string };
  const table = entity;

  if (op === 'create' && 'payload' in entry.op) {
    const { error } = await supabase.from(table).insert(entry.op.payload as Record<string, unknown>).select().single();
    if (error) throw new Error(`${entity}.create: ${error.message}`);
    return;
  }

  if (op === 'update' && 'id' in entry.op && 'payload' in entry.op) {
    const { error } = await supabase.from(table).update(entry.op.payload).eq('id', entry.op.id);
    if (error) throw new Error(`${entity}.update: ${error.message}`);
    return;
  }

  if (op === 'delete' && 'id' in entry.op) {
    if (entity === 'habits') {
      const { error } = await supabase.from(table).update({ is_archived: true }).eq('id', entry.op.id);
      if (error) throw new Error(`${entity}.delete: ${error.message}`);
    } else {
      const { error } = await supabase.from(table).delete().eq('id', entry.op.id);
      if (error) throw new Error(`${entity}.delete: ${error.message}`);
    }
    return;
  }

  if (op === 'upsert' && 'payload' in entry.op) {
    const { error } = await supabase.from(table).upsert(entry.op.payload as Record<string, unknown>, { onConflict: 'id' });
    if (error) throw new Error(`${entity}.upsert: ${error.message}`);
    return;
  }
}

/** Process the offline queue (push to Supabase). Returns number of processed entries. */
export async function processOfflineQueue(
  onProgress?: (processed: number, total: number, error?: Error) => void
): Promise<{ processed: number; failed: number }> {
  const queue = await idbGetOfflineQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const remaining: IdbQueueEntry[] = [];

  for (let i = 0; i < queue.length; i++) {
    try {
      await replayOne(queue[i]);
      processed++;
      onProgress?.(processed, queue.length);
    } catch (e) {
      failed++;
      remaining.push(queue[i]);
      onProgress?.(processed, queue.length, e as Error);
    }
  }

  await idbSetOfflineQueue(remaining);
  if (processed > 0) {
    const nowIso = new Date().toISOString();
    lastSyncAt = nowIso;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LAST_SYNC_KEY, nowIso);
      } catch {
        // ignore
      }
    }
  }

  return { processed, failed };
}

export function getOfflineQueueLength(): number {
  // Synchronous length is not possible with IndexedDB; return best-effort snapshot.
  // Callers that care about exact length should query processOfflineQueue or idbGetOfflineQueue directly.
  // Here we return 0 until an async path is introduced in the UI.
  return 0;
}

export function getLastSyncAt(): string | null {
  loadLastSyncFromStorage();
  return lastSyncAt;
}

export async function getOfflineQueueLengthAsync(): Promise<number> {
  const queue = await idbGetOfflineQueue();
  return queue.length;
}

