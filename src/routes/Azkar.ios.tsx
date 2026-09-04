import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Check, Bookmark, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useAllAzkar,
  useAzkarCategories,
  useTodayAzkarProgress,
  useAzkarFavorites,
  useContextualAzkarCategory,
} from '../hooks/useAzkar';
import { useAzkarStore } from '../stores/useAzkarStore';

export default function AzkarRoute() {
  const allAzkar = useAllAzkar();
  const categories = useAzkarCategories();
  const { progress, updateCount } = useTodayAzkarProgress();
  const { favoriteIds, isFavorite, toggleFavorite } = useAzkarFavorites();
  const contextual = useContextualAzkarCategory();

  const {
    selectedCategory,
    setSelectedCategory,
    fontSize,
    hapticFeedback,
    soundEnabled,
    toggleSound,
  } = useAzkarStore();

  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward (next), -1 = back (prev)

  // Determine which category to show
  const activeCategory = selectedCategory || contextual.category;
  const categoryItems = useMemo(
    () => allAzkar.filter((item) => item.category === activeCategory),
    [allAzkar, activeCategory]
  );

  // Reset index when category changes
  useEffect(() => {
    setActiveIndex(0);
  }, [activeCategory]);

  // Clamp index if filtered list shrinks
  useEffect(() => {
    if (categoryItems.length > 0 && activeIndex >= categoryItems.length) {
      setActiveIndex(categoryItems.length - 1);
    }
  }, [categoryItems.length, activeIndex]);

  const item = categoryItems[activeIndex];
  const completedCount = item ? progress.counts[item.id] || 0 : 0;
  const targetCount = item?.count ?? 0;
  const isFinished = !!item && completedCount >= targetCount;

  const handleIncrement = useCallback(
    (id: string, count: number) => {
      const cat = allAzkar.find((i) => i.id === id)?.category;
      const catItems = allAzkar.filter((i) => i.category === cat);
      const allDone = catItems.every((ci) => {
        const current = ci.id === id ? count : progress.counts[ci.id] || 0;
        return current >= ci.count;
      });
      updateCount({ zekrId: id, count, categoryName: cat, categoryCompleted: allDone });
    },
    [allAzkar, progress.counts, updateCount]
  );

  const next = useCallback(() => {
    setDirection(1);
    setActiveIndex((i) => Math.min(i + 1, categoryItems.length - 1));
  }, [categoryItems.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleTap = useCallback(() => {
    if (!item || isFinished) return;

    if (hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {}
    }

    const newCount = completedCount + 1;
    handleIncrement(item.id, newCount);

    if (newCount >= targetCount) {
      if (soundEnabled && typeof window !== 'undefined' && 'AudioContext' in window) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(659.25, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } catch {}
      }
      // auto-advance to next zekr after finishing
      setTimeout(() => {
        if (activeIndex < categoryItems.length - 1) {
          next();
        }
      }, 550);
    }
  }, [
    item,
    isFinished,
    hapticFeedback,
    completedCount,
    handleIncrement,
    targetCount,
    soundEnabled,
    activeIndex,
    categoryItems.length,
    next,
  ]);

  // Swipe handling: right swipe skips (next), left swipe goes back (prev)
  const handleDragEnd = useCallback(
    (_event: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const vx = info.velocity.x;
      if (vx < -120) {
        // finger moved left -> left swipe -> goes back (prev)
        prev();
      } else if (vx > 120) {
        // finger moved right -> right swipe -> skips (next)
        next();
      }
    },
    [prev, next]
  );

  const handleSwitchCategory = (cat: string) => {
    setSelectedCategory(cat);
    setActiveIndex(0);
  };

  const progressPct = item ? Math.min(100, (completedCount / targetCount) * 100) : 0;

  // Font sizing for iOS
  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-xl leading-relaxed'
      : fontSize === 'base'
      ? 'text-2xl leading-relaxed'
      : fontSize === 'lg'
      ? 'text-2xl leading-loose'
      : 'text-3xl leading-loose';

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="-m-4 flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2 text-sm font-bold text-primary"
        >
          <Sun size={18} />
          <span>الأذكار</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary"
            title="الصوت"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border/60 px-4 py-2">
        {categories.map((cat) => {
          const isSel = cat.name === activeCategory;
          return (
            <button
              key={cat.name}
              onClick={() => handleSwitchCategory(cat.name)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-all',
                isSel
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground'
              )}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Reader area */}
      <div className="relative flex-1 overflow-hidden">
        {categoryItems.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            لا توجد أذكار في هذا التصنيف
          </div>
        ) : (
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={item?.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.22 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragEnd={handleDragEnd}
              onClick={handleTap}
              className="flex h-full cursor-pointer touch-pan-y select-none flex-col"
            >
              {/* Progress + index */}
              <div className="flex items-center justify-between px-5 pt-4 text-xs text-muted-foreground">
                <span className="font-medium">
                  {activeIndex + 1} / {categoryItems.length}
                </span>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{ width: `${((activeIndex + 1) / categoryItems.length) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {item && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className={cn(
                        'rounded-lg p-1.5 transition-colors',
                        isFavorite(item.id)
                          ? 'text-amber-500'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      title="المفضلة"
                    >
                      <Bookmark size={16} fill={isFavorite(item.id) ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
              </div>

              {/* Zekr text - centered full area */}
              <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-2">
                <p
                  className={cn(
                    'font-arabic-quran text-center font-bold leading-relaxed',
                    fontSizeClass,
                    isFinished ? 'text-emerald-500' : 'text-foreground'
                  )}
                  dir="rtl"
                >
                  {item?.zekr}
                </p>

                {/* Counter / completion */}
                <div className="mt-10 flex flex-col items-center">
                  {isFinished ? (
                    <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-emerald-500">
                      <Check size={20} strokeWidth={3} />
                      <span className="text-sm font-bold">تم الإتمام</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline text-center">
                      <span className="text-4xl font-extrabold tracking-tight text-foreground">
                        {completedCount}
                      </span>
                      <span className="mx-1 text-lg text-muted-foreground">/</span>
                      <span className="text-lg text-muted-foreground">{targetCount}</span>
                    </div>
                  )}
                </div>

                {/* Progress ring bar under counter */}
                <div className="mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-200',
                      isFinished ? 'bg-emerald-500' : 'bg-primary'
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Bottom hint */}
              <div className="px-6 pb-6 text-center text-[11px] text-muted-foreground">
                اضغط للعد • اسحب لليمين للتالي • اسحب لليسار للسابق
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
