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

  const words = textUthmani.trim().split(/\s+/);

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
      <div dir="rtl" className="flex items-center gap-2 mb-2">
        <button
          onClick={onToggleBlindMode}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-500/20 transition-all cursor-pointer"
        >
          <EyeOff className="size-4 shrink-0" />
          <span>تفعيل وضع اختبار الحفظ (إخفاء النص)</span>
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-3 my-2 p-4 md:p-5 rounded-2xl border border-indigo-500/30 bg-indigo-950/30 backdrop-blur-md shadow-lg font-arabic-body text-right">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-bold text-indigo-400 flex items-center gap-2">
          <EyeOff className="size-4" />
          وضع الاختبار والتسميع الذاتي (مُخفَى)
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRevealWord}
            disabled={revealedWordsCount >= words.length || isFullyRevealed}
            className="px-3 py-1.5 rounded-xl bg-secondary text-foreground text-xs font-bold border border-border hover:bg-accent disabled:opacity-40 cursor-pointer transition-all"
          >
            + كشف كلمة واحدة ({revealedWordsCount}/{words.length})
          </button>
          <button
            onClick={handleToggleFullReveal}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow-sm transition-all"
          >
            {isFullyRevealed ? 'إخفاء النص' : 'كشف النص كاملاً'}
          </button>
          <button
            onClick={onToggleBlindMode}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
            title="إلغاء الإخفاء"
          >
            <Eye className="size-4" />
          </button>
        </div>
      </div>

      {/* Masked / Natural Arabic Text Display */}
      <div className="dir-rtl text-right font-arabic-quran text-3xl md:text-4xl leading-[2.4] p-5 rounded-2xl bg-black/40 border border-border/40 select-none">
        {words.map((word, i) => {
          const isRevealed = isFullyRevealed || i < revealedWordsCount;
          return (
            <span
              key={i}
              onClick={handleRevealWord}
              className={`inline mx-1 px-1 rounded-md transition-all duration-300 cursor-pointer ${
                isRevealed
                  ? 'text-foreground bg-transparent'
                  : 'text-indigo-400/20 bg-indigo-500/20 rounded border border-indigo-500/30 blur-[6px] hover:blur-none select-none'
              }`}
            >
              {word}{' '}
            </span>
          );
        })}
      </div>

      {/* Self-Rating SRS Buttons */}
      {onGrade && (
        <div className="flex items-center justify-between pt-3 border-t border-border/30 flex-wrap gap-2">
          <span className="text-xs text-muted-foreground font-bold">قيّم جودة حفظك لهذه الآية:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onGrade('again')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 cursor-pointer"
            >
              <RefreshCw className="size-3.5" /> إعادة (نسيت)
            </button>
            <button
              onClick={() => onGrade('hard')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 cursor-pointer"
            >
              <AlertTriangle className="size-3.5" /> صعب
            </button>
            <button
              onClick={() => onGrade('good')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" /> جيد
            </button>
            <button
              onClick={() => onGrade('easy')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-500/20 cursor-pointer"
            >
              <Award className="size-3.5" /> ممتاز (متقن)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
