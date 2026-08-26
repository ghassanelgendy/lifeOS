import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Calendar, Layers, Award, Sparkles, Target, X } from 'lucide-react';
import { Reciter, RepeatSettings, HifdhRecord, LifeOSIntegrationProps } from '../types/quran';
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

const QURAN_HADITHS = [
  { text: 'خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ', narrator: 'رواه البخاري' },
  { text: 'اقْرَؤُوا القُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ القِيَامَةِ شَفِيعًا لِأَصْحَابِهِ', narrator: 'رواه مسلم' },
  { text: 'الَّذِي يَقْرَأُ القُرْآنَ وَهُوَ مَاهِرٌ بِهِ مَعَ السَّفَرَةِ الكِرَامِ البَرَرَةِ', narrator: 'متفق عليه' },
  { text: 'إِنَّ اللَّهَ يَرْفَعُ بِهَذَا الكِتَابِ أَقْوَامًا وَيَضَعُ بِهِ آخَرِينَ', narrator: 'رواه مسلم' },
];

export const QuranMemorizerMain: React.FC<LifeOSIntegrationProps> = ({
  linkedTasks = [],
  linkedHabits = [],
  linkedEvents = [],
  onToggleTask,
  onToggleHabit,
  onUpdateHabitDescription,
  onCreateQuranTask,
  onCreateHalqahNote,
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

  // 12-Hour Hadith Toast Auto-Show logic on Mobile
  useEffect(() => {
    try {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) return;

      const lastShown = localStorage.getItem(HADITH_LAST_SHOWN_KEY);
      const now = Date.now();
      const twelveHoursMs = 12 * 60 * 60 * 1000;

      if (!lastShown || now - Number(lastShown) > twelveHoursMs) {
        const randomIdx = Math.floor(Math.random() * QURAN_HADITHS.length);
        setCurrentHadithIdx(randomIdx);
        setShowHadithModal(true);
        localStorage.setItem(HADITH_LAST_SHOWN_KEY, now.toString());
      }
    } catch {}
  }, []);

  const openHadithModalManual = () => {
    const randomIdx = Math.floor(Math.random() * QURAN_HADITHS.length);
    setCurrentHadithIdx(randomIdx);
    setShowHadithModal(true);
  };

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

  const [reciter, setReciter] = useState<Reciter>(RECITERS[0]);

  // Repeat & Blind mode settings
  const [repeatSettings, setRepeatSettings] = useState<RepeatSettings>({
    verseRepeats: 3,
    rangeRepeats: 1,
    delaySeconds: 2,
    autoAdvance: true,
    blindMode: false,
  });

  const memorizerStore = useQuranMemorizer();

  const currentSurah = SURAHS.find((s) => s.id === selectedSurah) || SURAHS[0];

  // Update endAyah when surah changes
  const handleSurahChange = (surahNum: number) => {
    setSelectedSurah(surahNum);
    setStartAyah(1);
    const meta = SURAHS.find((s) => s.id === surahNum);
    setEndAyah(meta ? Math.min(meta.versesCount, 7) : 7);
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
        setMemorizationPlan(pSaved ? JSON.parse(pSaved) : null);
        const rSaved = localStorage.getItem('quran_reading_wird_v1');
        setReadingWird(rSaved ? JSON.parse(rSaved) : { currentPage: 1, pagesPerDay: 4, streakDays: 0 });
      } catch {}
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('quran_plan_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('quran_plan_updated', handleStorageUpdate);
    };
  }, []);

  const memorizationPage = memorizationPlan ? memorizationPlan.currentPage : undefined;
  const memorizationEndPage = memorizationPlan
    ? memorizationPlan.direction === 'reverse'
      ? Math.max(memorizationPlan.endPage, memorizationPlan.currentPage - memorizationPlan.pagesPerDay)
      : Math.min(memorizationPlan.endPage, memorizationPlan.currentPage + memorizationPlan.pagesPerDay)
    : undefined;

  const readingPage = readingWird ? readingWird.currentPage : undefined;
  const readingEndPage = readingWird ? Math.min(604, readingWird.currentPage + readingWird.pagesPerDay) : undefined;

  const handleSyncMemorization = () => {
    if (memorizationPage) {
      const foundSurah =
        SURAHS.find((s, idx) => {
          const nextS = SURAHS[idx + 1];
          const pageEnd = nextS ? nextS.pageStart - 1 : 604;
          return s.pageStart <= memorizationPage && memorizationPage <= pageEnd;
        }) || SURAHS[0];

      setSelectedSurah(foundSurah.id);
      setStartAyah(1);
      setEndAyah(Math.min(7, foundSurah.versesCount));
      setActiveTab('reader');
    }
  };

  const handleSyncReading = () => {
    if (readingPage) {
      const foundSurah =
        SURAHS.find((s, idx) => {
          const nextS = SURAHS[idx + 1];
          const pageEnd = nextS ? nextS.pageStart - 1 : 604;
          return s.pageStart <= readingPage && readingPage <= pageEnd;
        }) || SURAHS[0];

      setSelectedSurah(foundSurah.id);
      setStartAyah(1);
      setEndAyah(Math.min(7, foundSurah.versesCount));
      setActiveTab('reader');
    }
  };

  const currentHadith = QURAN_HADITHS[currentHadithIdx] || QURAN_HADITHS[0];

  return (
    <div dir="rtl" className="-mt-4 -mx-4 md:-mt-6 md:-mx-6 flex flex-col font-arabic-body text-right">
      {/* Top Banner & Tab Navigation (Ultra Compact on Mobile) */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-xl p-3 md:p-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Header Title Bar */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-10 md:size-11 rounded-2xl bg-emerald-600/10 text-emerald-500 flex items-center justify-center font-bold text-xl shadow-sm border border-emerald-500/20 shrink-0">
                📖
              </div>
              <div className="text-right">
                <h1 className="text-base md:text-xl font-extrabold text-foreground flex items-center gap-2 font-arabic-title">
                  <span>مُحَفِّظُ القُرْآنِ الكَرِيمِ</span>
                </h1>
                {/* Description hidden on Mobile to bring first entry above the fold, visible on PC */}
                <p className="hidden md:block text-xs text-muted-foreground font-semibold mt-0.5">
                  تخطيط الخاتمات، التكرار الصوتي، المراجعة المتباعدة، ومتابعة جلسات التسميع مع الشيخ.
                </p>
              </div>
            </div>

            {/* Mobile Hadith of the Day Trigger Button */}
            <button
              onClick={openHadithModalManual}
              className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 text-[11px] font-bold active:scale-95 transition-all cursor-pointer"
              title="حديث اليوم"
            >
              <Sparkles className="size-3.5 text-amber-400" />
              <span>حديث اليوم</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div dir="rtl" className="flex items-center gap-1 bg-secondary/80 p-1 rounded-2xl border border-border/60 w-full sm:w-auto overflow-x-auto justify-between sm:justify-start shrink-0">
            <button
              onClick={() => setActiveTab('khatmah')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'khatmah'
                  ? 'bg-background text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="size-3.5 text-emerald-500 shrink-0" />
              <span>الخاتمة</span>
            </button>

            <button
              onClick={() => setActiveTab('reader')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reader'
                  ? 'bg-background text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="size-3.5 text-emerald-500 shrink-0" />
              <span>المصحف</span>
            </button>

            <button
              onClick={() => setActiveTab('revision')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'revision'
                  ? 'bg-background text-amber-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="size-3.5 text-amber-500 shrink-0" />
              <span>المراجعة ({memorizerStore.dueReviews.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('mutashabihat')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'mutashabihat'
                  ? 'bg-background text-indigo-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-3.5 text-indigo-400 shrink-0" />
              <span>المتشابهات</span>
            </button>
          </div>
        </div>
      </header>

      {/* 12-Hour Message of the Day Hadith Bottom Sheet Popup */}
      {showHadithModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowHadithModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-[2.5rem] sm:rounded-3xl border border-emerald-500/40 bg-card/95 backdrop-blur-2xl p-6 space-y-4 shadow-2xl text-center overscroll-contain pb-safe animate-in slide-in-from-bottom-5 duration-200"
            >
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-1" />

              <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto text-2xl border border-emerald-500/20">
                ✨
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground font-arabic-title">
                  حديث اليوم في فضل القرآن الكريم
                </h3>
                <p className="text-[11px] text-muted-foreground">رسالة تذكير وإلهام يومية</p>
              </div>

              <blockquote className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 font-arabic-quran text-lg md:text-xl text-emerald-300 font-bold leading-relaxed">
                «{currentHadith.text}»
              </blockquote>

              <p className="text-xs text-muted-foreground font-mono">
                — {currentHadith.narrator}
              </p>

              <button
                onClick={() => setShowHadithModal(false)}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                جزاكم الله خيراً — متابعة القراءة
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 pb-36 md:pb-40 text-right space-y-6">
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
            repeatSettings={repeatSettings}
            onChangeRepeatSettings={setRepeatSettings}
            onGradeVerse={(grade) =>
              memorizerStore.reviewRecord(selectedSurah, startAyah, endAyah, grade)
            }
            onMarkMemorized={() =>
              memorizerStore.updateRecordStatus(selectedSurah, startAyah, endAyah, 'memorized')
            }
            memorizationPage={memorizationPage}
            memorizationEndPage={memorizationEndPage}
            readingPage={readingPage}
            readingEndPage={readingEndPage}
            onSyncMemorization={handleSyncMemorization}
            onSyncReading={handleSyncReading}
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

        {/* Sticky Audio Player Bar inside container */}
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
        />
      </main>
    </div>
  );
};
