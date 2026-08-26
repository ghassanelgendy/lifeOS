import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Layers,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  Volume2,
  Target,
  Bookmark,
  FileText,
  Compass,
  LayoutList,
  Book,
} from 'lucide-react';
import { Ayah, SurahMeta, Reciter, RepeatSettings, RatingGrade } from '../types/quran';
import { fetchSurahVerses } from '../services/quranApi';
import { SURAHS } from '../services/quranData';
import { BlindModeOverlay } from './BlindModeOverlay';

interface QuranReaderViewProps {
  surahNumber: number;
  onSelectSurah: (surahNumber: number) => void;
  currentAyahIndex: number;
  onSelectAyah: (ayahNumber: number) => void;
  isAudioPlaying: boolean;
  repeatSettings: RepeatSettings;
  onChangeRepeatSettings: (settings: RepeatSettings) => void;
  onGradeVerse?: (grade: RatingGrade) => void;

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
  isAudioPlaying,
  repeatSettings,
  onChangeRepeatSettings,
  onGradeVerse,
  memorizationPage,
  memorizationEndPage,
  readingPage,
  readingEndPage,
  onSyncMemorization,
  onSyncReading,
}) => {
  const [verses, setVerses] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [viewMode, setViewMode] = useState<'page' | 'ayah'>('page');

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

      {/* Sync Buttons Bar (Memorization + Reading Jump) */}
      <div className="p-3 md:p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-sm flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Compass className="size-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-foreground">مزامنة موقع القراءة والحفظ:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onSyncMemorization}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            title="الانتقال فوراً لموقع ورد الحفظ الحالي"
          >
            <Target className="size-3.5" />
            <span>موقع الحفظ {memorizationPage ? `(صفحة ${memorizationPage})` : ''}</span>
          </button>

          <button
            onClick={onSyncReading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            title="الانتقال فوراً لموقع ورد التلاوة الحالي"
          >
            <Bookmark className="size-3.5" />
            <span>موقع التلاوة {readingPage ? `(صفحة ${readingPage})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Surah Header Selector & View Toggle Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20 text-sm">
            {surahNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={surahNumber}
                onChange={(e) => onSelectSurah(Number(e.target.value))}
                className="bg-secondary/70 text-sm font-bold text-foreground rounded-xl px-3 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {SURAHS.map((s) => (
                  <option key={s.id} value={s.id}>
                    سورة {s.name} ({s.transliteration})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">
              سورة {currentSurah.type === 'Meccan' ? 'مكية' : 'مدنية'} • {currentSurah.versesCount} آية • الجزء {currentSurah.juzStart}
            </p>
          </div>
        </div>

        {/* View Toggle Tabs (Pages View vs Ayahs View) */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-secondary/80 border border-border text-xs font-bold">
            <button
              onClick={() => setViewMode('page')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'page'
                  ? 'bg-background text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Book className="size-3.5" />
              <span>عرض المصحف (صفحات)</span>
            </button>

            <button
              onClick={() => setViewMode('ayah')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'ayah'
                  ? 'bg-background text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="size-3.5" />
              <span>عرض الآيات (قائمة)</span>
            </button>
          </div>

          <button
            onClick={() =>
              onChangeRepeatSettings({ ...repeatSettings, blindMode: !repeatSettings.blindMode })
            }
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              repeatSettings.blindMode
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                : 'bg-secondary/70 text-muted-foreground border-border hover:bg-secondary'
            }`}
          >
            {repeatSettings.blindMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            اختبار الحفظ
          </button>

          {viewMode === 'ayah' && (
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showTranslation
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                  : 'bg-secondary/70 text-muted-foreground border-border hover:bg-secondary'
              }`}
            >
              التفسير / الترجمة
            </button>
          )}
        </div>
      </div>

      {/* Standalone Basmalah Header */}
      {surahNumber !== 9 && (
        <div className="text-center py-4 font-arabic-quran text-3xl md:text-4xl text-emerald-500/90 dir-rtl select-none tracking-wide">
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
        <div className="space-y-8">
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
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold animate-pulse text-[11px]">
                        <Target className="size-3.5" /> 🎯 نهاية ورد الحفظ اليومي
                      </span>
                    )}

                    {isReadTargetPage && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold animate-pulse text-[11px]">
                        <Bookmark className="size-3.5" /> 📖 نهاية ورد التلاوة اليومي
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
        <div className="space-y-4">
          {verses.map((ayah) => {
            const isActive = currentAyahIndex === ayah.numberInSurah;
            const isMemTargetPage = memorizationEndPage === ayah.page || memorizationPage === ayah.page;
            const isReadTargetPage = readingEndPage === ayah.page || readingPage === ayah.page;

            return (
              <div
                key={ayah.number}
                onClick={() => onSelectAyah(ayah.numberInSurah)}
                className={`p-5 md:p-7 rounded-2xl border transition-all cursor-pointer relative ${
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-foreground font-bold">
                      الآية {ayah.numberInSurah} (صفحة {ayah.page})
                    </span>

                    {isActive && isAudioPlaying && (
                      <span className="text-xs font-bold text-emerald-400 animate-pulse flex items-center gap-1.5">
                        <Volume2 className="size-4" /> جاري التلاوة والتكرار...
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isMemTargetPage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                        <Target className="size-3" /> 🎯 نهاية ورد الحفظ
                      </span>
                    )}

                    {isReadTargetPage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold text-[10px]">
                        <Bookmark className="size-3" /> 📖 نهاية ورد التلاوة
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
