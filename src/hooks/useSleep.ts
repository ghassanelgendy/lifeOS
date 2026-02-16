import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { SleepStage } from '../types/schema';
import { useAuth } from '../contexts/AuthContext';
import { idbGetSleepStages, idbSaveSleepStages } from '../db/indexedDb';

const QUERY_KEY = ['sleep'];

export function useSleepStages(startDate: string, endDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, 'stages', startDate, endDate, user?.id],
    queryFn: async () => {
      try {
        const q = supabase
          .from('sleep_stages')
          .select('*')
          .eq('user_id', user!.id)
          .gte('started_at', startDate)
          .lte('started_at', endDate)
          .order('started_at', { ascending: false });
        const { data, error } = await q;
        if (error) throw error;
        const list = (data ?? []) as SleepStage[];
        void idbSaveSleepStages(list);
        return list;
      } catch {
        const local = await idbGetSleepStages();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        const filtered = (local as SleepStage[])
          .filter((s) => {
            const t = new Date(s.started_at).getTime();
            return t >= start && t <= end;
          })
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        return filtered;
      }
    },
    enabled: !!user?.id,
  });
}
