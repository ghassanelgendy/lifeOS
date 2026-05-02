import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import type {
  InvestmentAccount,
  InvestmentTransaction,
  CreateInput,
  UpdateInput,
} from '../types/schema';
import { useAuth } from '../contexts/AuthContext';

const INVESTMENT_ACCOUNTS_KEY = ['investment_accounts'];
const INVESTMENT_TRANSACTIONS_KEY = ['investment_transactions'];

const DEFAULT_ACCOUNTS = ['Thndr', 'Fawry'];

function filterToCurrentUser<T extends { user_id?: string | null }>(
  data: T[],
  currentUserId: string,
  entityName: string
): T[] {
  const own = data.filter((row) => row.user_id == null || row.user_id === currentUserId);
  if (own.length !== data.length) {
    console.error(`[LifeOS] ${entityName}: API returned rows belonging to other users. Enable RLS.`);
  }
  return own;
}

// Investment Accounts
export function useInvestmentAccounts() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: [...INVESTMENT_ACCOUNTS_KEY, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_accounts')
        .select('*')
        .order('name');
      if (error) throw error;
      const list = (data ?? []) as (InvestmentAccount & { user_id?: string | null })[];
      return userId ? (filterToCurrentUser(list, userId, 'investment_accounts') as InvestmentAccount[]) : list;
    },
    enabled: !!user?.id,
  });
}

export function useEnsureDefaultInvestmentAccounts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      for (const name of DEFAULT_ACCOUNTS) {
        const { error } = await supabase.from('investment_accounts').insert({ name });
        if (error && error.code !== '23505') throw error; // ignore unique violation
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVESTMENT_ACCOUNTS_KEY });
    },
  });
}

// Investment Transactions
export function useInvestmentTransactions() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: [...INVESTMENT_TRANSACTIONS_KEY, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_transactions')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as (InvestmentTransaction & { user_id?: string | null })[];
      return userId
        ? (filterToCurrentUser(list, userId, 'investment_transactions') as InvestmentTransaction[])
        : list;
    },
    enabled: !!user?.id,
  });
}

export function useCreateInvestmentTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateInput<InvestmentTransaction>) => {
      if (!isOnline()) {
        addToOfflineQueue({
          entity: 'investment_transactions',
          op: 'create',
          payload: input as Record<string, unknown>,
        });
        const now = new Date().toISOString();
        const optimistic: InvestmentTransaction = {
          ...input,
          id: `offline-itx-${Date.now()}`,
          created_at: now,
          updated_at: now,
        } as InvestmentTransaction;
        queryClient.setQueryData([...INVESTMENT_TRANSACTIONS_KEY, user?.id], (old: InvestmentTransaction[] | undefined) => [
          optimistic,
          ...(old ?? []),
        ]);
        return optimistic;
      }
      const { data, error } = await supabase
        .from('investment_transactions')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as InvestmentTransaction;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: INVESTMENT_TRANSACTIONS_KEY });
    },
  });
}

export function useUpdateInvestmentTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<InvestmentTransaction> }) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'investment_transactions', op: 'update', id, payload: data as Record<string, unknown> });
        queryClient.setQueryData(
          [...INVESTMENT_TRANSACTIONS_KEY, user?.id],
          (old: InvestmentTransaction[] | undefined) =>
            (old ?? []).map((t) => (t.id === id ? { ...t, ...data } : t))
        );
        const prev = (queryClient.getQueryData([...INVESTMENT_TRANSACTIONS_KEY, user?.id]) as InvestmentTransaction[] | undefined)?.find(
          (t) => t.id === id
        );
        return { ...prev, ...data, id } as InvestmentTransaction;
      }
      const { data: updated, error } = await supabase
        .from('investment_transactions')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated as InvestmentTransaction;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: INVESTMENT_TRANSACTIONS_KEY });
    },
  });
}

export function useDeleteInvestmentTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'investment_transactions', op: 'delete', id });
        queryClient.setQueryData(
          [...INVESTMENT_TRANSACTIONS_KEY, user?.id],
          (old: InvestmentTransaction[] | undefined) => (old ?? []).filter((t) => t.id !== id)
        );
        return true;
      }
      const { error } = await supabase.from('investment_transactions').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: INVESTMENT_TRANSACTIONS_KEY });
    },
  });
}

export function getInvestmentBreakdown(transactions: InvestmentTransaction[]) {
  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach((t) => {
    if (t.type === 'income') totalIncome += Number(t.amount);
    else totalExpense += Number(t.amount);
  });
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}
