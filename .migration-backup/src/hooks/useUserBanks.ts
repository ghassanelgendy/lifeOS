import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { UserBank } from '../types/schema';

const USER_BANKS_KEY = ['user_banks'];

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
