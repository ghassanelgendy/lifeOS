import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { isOnline, addToOfflineQueue } from '../lib/offlineSync';
import { v4 as uuidv4 } from 'uuid';
import {
  idbGetPointsTransactions,
  idbSavePointsTransactions,
  idbAddPointsTransaction,
  idbGetCustomRewards,
  idbSaveCustomRewards,
  idbAddCustomReward,
  idbDeleteCustomReward,
} from '../db/indexedDb';
import type { PointTransaction, CustomReward } from '../types/schema';

export const POINTS_TX_KEY = ['points-transactions'];
export const CUSTOM_REWARDS_KEY = ['custom-rewards'];

// Points Configuration Defaults
export interface PointsConfig {
  defaultTaskEarn: number;
  defaultHabitEarn: number;
  habitStreakMultiplier: number;
  taskRescueCost: number;
}

const CONFIG_KEY = 'lifeos_points_config';
const defaultPointsConfig: PointsConfig = {
  defaultTaskEarn: 10,
  defaultHabitEarn: 5,
  habitStreakMultiplier: 2,
  taskRescueCost: 100,
};

export function getPointsConfig(): PointsConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return { ...defaultPointsConfig, ...JSON.parse(stored) };
  } catch {}
  return defaultPointsConfig;
}

export function savePointsConfig(config: PointsConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

const START_DATE_LIMIT = '2026-07-01T00:00:00.000Z';

// Dynamic helper to check if a transaction falls within our July 1st, 2026 limit
export function isDateEligibleForPoints(dateStr: string | Date): boolean {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.getTime() >= new Date(START_DATE_LIMIT).getTime();
}

export function isTaskCompletedOnTime(task: { due_date?: string | null; due_time?: string | null; is_wont_do?: boolean }, completedAtStr?: string): boolean {
  if (task.is_wont_do) return false;
  if (!task.due_date) return true;
  
  const completedAt = completedAtStr ? new Date(completedAtStr) : new Date();
  const datePart = task.due_date.split('T')[0];
  let deadline: Date;
  
  if (task.due_time) {
    deadline = new Date(`${datePart}T${task.due_time.slice(0, 5)}:00`);
  } else {
    // No time set, deadline is end of that day (local time)
    deadline = new Date(`${datePart}T23:59:59`);
  }
  
  return completedAt <= deadline;
}

/**
 * Fetch and manage Point Transactions
 */
export function usePointsTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...POINTS_TX_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as PointTransaction[];

      if (!isOnline()) {
        const local = await idbGetPointsTransactions();
        return local.filter(tx => tx.user_id === user.id) as PointTransaction[];
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', START_DATE_LIMIT)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Merge local unsynced transactions with the remote synced database state
      const local = await idbGetPointsTransactions();
      const unsynced = local.filter((tx) => tx.user_id === user.id && !tx.is_synced);
      
      const merged = [
        ...unsynced,
        ...(data || []).map(tx => ({ ...tx, is_synced: true }))
      ];

      // Sort merged array by date descending
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Save synced state to local cache
      await idbSavePointsTransactions(merged);

      return merged as PointTransaction[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Get current points balance (local calculation based on transactions)
 */
export function usePointsBalance() {
  const { data: transactions } = usePointsTransactions();

  return useMemo(() => {
    if (!transactions) return 0;
    const balance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    return Math.round(balance * 10) / 10;
  }, [transactions]);
}

/**
 * Fetch and manage Custom Rewards
 */
export function useCustomRewards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...CUSTOM_REWARDS_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as CustomReward[];

      if (!isOnline()) {
        const local = await idbGetCustomRewards();
        return local.filter(r => r.user_id === user.id) as CustomReward[];
      }

      const { data, error } = await supabase
        .from('custom_rewards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      await idbSaveCustomRewards(data || []);
      return data as CustomReward[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Create custom reward
 */
export function useCreateCustomReward() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { title: string; cost: number; icon?: string }) => {
      if (!user?.id) throw new Error('Unauthenticated');

      const tempId = uuidv4();
      const payload = {
        id: tempId,
        user_id: user.id,
        title: input.title,
        cost: input.cost,
        icon: input.icon || null,
        created_at: new Date().toISOString(),
      };

      if (!isOnline()) {
        addToOfflineQueue({ entity: 'custom_rewards', op: 'create', payload });
        await idbAddCustomReward(payload);
        return payload as CustomReward;
      }

      const { data, error } = await supabase
        .from('custom_rewards')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as CustomReward;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_REWARDS_KEY });
    },
  });
}

/**
 * Delete custom reward
 */
export function useDeleteCustomReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'custom_rewards', op: 'delete', id });
        await idbDeleteCustomReward(id);
        return true;
      }

      const { error } = await supabase
        .from('custom_rewards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOM_REWARDS_KEY });
    },
  });
}

/**
 * Create local points transaction (used instantly by hooks/UI)
 */
export function useAddPointsTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { amount: number; description: string; reference_type?: string; reference_id?: string }) => {
      if (!user?.id) throw new Error('Unauthenticated');

      const tx: PointTransaction & { is_synced: boolean } = {
        id: uuidv4(),
        user_id: user.id,
        amount: input.amount,
        description: input.description,
        reference_type: input.reference_type || null,
        reference_id: input.reference_id || null,
        created_at: new Date().toISOString(),
        is_synced: false, // Keep local only until daily sync runs
      };

      // Add to local database instantly
      await idbAddPointsTransaction(tx);
      return tx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POINTS_TX_KEY });
    },
  });
}

/**
 * Redeem custom reward
 */
export function useRedeemReward() {
  const queryClient = useQueryClient();
  const addTx = useAddPointsTransaction();

  return useMutation({
    mutationFn: async (reward: CustomReward) => {
      const balance = queryClient.getQueryData<PointTransaction[]>([...POINTS_TX_KEY, reward.user_id])
        ?.reduce((sum, tx) => sum + tx.amount, 0) ?? 0;

      if (balance < reward.cost) {
        throw new Error('Insufficient points balance');
      }

      // Record negative transaction locally
      await addTx.mutateAsync({
        amount: -reward.cost,
        description: `Redeemed Reward: ${reward.title}`,
        reference_type: 'reward',
        reference_id: reward.id,
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POINTS_TX_KEY });
    },
  });
}

/**
 * Rescue overdue task
 */
export function useRescueTask() {
  const queryClient = useQueryClient();
  const addTx = useAddPointsTransaction();

  return useMutation({
    mutationFn: async (task: { id: string; title: string; user_id?: string }) => {
      const config = getPointsConfig();
      const balance = queryClient.getQueryData<PointTransaction[]>([...POINTS_TX_KEY, task.user_id])
        ?.reduce((sum, tx) => sum + tx.amount, 0) ?? 0;

      if (balance < config.taskRescueCost) {
        throw new Error('Insufficient points to rescue task');
      }

      // 1. Update task locally and/or online
      const todayStr = new Date().toISOString().split('T')[0];
      const payload = { due_date: todayStr };

      if (!isOnline()) {
        addToOfflineQueue({ entity: 'tasks', op: 'update', id: task.id, payload });
      } else {
        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', task.id);
        if (error) throw error;
      }

      // 2. Deduct points locally
      await addTx.mutateAsync({
        amount: -config.taskRescueCost,
        description: `Rescued Task: ${task.title}`,
        reference_type: 'rescue',
        reference_id: task.id,
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POINTS_TX_KEY });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Daily points synchronization worker
 * Uploads all unsynced points transactions to Supabase after 12 AM
 */
export function useDailyPointsSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id || !isOnline()) return;

    const runSync = async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const lastSyncKey = `points_last_sync_date_${user.id}`;
      const lastSyncDate = localStorage.getItem(lastSyncKey);

      // Skip if we already synced today
      if (lastSyncDate === todayStr) return;

      try {
        const local = await idbGetPointsTransactions();
        const unsynced = local.filter((tx) => tx.user_id === user.id && !tx.is_synced);

        if (unsynced.length > 0) {
          // Remove local helper properties before insert
          const payload = unsynced.map(({ is_synced, ...rest }: any) => ({
            ...rest,
            user_id: user.id,
          }));

          const { error } = await supabase
            .from('points_transactions')
            .insert(payload);

          if (error) throw error;

          // Update local status to synced
          const updated = local.map((tx) => 
            tx.user_id === user.id && !tx.is_synced ? { ...tx, is_synced: true } : tx
          );
          await idbSavePointsTransactions(updated);
        }

        localStorage.setItem(lastSyncKey, todayStr);
        queryClient.invalidateQueries({ queryKey: POINTS_TX_KEY });
      } catch (err) {
        console.error('Failed to execute daily points sync:', err);
      }
    };

    // Run sync on load and set up daily interval checks
    void runSync();

    const interval = setInterval(() => {
      void runSync();
    }, 60000 * 30); // Check every 30 minutes

    return () => clearInterval(interval);
  }, [user?.id, queryClient]);
}
