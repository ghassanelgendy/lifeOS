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
} from 'lucide-react';
import { Ayah, RepeatSettings, RatingGrade, MemorizationStatus } from '../types/quran';
import { fetchSurahVerses } from '../services/quranApi';
import { SURAHS } from '../services/quranData';
import { BlindModeOverlay } from './BlindModeOverlay';

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

  const currentSurah = SURAHS.find((s) => s.id === surahNumber) || SURAHS[0];

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

      {/* UNIFIED SLEEK TOP CONTROL BAR */}
      <div className="p-3 md:p-3.5 rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-md flex flex-col md:flex-row items-center justify-between gap-2.5 font-arabic-title">
        
        {/* Row 1 / Right Section: Surah Selector & View Mode Switcher */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          {/* Surah Dropdown with matched height */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0 md:flex-initial">
            <span className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-500/20">
              {surahNumber}
            </span>
            <select
              value={surahNumber}
              onChange={(e) => onSelectSurah(Number(e.target.value))}
              className="h-9 w-full md:w-auto bg-secondary/80 text-xs font-bold text-foreground rounded-xl px-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
            >
              {SURAHS.map((s) => (
                <option key={s.id} value={s.id}>
                  سورة {s.name} ({s.versesCount} آية)
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Segmented Control (Pages vs Ayahs) */}
          <div className="flex items-center h-9 p-0.5 rounded-xl bg-secondary/80 border border-border/60 text-[11px] font-bold shrink-0">
            <button
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
        </div>

        {/* Row 2 / Left Section: Sync Location Pills & Quick Tools */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 border-t border-border/40 md:border-t-0 md:pt-0">
          
          {/* Quick Location Sync Pills */}
          <div className="flex items-center gap-1.5">
            {/* Memorization Sync Button (Emerald) */}
            <button
              onClick={onSyncMemorization}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title={`الانتقال إلى موضع الحفظ (آية ${memorizationMarker?.ayahNumber || 1})`}
            >
              <Target className="size-3.5 text-emerald-400" />
              <span>ورد الحفظ</span>
              <span className="text-[10px] opacity-90 font-mono font-bold">
                ({memorizationMarker ? `آية ${memorizationMarker.ayahNumber}` : `ص${memorizationPage || 1}`})
              </span>
            </button>

            {/* Reading Sync Button (Indigo) */}
            <button
              onClick={onSyncReading}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title={`الانتقال إلى موضع التلاوة (آية ${readingMarker?.ayahNumber || 1})`}
            >
              <Bookmark className="size-3.5 text-indigo-400" />
              <span>ورد التلاوة</span>
              <span className="text-[10px] opacity-90 font-mono font-bold">
                ({readingMarker ? `آية ${readingMarker.ayahNumber}` : `ص${readingPage || 1}`})
              </span>
            </button>
          </div>

          {/* Tools & Settings Actions */}
          <div className="flex items-center gap-1.5">
            {/* Toggle Range Selector Popover */}
            <button
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

            {/* Blind Mode Testing Toggle */}
            <button
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
      {surahNumber !== 9 && (
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
        /* PAGES VIEW (MUSHAF DISPLAY) */
        <div className="space-y-6">
          {Array.from(versesByPage.entries()).map(([pageNum, pageAyahs]) => {
            const isMemTargetPage = memorizationEndPage === pageNum || memorizationPage === pageNum;
            const isReadTargetPage = readingEndPage === pageNum || readingPage === pageNum;

            return (
              <div
                key={pageNum}
                className={`p-6 md:p-10 rounded-3xl border transition-all space-y-4 bg-card/90 shadow-xl relative ${
                  isMemTargetPage && isReadTargetPage
                    ? 'border-gradient-to-r ring-4 ring-emerald-500/40 border-amber-500 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
                    : isMemTargetPage
                    ? 'border-emerald-500 ring-4 ring-emerald-500/30 bg-emerald-950/10 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                    : isReadTargetPage
                    ? 'border-indigo-500 ring-4 ring-indigo-500/30 bg-indigo-950/10 shadow-[0_0_25px_rgba(99,102,241,0.2)]'
                    : 'border-border/60 hover:border-border'
                }`}
              >
                {/* Page Top Target Badges (Only shown if page has targets) */}
                {(isMemTargetPage || isReadTargetPage) && (
                  <div className="flex items-center justify-end border-b border-border/40 pb-2.5 text-xs text-muted-foreground font-sans gap-2 flex-wrap">
                    {isMemTargetPage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] animate-pulse">
                        <Target className="size-3" /> نهاية ورد الحفظ
                      </span>
                    )}

                    {isReadTargetPage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold text-[10px] animate-pulse">
                        <Bookmark className="size-3" /> نهاية ورد التلاوة
                      </span>
                    )}
                  </div>
                )}

                {/* Continuous Mushaf Page Text */}
                <div className="dir-rtl text-justify font-arabic-quran text-2xl md:text-3xl leading-[2.6] md:leading-[2.8] text-foreground tracking-wide select-none font-bold">
                  {pageAyahs.map((ayah) => {
                    const isActive = currentAyahIndex === ayah.numberInSurah;
                    const inStudyRange = startAyah <= ayah.numberInSurah && ayah.numberInSurah <= endAyah;
                    const mastery = getVerseMastery ? getVerseMastery(surahNumber, ayah.numberInSurah) : null;
                    const isMemorized = mastery?.status === 'memorized';
                    
                    const isMemMarker = memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === ayah.numberInSurah;
                    const isReadMarker = readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === ayah.numberInSurah;

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
                          {ayah.textUthmani}
                        </span>
                        <span
                          onClick={() => onSelectAyah(ayah.numberInSurah)}
                          className={`inline-flex items-center justify-center size-8 md:size-9 mx-1 rounded-full text-xs font-bold align-middle cursor-pointer transition-all ${
                            isMemMarker
                              ? 'bg-emerald-500 text-white font-black shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110'
                              : isReadMarker
                              ? 'bg-indigo-600 text-white font-black shadow-[0_0_10px_rgba(99,102,241,0.5)] scale-110'
                              : isMemorized
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                              : inStudyRange
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/50'
                              : 'border border-emerald-500/30 text-emerald-500/80'
                          }`}
                          title={`الآية ${ayah.numberInSurah} ${
                            isMemMarker ? '🎯 (موضع الحفظ الحالي)' : isReadMarker ? '📖 (موضع التلاوة الحالي)' : isMemorized ? '✨ (مُتقنة 100%)' : ''
                          }`}
                        >
                          {ayah.numberInSurah}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Page Bottom Footer: Surah Name | Page Number | Juz */}
                <div className="border-t border-border/40 pt-3 text-xs text-muted-foreground flex items-center justify-between font-sans">
                  <span className="font-semibold text-foreground/80">سورة {currentSurah.name}</span>
                  <span className="font-bold text-foreground bg-secondary/80 px-3 py-1 rounded-full border border-border text-xs">
                    صفحة {pageNum}
                  </span>
                  <span className="font-semibold text-foreground/80">الجزء {currentSurah.juzStart}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* AYAH VIEW (LIST CARDS DISPLAY) */
        <div className="space-y-3">
          {verses.map((ayah) => {
            const isActive = currentAyahIndex === ayah.numberInSurah;
            const inStudyRange = startAyah <= ayah.numberInSurah && ayah.numberInSurah <= endAyah;
            const mastery = getVerseMastery ? getVerseMastery(surahNumber, ayah.numberInSurah) : null;
            const isMemorized = mastery?.status === 'memorized';
            const isMemTargetPage = memorizationEndPage === ayah.page || memorizationPage === ayah.page;
            const isReadTargetPage = readingEndPage === ayah.page || readingPage === ayah.page;
            
            const isMemMarker = memorizationMarker?.surahNumber === surahNumber && memorizationMarker?.ayahNumber === ayah.numberInSurah;
            const isReadMarker = readingMarker?.surahNumber === surahNumber && readingMarker?.ayahNumber === ayah.numberInSurah;

            return (
              <div
                key={ayah.number}
                onClick={() => onSelectAyah(ayah.numberInSurah)}
                className={`p-4 md:p-6 rounded-2xl border transition-all cursor-pointer relative ${
                  isMemMarker
                    ? 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/40 shadow-lg'
                    : isReadMarker
                    ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/40 shadow-lg'
                    : isActive
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/30 shadow-lg'
                    : inStudyRange
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : isMemTargetPage
                    ? 'border-emerald-500/50 bg-emerald-950/10'
                    : isReadTargetPage
                    ? 'border-indigo-500/50 bg-indigo-950/10'
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

                    {inStudyRange && (
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

                  <div className="flex items-center gap-2 flex-wrap">
                    {isMemTargetPage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                        <Target className="size-3" /> نهاية ورد الحفظ
                      </span>
                    )}

                    {isReadTargetPage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold text-[10px]">
                        <Bookmark className="size-3" /> نهاية ورد التلاوة
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
                    <span className="inline-flex items-center justify-center size-9 mx-2.5 rounded-full border border-emerald-500/40 text-emerald-500 font-sans text-xs font-bold align-middle">
                      {ayah.numberInSurah}
                    </span>
                  </div>
                )}

                {/* Translation Display */}
                {showTranslation && ayah.translation && (
                  <p className="mt-4 text-xs md:text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3 text-left dir-ltr">
                    {ayah.translation}
                  </p>
                )}

                {/* Active Ayah Quick Marker Actions */}
                {isActive && (
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {onSetMemorizationMarker && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetMemorizationMarker(surahNumber, ayah.numberInSurah, ayah.page);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                            isMemMarker
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                          }`}
                        >
                          <Target className="size-3.5" />
                          <span>{isMemMarker ? '✓ موضع الحفظ الحالي' : 'تعيين كموضع الحفظ'}</span>
                        </button>
                      )}

                      {onSetReadingMarker && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetReadingMarker(surahNumber, ayah.numberInSurah, ayah.page);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                            isReadMarker
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/30'
                          }`}
                        >
                          <Bookmark className="size-3.5" />
                          <span>{isReadMarker ? '✓ موضع التلاوة الحالي' : 'تعيين كموضع التلاوة'}</span>
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
                        className="px-2.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold border border-border text-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <Award className="size-3.5 text-emerald-400" />
                        <span>اعتماد المقطع كمُتقَن</span>
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
