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
      <div className="flex items-center gap-2 mb-2 dir-rtl">
        <button
          onClick={onToggleBlindMode}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-500/20 transition-all cursor-pointer"
        >
          <EyeOff className="size-4" />
          تفعيل وضع اختبار الحفظ (إخفاء النص)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 my-2 p-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/30 backdrop-blur-md dir-rtl shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-400 flex items-center gap-2">
          <EyeOff className="size-4" />
          وضع الاختبار والتسميع الذاتي (مُخفَى)
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRevealWord}
            disabled={revealedWordsCount >= words.length}
            className="px-3 py-1 rounded-xl bg-secondary text-foreground text-xs font-bold border border-border hover:bg-accent disabled:opacity-40 cursor-pointer"
          >
            + كشف كلمة واحدة
          </button>
          <button
            onClick={handleToggleFullReveal}
            className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow-sm"
          >
            {isFullyRevealed ? 'تظليل النص' : 'كشف النص كاملاً'}
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

      {/* Masked / Blur Text Display */}
      <div className="dir-rtl text-right font-arabic text-2xl md:text-3xl leading-[2.2] p-4 rounded-xl bg-black/30 border border-border/30 select-none">
        {words.map((word, i) => {
          const isRevealed = isFullyRevealed || i < revealedWordsCount;
          return (
            <span
              key={i}
              onClick={handleRevealWord}
              className={`inline-block mx-1 px-1 rounded-lg transition-all duration-300 cursor-pointer ${
                isRevealed
                  ? 'text-foreground bg-transparent'
                  : 'text-transparent bg-indigo-500/25 blur-md hover:blur-none select-none'
              }`}
            >
              {word}
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
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 cursor-pointer"
            >
              <RefreshCw className="size-3.5" /> إعادة (نسيت)
            </button>
            <button
              onClick={() => onGrade('hard')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 cursor-pointer"
            >
              <AlertTriangle className="size-3.5" /> صعب
            </button>
            <button
              onClick={() => onGrade('good')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" /> جيد
            </button>
            <button
              onClick={() => onGrade('easy')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-500/20 cursor-pointer"
            >
              <Award className="size-3.5" /> ممتاز (متقن)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
