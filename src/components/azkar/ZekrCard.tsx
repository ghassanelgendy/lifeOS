import React, { useState, useCallback } from 'react';
import { Bookmark, Check, RotateCcw, Share2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AzkarItem } from '../../types/azkar';
import { useAzkarStore } from '../../stores/useAzkarStore';
import { stripTashkeel } from '../../hooks/useAzkar';

interface ZekrCardProps {
  item: AzkarItem;
  index: number;
  total: number;
  completedCount: number;
  isFavorite: boolean;
  onIncrement: (id: string, newCount: number) => void;
  onReset: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onNext?: () => void;
}

export function ZekrCard({
  item,
  index,
  total,
  completedCount,
  isFavorite,
  onIncrement,
  onReset,
  onToggleFavorite,
  onNext,
}: ZekrCardProps) {
  const {
    fontSize,
    showTashkeel,
    hapticFeedback,
    soundEnabled,
    autoAdvance,
  } = useAzkarStore();

  const [showDetails, setShowDetails] = useState(false);

  const targetCount = item.count;
  const isFinished = completedCount >= targetCount;
  const remaining = Math.max(0, targetCount - completedCount);

  const triggerHaptic = useCallback(() => {
    if (!hapticFeedback) return;
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(25);
      }
    } catch {}
  }, [hapticFeedback]);

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  }, [soundEnabled]);

  const handleTap = (e: React.MouseEvent) => {
    // If clicking action buttons inside footer/header, don't increment
    if ((e.target as HTMLElement).closest('button')) return;

    if (isFinished) return;

    triggerHaptic();
    const newCount = completedCount + 1;
    onIncrement(item.id, newCount);

    if (newCount >= targetCount) {
      playChime();
      if (autoAdvance && onNext) {
        setTimeout(() => {
          onNext();
        }, 500);
      }
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `${item.zekr}\n\n${item.description ? `فضيلته: ${item.description}\n` : ''}${item.reference ? `المرجع: ${item.reference}` : ''}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: item.category,
          text: shareText,
        });
      } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
    }
  };

  // Adjust font size style
  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-base sm:text-lg leading-relaxed'
      : fontSize === 'base'
      ? 'text-lg sm:text-xl leading-relaxed'
      : fontSize === 'lg'
      ? 'text-xl sm:text-2xl leading-loose'
      : 'text-2xl sm:text-3xl leading-loose';

  const progressPct = Math.min(100, (completedCount / targetCount) * 100);

  return (
    <div
      onClick={handleTap}
      className={cn(
        'group relative flex flex-col justify-between p-5 sm:p-7 rounded-2xl border transition-all duration-200 cursor-pointer select-none',
        isFinished
          ? 'bg-card/40 border-emerald-500/30 opacity-80 shadow-none'
          : 'bg-card hover:bg-accent/20 border-border hover:border-primary/40 shadow-sm hover:shadow-md'
      )}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full font-medium bg-secondary text-muted-foreground">
            {index + 1} من {total}
          </span>
          {isFinished && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <Check size={13} strokeWidth={3} />
              <span>تم الإتمام</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isFavorite
                ? 'text-amber-500 bg-amber-500/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
            title="حفظ في المفضلة"
          >
            <Bookmark size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="مشاركة الذكر"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Zekr Text Body */}
      <div className="my-2 py-2">
        <p
          className={cn(
            'font-arabic-quran text-foreground text-right tracking-wide whitespace-pre-line',
            fontSizeClass
          )}
          dir="rtl"
        >
          {showTashkeel ? item.zekr : stripTashkeel(item.zekr)}
        </p>
      </div>

      {/* Description & Reference Collapsible */}
      {(item.description || item.reference) && (
        <div className="my-3 pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails((v) => !v);
            }}
            className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Info size={14} />
              <span>الفضل والمرجع</span>
            </span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showDetails && (
            <div className="mt-2 text-xs text-muted-foreground space-y-1.5 bg-secondary/30 p-3 rounded-xl animate-in fade-in duration-150" dir="rtl">
              {item.description && (
                <p className="leading-relaxed">
                  <span className="font-semibold text-foreground">الفضيلة: </span>
                  {item.description}
                </p>
              )}
              {item.reference && (
                <p className="text-[11px] text-muted-foreground/80">
                  <span className="font-semibold text-foreground">المصدر: </span>
                  {item.reference}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Counter & Action Bottom Bar */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/60">
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReset(item.id);
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="إعادة التصفير"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {isFinished ? 'اكتمل التكرار' : `المتبقي: ${remaining}`}
          </span>
        </div>

        {/* Big Tap Target / Counter Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTap(e);
            }}
            disabled={isFinished}
            className={cn(
              'relative min-w-[76px] h-11 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all duration-150 select-none shadow-sm active:scale-95',
              isFinished
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-default'
                : 'bg-primary text-primary-foreground hover:brightness-105 cursor-pointer'
            )}
          >
            {isFinished ? (
              <>
                <Check size={18} strokeWidth={3} />
                <span className="text-sm font-semibold">{targetCount}</span>
              </>
            ) : (
              <span className="text-base font-extrabold tracking-tight font-mono">
                {completedCount} / {targetCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Progress line at bottom of card */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary/40 rounded-b-2xl overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-200',
            isFinished ? 'bg-emerald-500' : 'bg-primary'
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
