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
  const [showTranslation, setShowTranslation] = useState(true);

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
    <div className="space-y-4 font-sans">
      {/* Surah Header Selector & Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold flex items-center justify-center shrink-0">
            {surahNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={surahNumber}
                onChange={(e) => onSelectSurah(Number(e.target.value))}
                className="bg-secondary/60 text-sm font-bold text-foreground rounded-lg px-2.5 py-1 border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {SURAHS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. {s.transliteration} ({s.name})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentSurah.type} • {currentSurah.versesCount} Verses • Juz {currentSurah.juzStart}
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() =>
              onChangeRepeatSettings({ ...repeatSettings, blindMode: !repeatSettings.blindMode })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              repeatSettings.blindMode
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
            }`}
          >
            {repeatSettings.blindMode ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            Blind Mode
          </button>

          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              showTranslation
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
            }`}
          >
            Translation
          </button>
        </div>
      </div>

      {/* Bismillah Header (Except Surah 1 & Surah 9) */}
      {surahNumber !== 1 && surahNumber !== 9 && (
        <div className="text-center py-3 font-arabic text-2xl text-emerald-500/90 dir-rtl select-none">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </div>
      )}

      {/* Verses Container */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
          Loading Uthmani text for {currentSurah.transliteration}...
        </div>
      ) : (
        <div className="space-y-4">
          {verses.map((ayah) => {
            const isActive = currentAyahIndex === ayah.numberInSurah;

            return (
              <div
                key={ayah.number}
                onClick={() => onSelectAyah(ayah.numberInSurah)}
                className={`p-4 md:p-6 rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-md'
                    : 'border-border/60 bg-card hover:border-border hover:bg-accent/20'
                }`}
              >
                {/* Verse Header Info */}
                <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground font-sans">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-foreground font-bold">
                    {surahNumber}:{ayah.numberInSurah}
                  </span>

                  {isActive && isAudioPlaying && (
                    <span className="text-xs font-semibold text-emerald-500 animate-pulse flex items-center gap-1">
                      <Volume2 className="size-3.5" /> Reciting...
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
                  <div className="dir-rtl text-right font-arabic text-2xl md:text-3xl leading-[2.2] text-foreground tracking-wide select-none">
                    {ayah.textUthmani}
                    <span className="inline-flex items-center justify-center size-8 mx-2 rounded-full border border-emerald-500/40 text-emerald-500 font-sans text-xs font-bold align-middle">
                      {ayah.numberInSurah}
                    </span>
                  </div>
                )}

                {/* Translation Display */}
                {showTranslation && ayah.translation && (
                  <p className="mt-3 text-xs md:text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
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
