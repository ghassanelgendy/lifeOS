/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import { idbGetInBodyScans, idbSaveInBodyScans } from '../db/indexedDb';
import type { InBodyScan, CreateInput, UpdateInput } from '../types/schema';
import { round1 } from '../lib/utils';

const QUERY_KEY = ['inbody-scans'];

export function useInBodyScans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    queryFn: async () => {
      try {
        const q = supabase.from('inbody_scans').select('*').order('date', { ascending: false });
        if (user?.id) q.eq('user_id', user.id);
        const { data, error } = await q;
        if (error) throw error;
        const list = (data ?? []) as InBodyScan[];
        void idbSaveInBodyScans(list);
        return list;
      } catch {
        const local = await idbGetInBodyScans();
        const sorted = (local as InBodyScan[]).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        // Filter by user_id in offline mode too
        return user?.id ? sorted.filter((s: any) => s.user_id === user.id) : sorted;
      }
    },
    enabled: !!user?.id,
  });
}

export function useInBodyScan(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, id, user?.id],
    queryFn: async () => {
      const q = supabase.from('inbody_scans').select('*').eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q.single();
      if (error) throw error;
      return data as InBodyScan;
    },
    enabled: !!id && !!user?.id,
  });
}

export function useCreateInBodyScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<InBodyScan>) => {
      const nowIso = new Date().toISOString();
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'inbody_scans', op: 'create', payload: input as Record<string, unknown> });
        const optimistic: InBodyScan = {
          ...input,
          id: `offline-inbody-${Date.now()}`,
          weight: round1(input.weight),
          skeletal_muscle_mass: round1(input.skeletal_muscle_mass),
          body_fat_percent: round1(input.body_fat_percent),
          visceral_fat_level: input.visceral_fat_level ?? 0,
          bmr_kcal: input.bmr_kcal ?? 0,
          bmi: input.bmi ?? 0,
          created_at: nowIso,
          updated_at: nowIso,
        };
        const prev = (queryClient.getQueryData(QUERY_KEY) as InBodyScan[] | undefined) ?? [];
        const next = [optimistic, ...prev];
        queryClient.setQueryData(QUERY_KEY, next);
        void idbSaveInBodyScans(next);
        return optimistic;
      }
      const { data, error } = await supabase.from('inbody_scans').insert(input).select().single();
      if (error) throw error;
      const created = data as InBodyScan;
      const prev = (queryClient.getQueryData(QUERY_KEY) as InBodyScan[] | undefined) ?? [];
      const next = [created, ...prev];
      queryClient.setQueryData(QUERY_KEY, next);
      void idbSaveInBodyScans(next);
      return created;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateInBodyScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<InBodyScan> }) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'inbody_scans', op: 'update', id, payload: data as Record<string, unknown> });
        const prev = (queryClient.getQueryData(QUERY_KEY) as InBodyScan[] | undefined) ?? [];
        const next = prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...data,
                weight: data.weight !== undefined ? round1(data.weight) : s.weight,
                skeletal_muscle_mass: data.skeletal_muscle_mass !== undefined ? round1(data.skeletal_muscle_mass) : s.skeletal_muscle_mass,
                body_fat_percent: data.body_fat_percent !== undefined ? round1(data.body_fat_percent) : s.body_fat_percent,
                updated_at: new Date().toISOString(),
              }
            : s
        );
        queryClient.setQueryData(QUERY_KEY, next);
        void idbSaveInBodyScans(next);
        const updated = next.find((s) => s.id === id);
        return updated as InBodyScan;
      }
      const { data: updated, error } = await supabase.from('inbody_scans').update(data).eq('id', id).select().single();
      if (error) throw error;
      const result = updated as InBodyScan;
      const prev = (queryClient.getQueryData(QUERY_KEY) as InBodyScan[] | undefined) ?? [];
      const next = prev.map((s) => (s.id === id ? result : s));
      queryClient.setQueryData(QUERY_KEY, next);
      void idbSaveInBodyScans(next);
      return result;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteInBodyScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'inbody_scans', op: 'delete', id });
        const prev = (queryClient.getQueryData(QUERY_KEY) as InBodyScan[] | undefined) ?? [];
        const next = prev.filter((s) => s.id !== id);
        queryClient.setQueryData(QUERY_KEY, next);
        void idbSaveInBodyScans(next);
        return true;
      }
      const { error } = await supabase.from('inbody_scans').delete().eq('id', id);
      if (error) throw error;
      const prev = (queryClient.getQueryData(QUERY_KEY) as InBodyScan[] | undefined) ?? [];
      const next = prev.filter((s) => s.id !== id);
      queryClient.setQueryData(QUERY_KEY, next);
      void idbSaveInBodyScans(next);
      return true;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// Derived data hook for dashboard metrics
export function useHealthMetrics() {
  const { data: scans = [] } = useInBodyScans();

  const latestScan = scans[0];
  const previousScan = scans[1];

  const calculateTrend = (current: number, previous: number): number => {
    if (!previous || previous === 0) return 0;
    return round1(((current - previous) / previous) * 100);
  };

  const metrics = latestScan && previousScan ? {
    weight: {
      current: round1(latestScan.weight),
      trend: calculateTrend(latestScan.weight, previousScan.weight),
      history: scans.map((s) => round1(s.weight)).reverse(),
    },
    smm: {
      current: round1(latestScan.skeletal_muscle_mass),
      trend: calculateTrend(latestScan.skeletal_muscle_mass, previousScan.skeletal_muscle_mass),
      history: scans.map((s) => round1(s.skeletal_muscle_mass)).reverse(),
    },
    pbf: {
      current: round1(latestScan.body_fat_percent),
      trend: calculateTrend(latestScan.body_fat_percent, previousScan.body_fat_percent),
      history: scans.map((s) => round1(s.body_fat_percent)).reverse(),
    },
    visceral: {
      current: latestScan.visceral_fat_level,
      trend: calculateTrend(latestScan.visceral_fat_level, previousScan.visceral_fat_level),
      history: scans.map((s) => s.visceral_fat_level).reverse(),
    },
    bmr: {
      current: latestScan.bmr_kcal,
      trend: calculateTrend(latestScan.bmr_kcal, previousScan.bmr_kcal),
      history: scans.map((s) => s.bmr_kcal).reverse(),
    },
  } : {
    weight: { current: 0, trend: 0, history: [] },
    smm: { current: 0, trend: 0, history: [] },
    pbf: { current: 0, trend: 0, history: [] },
    visceral: { current: 0, trend: 0, history: [] },
    bmr: { current: 0, trend: 0, history: [] },
  };

  return {
    latestScan,
    previousScan,
    metrics,
    scans,
    hasData: scans.length > 0,
  };
}
