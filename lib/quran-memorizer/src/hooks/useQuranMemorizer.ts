import { useState, useEffect, useCallback, useMemo } from 'react';
import { HifdhRecord, RatingGrade, MemorizationStatus } from '../types/quran';

const LOCAL_STORAGE_KEY = 'quran_memorizer_records_v1';

export function useQuranMemorizer() {
  const [records, setRecords] = useState<HifdhRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save changes & broadcast
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
      window.dispatchEvent(new Event('quran_records_updated'));
    } catch (e) {
      console.warn('Failed to save quran records to localStorage:', e);
    }
  }, [records]);

  // Sync across tabs and events
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          setRecords(JSON.parse(saved));
        }
      } catch {}
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('quran_records_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('quran_records_updated', handleSync);
    };
  }, []);

  const getRecord = useCallback(
    (surahNumber: number, ayahStart: number, ayahEnd: number): HifdhRecord | undefined => {
      return records.find(
        (r) => r.surahNumber === surahNumber && r.ayahStart === ayahStart && r.ayahEnd === ayahEnd
      );
    },
    [records]
  );

  const getVerseMastery = useCallback(
    (surahNumber: number, ayahNumber: number): { status: MemorizationStatus; masteryScore: number } | null => {
      const matches = records.filter(
        (r) =>
          r.surahNumber === surahNumber &&
          ayahNumber >= r.ayahStart &&
          ayahNumber <= r.ayahEnd
      );
      if (matches.length === 0) return null;
      // Prioritize single-ayah / narrowest range first so individual ayah statuses override section defaults
      matches.sort((a, b) => (a.ayahEnd - a.ayahStart) - (b.ayahEnd - b.ayahStart));
      const match = matches[0];
      return match ? { status: match.status, masteryScore: match.masteryScore } : null;
    },
    [records]
  );

  const updateRecordStatus = useCallback(
    (
      surahNumber: number,
      ayahStart: number,
      ayahEnd: number,
      status: MemorizationStatus
    ) => {
      setRecords((prev) => {
        const existingIdx = prev.findIndex(
          (r) => r.surahNumber === surahNumber && r.ayahStart === ayahStart && r.ayahEnd === ayahEnd
        );

        const now = new Date().toISOString();
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (status === 'memorized' ? 3 : 1));

        const score = status === 'memorized' ? 100 : status === 'reviewing' ? 75 : 50;

        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const updatedRecord: HifdhRecord = {
            ...existing,
            status,
            masteryScore: score,
            repeatsDone: (existing.repeatsDone || 0) + 1,
            lastReviewedAt: now,
            nextReviewAt: nextDate.toISOString(),
            intervalDays: status === 'memorized' ? 3 : 1,
          };
          const nextList = [...prev];
          nextList[existingIdx] = updatedRecord;
          return nextList;
        } else {
          const newRecord: HifdhRecord = {
            surahNumber,
            ayahStart,
            ayahEnd,
            status,
            masteryScore: score,
            repeatsDone: 1,
            lastReviewedAt: now,
            nextReviewAt: nextDate.toISOString(),
            intervalDays: status === 'memorized' ? 3 : 1,
            easeFactor: 2.5,
          };
          return [...prev, newRecord];
        }
      });
    },
    []
  );

  /**
   * Applies SM-2 Spaced Repetition Rating
   */
  const reviewRecord = useCallback(
    (
      surahNumber: number,
      ayahStart: number,
      ayahEnd: number,
      grade: RatingGrade
    ) => {
      setRecords((prev) => {
        const existing = prev.find(
          (r) => r.surahNumber === surahNumber && r.ayahStart === ayahStart && r.ayahEnd === ayahEnd
        ) || {
          surahNumber,
          ayahStart,
          ayahEnd,
          status: 'memorizing' as MemorizationStatus,
          masteryScore: 50,
          repeatsDone: 0,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: new Date().toISOString(),
          intervalDays: 1,
          easeFactor: 2.5,
        };

        let { intervalDays, easeFactor, masteryScore, repeatsDone } = existing;
        repeatsDone += 1;

        // Grade mapping: again=1, hard=2, good=3, easy=4
        let gradeVal = 3;
        if (grade === 'again') gradeVal = 1;
        if (grade === 'hard') gradeVal = 2;
        if (grade === 'good') gradeVal = 3;
        if (grade === 'easy') gradeVal = 4;

        // Calculate SM-2 interval & score adjustment
        if (gradeVal === 1) {
          // Failed / Need re-memorization
          intervalDays = 1;
          masteryScore = Math.max(20, masteryScore - 25);
        } else if (gradeVal === 2) {
          // Hard / Struggled
          intervalDays = 1;
          masteryScore = Math.max(50, masteryScore - 10);
        } else if (gradeVal === 3) {
          // Good / Normal recall
          if (repeatsDone <= 1) {
            intervalDays = 1;
          } else if (repeatsDone === 2) {
            intervalDays = 3;
          } else {
            intervalDays = Math.round(intervalDays * easeFactor);
          }
          masteryScore = Math.min(95, masteryScore + 10);
        } else {
          // Easy / Perfect recall
          if (repeatsDone <= 1) {
            intervalDays = 3;
          } else if (repeatsDone === 2) {
            intervalDays = 6;
          } else {
            intervalDays = Math.round(intervalDays * easeFactor * 1.3);
          }
          masteryScore = 100;
        }

        // Update Ease Factor
        easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - gradeVal) * (0.08 + (5 - gradeVal) * 0.02)));

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + intervalDays);

        const updated: HifdhRecord = {
          ...existing,
          status: masteryScore >= 80 ? 'memorized' : 'reviewing',
          masteryScore,
          repeatsDone,
          intervalDays,
          easeFactor,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: nextDate.toISOString(),
        };

        const filtered = prev.filter(
          (r) => !(r.surahNumber === surahNumber && r.ayahStart === ayahStart && r.ayahEnd === ayahEnd)
        );

        return [...filtered, updated];
      });
    },
    []
  );

  // Get items due for review today
  const dueReviews = records.filter((r) => {
    if (!r.nextReviewAt) return false;
    return new Date(r.nextReviewAt) <= new Date();
  });

  const totalVersesMemorized = useMemo(() => {
    const uniqueVerses = new Set<string>();
    for (const r of records) {
      if (r.status === 'memorized') {
        for (let a = r.ayahStart; a <= r.ayahEnd; a++) {
          uniqueVerses.add(`${r.surahNumber}:${a}`);
        }
      }
    }
    return uniqueVerses.size;
  }, [records]);

  return {
    records,
    dueReviews,
    totalVersesMemorized,
    getRecord,
    getVerseMastery,
    updateRecordStatus,
    reviewRecord,
  };
}
