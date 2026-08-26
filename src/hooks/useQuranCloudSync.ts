import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { HifdhRecord } from '../../lib/quran-memorizer/src/types/quran';

const QURAN_PLAN_STORAGE_KEY = 'quran_khatmah_plan_v1';
const QURAN_READING_STORAGE_KEY = 'quran_reading_wird_v1';
const QURAN_MEM_MARKER_KEY = 'quran_memorization_marker_v1';
const QURAN_READ_MARKER_KEY = 'quran_reading_marker_v1';
const QURAN_RECORDS_STORAGE_KEY = 'quran_memorizer_records_v1';

export function useQuranCloudSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isHydratingRef = useRef(false);

  // 1. Query Khatmah Plans & Markers from Supabase
  const planQuery = useQuery({
    queryKey: ['quran-khatmah-plan', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('quran_khatmah_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching quran plan from supabase:', error);
        return null;
      }
      return data;
    },
  });

  // 2. Query Hifdh Records from Supabase
  const recordsQuery = useQuery({
    queryKey: ['quran-hifdh-records', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('quran_hifdh_records')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.warn('Error fetching quran hifdh records from supabase:', error);
        return [];
      }
      return data || [];
    },
  });

  // Hydrate local storage when Supabase data arrives
  useEffect(() => {
    if (!planQuery.data) return;
    isHydratingRef.current = true;
    const p = planQuery.data;

    try {
      // Hydrate Memorization Plan
      const memPlan = {
        title: p.title || 'خطة حفظ القرآن الكريم',
        goalType: p.goal_type || 'pages_per_day',
        pagesPerDay: p.pages_per_day || 1,
        startPage: p.start_page || 1,
        endPage: p.end_page || 604,
        currentPage: p.current_page || 1,
        startDate: p.start_date || new Date().toISOString(),
        streakDays: p.streak_days || 0,
        lastCompletedDate: p.last_completed_date || null,
        notes: p.notes || '',
      };
      localStorage.setItem(QURAN_PLAN_STORAGE_KEY, JSON.stringify(memPlan));

      // Hydrate Reading Plan
      const readPlan = {
        currentPage: p.reading_current_page || 1,
        pagesPerDay: p.reading_pages_per_day || 4,
        streakDays: p.reading_streak_days || 0,
        lastCompletedDate: p.reading_last_completed_date || null,
      };
      localStorage.setItem(QURAN_READING_STORAGE_KEY, JSON.stringify(readPlan));

      // Hydrate Memorization Marker
      const memMarker = {
        surahNumber: p.current_surah || 1,
        ayahNumber: p.current_ayah || 1,
        page: p.current_page || 1,
      };
      localStorage.setItem(QURAN_MEM_MARKER_KEY, JSON.stringify(memMarker));

      // Hydrate Reading Marker
      const readMarker = {
        surahNumber: p.reading_current_surah || 1,
        ayahNumber: p.reading_current_ayah || 1,
        page: p.reading_current_page || 1,
      };
      localStorage.setItem(QURAN_READ_MARKER_KEY, JSON.stringify(readMarker));

      window.dispatchEvent(new Event('quran_plan_updated'));
    } catch (e) {
      console.warn('Failed hydrating quran plan to localStorage:', e);
    } finally {
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 500);
    }
  }, [planQuery.data]);

  // Hydrate Hifdh records
  useEffect(() => {
    if (!recordsQuery.data || recordsQuery.data.length === 0) return;
    try {
      const formatted: HifdhRecord[] = recordsQuery.data.map((r: any) => ({
        id: r.id,
        surahNumber: r.surah_number,
        ayahStart: r.ayah_start,
        ayahEnd: r.ayah_end,
        status: r.status,
        masteryScore: r.mastery_score,
        repeatsDone: r.repeats_done,
        intervalDays: r.interval_days,
        easeFactor: r.ease_factor,
        lastReviewedAt: r.last_reviewed_at,
        nextReviewAt: r.next_review_at,
        notes: r.notes,
      }));

      localStorage.setItem(QURAN_RECORDS_STORAGE_KEY, JSON.stringify(formatted));
      window.dispatchEvent(new Event('quran_records_updated'));
    } catch (e) {
      console.warn('Failed hydrating quran records to localStorage:', e);
    }
  }, [recordsQuery.data]);

  // Mutation to upsert Khatmah Plan & Position
  const syncPlanMutation = useMutation({
    mutationFn: async (payload: {
      currentPage?: number;
      currentSurah?: number;
      currentAyah?: number;
      readingCurrentPage?: number;
      readingCurrentSurah?: number;
      readingCurrentAyah?: number;
      pagesPerDay?: number;
      readingPagesPerDay?: number;
      streakDays?: number;
      readingStreakDays?: number;
      lastCompletedDate?: string;
      readingLastCompletedDate?: string;
    }) => {
      if (!user?.id) return;

      const record = {
        user_id: user.id,
        ...(payload.currentPage !== undefined && { current_page: payload.currentPage }),
        ...(payload.currentSurah !== undefined && { current_surah: payload.currentSurah }),
        ...(payload.currentAyah !== undefined && { current_ayah: payload.currentAyah }),
        ...(payload.readingCurrentPage !== undefined && { reading_current_page: payload.readingCurrentPage }),
        ...(payload.readingCurrentSurah !== undefined && { reading_current_surah: payload.readingCurrentSurah }),
        ...(payload.readingCurrentAyah !== undefined && { reading_current_ayah: payload.readingCurrentAyah }),
        ...(payload.pagesPerDay !== undefined && { pages_per_day: payload.pagesPerDay }),
        ...(payload.readingPagesPerDay !== undefined && { reading_pages_per_day: payload.readingPagesPerDay }),
        ...(payload.streakDays !== undefined && { streak_days: payload.streakDays }),
        ...(payload.readingStreakDays !== undefined && { reading_streak_days: payload.readingStreakDays }),
        ...(payload.lastCompletedDate !== undefined && { last_completed_date: payload.lastCompletedDate }),
        ...(payload.readingLastCompletedDate !== undefined && { reading_last_completed_date: payload.readingLastCompletedDate }),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('quran_khatmah_plans').upsert(record, {
        onConflict: 'user_id',
      });

      if (error) {
        // If unique constraint is on id, query existing row or insert
        console.warn('Sync plan error:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quran-khatmah-plan', user?.id] });
    },
  });

  // Listen to local changes and sync to Supabase
  useEffect(() => {
    const handleLocalPlanUpdate = () => {
      if (isHydratingRef.current || !user?.id) return;
      try {
        const memPlanStr = localStorage.getItem(QURAN_PLAN_STORAGE_KEY);
        const readPlanStr = localStorage.getItem(QURAN_READING_STORAGE_KEY);
        const memMarkerStr = localStorage.getItem(QURAN_MEM_MARKER_KEY);
        const readMarkerStr = localStorage.getItem(QURAN_READ_MARKER_KEY);

        const memPlan = memPlanStr ? JSON.parse(memPlanStr) : null;
        const readPlan = readPlanStr ? JSON.parse(readPlanStr) : null;
        const memMarker = memMarkerStr ? JSON.parse(memMarkerStr) : null;
        const readMarker = readMarkerStr ? JSON.parse(readMarkerStr) : null;

        syncPlanMutation.mutate({
          currentPage: memPlan?.currentPage || memMarker?.page,
          currentSurah: memMarker?.surahNumber,
          currentAyah: memMarker?.ayahNumber,
          readingCurrentPage: readPlan?.currentPage || readMarker?.page,
          readingCurrentSurah: readMarker?.surahNumber,
          readingCurrentAyah: readMarker?.ayahNumber,
          pagesPerDay: memPlan?.pagesPerDay,
          readingPagesPerDay: readPlan?.pagesPerDay,
          streakDays: memPlan?.streakDays,
          readingStreakDays: readPlan?.streakDays,
          lastCompletedDate: memPlan?.lastCompletedDate,
          readingLastCompletedDate: readPlan?.lastCompletedDate,
        });
      } catch (e) {
        console.warn('Error during auto cloud sync:', e);
      }
    };

    window.addEventListener('quran_plan_updated', handleLocalPlanUpdate);
    window.addEventListener('storage', handleLocalPlanUpdate);
    return () => {
      window.removeEventListener('quran_plan_updated', handleLocalPlanUpdate);
      window.removeEventListener('storage', handleLocalPlanUpdate);
    };
  }, [user?.id]);

  return {
    isCloudSynced: !!user?.id && !planQuery.isLoading,
  };
}
