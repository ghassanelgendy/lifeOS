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

export function useSleepMetrics(days: number = 7) {
  const end = useMemo(() => new Date(), []);
  const endStr = format(end, 'yyyy-MM-dd');
  const startStr = format(subDays(end, days), 'yyyy-MM-dd');
  const { data: segments = [] } = useSleepStages(startStr + 'T00:00:00.000Z', endStr + 'T23:59:59.999Z');
  return useMemo(() => {
    const nights = groupSegmentsByNight(segments);
    if (nights.length === 0) return { avgSleepMinutes: 0, avgBedtimeMinutes: null, nightsCount: 0 };
    const totalMin = nights.reduce((s, n) => s + n.sleepMinutes, 0);

    // Calculate average bedtime by grouping sleep groups by their end date
    const bedtimes = [];
    const sortedSegs = [...segments].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    const groups: SleepStage[][] = [];
    let current: SleepStage[] = [];
    for (const seg of sortedSegs) {
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

    const byDateGroups = new Map<string, SleepStage[][]>();
    for (const group of groups) {
      if (group.length > 0) {
        const dateStr = group[group.length - 1].ended_at.slice(0, 10);
        if (!byDateGroups.has(dateStr)) {
          byDateGroups.set(dateStr, []);
        }
        byDateGroups.get(dateStr)!.push(group);
      }
    }

    for (const [_, groupsForDate] of byDateGroups.entries()) {
      groupsForDate.sort((a, b) => new Date(a[0].started_at).getTime() - new Date(b[0].started_at).getTime());
      const firstGroup = groupsForDate[0];
      if (firstGroup && firstGroup.length > 0) {
        const date = new Date(firstGroup[0].started_at);
        let mins = date.getHours() * 60 + date.getMinutes();
        // If they slept between 00:00 and 12:00, add 24 hours so it averages correctly with e.g. 23:00
        if (mins < 12 * 60) mins += 24 * 60;
        bedtimes.push(mins);
      }
    }

    let avgBedtimeMinutes = null;
    if (bedtimes.length > 0) {
      const avgRaw = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
      avgBedtimeMinutes = Math.round(avgRaw % (24 * 60));
    }

    return { 
      avgSleepMinutes: Math.round(totalMin / nights.length), 
      avgBedtimeMinutes,
      nightsCount: nights.length 
    };
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

function overlapMinutesForDay(segment: SleepStage, day: Date): number {
  if (stageIs(segment, 'Awake')) return 0;
  const start = new Date(segment.started_at).getTime();
  const end = new Date(segment.ended_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const overlapStart = Math.max(start, dayStart.getTime());
  const overlapEnd = Math.min(end, dayEnd.getTime());
  return Math.max(0, Math.round((overlapEnd - overlapStart) / (1000 * 60)));
}

/** Sleep minutes that overlap the selected local calendar day. */
export function useSleepMinutesForDay(day: Date = new Date()) {
  const startStr = format(subDays(day, 1), 'yyyy-MM-dd');
  const endStr = format(day, 'yyyy-MM-dd');
  const { data: segments = [] } = useSleepStages(startStr + 'T00:00:00.000Z', endStr + 'T23:59:59.999Z');
  return useMemo(
    () => segments.reduce((total, segment) => total + overlapMinutesForDay(segment, day), 0),
    [day, segments],
  );
}

export function useSleepStages(startDate: string, endDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, 'stages', startDate, endDate, user?.id],
    queryFn: async () => {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      try {
        const q = supabase
          .from('sleep_stages')
          .select('*')
          .eq('user_id', user!.id)
          .lt('started_at', endDate)
          .gt('ended_at', startDate)
          .order('started_at', { ascending: false });
        const { data, error } = await q;
        if (error) throw error;
        const list = (data ?? []) as SleepStage[];
        void idbSaveSleepStages(list);
        return list;
      } catch {
        const local = await idbGetSleepStages();
        const filtered = (local as SleepStage[])
          .filter((s) => {
            const started = new Date(s.started_at).getTime();
            const ended = new Date(s.ended_at).getTime();
            return started < end && ended > start;
          })
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        return filtered;
      }
    },
    enabled: !!user?.id,
  });
}
