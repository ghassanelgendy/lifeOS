import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, RefreshCw, Award } from 'lucide-react';
import { RatingGrade } from '../types/quran';

interface BlindModeOverlayProps {
  isBlindMode: boolean;
  onToggleBlindMode: () => void;
  textUthmani: string;
  onGrade?: (grade: RatingGrade) => void;
}

export const BlindModeOverlay: React.FC<BlindModeOverlayProps> = ({
  isBlindMode,
  onToggleBlindMode,
  textUthmani,
  onGrade,
}) => {
  const [revealedWordsCount, setRevealedWordsCount] = useState(0);
  const [isFullyRevealed, setIsFullyRevealed] = useState(false);

  const words = textUthmani.split(' ');

  const handleRevealWord = () => {
    if (revealedWordsCount < words.length) {
      setRevealedWordsCount((prev) => prev + 1);
    }
  };

  const handleToggleFullReveal = () => {
    setIsFullyRevealed(!isFullyRevealed);
  };

  if (!isBlindMode) {
    return (
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onToggleBlindMode}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 transition-all cursor-pointer"
        >
          <EyeOff className="size-3.5" />
          Enable Blind Mode (Self-Test)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 my-2 p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
          <EyeOff className="size-4" />
          Blind Recitation Mode
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRevealWord}
            disabled={revealedWordsCount >= words.length}
            className="px-2.5 py-1 rounded-lg bg-secondary text-foreground text-[11px] font-semibold border border-border hover:bg-accent disabled:opacity-40 cursor-pointer"
          >
            Reveal +1 Word
          </button>
          <button
            onClick={handleToggleFullReveal}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500 cursor-pointer"
          >
            {isFullyRevealed ? 'Blur Text' : 'Reveal All'}
          </button>
          <button
            onClick={onToggleBlindMode}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
            title="Exit Blind Mode"
          >
            <Eye className="size-4" />
          </button>
        </div>
      </div>

      {/* Masked / Blur Text Display */}
      <div className="dir-rtl text-right font-arabic text-xl md:text-2xl leading-loose p-4 rounded-xl bg-black/20 border border-border/30 select-none">
        {words.map((word, i) => {
          const isRevealed = isFullyRevealed || i < revealedWordsCount;
          return (
            <span
              key={i}
              onClick={handleRevealWord}
              className={`inline-block mx-1 px-1 rounded transition-all duration-300 cursor-pointer ${
                isRevealed
                  ? 'text-foreground bg-transparent'
                  : 'text-transparent bg-indigo-500/20 blur-sm hover:blur-none select-none'
              }`}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Self-Rating SRS Buttons */}
      {onGrade && (
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <span className="text-[11px] text-muted-foreground font-medium">Rate your recitation accuracy:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onGrade('again')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 cursor-pointer"
            >
              <RefreshCw className="size-3" /> Again (Forgot)
            </button>
            <button
              onClick={() => onGrade('hard')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold hover:bg-amber-500/20 cursor-pointer"
            >
              <AlertTriangle className="size-3" /> Hard
            </button>
            <button
              onClick={() => onGrade('good')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 cursor-pointer"
            >
              <CheckCircle2 className="size-3" /> Good
            </button>
            <button
              onClick={() => onGrade('easy')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 cursor-pointer"
            >
              <Award className="size-3" /> Easy (Perfect)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
