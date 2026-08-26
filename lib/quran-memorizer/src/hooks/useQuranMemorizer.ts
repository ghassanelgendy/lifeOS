import { useState, useEffect } from 'react';
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

  // Save changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to save quran records to localStorage:', e);
    }
  }, [records]);

  const getRecord = (surahNumber: number, ayahStart: number, ayahEnd: number): HifdhRecord | undefined => {
    return records.find(
      (r) => r.surahNumber === surahNumber && r.ayahStart === ayahStart && r.ayahEnd === ayahEnd
    );
  };

  const updateRecordStatus = (
    surahNumber: number,
    ayahStart: number,
    ayahEnd: number,
    status: MemorizationStatus
  ) => {
    setRecords((prev) => {
      const existing = prev.find(
        (r) => r.surahNumber === surahNumber && r.ayahStart === ayahStart && r.ayahEnd === ayahEnd
      );

      const now = new Date().toISOString();
      if (existing) {
        return prev.map((r) =>
          r === existing
            ? { ...r, status, lastReviewedAt: now }
            : r
        );
      } else {
        const newRecord: HifdhRecord = {
          surahNumber,
          ayahStart,
          ayahEnd,
          status,
          masteryScore: status === 'memorized' ? 100 : 50,
          repeatsDone: 1,
          lastReviewedAt: now,
          nextReviewAt: new Date(Date.now() + 86400000).toISOString(), // 1 day
          intervalDays: 1,
          easeFactor: 2.5,
        };
        return [...prev, newRecord];
      }
    });
  };

  /**
   * Applies SM-2 Spaced Repetition Rating
   */
  const reviewRecord = (
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

      // Calculate SM-2 interval
      if (gradeVal < 3) {
        intervalDays = 1;
        masteryScore = Math.max(10, masteryScore - 20);
      } else {
        if (repeatsDone === 1) {
          intervalDays = 1;
        } else if (repeatsDone === 2) {
          intervalDays = 6;
        } else {
          intervalDays = Math.round(intervalDays * easeFactor);
        }
        masteryScore = Math.min(100, masteryScore + (gradeVal === 4 ? 15 : 10));
      }

      // Update Ease Factor
      easeFactor = easeFactor + (0.1 - (5 - gradeVal) * (0.08 + (5 - gradeVal) * 0.02));
      if (easeFactor < 1.3) easeFactor = 1.3;

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + intervalDays);

      const updated: HifdhRecord = {
        ...existing,
        status: masteryScore >= 85 ? 'memorized' : 'reviewing',
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
  };

  // Get items due for review today
  const dueReviews = records.filter((r) => {
    if (!r.nextReviewAt) return false;
    return new Date(r.nextReviewAt) <= new Date();
  });

  const totalVersesMemorized = records
    .filter((r) => r.status === 'memorized')
    .reduce((sum, r) => sum + (r.ayahEnd - r.ayahStart + 1), 0);

  return {
    records,
    dueReviews,
    totalVersesMemorized,
    getRecord,
    updateRecordStatus,
    reviewRecord,
  };
}
