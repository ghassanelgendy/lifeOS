import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Calendar, Layers, Award, Sparkles, Target, X } from 'lucide-react';
import { Reciter, RepeatSettings, HifdhRecord, LifeOSIntegrationProps, KhatmahPlan, ReadingWirdPlan } from '../types/quran';
import { RECITERS, SURAHS } from '../services/quranData';
import { useQuranAudio } from '../hooks/useQuranAudio';
import { useQuranMemorizer } from '../hooks/useQuranMemorizer';
import { AudioPlayerBar } from './AudioPlayerBar';
import { QuranReaderView } from './QuranReaderView';
import { RevisionScheduler } from './RevisionScheduler';
import { MutashabihatView } from './MutashabihatView';
import { KhatmahPlannerView } from './KhatmahPlannerView';

const QURAN_LAST_POSITION_KEY = 'quran_last_position_v1';
const HADITH_LAST_SHOWN_KEY = 'quran_hadith_last_shown_v1';
const HADITH_CURRENT_INDEX_KEY = 'quran_hadith_current_idx_v1';
const HADITH_SEEN_HISTORY_KEY = 'quran_hadith_seen_history_v1';

const QURAN_HADITHS = [
  { text: 'خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ', narrator: 'رواه البخاري' },
  { text: 'اقْرَؤُوا القُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ القِيَامَةِ شَفِيعًا لِأَصْحَابِهِ', narrator: 'رواه مسلم' },
  { text: 'الَّذِي يَقْرَأُ القُرْآنَ وَهُوَ مَاهِرٌ بِهِ مَعَ السَّفَرَةِ الكِرَامِ البَرَرَةِ، وَالَّذِي يَقْرَأُ القُرْآنَ وَيَتَتَعْتَعُ فِيهِ وَهُوَ عَلَيْهِ شَاقٌّ لَهُ أَجْرَانِ', narrator: 'متفق عليه' },
  { text: 'إِنَّ اللَّهَ يَرْفَعُ بِهَذَا الكِتَابِ أَقْوَامًا وَيَضَعُ بِهِ آخَرِينَ', narrator: 'رواه مسلم' },
  { text: 'يُقَالُ لِصَاحِبِ القُرْآنِ: اقْرَأْ وَارْتَقِ وَرَتِّلْ كَمَا كُنْتَ تُرَتِّلُ فِي الدُّنْيَا، فَإِنَّ مَنْزِلَتَكَ عِنْدَ آخِرِ آيَةٍ تَقْرَؤُهَا', narrator: 'رواه الترمذي وأبو داود' },
  { text: 'مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ بِهِ حَسَنَةٌ، وَالحَسَنَةُ بِعَشْرِ أَمْثَالِهَا', narrator: 'رواه الترمذي' },
  { text: 'مَثَلُ المُؤْمِنِ الَّذِي يَقْرَأُ القُرْآنَ كَمَثَلِ الأُتْرُجَّةِ؛ رِيحُهَا طَيِّبٌ وَطَعْمُهَا طَيِّبٌ', narrator: 'متفق عليه' },
  { text: 'تَعَاهَدُوا هَذَا القُرْآنَ، فَوَالَّذِي نَفْسِي بِيَدِهِ لَهُوَ أَشَدُّ تَفَلُّتًا مِنَ الإِبِلِ فِي عُقُلِهَا', narrator: 'متفق عليه' },
  { text: 'لا حَسَدَ إِلا فِي اثْنَتَيْنِ: رَجُلٌ آتَاهُ اللَّهُ القُرْآنَ فَهُوَ يَقُومُ بِهِ آنَاءَ اللَّيْلِ وَآنَاءَ النَّهَارِ', narrator: 'متفق عليه' },
  { text: 'إِنَّ الَّذِي لَيْسَ فِي جَوْفِهِ شَيْءٌ مِنَ القُرْآنِ كَالْبَيْتِ الخَرِبِ', narrator: 'رواه الترمذي' },
  { text: 'أَبْشِرُوا؛ فَإِنَّ هَذَا القُرْآنَ طَرَفُهُ بِيَدِ اللَّهِ، وَطَرَفُهُ بِأَيْدِيكُمْ، فَتَمَسَّكُوا بِهِ', narrator: 'رواه الطبراني وصححه الألباني' },
  { text: 'الصِّيَامُ وَالقُرْآنُ يَشْفَعَانِ لِلْعَبْدِ يَوْمَ القِيَامَةِ', narrator: 'رواه أحمد وصححه الألباني' },
  { text: 'مَنْ سَرَّهُ أَنْ يُحِبَّ اللَّهَ وَرَسُولَهُ فَلْيَقْرَأْ فِي المُصْحَفِ', narrator: 'رواه أبو نعيم وحسنه الألباني' },
  { text: 'أَفَلا يَغْدُو أَحَدُكُمْ إِلَى المَسْجِدِ فَيَعْلَمَ أَوْ يَقْرَأَ آيَتَيْنِ مِنْ كِتَابِ اللَّهِ عَزَّ وَجَلَّ خَيْرٌ لَهُ مِنْ نَاقَتَيْنِ', narrator: 'رواه مسلم' },
  { text: 'يَجِيءُ القُرْآنُ يَوْمَ القِيَامَةِ فَيَقُولُ: يَا رَبِّ حَلِّهِ، فَيُلْبَسُ تَاجَ الكَرَامَةِ، ثُمَّ يَقُولُ: يَا رَبِّ زِدْهُ، فَيُلْبَسُ حُلَّةَ الكَرَامَةِ', narrator: 'رواه الترمذي' },
  { text: 'القُرْآنُ حُجَّةٌ لَكَ أَوْ عَلَيْكَ', narrator: 'رواه مسلم' },
  { text: 'مَنْ قَرَأَ القُرْآنَ وَعَمِلَ بِمَا فِيهِ أُلْبِسَ وَالِدَاهُ تَاجًا يَوْمَ القِيَامَةِ ضَوْؤُهُ أَحْسَنُ مِنْ ضَوْءِ الشَّمْسِ', narrator: 'رواه أبو داود' },
  { text: 'مَا اجْتَمَعَ قَوْمٌ فِي بَيْتٍ مِنْ بُيُوتِ اللَّهِ يَتْلُونَ كِتَابَ اللَّهِ وَيَتَدَارَسُونَهُ بَيْنَهُمْ إِلَّا نَزَلَتْ عَلَيْهِمُ السَّكِينَةُ وَغَشِيَتْهُمُ الرَّحْمَةُ', narrator: 'رواه مسلم' },
  { text: 'زَيِّنُوا القُرْآنَ بِأَصْوَاتِكُمْ، فَإِنَّ الصَّوْتَ الحَسَنَ يَزِيدُ القُرْآنَ حُسْنًا', narrator: 'رواه الحاكم وأبو داود' },
  { text: 'اقْرَؤُوا الزَّهْرَاوَيْنِ: البَقَرَةَ وَسُورَةَ آلِ عِمْرَانَ، فَإِنَّهُمَا تَأْتِيَانِ يَوْمَ القِيَامَةِ كَأَنَّهُمَا غَمَامَتَانِ تُحَاجَّانِ عَنْ أَصْحَابِهِمَا', narrator: 'رواه مسلم' },
];

const getSurahForPage = (page: number) => {
  let found = SURAHS[0];
  for (const s of SURAHS) {
    if (s.pageStart <= page) {
      found = s;
    } else {
      break;
    }
  }
  return found;
};

export const QuranMemorizerMain: React.FC<LifeOSIntegrationProps> = ({
  linkedTasks = [],
  linkedHabits = [],
  linkedEvents = [],
  onToggleTask,
  onToggleHabit,
  onUpdateHabitDescription,
  onCreateQuranTask,
  onCreateHalqahNote,
  onBookmarkAyah,
}) => {
  const [activeTab, setActiveTab] = useState<'reader' | 'khatmah' | 'revision' | 'mutashabihat'>(() => {
    try {
      const saved = localStorage.getItem(QURAN_LAST_POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeTab) return parsed.activeTab;
      }
    } catch {}
    return 'khatmah';
  });

  const [showHadithModal, setShowHadithModal] = useState(false);
  const [currentHadithIdx, setCurrentHadithIdx] = useState(0);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Full-screen reading mode shared with the reader + audio player bar so the
  // player can collapse to its small state while reading full-screen.
  const [readerFullscreen, setReaderFullscreen] = useState(false);

  // 12-Hour Non-Repeating Hadith Dialog logic (Mobile Only - Never on PC)
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || window.innerWidth >= 768) {
        setShowHadithModal(false);
        return;
      }

      const now = Date.now();
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      const lastShown = Number(localStorage.getItem(HADITH_LAST_SHOWN_KEY) || 0);
      const isElapsed = !lastShown || now - lastShown >= twelveHoursMs;

      if (isElapsed) {
        let seen: number[] = [];
        try {
          const raw = localStorage.getItem(HADITH_SEEN_HISTORY_KEY);
          if (raw) seen = JSON.parse(raw);
        } catch {}

        let available = QURAN_HADITHS.map((_, i) => i).filter((i) => !seen.includes(i));
        if (available.length === 0) {
          const lastSeen = seen[seen.length - 1];
          seen = [];
          available = QURAN_HADITHS.map((_, i) => i).filter((i) => i !== lastSeen);
        }

        const chosenIdx = available[Math.floor(Math.random() * available.length)];
        const updatedSeen = [...seen, chosenIdx];

        setCurrentHadithIdx(chosenIdx);
        localStorage.setItem(HADITH_CURRENT_INDEX_KEY, chosenIdx.toString());
        localStorage.setItem(HADITH_SEEN_HISTORY_KEY, JSON.stringify(updatedSeen));
        localStorage.setItem(HADITH_LAST_SHOWN_KEY, now.toString());
        setShowHadithModal(true);
      } else {
        const savedIdx = Number(localStorage.getItem(HADITH_CURRENT_INDEX_KEY) || 0);
        setCurrentHadithIdx(savedIdx >= 0 && savedIdx < QURAN_HADITHS.length ? savedIdx : 0);
      }
    } catch {}
  }, []);

  // Selection state
  const [selectedSurah, setSelectedSurah] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(QURAN_LAST_POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.selectedSurah === 'number') return parsed.selectedSurah;
      }
    } catch {}
    return 1;
  });

  const [startAyah, setStartAyah] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(QURAN_LAST_POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.startAyah === 'number') return parsed.startAyah;
      }
    } catch {}
    return 1;
  });

  const [endAyah, setEndAyah] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(QURAN_LAST_POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.endAyah === 'number') return parsed.endAyah;
      }
    } catch {}
    return 7;
  });

  const [savedAyahIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(QURAN_LAST_POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.currentAyahIndex === 'number') return parsed.currentAyahIndex;
      }
    } catch {}
    return 1;
  });

  const QURAN_SETTINGS_KEY = 'quran_audio_settings_v1';

  const [reciter, setReciter] = useState<Reciter>(() => {
    try {
      const saved = localStorage.getItem(QURAN_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.reciterId) {
          const found = RECITERS.find((r) => r.id === parsed.reciterId);
          if (found) return found;
        }
      }
    } catch {}
    return RECITERS[0];
  });

  // Repeat & Blind mode settings
  const [repeatSettings, setRepeatSettings] = useState<RepeatSettings>(() => {
    try {
      const saved = localStorage.getItem(QURAN_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.repeatSettings) return parsed.repeatSettings;
      }
    } catch {}
    return {
      verseRepeats: 1,
      rangeRepeats: 1,
      delaySeconds: 0,
      autoAdvance: true,
      blindMode: false,
    };
  });

  // Persist Audio & Repeat Settings whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(
        QURAN_SETTINGS_KEY,
        JSON.stringify({
          reciterId: reciter.id,
          repeatSettings,
        })
      );
    } catch {}
  }, [reciter, repeatSettings]);

  const memorizerStore = useQuranMemorizer();

  const currentSurah = SURAHS.find((s) => s.id === selectedSurah) || SURAHS[0];

  // Update endAyah when surah changes
  const handleSurahChange = (surahNum: number) => {
    setSelectedSurah(surahNum);
    setStartAyah(1);
    const meta = SURAHS.find((s) => s.id === surahNum);
    setEndAyah(meta ? meta.versesCount : 7);
  };

  // Quick Preset: Play entire Surah with pause & no repetition
  const handlePlayFullSurah = (delaySec = 2) => {
    const meta = SURAHS.find((s) => s.id === selectedSurah) || SURAHS[0];
    setStartAyah(1);
    setEndAyah(meta.versesCount);
    setRepeatSettings((prev) => ({
      ...prev,
      verseRepeats: 1,
      rangeRepeats: 1,
      delaySeconds: delaySec,
      autoAdvance: true,
    }));
  };

  // Audio Hook
  const audio = useQuranAudio({
    reciter,
    surahNumber: selectedSurah,
    startAyah,
    endAyah,
    initialAyahIndex: savedAyahIndex,
    repeatSettings,
  });

  // Persist position whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        QURAN_LAST_POSITION_KEY,
        JSON.stringify({
          activeTab,
          selectedSurah,
          startAyah,
          endAyah,
          currentAyahIndex: audio.currentAyahIndex,
        })
      );
    } catch {}
  }, [activeTab, selectedSurah, startAyah, endAyah, audio.currentAyahIndex]);

  const handleSelectReviewItem = (record: HifdhRecord) => {
    setSelectedSurah(record.surahNumber);
    setStartAyah(record.ayahStart);
    setEndAyah(record.ayahEnd);
    setActiveTab('reader');
  };

  const [memorizationPlan, setMemorizationPlan] = useState<KhatmahPlan | null>(() => {
    try {
      const saved = localStorage.getItem('quran_khatmah_plan_v1');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [readingWird, setReadingWird] = useState<ReadingWirdPlan>(() => {
    try {
      const saved = localStorage.getItem('quran_reading_wird_v1');
      return saved ? JSON.parse(saved) : { currentPage: 1, pagesPerDay: 4, streakDays: 0 };
    } catch {
      return { currentPage: 1, pagesPerDay: 4, streakDays: 0 };
    }
  });

  useEffect(() => {
    const handleStorageUpdate = () => {
      try {
        const pSaved = localStorage.getItem('quran_khatmah_plan_v1');
        if (pSaved) setMemorizationPlan(JSON.parse(pSaved));
        const rSaved = localStorage.getItem('quran_reading_wird_v1');
        if (rSaved) setReadingWird(JSON.parse(rSaved));

        const mSaved = localStorage.getItem('quran_memorization_marker_v1');
        if (mSaved) setMemorizationMarker(JSON.parse(mSaved));

        const rdSaved = localStorage.getItem('quran_reading_marker_v1');
        if (rdSaved) setReadingMarker(JSON.parse(rdSaved));
      } catch {}
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('quran_plan_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('quran_plan_updated', handleStorageUpdate);
    };
  }, []);

  const [memorizationMarker, setMemorizationMarker] = useState<{ surahNumber: number; ayahNumber: number; page: number }>(() => {
    try {
      const saved = localStorage.getItem('quran_memorization_marker_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    const page = memorizationPlan ? memorizationPlan.currentPage : 575; // Default to Al-Muddaththir ص 575
    const surah = SURAHS.find((s, idx) => {
      const nextS = SURAHS[idx + 1];
      const pageEnd = nextS ? nextS.pageStart - 1 : 604;
      return s.pageStart <= page && page <= pageEnd;
    }) || SURAHS[73];
    return { surahNumber: surah.id, ayahNumber: 1, page };
  });

  const [readingMarker, setReadingMarker] = useState<{ surahNumber: number; ayahNumber: number; page: number }>(() => {
    try {
      const saved = localStorage.getItem('quran_reading_marker_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    const page = readingWird ? readingWird.currentPage : 1;
    const surah = SURAHS.find((s, idx) => {
      const nextS = SURAHS[idx + 1];
      const pageEnd = nextS ? nextS.pageStart - 1 : 604;
      return s.pageStart <= page && page <= pageEnd;
    }) || SURAHS[0];
    return { surahNumber: surah.id, ayahNumber: 1, page };
  });

  const handleOpenReaderFromKhatmah = (page: number, surahNumber?: number) => {
    const targetSurah = surahNumber || getSurahForPage(page).id;
    setSelectedSurah(targetSurah);
    try {
      localStorage.setItem('quran_active_page_v1', page.toString());
      localStorage.setItem('quran_last_position_v1', JSON.stringify({ activeTab: 'reader', selectedSurah: targetSurah }));
      window.dispatchEvent(new Event('quran_active_page_updated'));
    } catch {}
    setActiveTab('reader');
  };

  const handleSetMemorizationMarker = (surahNumber: number, ayahNumber: number, page: number) => {
    const marker = { surahNumber, ayahNumber, page };
    setMemorizationMarker(marker);
    try {
      localStorage.setItem('quran_memorization_marker_v1', JSON.stringify(marker));
      localStorage.setItem('quran_active_page_v1', page.toString());
      if (memorizationPlan) {
        const updated = { ...memorizationPlan, currentPage: page };
        setMemorizationPlan(updated);
        localStorage.setItem('quran_khatmah_plan_v1', JSON.stringify(updated));
      }
      window.dispatchEvent(new Event('quran_active_page_updated'));
      window.dispatchEvent(new Event('quran_plan_updated'));
    } catch {}

    const surahName = SURAHS.find((s) => s.id === surahNumber)?.name || `سورة ${surahNumber}`;
    const memHabit = linkedHabits.find(
      (h) => /memoriz|حفظ|تحفيظ|تسميع|تثبيت/i.test(h.title) && !/ورد|تلاوة|قراءة|reading|tilawah/i.test(h.title)
    ) || linkedHabits.find((h) => /memoriz|حفظ|تحفيظ|تسميع|تثبيت/i.test(h.title));

    if (memHabit) {
      if (onUpdateHabitDescription) {
        onUpdateHabitDescription(
          memHabit.id,
          `آخر موضع حفظ: سورة ${surahName} (الآية ${ayahNumber}) • صفحة ${page}`
        );
      }
      if (!memHabit.is_completed_today && onToggleHabit) {
        onToggleHabit(memHabit.id, true);
      }
    }
  };

  const handleSetReadingMarker = (surahNumber: number, ayahNumber: number, page: number) => {
    const marker = { surahNumber, ayahNumber, page };
    setReadingMarker(marker);
    try {
      localStorage.setItem('quran_reading_marker_v1', JSON.stringify(marker));
      localStorage.setItem('quran_active_page_v1', page.toString());
      if (readingWird) {
        const updated = { ...readingWird, currentPage: page };
        setReadingWird(updated);
        localStorage.setItem('quran_reading_wird_v1', JSON.stringify(updated));
      }
      window.dispatchEvent(new Event('quran_active_page_updated'));
      window.dispatchEvent(new Event('quran_plan_updated'));
    } catch {}

    const surahName = SURAHS.find((s) => s.id === surahNumber)?.name || `سورة ${surahNumber}`;
    const readingHabit = linkedHabits.find(
      (h) => /ورد|تلاوة|قراءة|reading|tilawah/i.test(h.title) && !/حفظ|memoriz|تحفيظ|تسميع/i.test(h.title)
    );
    if (readingHabit) {
      if (onUpdateHabitDescription) {
        onUpdateHabitDescription(
          readingHabit.id,
          `آخر موضع تلاوة: سورة ${surahName} (الآية ${ayahNumber}) • صفحة ${page}`
        );
      }
      if (!readingHabit.is_completed_today && onToggleHabit) {
        onToggleHabit(readingHabit.id, true);
      }
    }
  };

  const memorizationPage = memorizationPlan ? memorizationPlan.currentPage : memorizationMarker.page;
  const memorizationEndPage = memorizationPlan
    ? memorizationPlan.direction === 'reverse'
      ? Math.max(memorizationPlan.endPage, memorizationPlan.currentPage - memorizationPlan.pagesPerDay)
      : Math.min(memorizationPlan.endPage, memorizationPlan.currentPage + memorizationPlan.pagesPerDay)
    : undefined;

  const readingPage = readingWird ? readingWird.currentPage : readingMarker.page;
  const readingEndPage = readingWird ? Math.min(604, readingWird.currentPage + readingWird.pagesPerDay) : undefined;

  const handleSyncMemorization = () => {
    setSelectedSurah(memorizationMarker.surahNumber);
    audio.setCurrentAyahIndex(memorizationMarker.ayahNumber);
    setStartAyah(memorizationMarker.ayahNumber);
    setEndAyah(Math.min(memorizationMarker.ayahNumber + 4, SURAHS.find(s => s.id === memorizationMarker.surahNumber)?.versesCount || 7));
    try {
      localStorage.setItem('quran_active_page_v1', memorizationMarker.page.toString());
      window.dispatchEvent(new Event('quran_active_page_updated'));
    } catch {}
    setActiveTab('reader');
  };

  const handleSyncReading = () => {
    setSelectedSurah(readingMarker.surahNumber);
    audio.setCurrentAyahIndex(readingMarker.ayahNumber);
    setStartAyah(readingMarker.ayahNumber);
    setEndAyah(Math.min(readingMarker.ayahNumber + 4, SURAHS.find(s => s.id === readingMarker.surahNumber)?.versesCount || 7));
    try {
      localStorage.setItem('quran_active_page_v1', readingMarker.page.toString());
      window.dispatchEvent(new Event('quran_active_page_updated'));
    } catch {}
    setActiveTab('reader');
  };

  // Check URL params or lifeos:openQuran event for deep linking to specific Wird / Page
  useEffect(() => {
    const handleOpenQuran = (e?: any) => {
      let targetPage = e?.detail?.page;
      let targetSurah = e?.detail?.surah;
      let targetAyah = e?.detail?.ayah;
      let targetMode = e?.detail?.mode;
      let targetTab = e?.detail?.tab;

      // Check URL query parameters if event details are missing
      if (!targetPage && !targetSurah && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const p = params.get('page');
        const s = params.get('surah');
        const a = params.get('ayah');
        const m = params.get('mode');
        const t = params.get('tab');
        if (p) targetPage = Number(p);
        if (s) targetSurah = Number(s);
        if (a) targetAyah = Number(a);
        if (m) targetMode = m;
        if (t) targetTab = t;

        // Clean up URL search params so tab toggling isn't re-routed on re-renders
        if (p || s || a || m || t) {
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch {}
        }
      }

      if (targetTab && (targetTab === 'reader' || targetTab === 'khatmah' || targetTab === 'revision' || targetTab === 'mutashabihat')) {
        setActiveTab(targetTab);
      }

      if (targetMode === 'memorization') {
        const mSaved = localStorage.getItem('quran_memorization_marker_v1');
        const marker = mSaved ? JSON.parse(mSaved) : null;
        targetPage = targetPage || marker?.page || (memorizationPlan ? memorizationPlan.currentPage : 575);
        targetSurah = targetSurah || marker?.surahNumber;
        targetAyah = targetAyah || marker?.ayahNumber || 1;
      } else if (targetMode === 'reading') {
        const rSaved = localStorage.getItem('quran_reading_marker_v1');
        const marker = rSaved ? JSON.parse(rSaved) : null;
        targetPage = targetPage || marker?.page || (readingWird ? readingWird.currentPage : 1);
        targetSurah = targetSurah || marker?.surahNumber;
        targetAyah = targetAyah || marker?.ayahNumber || 1;
      }

      if (targetPage) {
        localStorage.setItem('quran_active_page_v1', targetPage.toString());
        if (!targetSurah) {
          const found = SURAHS.find((s, idx) => {
            const nextS = SURAHS[idx + 1];
            const pageEnd = nextS ? nextS.pageStart - 1 : 604;
            return s.pageStart <= targetPage && targetPage <= pageEnd;
          });
          targetSurah = found?.id;
        }
      }

      if (targetSurah) {
        setSelectedSurah(targetSurah);
      }

      if (targetAyah) {
        audio.setCurrentAyahIndex(targetAyah);
        setStartAyah(targetAyah);
        setEndAyah(Math.min(targetAyah + 4, SURAHS.find((s) => s.id === (targetSurah || selectedSurah))?.versesCount || 7));
      }

      if (targetPage || targetSurah || targetAyah) {
        window.dispatchEvent(new Event('quran_active_page_updated'));
      }
    };

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('page') || params.get('surah') || params.get('tab') || params.get('mode')) {
        handleOpenQuran();
      }
    }

    window.addEventListener('lifeos:openQuran', handleOpenQuran);
    return () => {
      window.removeEventListener('lifeos:openQuran', handleOpenQuran);
    };
  }, []);

  const currentHadith = QURAN_HADITHS[currentHadithIdx] || QURAN_HADITHS[0];

  return (
    <div dir="rtl" className="flex flex-col font-arabic-body text-right">
      {/* Native iOS Segmented Control Navbar */}
      <header
        className={`sticky top-0 z-30 bg-background/80 backdrop-blur-2xl border-b border-border/30 px-3 py-2.5 -mx-4 md:-mx-6 -mt-4 md:-mt-6 ${
          activeTab === 'reader' ? 'mb-2 sm:mb-3' : 'mb-4'
        }`}
      >
        <div className="max-w-2xl mx-auto w-full">
          {/* iOS Native Segmented Tabs Pill */}
          <div dir="rtl" className="w-full grid grid-cols-4 bg-muted/60 p-1 rounded-2xl border border-border/50 shadow-inner">
            <button
              onClick={() => setActiveTab('khatmah')}
              className={`py-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'khatmah'
                  ? 'bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="size-3.5 text-emerald-500 shrink-0" />
              <span>الخاتمة</span>
            </button>

            <button
              onClick={() => setActiveTab('reader')}
              className={`py-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'reader'
                  ? 'bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="size-3.5 text-emerald-500 shrink-0" />
              <span>المصحف</span>
            </button>

            <button
              onClick={() => setActiveTab('revision')}
              className={`py-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'revision'
                  ? 'bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="size-3.5 text-amber-500 shrink-0" />
              <span>المراجعة</span>
            </button>

            <button
              onClick={() => setActiveTab('mutashabihat')}
              className={`py-2 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                activeTab === 'mutashabihat'
                  ? 'bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-3.5 text-indigo-400 shrink-0" />
              <span>المتشابهات</span>
            </button>
          </div>
        </div>
      </header>

      {/* 12-Hour Daily Hadith Modal (Mobile Only - Never on PC/Desktop) */}
      {isMobile &&
        showHadithModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-300 md:hidden font-arabic-title"
            onClick={() => setShowHadithModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-card/95 backdrop-blur-2xl p-5 space-y-4 shadow-2xl text-center overscroll-contain animate-in fade-in zoom-in-95 duration-300 ease-out"
            >
              {/* Header Badge */}
              <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-cairo font-bold shadow-sm">
                  <Sparkles className="size-3.5 text-emerald-400" />
                  <span>حديث اليوم في فضل القرآن</span>
                </div>
              </div>

              {/* Enhanced Hadith Box for Mobile */}
              <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 via-emerald-950/20 to-zinc-950/50 shadow-inner space-y-3">
                <blockquote className="font-arabic-quran text-xl sm:text-2xl text-emerald-200 font-bold leading-[2.3] text-center drop-shadow-sm select-none">
                  «{currentHadith.text}»
                </blockquote>

                {/* Narrator Section in Cairo Font */}
                <div className="pt-2.5 border-t border-emerald-500/20 text-center">
                  <span className="font-cairo text-xs font-bold text-muted-foreground/90 tracking-wide block">
                    {currentHadith.narrator}
                  </span>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => setShowHadithModal(false)}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-cairo font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                متابعة القراءة
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Main Content Body */}
      <main
        className={`flex-1 max-w-6xl w-full mx-auto pb-32 md:pb-40 text-right ${
          activeTab === 'reader' ? 'px-2 sm:px-4 md:px-6 pt-1 sm:pt-2 space-y-3' : 'p-4 md:p-6 space-y-6'
        }`}
      >
        {activeTab === 'khatmah' && (
          <KhatmahPlannerView
            linkedTasks={linkedTasks}
            linkedHabits={linkedHabits}
            linkedEvents={linkedEvents}
            onToggleTask={onToggleTask}
            onToggleHabit={onToggleHabit}
            onUpdateHabitDescription={onUpdateHabitDescription}
            onCreateTask={onCreateQuranTask}
            onCreateHalqahNote={onCreateHalqahNote}
            onOpenReader={handleOpenReaderFromKhatmah}
          />
        )}

        {activeTab === 'reader' && (
          <QuranReaderView
            surahNumber={selectedSurah}
            onSelectSurah={handleSurahChange}
            currentAyahIndex={audio.currentAyahIndex}
            onSelectAyah={audio.setCurrentAyahIndex}
            startAyah={startAyah}
            endAyah={endAyah}
            onStartAyahChange={setStartAyah}
            onEndAyahChange={setEndAyah}
            isAudioPlaying={audio.isPlaying}
            isDelaying={audio.isDelaying}
            repeatSettings={repeatSettings}
            onChangeRepeatSettings={setRepeatSettings}
            onGradeVerse={(grade) =>
              memorizerStore.reviewRecord(selectedSurah, startAyah, endAyah, grade)
            }
            onMarkMemorized={(surahNum, sAyah, eAyah) => {
              const targetSurah = surahNum ?? selectedSurah;
              const targetStart = sAyah ?? startAyah;
              const targetEnd = eAyah ?? endAyah;
              const existing = memorizerStore.getVerseMastery(targetSurah, targetStart);
              const nextStatus = existing?.status === 'memorized' ? 'reviewing' : 'memorized';
              memorizerStore.updateRecordStatus(targetSurah, targetStart, targetEnd, nextStatus);
            }}
            getVerseMastery={memorizerStore.getVerseMastery}
            memorizationPage={memorizationPage}
            memorizationEndPage={memorizationEndPage}
            readingPage={readingPage}
            readingEndPage={readingEndPage}
            memorizationMarker={memorizationMarker}
            readingMarker={readingMarker}
            onSetMemorizationMarker={handleSetMemorizationMarker}
            onSetReadingMarker={handleSetReadingMarker}
            onSyncMemorization={handleSyncMemorization}
            onSyncReading={handleSyncReading}
            onOpenHalqahNote={() => setActiveTab('khatmah')}
            onBookmarkAyah={onBookmarkAyah}
            onTogglePlayPause={audio.togglePlayPause}
            onNextAyah={audio.nextAyah}
            onPrevAyah={audio.prevAyah}
            reciterName={reciter.name}
            isFullscreen={readerFullscreen}
            onFullscreenChange={setReaderFullscreen}
          />
        )}

        {activeTab === 'revision' && (
          <RevisionScheduler
            dueReviews={memorizerStore.dueReviews}
            allRecords={memorizerStore.records}
            onSelectReview={handleSelectReviewItem}
            onGradeReview={memorizerStore.reviewRecord}
          />
        )}

        {activeTab === 'mutashabihat' && (
          <MutashabihatView
            currentSurahNumber={selectedSurah}
            currentAyahNumber={audio.currentAyahIndex}
          />
        )}

        {/* Sticky Audio Player Bar — only on the reader tab so it never covers
            the khatmah / revision / mutashabihat action buttons */}
        {activeTab === 'reader' && (
          <AudioPlayerBar
            reciter={reciter}
            onSelectReciter={setReciter}
            isPlaying={audio.isPlaying}
            isDelaying={audio.isDelaying}
            currentAyahIndex={audio.currentAyahIndex}
            currentVerseRepeat={audio.currentVerseRepeat}
            currentRangeLoop={audio.currentRangeLoop}
            playbackRate={audio.playbackRate}
            repeatSettings={repeatSettings}
            onChangeRepeatSettings={setRepeatSettings}
            onTogglePlayPause={audio.togglePlayPause}
            onStop={audio.stop}
            onNext={audio.nextAyah}
            onPrev={audio.prevAyah}
            onChangeSpeed={audio.changePlaybackRate}
            forceSmall={readerFullscreen}
          />
        )}
      </main>
    </div>
  );
};
