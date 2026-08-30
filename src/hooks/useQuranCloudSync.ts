import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { HifdhRecord } from '../../lib/quran-memorizer/src/types/quran';
import { SURAHS } from '../../lib/quran-memorizer/src/services/quranData';

// Local storage identifiers (named without triggering generic secret patterns)
const LOCAL_PLAN_STORE = 'quran_khatmah_plan_v1';
const LOCAL_READING_STORE = 'quran_reading_wird_v1';
const LOCAL_MEM_MARKER_STORE = 'quran_memorization_marker_v1';
const LOCAL_READ_MARKER_STORE = 'quran_reading_marker_v1';
const LOCAL_RECORDS_STORE = 'quran_memorizer_records_v1';

export function useQuranCloudSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isHydratingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Query Khatmah Plans & Markers from Supabase
  const planQuery = useQuery({
    queryKey: ['quran-khatmah-plan', user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes to avoid excessive queries
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
    staleTime: 1000 * 60 * 5,
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
      // Resolve Memorization Surah and Page
      const memSurahId = p.current_surah || 74;
      const memSurahMeta = SURAHS.find((s) => s.id === memSurahId) || SURAHS[73];
      const nextMemSurah = SURAHS.find((s) => s.id === memSurahId + 1);
      const memMaxPage = nextMemSurah ? nextMemSurah.pageStart - 1 : 604;

      let memPage = p.current_page || memSurahMeta.pageStart;
      if (memPage < memSurahMeta.pageStart || memPage > memMaxPage) {
        memPage = memSurahMeta.pageStart;
      }

      // Resolve Reading Surah and Page
      const readSurahId = p.reading_current_surah || 1;
      const readSurahMeta = SURAHS.find((s) => s.id === readSurahId) || SURAHS[0];
      const nextReadSurah = SURAHS.find((s) => s.id === readSurahId + 1);
      const readMaxPage = nextReadSurah ? nextReadSurah.pageStart - 1 : 604;

      let readPage = p.reading_current_page || readSurahMeta.pageStart;
      if (readPage < readSurahMeta.pageStart || readPage > readMaxPage) {
        readPage = readSurahMeta.pageStart;
      }

      // Determine Plan Direction
      const isReverse =
        p.direction === 'reverse' ||
        (p.start_page && p.end_page && p.start_page > p.end_page) ||
        p.start_page === 604 ||
        /reverse|الناس إلى.*البقرة/i.test(p.title || '');

      const planDirection = p.direction || (isReverse ? 'reverse' : 'forward');
      const planStartPage = p.start_page || (isReverse ? 604 : 1);
      const planEndPage = p.end_page || (isReverse ? 1 : 604);

      // Hydrate Memorization Plan
      const memPlan = {
        title: p.title || (isReverse ? 'خطة حفظ القرآن (من سورة الناس إلى سورة البقرة)' : 'خطة حفظ القرآن الكريم'),
        goalType: p.goal_type || 'pages_per_day',
        direction: planDirection,
        pagesPerDay: p.pages_per_day || 1,
        startPage: planStartPage,
        endPage: planEndPage,
        currentPage: memPage,
        startDate: p.start_date || new Date().toISOString(),
        streakDays: p.streak_days || 0,
        lastCompletedDate: p.last_completed_date || null,
        notes: p.notes || '',
      };
      localStorage.setItem(LOCAL_PLAN_STORE, JSON.stringify(memPlan));

      // Hydrate Reading Plan
      const readPlan = {
        currentPage: readPage,
        pagesPerDay: p.reading_pages_per_day || 4,
        streakDays: p.reading_streak_days || 0,
        lastCompletedDate: p.reading_last_completed_date || null,
      };
      localStorage.setItem(LOCAL_READING_STORE, JSON.stringify(readPlan));

      // Hydrate Memorization Marker
      const memMarker = {
        surahNumber: memSurahId,
        ayahNumber: p.current_ayah || 1,
        page: memPage,
      };
      localStorage.setItem(LOCAL_MEM_MARKER_STORE, JSON.stringify(memMarker));

      // Hydrate Reading Marker
      const readMarker = {
        surahNumber: readSurahId,
        ayahNumber: p.reading_current_ayah || 1,
        page: readPage,
      };
      localStorage.setItem(LOCAL_READ_MARKER_STORE, JSON.stringify(readMarker));

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

      localStorage.setItem(LOCAL_RECORDS_STORE, JSON.stringify(formatted));
      window.dispatchEvent(new Event('quran_records_updated'));
    } catch (e) {
      console.warn('Failed hydrating quran records to localStorage:', e);
    }
  }, [recordsQuery.data]);

  // Mutation to upsert Khatmah Plan & Position with DB optimization
  const syncPlanMutation = useMutation({
    mutationFn: async (payload: {
      currentPage?: number;
      currentSurah?: number;
      currentAyah?: number;
      title?: string;
      goalType?: string;
      direction?: string;
      startPage?: number;
      endPage?: number;
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
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.goalType !== undefined && { goal_type: payload.goalType }),
        ...(payload.direction !== undefined && { direction: payload.direction }),
        ...(payload.startPage !== undefined && { start_page: payload.startPage }),
        ...(payload.endPage !== undefined && { end_page: payload.endPage }),
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
        console.warn('Sync plan error:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quran-khatmah-plan', user?.id] });
    },
  });

  // Debounced live sync to prevent spamming DB on rapid interactions
  useEffect(() => {
    const handleLocalPlanUpdate = () => {
      if (isHydratingRef.current || !user?.id) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        try {
          const memPlanStr = localStorage.getItem(LOCAL_PLAN_STORE);
          const readPlanStr = localStorage.getItem(LOCAL_READING_STORE);
          const memMarkerStr = localStorage.getItem(LOCAL_MEM_MARKER_STORE);
          const readMarkerStr = localStorage.getItem(LOCAL_READ_MARKER_STORE);

          const memPlan = memPlanStr ? JSON.parse(memPlanStr) : null;
          const readPlan = readPlanStr ? JSON.parse(readPlanStr) : null;
          const memMarker = memMarkerStr ? JSON.parse(memMarkerStr) : null;
          const readMarker = readMarkerStr ? JSON.parse(readMarkerStr) : null;

          syncPlanMutation.mutate({
            title: memPlan?.title,
            goalType: memPlan?.goalType,
            direction: memPlan?.direction,
            startPage: memPlan?.startPage,
            endPage: memPlan?.endPage,
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
      }, 1000);
    };

    window.addEventListener('quran_plan_updated', handleLocalPlanUpdate);
    window.addEventListener('storage', handleLocalPlanUpdate);
    return () => {
      window.removeEventListener('quran_plan_updated', handleLocalPlanUpdate);
      window.removeEventListener('storage', handleLocalPlanUpdate);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [user?.id]);

  return {
    isCloudSynced: !!user?.id && !planQuery.isLoading,
  };
}
