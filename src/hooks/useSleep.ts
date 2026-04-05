import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { SleepStage } from '../types/schema';
import { useAuth } from '../contexts/AuthContext';
import { idbGetSleepStages, idbSaveSleepStages } from '../db/indexedDb';

const QUERY_KEY = ['sleep'];

function stageIs(seg: SleepStage, stage: string): boolean {
  return (seg.stage ?? '').toLowerCase() === stage.toLowerCase();
}

/** Group segments into nights and return total sleep minutes per night (excluding awake). */
export function groupSegmentsByNight(segments: SleepStage[]): { date: string; sleepMinutes: number }[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const groups: SleepStage[][] = [];
  let current: SleepStage[] = [];
  for (const seg of sorted) {
    if (current.length === 0) {
      current.push(seg);
    } else {
      const last = current[current.length - 1];
      const gapMin = (new Date(seg.started_at).getTime() - new Date(last.ended_at).getTime()) / (1000 * 60);
      if (gapMin < 120) {
        current.push(seg);
      } else {
        groups.push(current);
        current = [seg];
      }
    }
  }
  if (current.length > 0) groups.push(current);

  const byDate = new Map<string, SleepStage[]>();
  for (const group of groups) {
    const endDate = group[group.length - 1].ended_at.slice(0, 10);
    if (!byDate.has(endDate)) byDate.set(endDate, []);
    byDate.get(endDate)!.push(...group);
  }

  return Array.from(byDate.entries()).map(([date, segs]) => {
    const total = segs.reduce((s, x) => s + x.duration_minutes, 0);
    const awake = segs.filter((s) => stageIs(s, 'Awake')).reduce((s, x) => s + x.duration_minutes, 0);
    return { date, sleepMinutes: total - awake };
  });
}

/** Average sleep time over the last N days. Uses same night-grouping as Sleep page. */
export function useSleepMetrics(days: number = 7) {
  const end = useMemo(() => new Date(), []);
  const endStr = format(end, 'yyyy-MM-dd');
  const startStr = format(subDays(end, days), 'yyyy-MM-dd');
  const { data: segments = [] } = useSleepStages(startStr + 'T00:00:00.000Z', endStr + 'T23:59:59.999Z');
  return useMemo(() => {
    const nights = groupSegmentsByNight(segments);
    if (nights.length === 0) return { avgSleepMinutes: 0, nightsCount: 0 };
    const totalMin = nights.reduce((s, n) => s + n.sleepMinutes, 0);
    return { avgSleepMinutes: Math.round(totalMin / nights.length), nightsCount: nights.length };
  }, [segments]);
}

/** Most recent night’s sleep minutes (by segment end date), same grouping as Sleep page. */
export function useLastNightSleepMinutes() {
  const endStr = format(new Date(), 'yyyy-MM-dd');
  const startStr = format(subDays(new Date(), 4), 'yyyy-MM-dd');
  const { data: segments = [] } = useSleepStages(startStr + 'T00:00:00.000Z', endStr + 'T23:59:59.999Z');
  return useMemo(() => {
    const nights = groupSegmentsByNight(segments);
    if (nights.length === 0) return null;
    const sorted = [...nights].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.sleepMinutes ?? null;
  }, [segments]);
}

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
