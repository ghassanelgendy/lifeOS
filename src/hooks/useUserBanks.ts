import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { UserBank } from '../types/schema';

const USER_BANKS_KEY = ['user_banks'];
const TRANSACTIONS_KEY = ['transactions'];

export const DEFAULT_BANK_NAMES = [
  'Orange Cash',
  'QNB',
  'HSBC',
  'SAIB',
  'NBE',
  'Cash',
] as const;

function userBanksKey(userId: string | undefined) {
  return [...USER_BANKS_KEY, userId] as const;
}

export function useUserBanks() {
  const { user } = useAuth();
  const key = userBanksKey(user?.id);
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_banks')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as UserBank[];
    },
    enabled: !!user?.id,
  });
}

/** Ensures the default bank names exist for the current user (run once when list is empty). */
export function useEnsureDefaultBanks() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = userBanksKey(user?.id);

  return useMutation({
    mutationFn: async () => {
      for (const name of DEFAULT_BANK_NAMES) {
        await supabase.from('user_banks').insert({ name }).then(({ error }) => {
          if (error && error.code !== '23505') throw error; // ignore unique violation
        });
      }
      const { data, error } = await supabase
        .from('user_banks')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as UserBank[];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
    },
  });
}

/** Add a new bank name for the current user. */
export function useAddBank() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = userBanksKey(user?.id);

  return useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Bank name is required');
      const { data, error } = await supabase
        .from('user_banks')
        .insert({ name: trimmed })
        .select()
        .single();
      if (error) throw error;
      return data as UserBank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Rename a bank. The `bank` column on transactions is a plain text field (not a foreign
 * key), so renaming only the `user_banks` row would silently detach every existing
 * transaction from its account. To keep them linked to the same entity under its new
 * name, every transaction whose `bank` matches the old name is updated to the new one.
 */
export function useRenameBank() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = userBanksKey(user?.id);

  return useMutation({
    mutationFn: async ({ id, oldName, newName }: { id: string; oldName: string; newName: string }) => {
      const trimmed = newName.trim();
      if (!trimmed) throw new Error('Bank name is required');
      if (trimmed === oldName) return;

      const { error: renameError } = await supabase
        .from('user_banks')
        .update({ name: trimmed })
        .eq('id', id);
      if (renameError) throw renameError;

      if (user?.id) {
        const { error: relinkError } = await supabase
          .from('transactions')
          .update({ bank: trimmed })
          .eq('user_id', user.id)
          .eq('bank', oldName);
        if (relinkError) throw relinkError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: [...TRANSACTIONS_KEY, user?.id] });
    },
  });
}

/** Remove a bank from the user's list. Existing transactions keep their `bank` text as-is (history is preserved); it just stops appearing as a selectable option for new transactions. */
export function useRemoveBank() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = userBanksKey(user?.id);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_banks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
