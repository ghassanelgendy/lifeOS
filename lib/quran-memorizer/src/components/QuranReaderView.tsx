import React, { useState, useEffect } from 'react';
import { BookOpen, Layers, Eye, EyeOff, Check, RotateCcw, Volume2 } from 'lucide-react';
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
}) => {
  const [verses, setVerses] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);

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

  return (
    <div className="space-y-4 font-sans dir-rtl">
      {/* Surah Header Selector & Bar */}
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

        {/* View Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              showTranslation
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-secondary/70 text-muted-foreground border-border hover:bg-secondary'
            }`}
          >
            الترجمة
          </button>
        </div>
      </div>

      {/* Bismillah Header (Except Surah 1 & Surah 9) */}
      {surahNumber !== 1 && surahNumber !== 9 && (
        <div className="text-center py-4 font-arabic text-3xl text-emerald-500/90 dir-rtl select-none">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </div>
      )}

      {/* Verses Container */}
      {loading ? (
        <div className="p-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border rounded-2xl">
          جاري تحميل آيات سورة {currentSurah.name}...
        </div>
      ) : (
        <div className="space-y-4">
          {verses.map((ayah) => {
            const isActive = currentAyahIndex === ayah.numberInSurah;

            return (
              <div
                key={ayah.number}
                onClick={() => onSelectAyah(ayah.numberInSurah)}
                className={`p-5 md:p-7 rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-lg'
                    : 'border-border/60 bg-card hover:border-border hover:bg-accent/20'
                }`}
              >
                {/* Verse Header Info */}
                <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground font-sans">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-foreground font-bold">
                    الآية {ayah.numberInSurah}
                  </span>

                  {isActive && isAudioPlaying && (
                    <span className="text-xs font-bold text-emerald-400 animate-pulse flex items-center gap-1.5">
                      <Volume2 className="size-4" /> جاري التلاوة والتكرار...
                    </span>
                  )}
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
