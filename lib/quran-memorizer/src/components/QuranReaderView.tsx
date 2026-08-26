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
import { Ayah, RepeatSettings, RatingGrade } from '../types/quran';
import { fetchSurahVerses } from '../services/quranApi';
import { SURAHS } from '../services/quranData';
import { BlindModeOverlay } from './BlindModeOverlay';

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

  // Sync Locations & Highlights
  memorizationPage?: number;
  memorizationEndPage?: number;
  readingPage?: number;
  readingEndPage?: number;
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
  memorizationPage,
  memorizationEndPage,
  readingPage,
  readingEndPage,
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
      <div className="p-3 md:p-3.5 rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-md flex flex-col md:flex-row items-center justify-between gap-3 font-arabic-title">
        
        {/* Right Section: Surah Selector & View Mode Switcher */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto shrink-0 justify-between md:justify-start">
          {/* Surah Dropdown */}
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-500/20">
              {surahNumber}
            </span>
            <select
              value={surahNumber}
              onChange={(e) => onSelectSurah(Number(e.target.value))}
              className="bg-secondary/80 text-xs font-bold text-foreground rounded-xl px-2.5 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {SURAHS.map((s) => (
                <option key={s.id} value={s.id}>
                  سورة {s.name} ({s.versesCount} آية)
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Segmented Control (Pages vs Ayahs) */}
          <div className="flex items-center p-0.5 rounded-xl bg-secondary/80 border border-border text-[11px] font-bold shrink-0">
            <button
              onClick={() => setViewMode('page')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'page'
                  ? 'bg-background text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Book className="size-3.5" />
              <span>المصحف</span>
            </button>

            <button
              onClick={() => setViewMode('ayah')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'ayah'
                  ? 'bg-background text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="size-3.5" />
              <span>الآيات</span>
            </button>
          </div>
        </div>

        {/* Left Section: Sync Location Pills & Quick Tools */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end shrink-0">
          
          {/* Quick Location Sync Pills */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onSyncMemorization}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="موقع ورد الحفظ الحالي"
            >
              <Target className="size-3.5" />
              <span>الحفظ</span>
              <span className="text-[10px] opacity-80">({memorizationPage || 1})</span>
            </button>

            <button
              onClick={onSyncReading}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/25 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="موقع ورد التلاوة الحالي"
            >
              <Bookmark className="size-3.5" />
              <span>التلاوة</span>
              <span className="text-[10px] opacity-80">({readingPage || 1})</span>
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

            {/* Mark Memorized Mastered Button */}
            {onMarkMemorized && (
              <button
                onClick={onMarkMemorized}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm flex items-center gap-1"
                title="اعتماد المقطع كمُتقَن"
              >
                <Award className="size-3.5" />
                <span className="hidden sm:inline">إتقان</span>
              </button>
            )}
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
              <span className="text-muted-foreground">من:</span>
              <select
                value={startAyah}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onStartAyahChange(val);
                  if (val > endAyah) onEndAyahChange(val);
                }}
                className="rounded-xl border border-border bg-background px-2.5 py-1 font-bold text-foreground text-xs focus:outline-none"
              >
                {Array.from({ length: currentSurah.versesCount }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    الآية {num}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">إلى:</span>
              <select
                value={endAyah}
                onChange={(e) => onEndAyahChange(Number(e.target.value))}
                className="rounded-xl border border-border bg-background px-2.5 py-1 font-bold text-foreground text-xs focus:outline-none"
              >
                {Array.from(
                  { length: currentSurah.versesCount - startAyah + 1 },
                  (_, i) => startAyah + i
                ).map((num) => (
                  <option key={num} value={num}>
                    الآية {num}
                  </option>
                ))}
              </select>
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
                {/* Page Top Indicator Header */}
                <div className="flex items-center justify-between border-b border-border/40 pb-3 text-xs text-muted-foreground font-sans">
                  <span className="font-bold text-foreground bg-secondary px-3 py-1 rounded-full border border-border">
                    صفحة {pageNum}
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
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
                </div>

                {/* Continuous Mushaf Page Text */}
                <div className="dir-rtl text-justify font-arabic-quran text-2xl md:text-3xl leading-[2.6] md:leading-[2.8] text-foreground tracking-wide select-none font-bold">
                  {pageAyahs.map((ayah) => {
                    const isActive = currentAyahIndex === ayah.numberInSurah;
                    return (
                      <React.Fragment key={ayah.number}>
                        <span
                          onClick={() => onSelectAyah(ayah.numberInSurah)}
                          className={`cursor-pointer rounded-lg px-1 transition-all ${
                            isActive
                              ? 'bg-emerald-500/25 text-emerald-300 ring-2 ring-emerald-500/50'
                              : 'hover:bg-accent/40'
                          }`}
                        >
                          {ayah.textUthmani}
                        </span>
                        <span className="inline-flex items-center justify-center size-8 md:size-9 mx-1.5 rounded-full border border-emerald-500/40 text-emerald-500 font-sans text-xs font-bold align-middle">
                          {ayah.numberInSurah}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Page Bottom Info */}
                <div className="border-t border-border/30 pt-2 text-[10px] text-muted-foreground flex justify-between">
                  <span>سورة {currentSurah.name}</span>
                  <span>الجزء {currentSurah.juzStart}</span>
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
            const isMemTargetPage = memorizationEndPage === ayah.page || memorizationPage === ayah.page;
            const isReadTargetPage = readingEndPage === ayah.page || readingPage === ayah.page;

            return (
              <div
                key={ayah.number}
                onClick={() => onSelectAyah(ayah.numberInSurah)}
                className={`p-4 md:p-6 rounded-2xl border transition-all cursor-pointer relative ${
                  isActive
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-lg'
                    : isMemTargetPage
                    ? 'border-emerald-500/50 bg-emerald-950/10'
                    : isReadTargetPage
                    ? 'border-indigo-500/50 bg-indigo-950/10'
                    : 'border-border/60 bg-card hover:border-border hover:bg-accent/20'
                }`}
              >
                {/* Verse Header Info */}
                <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground font-sans flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-foreground font-bold text-[11px]">
                      الآية {ayah.numberInSurah} (صفحة {ayah.page})
                    </span>

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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
