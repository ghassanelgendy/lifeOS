/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { InBodyScan, CreateInput, UpdateInput } from '../types/schema';
import { round1 } from '../lib/utils';

const QUERY_KEY = ['inbody-scans'];

export function useInBodyScans() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('inbody_scans').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data as InBodyScan[];
    },
  });
}

export function useInBodyScan(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase.from('inbody_scans').select('*').eq('id', id).single();
      if (error) throw error;
      return data as InBodyScan;
    },
    enabled: !!id,
  });
}

export function useCreateInBodyScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<InBodyScan>) => {
      const { data, error } = await supabase.from('inbody_scans').insert(input).select().single();
      if (error) throw error;
      return data as InBodyScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateInBodyScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<InBodyScan> }) => {
      const { data: updated, error } = await supabase.from('inbody_scans').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated as InBodyScan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteInBodyScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inbody_scans').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
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
