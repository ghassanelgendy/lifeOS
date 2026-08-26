import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Eye,
  EyeOff,
  Volume2,
  Target,
  Bookmark,
  Book,
  LayoutList,
  Award,
  SlidersHorizontal,
  FileText,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Compass,
} from 'lucide-react';
import { Ayah, RepeatSettings, RatingGrade, MemorizationStatus } from '../types/quran';
import { fetchSurahVerses } from '../services/quranApi';
import { SURAHS } from '../services/quranData';
import { BlindModeOverlay } from './BlindModeOverlay';

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

const JUZ_START_PAGES = Array.from({ length: 30 }, (_, i) => {
  const juzNum = i + 1;
  if (juzNum === 1) return { juz: 1, page: 1 };
  return { juz: juzNum, page: (juzNum - 2) * 20 + 22 };
});

interface WirdMarker {
  surahNumber: number;
  ayahNumber: number;
  page: number;
}

interface QuranReaderViewProps {
  surahNumber: number;
  onSelectSurah: (surahNumber: number) => void;
  currentAyahIndex: number;
  onSelectAyah: (ayahNumber: number) => void;
  startAyah: number;
  endAyah: number;
  onStartAyahChange: (val: number) => void;
  onEndAyahChange: (val: number) => void;
  isAudioPlaying: boolean;
  repeatSettings: RepeatSettings;
  onChangeRepeatSettings: (settings: RepeatSettings) => void;
  onGradeVerse?: (grade: RatingGrade) => void;
  onMarkMemorized?: () => void;
  getVerseMastery?: (surahNumber: number, ayahNumber: number) => { status: MemorizationStatus; masteryScore: number } | null;

  // Sync Locations & Highlights
  memorizationPage?: number;
  memorizationEndPage?: number;
  readingPage?: number;
  readingEndPage?: number;
  memorizationMarker?: WirdMarker;
  readingMarker?: WirdMarker;
  onSetMemorizationMarker?: (surahNumber: number, ayahNumber: number, page: number) => void;
  onSetReadingMarker?: (surahNumber: number, ayahNumber: number, page: number) => void;
  onSyncMemorization?: () => void;
  onSyncReading?: () => void;
  onOpenHalqahNote?: () => void;
}

export const QuranReaderView: React.FC<QuranReaderViewProps> = ({
  surahNumber,
  onSelectSurah,
  currentAyahIndex,
  onSelectAyah,
  startAyah,
  endAyah,
  onStartAyahChange,
  onEndAyahChange,
  isAudioPlaying,
  repeatSettings,
  onChangeRepeatSettings,
  onGradeVerse,
  onMarkMemorized,
  getVerseMastery,
  memorizationPage,
  memorizationEndPage,
  readingPage,
  readingEndPage,
  memorizationMarker,
  readingMarker,
  onSetMemorizationMarker,
  onSetReadingMarker,
  onSyncMemorization,
  onSyncReading,
  onOpenHalqahNote,
}) => {
  const [verses, setVerses] = useState<Ayah[]>([]);
  const [viewMode, setViewMode] = useState<'page' | 'ayah'>(() => {
    try {
      const saved = localStorage.getItem('quran_view_mode_v1');
      if (saved === 'page' || saved === 'ayah') return saved;
    } catch {}
    return 'page';
  });

  useEffect(() => {
    try {
      localStorage.setItem('quran_view_mode_v1', viewMode);
    } catch {}
  }, [viewMode]);

  const [loading, setLoading] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showRangeControls, setShowRangeControls] = useState(false);
  const touchStartXRef = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartXRef.current;

    if (diffX < -40) {
      // Swiped Left -> Move to Next Page
      if (activePage < 604) handlePageChange(activePage + 1);
    } else if (diffX > 40) {
      // Swiped Right -> Move to Previous Page
      if (activePage > 1) handlePageChange(activePage - 1);
    }
    touchStartXRef.current = null;
  };

  const currentSurah = SURAHS.find((s) => s.id === surahNumber) || SURAHS[0];

  // Active Page Number (1 - 604) for Page Navigation
  const [activePage, setActivePage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('quran_active_page_v1');
      if (saved) {
        const parsed = Number(saved);
        if (parsed >= 1 && parsed <= 604) return parsed;
      }
    } catch {}
    return memorizationPage || readingPage || currentSurah?.pageStart || 1;
  });

  // Page View Mode: 'single' (Classic Single Page Mushaf) vs 'all' (All Pages of Surah)
  const [pageLayout, setPageLayout] = useState<'single' | 'all'>(() => {
    try {
      const saved = localStorage.getItem('quran_page_layout_v1');
      if (saved === 'single' || saved === 'all') return saved;
    } catch {}
    return 'single';
  });

  useEffect(() => {
    try {
      localStorage.setItem('quran_active_page_v1', activePage.toString());
      localStorage.setItem('quran_page_layout_v1', pageLayout);
    } catch {}
  }, [activePage, pageLayout]);

  useEffect(() => {
    const handleActivePageSync = () => {
      try {
        const saved = localStorage.getItem('quran_active_page_v1');
        if (saved) {
          const parsed = Number(saved);
          if (parsed >= 1 && parsed <= 604) {
            setActivePage(parsed);
          }
        }
      } catch {}
    };

    window.addEventListener('quran_active_page_updated', handleActivePageSync);
    window.addEventListener('storage', handleActivePageSync);
    return () => {
      window.removeEventListener('quran_active_page_updated', handleActivePageSync);
      window.removeEventListener('storage', handleActivePageSync);
    };
  }, []);

  const handlePageChange = (newPage: number) => {
    const clampedPage = Math.min(604, Math.max(1, newPage));
    setActivePage(clampedPage);
    const targetSurah = getSurahForPage(clampedPage);
    if (targetSurah.id !== surahNumber) {
      onSelectSurah(targetSurah.id);
    }
  };

  useEffect(() => {
    const surahMeta = SURAHS.find((s) => s.id === surahNumber);
    if (surahMeta) {
      const nextSurah = SURAHS.find((s) => s.id === surahNumber + 1);
      const surahEndPage = nextSurah ? nextSurah.pageStart - 1 : 604;
      if (activePage < surahMeta.pageStart || activePage > surahEndPage) {
        setActivePage(surahMeta.pageStart);
      }
    }
  }, [surahNumber]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchSurahVerses(surahNumber)
      .then((data) => {
        if (isMounted) {
          setVerses(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [surahNumber]);

  // Group verses by page for Pages View
  const versesByPage = useMemo(() => {
    const map = new Map<number, Ayah[]>();
    verses.forEach((v) => {
      const p = v.page;
      if (!map.has(p)) {
        map.set(p, []);
      }
      map.get(p)!.push(v);
    });
    return map;
  }, [verses]);

  return (
    <div dir="rtl" className="space-y-4 font-arabic-body text-right">

      {/* UNIFIED SINGLE-ROW CONTROL BAR (PC & Mobile) */}
      <div className="p-3 md:p-3 rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-md flex flex-wrap items-center justify-between gap-2.5 font-arabic-title">
        
        {/* Right Section: Surah, Juz, View Mode & Layout */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Surah Dropdown */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-500/20">
              {surahNumber}
            </span>
            <select
              value={surahNumber}
              onChange={(e) => onSelectSurah(Number(e.target.value))}
              className="h-9 bg-secondary/80 text-xs font-bold text-foreground rounded-xl px-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
            >
              {SURAHS.map((s) => (
                <option key={s.id} value={s.id}>
                  سورة {s.name} ({s.versesCount} آية)
                </option>
              ))}
            </select>
          </div>

          {/* Juz Dropdown (Page Mode) */}
          {viewMode === 'page' && (
            <div className="flex items-center gap-1.5">
              <Compass className="size-4 text-amber-400 shrink-0" />
              <select
                value={JUZ_START_PAGES.reduce((acc, curr) => (activePage >= curr.page ? curr.juz : acc), 1)}
                onChange={(e) => {
                  const jNum = Number(e.target.value);
                  const target = JUZ_START_PAGES.find((j) => j.juz === jNum);
                  if (target) handlePageChange(target.page);
                }}
                className="h-9 bg-secondary/80 text-xs font-bold text-foreground rounded-xl px-2.5 border border-border focus:outline-none cursor-pointer"
              >
                {JUZ_START_PAGES.map((j) => (
                  <option key={j.juz} value={j.juz}>
                    الجزء {j.juz} (صفحة {j.page})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Segmented Control (Pages vs Ayahs) */}
          <div className="flex items-center h-9 p-0.5 rounded-xl bg-secondary/80 border border-border/60 text-[11px] font-bold shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('page')}
              className={`h-full px-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'page'
                  ? 'bg-card text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Book className="size-3.5" />
              <span>المصحف</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('ayah')}
              className={`h-full px-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'ayah'
                  ? 'bg-card text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="size-3.5" />
              <span>الآيات</span>
            </button>
          </div>

          {/* Single Page vs All Pages Selector */}
          {viewMode === 'page' && (
            <div className="flex items-center h-9 p-0.5 rounded-xl bg-secondary/80 border border-border/60 text-[11px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setPageLayout('single')}
                className={`h-full px-2.5 rounded-lg transition-all cursor-pointer ${
                  pageLayout === 'single'
                    ? 'bg-card text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="عرض صفحة واحدة بالمصحف"
              >
                صفحة واحدة
              </button>
              <button
                type="button"
                onClick={() => setPageLayout('all')}
                className={`h-full px-2.5 rounded-lg transition-all cursor-pointer ${
                  pageLayout === 'all'
                    ? 'bg-card text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="عرض جميع صفحات السورة"
              >
                صفحات السورة
              </button>
            </div>
          )}
        </div>

        {/* Left Section: Sync Location Pills & Quick Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Location Sync Pills */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSyncMemorization}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title={`الانتقال إلى موضع الحفظ (سورة ${memorizationMarker?.surahNumber || surahNumber} - آية ${memorizationMarker?.ayahNumber || 1})`}
            >
              <Target className="size-3.5 text-emerald-400" />
              <span>الحفظ ({memorizationPage})</span>
            </button>

            <button
              type="button"
              onClick={onSyncReading}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
              title={`الانتقال إلى موضع التلاوة (سورة ${readingMarker?.surahNumber || surahNumber} - آية ${readingMarker?.ayahNumber || 1})`}
            >
              <Bookmark className="size-3.5 text-indigo-400" />
              <span>التلاوة ({readingPage})</span>
            </button>

            {onOpenHalqahNote && (
              <button
                type="button"
                onClick={onOpenHalqahNote}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
                title="تدوين ملاحظة وتسميع الحلقة لورد اليوم"
              >
                <FileText className="size-3.5 text-amber-400" />
                <span>ملاحظة الحلقة</span>
              </button>
            )}
          </div>

          {/* Tools & Settings Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowRangeControls(!showRangeControls)}
              className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showRangeControls
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-secondary/80 text-muted-foreground border-border hover:bg-secondary'
              }`}
              title="تحديد نطاق التكرار (من آية - إلى آية)"
            >
              <SlidersHorizontal className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowTranslation(!showTranslation)}
              className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showTranslation
                  ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                  : 'bg-secondary/80 text-muted-foreground border-border hover:bg-secondary'
              }`}
              title="عرض التفسير الميسر"
            >
              <BookOpen className="size-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeRepeatSettings({ ...repeatSettings, blindMode: !repeatSettings.blindMode })
              }
              className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                repeatSettings.blindMode
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-secondary/80 text-muted-foreground border-border hover:bg-secondary'
              }`}
              title="اختبار الحفظ (تغطية الآيات)"
            >
              {repeatSettings.blindMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

      </div>

      {/* Expandable Range Selector (Shows cleanly when clicked) */}
      {showRangeControls && (
        <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-bold font-arabic-title">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">نطاق التلاوة والتكرار:</span>
            <span className="text-emerald-400 font-bold">
              من الآية {startAyah} إلى الآية {endAyah}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">من:</span>
              <input
                type="number"
                min={1}
                max={currentSurah.versesCount}
                value={startAyah}
                onChange={(e) => onStartAyahChange(Math.max(1, Number(e.target.value)))}
                className="w-14 bg-secondary/80 text-foreground font-mono text-center rounded-xl p-1 border border-border focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">إلى:</span>
              <input
                type="number"
                min={startAyah}
                max={currentSurah.versesCount}
                value={endAyah}
                onChange={(e) =>
                  onEndAyahChange(
                    Math.min(currentSurah.versesCount, Math.max(startAyah, Number(e.target.value)))
                  )
                }
                className="w-14 bg-secondary/80 text-foreground font-mono text-center rounded-xl p-1 border border-border focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Standalone Basmalah Header */}
      {surahNumber !== 9 && pageLayout === 'all' && (
        <div className="text-center py-3 font-arabic-quran text-3xl md:text-4xl text-emerald-500/90 dir-rtl select-none tracking-wide">
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="p-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border rounded-2xl">
          جاري تحميل آيات سورة {currentSurah.name}...
        </div>
      ) : viewMode === 'page' ? (
        /* PAGES VIEW (AUTHENTIC MUSHAF DISPLAY) */
        <div className="space-y-8">
          {(() => {
            let pagesToRender = Array.from(versesByPage.entries());
            if (pageLayout === 'single') {
              const singlePageEntries = pagesToRender.filter(([pNum]) => pNum === activePage);
              if (singlePageEntries.length > 0) {
                pagesToRender = singlePageEntries;
              }
            }

            if (pagesToRender.length === 0) {
              return (
                <div className="p-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/60 rounded-3xl space-y-3 bg-card/60">
                  <p className="text-sm">جاري تحميل آيات صفحة {activePage}...</p>
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentSurah.pageStart)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md transition-all"
                  >
                    الانتقال لبداية سورة {currentSurah.name} (صفحة {currentSurah.pageStart})
                  </button>
                </div>
              );
            }

            return pagesToRender.map(([pageNum, pageAyahs]) => {
              const pageSurah = getSurahForPage(pageNum);
              const hasAyahOne = pageAyahs.some((a) => a.numberInSurah === 1);

              return (
                <div
                  key={pageNum}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  className="p-4 md:p-8 rounded-[2.5rem] border-2 border-emerald-500/30 bg-card/95 backdrop-blur-xl shadow-2xl relative overflow-hidden space-y-4 touch-pan-y"
                >
                  {/* Outer Decorative Corner Flourishes */}
                  <div className="absolute top-3 right-3 text-emerald-500/30 text-sm select-none font-serif">❖</div>
                  <div className="absolute top-3 left-3 text-emerald-500/30 text-sm select-none font-serif">❖</div>
                  <div className="absolute bottom-3 right-3 text-emerald-500/30 text-sm select-none font-serif">❖</div>
                  <div className="absolute bottom-3 left-3 text-emerald-500/30 text-sm select-none font-serif">❖</div>

                  {/* Inner Decorative Border Frame */}
                  <div className="border border-emerald-500/20 rounded-[1.8rem] p-4 md:p-8 space-y-5 bg-background/50 backdrop-blur-sm">
                    
                    {/* Top Header Line Inside Page Frame */}
                    <div className="border-b border-emerald-500/20 pb-3 flex items-center justify-between text-xs text-muted-foreground font-arabic-title font-bold">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <BookOpen className="size-4 text-emerald-400 shrink-0" />
                        <span>سورة {pageSurah.name}</span>
                      </span>

                      <span className="px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-extrabold text-xs">
                        صفحة {pageNum}
                      </span>

                      <span className="text-foreground/80 font-mono">
                        الجزء {pageSurah.juzStart}
                      </span>
                    </div>

                    {/* Ornate Surah Title Banner if Ayah 1 is present */}
                    {hasAyahOne && (
                      <div className="my-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/80 to-emerald-950/60 border-2 border-emerald-500/40 text-center space-y-1 shadow-lg font-arabic-title relative">
                        <div className="text-xl md:text-2xl font-extrabold text-emerald-200 tracking-wide">
                          سُورَةُ {pageSurah.name}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-4">
                          <span>{pageSurah.type === 'Meccan' ? 'مَكِّيَّةٌ' : 'مَدَنِيَّةٌ'}</span>
                          <span>•</span>
                          <span>آيَاتُهَا {pageSurah.versesCount}</span>
                        </div>
                      </div>
                    )}

                    {/* Standalone Basmalah if Ayah 1 is present & Surah != 9 */}
                    {hasAyahOne && pageSurah.id !== 9 && (
                      <div className="text-center py-2 font-arabic-quran text-2xl md:text-3xl text-emerald-400/90 select-none tracking-wide">
                        بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                      </div>
                    )}

                    {/* Continuous Mushaf Page Text */}
                    <div className="dir-rtl text-justify font-arabic-quran text-2xl md:text-3xl leading-[2.7] md:leading-[3.0] text-foreground tracking-wide select-none font-bold">
                      {pageAyahs.map((ayah) => {
                        const isActive = currentAyahIndex === ayah.numberInSurah;
                        const inStudyRange = startAyah <= ayah.numberInSurah && ayah.numberInSurah <= endAyah;
                        const mastery = getVerseMastery ? getVerseMastery(surahNumber, ayah.numberInSurah) : null;
                        const isMemorized = mastery?.status === 'memorized';
                        
                        const isMemMarker = memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === ayah.numberInSurah;
                        const isReadMarker = readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === ayah.numberInSurah;
                        const isMemWirdEnd = ayah.numberInSurah === endAyah;
                        const words = ayah.textUthmani.trim().split(/\s+/);

                        return (
                          <React.Fragment key={ayah.number}>
                            <span
                              onClick={() => onSelectAyah(ayah.numberInSurah)}
                              className={`cursor-pointer rounded-xl px-1.5 py-0.5 transition-all inline ${
                                isMemMarker && isReadMarker
                                  ? 'bg-gradient-to-r from-emerald-500/30 to-indigo-500/30 text-foreground ring-2 ring-amber-400 font-extrabold shadow-md'
                                  : isMemMarker
                                  ? 'bg-emerald-500/25 text-emerald-200 ring-2 ring-emerald-500 border-b-2 border-emerald-500 font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                                  : isReadMarker
                                  ? 'bg-indigo-500/25 text-indigo-200 ring-2 ring-indigo-500 border-b-2 border-indigo-500 font-extrabold shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                                  : isActive
                                  ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/50 shadow-md font-extrabold'
                                  : inStudyRange
                                  ? 'bg-emerald-500/15 text-emerald-300 font-bold border-b-2 border-emerald-500/50'
                                  : isMemorized
                                  ? 'text-emerald-400 font-bold'
                                  : 'hover:bg-accent/40'
                              }`}
                            >
                              {repeatSettings.blindMode ? (
                                words.map((w, wIdx) => (
                                  <span
                                    key={wIdx}
                                    className="inline mx-1 px-1 rounded transition-all duration-300 text-indigo-400/20 bg-indigo-500/20 border border-indigo-500/30 blur-[6px] hover:blur-none hover:text-foreground hover:bg-transparent select-none cursor-pointer"
                                  >
                                    {w}{' '}
                                  </span>
                                ))
                              ) : (
                                ayah.textUthmani
                              )}
                            </span>
                            <span
                              onClick={() => onSelectAyah(ayah.numberInSurah)}
                              className={`inline-flex items-center justify-center min-w-[2.2rem] h-7 md:h-8 px-2 mx-1.5 rounded-full text-xs font-bold font-mono align-middle cursor-pointer transition-all whitespace-nowrap select-none ${
                                isMemWirdEnd
                                  ? 'bg-emerald-600 text-white font-black ring-4 ring-emerald-500/50 scale-105 shadow-lg'
                                  : isMemMarker
                                  ? 'bg-emerald-500 text-white font-black shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-105'
                                  : isReadMarker
                                  ? 'bg-indigo-600 text-white font-black shadow-[0_0_10px_rgba(99,102,241,0.5)] scale-105'
                                  : isMemorized
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                                  : inStudyRange
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/50'
                                  : 'border border-emerald-500/40 text-emerald-400/90 bg-emerald-500/5 hover:bg-emerald-500/20'
                              }`}
                              title={`الآية ${ayah.numberInSurah} ${
                                isMemWirdEnd ? '🎯 (نهاية ورد الحفظ)' : isMemMarker ? '🎯 (موضع الحفظ الحالي)' : isReadMarker ? '📖 (موضع التلاوة الحالي)' : isMemorized ? '✨ (مُتقنة 100%)' : ''
                              }`}
                            >
                              ﴿{ayah.numberInSurah}﴾
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Active Ayah Quick Actions in Page Mode */}
                    {pageAyahs.some((a) => a.numberInSurah === currentAyahIndex) && (
                      <>
                        <div className="border-t border-border/40 pt-2.5 flex items-center justify-between gap-2 flex-wrap text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-secondary/60 border border-border/50">
                            <span className="text-[11px] font-bold text-foreground px-2 py-0.5">
                              آية {currentAyahIndex}:
                            </span>

                            {onSetMemorizationMarker && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const target = pageAyahs.find((a) => a.numberInSurah === currentAyahIndex);
                                  if (target) {
                                    onSetMemorizationMarker(surahNumber, target.numberInSurah, target.page);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                                  memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === currentAyahIndex
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-emerald-400 hover:bg-emerald-500/15'
                                }`}
                                title="تحديد كموضع الحفظ"
                              >
                                <Target className="size-3" />
                                <span>{memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === currentAyahIndex ? '✓ موضع الحفظ' : '🎯 تحديد كورد الحفظ'}</span>
                              </button>
                            )}

                            {onSetReadingMarker && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const target = pageAyahs.find((a) => a.numberInSurah === currentAyahIndex);
                                  if (target) {
                                    onSetReadingMarker(surahNumber, target.numberInSurah, target.page);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                                  readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === currentAyahIndex
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-indigo-400 hover:bg-indigo-500/15'
                                }`}
                                title="تحديد كموضع التلاوة"
                              >
                                <Bookmark className="size-3" />
                                <span>{readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === currentAyahIndex ? '✓ موضع التلاوة' : '📖 تحديد كورد التلاوة'}</span>
                              </button>
                            )}
                          </div>

                          {onMarkMemorized && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkMemorized();
                              }}
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/25 text-[11px] flex items-center gap-1 active:scale-95 cursor-pointer transition-all"
                              title="اعتماد المقطع كمُتقَن"
                            >
                              <Award className="size-3 text-emerald-400" />
                              <span>اعتماد كمُتقَن</span>
                            </button>
                          )}
                        </div>

                        {/* Tafsir in Page Mode if enabled */}
                        {showTranslation && (
                          <div className="text-xs text-foreground/90 leading-relaxed border-t border-border/30 pt-2 text-right dir-rtl font-arabic-body bg-secondary/30 p-2.5 rounded-xl border border-border/40">
                            <span className="font-bold text-amber-400 block mb-0.5 text-[11px]">📖 التفسير الميسر (آية {currentAyahIndex}):</span>
                            {pageAyahs.find((a) => a.numberInSurah === currentAyahIndex)?.translation}
                          </div>
                        )}
                      </>
                    )}

                    {/* Page Bottom Footer Inside Frame */}
                    <div className="border-t border-emerald-500/20 pt-3 flex items-center justify-between text-xs text-muted-foreground font-arabic-title font-bold">
                      <span>سورة {pageSurah.name}</span>
                      <span className="text-emerald-400 font-extrabold text-sm">ـ  صفحة {pageNum}  ـ</span>
                      <span>الجزء {pageSurah.juzStart}</span>
                    </div>

                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        /* AYAH VIEW (LIST CARDS DISPLAY) */
        <div className="space-y-3">
          {verses.map((ayah) => {
            const isActive = currentAyahIndex === ayah.numberInSurah;
            const inStudyRange = startAyah <= ayah.numberInSurah && ayah.numberInSurah <= endAyah;
            const mastery = getVerseMastery ? getVerseMastery(surahNumber, ayah.numberInSurah) : null;
            const isMemorized = mastery?.status === 'memorized';
            
            const isMemMarker = memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === ayah.numberInSurah;
            const isReadMarker = readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === ayah.numberInSurah;
            const isMemWirdEnd = ayah.numberInSurah === endAyah;

            return (
              <div
                key={ayah.number}
                onClick={() => onSelectAyah(ayah.numberInSurah)}
                className={`p-4 md:p-6 rounded-2xl border transition-all cursor-pointer relative ${
                  isMemWirdEnd
                    ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-950/20 shadow-lg'
                    : isMemMarker
                    ? 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/40 shadow-lg'
                    : isReadMarker
                    ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/40 shadow-lg'
                    : isActive
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/30 shadow-lg'
                    : inStudyRange
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-border/60 bg-card hover:border-border hover:bg-accent/20'
                }`}
              >
                {/* Verse Header Info */}
                <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground font-sans flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-foreground font-bold text-[11px]">
                      الآية {ayah.numberInSurah} (صفحة {ayah.page})
                    </span>

                    {/* Memorization Marker Badge (Emerald) */}
                    {isMemMarker && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px]">
                        <Target className="size-3" /> موضع الحفظ الحالي
                      </span>
                    )}

                    {/* End of Memorization Wird Badge (Emerald) */}
                    {isMemWirdEnd && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-sm animate-pulse">
                        <Target className="size-3" /> نهاية ورد الحفظ
                      </span>
                    )}

                    {/* Reading Marker Badge (Indigo) */}
                    {isReadMarker && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-bold text-[10px]">
                        <Bookmark className="size-3" /> موضع التلاوة الحالي
                      </span>
                    )}

                    {isMemorized && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[10px]">
                        ✨ مُتقَن (100%)
                      </span>
                    )}

                    {mastery && mastery.status === 'reviewing' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-[10px]">
                        🔄 قيد المراجعة ({mastery.masteryScore}%)
                      </span>
                    )}

                    {inStudyRange && !isMemWirdEnd && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                        🎯 نطاق التكرار
                      </span>
                    )}

                    {isActive && isAudioPlaying && (
                      <span className="text-xs font-bold text-emerald-400 animate-pulse flex items-center gap-1.5">
                        <Volume2 className="size-4" /> جاري التلاوة...
                      </span>
                    )}
                  </div>
                </div>

                {/* Verse Text Display */}
                {repeatSettings.blindMode && isActive ? (
                  <BlindModeOverlay
                    isBlindMode={repeatSettings.blindMode}
                    onToggleBlindMode={() =>
                      onChangeRepeatSettings({ ...repeatSettings, blindMode: false })
                    }
                    textUthmani={ayah.textUthmani}
                    onGrade={onGradeVerse}
                  />
                ) : (
                  <div className="dir-rtl text-right font-arabic-quran text-3xl md:text-4xl leading-[2.4] text-foreground tracking-wide select-none font-bold">
                    {ayah.textUthmani}
                    <span className="inline-flex items-center justify-center min-w-[2.25rem] h-8 md:h-9 px-2 mx-2 rounded-full border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold align-middle whitespace-nowrap select-none">
                      ﴿{ayah.numberInSurah}﴾
                    </span>
                  </div>
                )}

                {/* Tafsir Al-Muyassar Display (Arabic) */}
                {showTranslation && ayah.translation && (
                  <div className="mt-4 text-xs md:text-sm text-foreground/90 leading-relaxed border-t border-border/30 pt-3 text-right dir-rtl font-arabic-body bg-secondary/30 p-3 rounded-xl border border-border/40">
                    <span className="font-bold text-amber-400 block mb-1 text-[11px]">📖 التفسير الميسر:</span>
                    {ayah.translation}
                  </div>
                )}

                {/* Active Ayah Sleek Micro-Toolbar */}
                {isActive && (
                  <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-secondary/60 border border-border/50">
                      {onSetMemorizationMarker && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetMemorizationMarker(surahNumber, ayah.numberInSurah, ayah.page);
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                            isMemMarker
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-emerald-400 hover:bg-emerald-500/15'
                          }`}
                          title="تحديد كموضع الحفظ"
                        >
                          <Target className="size-3" />
                          <span>{isMemMarker ? 'موضع الحفظ' : 'حفظ'}</span>
                        </button>
                      )}

                      {onSetReadingMarker && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetReadingMarker(surahNumber, ayah.numberInSurah, ayah.page);
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                            isReadMarker
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-indigo-400 hover:bg-indigo-500/15'
                          }`}
                          title="تحديد كموضع التلاوة"
                        >
                          <Bookmark className="size-3" />
                          <span>{isReadMarker ? 'موضع التلاوة' : 'تلاوة'}</span>
                        </button>
                      )}
                    </div>

                    {onMarkMemorized && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkMemorized();
                        }}
                        className="px-2 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/25 text-[11px] flex items-center gap-1 active:scale-95 cursor-pointer transition-all"
                        title="اعتماد المقطع كمُتقَن"
                      >
                        <Award className="size-3 text-emerald-400" />
                        <span>إتقان</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
