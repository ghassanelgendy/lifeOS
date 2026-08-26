export interface SurahMeta {
  id: number;
  name: string;
  transliteration: string;
  type: 'Meccan' | 'Medinan';
  versesCount: number;
  juzStart: number;
  pageStart: number;
}

export interface Ayah {
  number: number; // Global verse index (1..6236)
  numberInSurah: number;
  surahNumber: number;
  textUthmani: string;
  textSimple?: string;
  translation?: string;
  juz: number;
  page: number;
  hizbQuarter?: number;
}

export interface Reciter {
  id: string;
  name: string;
  style?: string;
  subfolder: string; // everyayah.com subfolder
}

export type MemorizationStatus = 'not_started' | 'memorizing' | 'reviewing' | 'memorized';

export type RatingGrade = 'again' | 'hard' | 'good' | 'easy';

export interface HifdhRecord {
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  status: MemorizationStatus;
  masteryScore: number; // 0 to 100
  repeatsDone: number;
  lastReviewedAt: string; // ISO date
  nextReviewAt: string; // ISO date
  intervalDays: number;
  easeFactor: number;
  notes?: string;
}

export interface RepeatSettings {
  verseRepeats: number; // How many times to repeat each verse
  rangeRepeats: number; // How many times to repeat the whole range
  delaySeconds: number; // Pause between repeats for user to recite
  autoAdvance: boolean;
  blindMode: boolean;
}

export interface MutashabihItem {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  matchedSurah: number;
  matchedAyah: number;
  snippet: string;
  matchedSnippet: string;
  similarityNote: string;
}
