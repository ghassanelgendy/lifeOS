/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import type { Transaction, Budget, CreateInput, UpdateInput, TransactionCategory } from '../types/schema';
import { round1 } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const TRANSACTIONS_KEY = ['transactions'];
const BUDGETS_KEY = ['budgets'];

function transactionsKey(userId: string | undefined) {
  return [...TRANSACTIONS_KEY, userId] as const;
}

/** Invalidate transactions queries when the table changes or when the app becomes visible (so expenses update). */
export function useTransactionsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
        }
      )
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === 'visible') queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id, queryClient]);
}
function budgetsKey(userId: string | undefined) {
  return [...BUDGETS_KEY, userId] as const;
}

// Safety: if RLS is not enabled, the API can return other users' rows. Filter to current user and warn.
function filterToCurrentUser<T extends { user_id?: string | null }>(
  data: T[],
  currentUserId: string,
  entityName: string
): T[] {
  const own = data.filter((row) => row.user_id == null || row.user_id === currentUserId);
  if (own.length !== data.length) {
    console.error(
      `[LifeOS] ${entityName}: API returned rows belonging to other users. Enable RLS in Supabase. See supabase/migrations/20250205100000_enable_rls_on_tables.sql`
    );
  }
  return own;
}

// Transactions
export function useTransactions() {
  const { user } = useAuth();
  const key = transactionsKey(user?.id);
  const userId = user?.id;
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (userId) q.eq('user_id', userId);
      const { data, error } = await q;
      if (error) throw error;
      const list = (data ?? []) as (Transaction & { user_id?: string | null })[];
      return userId ? (filterToCurrentUser(list, userId, 'transactions') as Transaction[]) : list;
    },
    enabled: !!user?.id,
  });
}

export function useTransactionsByRange(start: string, end: string) {
  const { user } = useAuth();
  const key = transactionsKey(user?.id);
  const userId = user?.id;
  return useQuery({
    queryKey: [...key, 'range', start, end],
    queryFn: async () => {
      const q = supabase
        .from('transactions')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (userId) q.eq('user_id', userId);
      const { data, error } = await q;
      if (error) throw error;
      const list = (data ?? []) as (Transaction & { user_id?: string | null })[];
      return userId ? (filterToCurrentUser(list, userId, 'transactions (range)') as Transaction[]) : list;
    },
    enabled: !!user?.id && !!start && !!end,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = transactionsKey(user?.id);

  return useMutation({
    mutationFn: async (input: CreateInput<Transaction>) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'transactions', op: 'create', payload: input as Record<string, unknown> });
        const now = new Date().toISOString();
        const optimistic: Transaction = { ...input, id: `offline-tx-${Date.now()}`, created_at: now, updated_at: now } as Transaction;
        queryClient.setQueryData(key, (old: Transaction[] | undefined) => [optimistic, ...(old ?? [])]);
        return optimistic;
      }
      const { data, error } = await supabase.from('transactions').insert(input).select().single();
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = transactionsKey(user?.id);

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Transaction> }) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'transactions', op: 'update', id, payload: data as Record<string, unknown> });
        queryClient.setQueryData(key, (old: Transaction[] | undefined) =>
          (old ?? []).map((t) => (t.id === id ? { ...t, ...data } : t))
        );
        const prev = (queryClient.getQueryData(key) as Transaction[] | undefined)?.find((t) => t.id === id);
        return { ...prev, ...data, id } as Transaction;
      }
      const upd = supabase.from('transactions').update(data).eq('id', id);
      if (user?.id) upd.eq('user_id', user.id);
      const { data: updated, error } = await upd.select().single();
      if (error) throw error;
      return updated as Transaction;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = transactionsKey(user?.id);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'transactions', op: 'delete', id });
        queryClient.setQueryData(key, (old: Transaction[] | undefined) => (old ?? []).filter((t) => t.id !== id));
        return true;
      }
      const del = supabase.from('transactions').delete().eq('id', id);
      if (user?.id) del.eq('user_id', user.id);
      const { error } = await del;
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// Budgets
export function useBudgets() {
  const { user } = useAuth();
  const key = budgetsKey(user?.id);
  const userId = user?.id;
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('budgets').select('*');
      if (error) throw error;
      const list = (data ?? []) as (Budget & { user_id?: string | null })[];
      return userId ? (filterToCurrentUser(list, userId, 'budgets') as Budget[]) : list;
    },
    enabled: !!user?.id,
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = budgetsKey(user?.id);

  return useMutation({
    mutationFn: async ({ category, monthlyLimit }: { category: TransactionCategory; monthlyLimit: number }) => {
      // Upsert based on category
      const { data, error } = await supabase
        .from('budgets')
        .upsert({ category, monthly_limit: monthlyLimit }, { onConflict: 'user_id,category' })
        .select()
        .single();
      if (error) throw error;
      return data as Budget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = budgetsKey(user?.id);

  return useMutation({
    mutationFn: async (category: TransactionCategory) => {
      const { error } = await supabase.from('budgets').delete().eq('category', category);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// Financial Summary
export function useFinancialSummary(year?: number, month?: number) {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth() + 1;

  // Construct date range for the month
  const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

  const { user } = useAuth();
  const key = transactionsKey(user?.id);
  const userId = user?.id;

  return useQuery({
    queryKey: [...key, 'summary', targetYear, targetMonth],
    queryFn: async () => {
      const q = supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);
      if (userId) q.eq('user_id', userId);
      const { data: raw, error } = await q;

      if (error) throw error;
      const transactions = userId
        ? filterToCurrentUser(
            (raw ?? []) as (Transaction & { user_id?: string | null })[],
            userId,
            'transactions (summary)'
          )
        : (raw ?? []);

      let totalIncome = 0;
      let totalExpenses = 0;

      transactions.forEach(t => {
        if (t.type === 'income') totalIncome += Number(t.amount);
        if (t.type === 'expense') totalExpenses += Number(t.amount);
      });

      return {
        income: round1(totalIncome),
        expenses: round1(totalExpenses),
        savings: round1(totalIncome - totalExpenses),
        savingsRate: totalIncome > 0 ? round1(((totalIncome - totalExpenses) / totalIncome) * 100) : 0
      };
    },
    enabled: !!user?.id,
  });
}

// Category breakdown for current month (optionally from a pre-filtered list)
function computeBreakdownFromTransactions(transactions: Transaction[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const expensesByCategory: Record<string, number> = {};
  const incomeByCategory: Record<string, number> = {};

  monthlyTransactions.forEach((t) => {
    if (t.type === 'expense') {
      expensesByCategory[t.category] = round1((expensesByCategory[t.category] || 0) + Number(t.amount));
    } else {
      incomeByCategory[t.category] = round1((incomeByCategory[t.category] || 0) + Number(t.amount));
    }
  });

  const totalExpenses = round1(Object.values(expensesByCategory).reduce((a, b) => a + b, 0));
  const totalIncome = round1(Object.values(incomeByCategory).reduce((a, b) => a + b, 0));

  return {
    expensesByCategory,
    incomeByCategory,
    totalExpenses,
    totalIncome,
    balance: round1(totalIncome - totalExpenses),
    transactions: monthlyTransactions,
  };
}

/** Breakdown from a given list (e.g. filtered by bank). Use for bank-scoped stats. */
export function getBreakdownFromTransactions(transactions: Transaction[]) {
  return computeBreakdownFromTransactions(transactions);
}

// Category breakdown for current month (all transactions)
export function useCategoryBreakdown() {
  const { data: transactions = [] } = useTransactions();
  return computeBreakdownFromTransactions(transactions);
}

// Budget vs Actual spending
export function useBudgetStatus() {
  const { data: budgets = [] } = useBudgets();
  const { expensesByCategory } = useCategoryBreakdown();

  return budgets.map((budget) => {
    const spent = expensesByCategory[budget.category] || 0;
    const remaining = round1(budget.monthly_limit - spent);
    const percentUsed = round1((spent / budget.monthly_limit) * 100);

    return {
      ...budget,
      spent,
      remaining,
      percentUsed,
      isOverBudget: spent > budget.monthly_limit,
    };
  });
}
