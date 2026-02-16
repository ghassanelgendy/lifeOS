import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { SleepStage } from '../types/schema';
import { useAuth } from '../contexts/AuthContext';

const QUERY_KEY = ['sleep'];

export function useSleepStages(startDate: string, endDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, 'stages', startDate, endDate, user?.id],
    queryFn: async () => {
      const q = supabase
        .from('sleep_stages')
        .select('*')
        .eq('user_id', user!.id)
        .gte('started_at', startDate)
        .lte('started_at', endDate)
        .order('started_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SleepStage[];
    },
    enabled: !!user?.id,
  });
}
