/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import type { Transaction, Budget, CreateInput, UpdateInput, TransactionCategory } from '../types/schema';
import { round1 } from '../lib/utils';

const TRANSACTIONS_KEY = ['transactions'];
const BUDGETS_KEY = ['budgets'];

// Transactions
export function useTransactions() {
  return useQuery({
    queryKey: TRANSACTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

export function useTransactionsByRange(start: string, end: string) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, 'range', start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!start && !!end,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<Transaction>) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'transactions', op: 'create', payload: input as Record<string, unknown> });
        const now = new Date().toISOString();
        const optimistic: Transaction = { ...input, id: `offline-tx-${Date.now()}`, created_at: now, updated_at: now } as Transaction;
        queryClient.setQueryData(TRANSACTIONS_KEY, (old: Transaction[] | undefined) => [optimistic, ...(old ?? [])]);
        return optimistic;
      }
      const { data, error } = await supabase.from('transactions').insert(input).select().single();
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Transaction> }) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'transactions', op: 'update', id, payload: data as Record<string, unknown> });
        queryClient.setQueryData(TRANSACTIONS_KEY, (old: Transaction[] | undefined) =>
          (old ?? []).map((t) => (t.id === id ? { ...t, ...data } : t))
        );
        const prev = (queryClient.getQueryData(TRANSACTIONS_KEY) as Transaction[] | undefined)?.find((t) => t.id === id);
        return { ...prev, ...data, id } as Transaction;
      }
      const { data: updated, error } = await supabase.from('transactions').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated as Transaction;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'transactions', op: 'delete', id });
        queryClient.setQueryData(TRANSACTIONS_KEY, (old: Transaction[] | undefined) => (old ?? []).filter((t) => t.id !== id));
        return true;
      }
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    },
  });
}

// Budgets
export function useBudgets() {
  return useQuery({
    queryKey: BUDGETS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('budgets').select('*');
      if (error) throw error;
      return data as Budget[];
    },
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ category, monthlyLimit }: { category: TransactionCategory; monthlyLimit: number }) => {
      // Upsert based on category
      const { data, error } = await supabase
        .from('budgets')
        .upsert({ category, monthly_limit: monthlyLimit }, { onConflict: 'category' })
        .select()
        .single();
      if (error) throw error;
      return data as Budget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: TransactionCategory) => {
      const { error } = await supabase.from('budgets').delete().eq('category', category);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY });
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

  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, 'summary', targetYear, targetMonth],
    queryFn: async () => {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

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
  });
}

// Category breakdown for current month
export function useCategoryBreakdown() {
  const { data: transactions = [] } = useTransactions();

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
