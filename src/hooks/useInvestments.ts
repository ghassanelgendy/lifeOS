import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import type {
  InvestmentAccount,
  InvestmentTransaction,
  CreateInput,
  UpdateInput,
} from '../types/schema';
import { useAuth } from './useAuth';

const INVESTMENT_ACCOUNTS_KEY = ['investment_accounts'];
const INVESTMENT_TRANSACTIONS_KEY = ['investment_transactions'];

const DEFAULT_ACCOUNTS = ['Thndr', 'Fawry'];

/**
 * Investment-specific transaction types, stored in the already-existing `transaction_type`
 * column (previously unused by investments). Each maps to a cash `type`/`direction` plus a
 * default category: Deposit/Withdrawal move cash in or out of the platform; Profit/Loss mark
 * gains or losses on the position itself; Correction reconciles the recorded balance to the
 * platform's real balance (mirrors the bank "Correction Transaction" pattern in Finance).
 */
export const INVESTMENT_TRANSACTION_TYPES = [
  { value: 'Deposit', label: 'Deposit', type: 'income', direction: 'In', category: 'investment' },
  { value: 'Withdrawal', label: 'Withdrawal', type: 'expense', direction: 'Out', category: 'other_expense' },
  { value: 'Profit', label: 'Profit', type: 'income', direction: 'In', category: 'investment' },
  { value: 'Loss', label: 'Loss', type: 'expense', direction: 'Out', category: 'other_expense' },
] as const;

export type InvestmentTransactionTypeValue = (typeof INVESTMENT_TRANSACTION_TYPES)[number]['value'];

function filterToCurrentUser<T extends { user_id?: string | null }>(
  data: T[],
  currentUserId: string,
  _entityName: string
): T[] {
  const own = data.filter((row) => row.user_id == null || row.user_id === currentUserId);
  if (own.length !== data.length) {
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

/** Seeds Thndr/Fawry as starting suggestions only (run once when the list is empty) —
 * users can rename or remove them and add their own platforms via useAddInvestmentAccount. */
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

/** Add a new investment platform (e.g. a broker/app beyond the seeded Thndr/Fawry defaults). */
export function useAddInvestmentAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Platform name is required');
      const { data, error } = await supabase
        .from('investment_accounts')
        .insert({ name: trimmed })
        .select()
        .single();
      if (error) throw error;
      return data as InvestmentAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...INVESTMENT_ACCOUNTS_KEY, user?.id] });
    },
  });
}

/** Rename an investment platform. Transactions reference it by account_id (a real foreign
 * key, unlike the freeform `bank` text column on regular transactions), so renaming here
 * needs no relinking — every transaction just picks up the new name automatically. */
export function useRenameInvestmentAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Platform name is required');
      const { error } = await supabase.from('investment_accounts').update({ name: trimmed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...INVESTMENT_ACCOUNTS_KEY, user?.id] });
    },
  });
}

/** Remove an investment platform. Unlike removing a bank (which just stops offering the
 * name for new transactions), this CASCADE-deletes every transaction recorded against it
 * (`investment_transactions.account_id` has `on delete cascade`) — callers must confirm
 * with the user first, since it's genuinely destructive. */
export function useRemoveInvestmentAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...INVESTMENT_ACCOUNTS_KEY, user?.id] });
      queryClient.invalidateQueries({ queryKey: [...INVESTMENT_TRANSACTIONS_KEY, user?.id] });
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

/** Current recorded balance for one platform — used by the Correction flow to compute the
 * adjustment needed to match the platform's real balance. */
export function getInvestmentAccountBalance(transactions: InvestmentTransaction[], accountId: string): number {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let total = 0;
  for (const t of transactions) {
    if (t.account_id !== accountId) continue;
    const amt = Number(t.amount) || 0;
    total += t.type === 'income' ? amt : -amt;
  }
  return round2(total);
}
