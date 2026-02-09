/**
 * Offline sync: persist React Query cache and flush pending changes when back online.
 * - When online: pull (refetch) and push (replay queued mutations).
 * - When offline: reads come from persisted cache; mutations are queued and replayed when online.
 */

import { supabase } from './supabase';

const OFFLINE_QUEUE_KEY = 'lifeos_offline_queue';

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
  | { entity: 'investment_transactions'; op: 'delete'; id: string };

interface QueueEntry {
  id: string;
  op: QueuedOp;
  at: number;
}

function getQueue(): QueueEntry[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setQueue(queue: QueueEntry[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue', e);
  }
}

export function addToOfflineQueue(op: QueuedOp): void {
  const queue = getQueue();
  queue.push({
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    op,
    at: Date.now(),
  });
  setQueue(queue);
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === true;
}

async function replayOne(entry: QueueEntry): Promise<void> {
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
  const queue = getQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const remaining: QueueEntry[] = [];

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

  setQueue(remaining);
  return { processed, failed };
}

export function getOfflineQueueLength(): number {
  return getQueue().length;
}
