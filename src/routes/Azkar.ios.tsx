import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Check, Bookmark, Volume2, VolumeX } from 'lucide-react';
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
  const { isFavorite, toggleFavorite } = useAzkarFavorites();
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
  const isDraggingRef = useRef(false);

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
    // Swiping/skipping past a zekr before finishing its tap count still counts it as
    // done — otherwise skipping a few items permanently blocks the category from completion.
    if (item && completedCount < targetCount) {
      handleIncrement(item.id, targetCount);
    }
    setDirection(1);
    setActiveIndex((i) => Math.min(i + 1, categoryItems.length - 1));
  }, [item, completedCount, targetCount, handleIncrement, categoryItems.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleTap = useCallback(() => {
    if (isDraggingRef.current) return;
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

  // Swipe handling:
  // In RTL Arabic reading order, swipe left (drag to left, dx < 0) advances to the next item,
  // swipe right (drag to right, dx > 0) goes to previous item.
  // We check both offset distance (> 45px) and velocity (> 100px/s) for responsive swiping.
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const dx = info.offset.x;
      const vx = info.velocity.x;

      const isSwipeLeft = dx < -45 || vx < -100;
      const isSwipeRight = dx > 45 || vx > 100;

      if (isSwipeLeft) {
        next();
      } else if (isSwipeRight) {
        prev();
      }

      // Allow a brief delay before enabling tap again so the drag release doesn't count
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 80);
    },
    [prev, next]
  );

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleSwitchCategory = (cat: string) => {
    setSelectedCategory(cat);
    setActiveIndex(0);
  };

  const progressPct = item && targetCount > 0 ? Math.min(100, (completedCount / targetCount) * 100) : 0;

  // Font sizing for iOS
  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-lg sm:text-xl leading-relaxed'
      : fontSize === 'base'
      ? 'text-xl sm:text-2xl leading-relaxed'
      : fontSize === 'lg'
      ? 'text-2xl sm:text-3xl leading-loose'
      : 'text-3xl sm:text-4xl leading-loose';

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Category Pills & Top Quick Actions */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 shrink-0 bg-background/80 backdrop-blur-md">
        <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => {
            const isSel = cat.name === activeCategory;
            return (
              <button
                key={cat.name}
                onClick={() => handleSwitchCategory(cat.name)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95',
                  isSel
                    ? 'border-primary bg-primary font-semibold text-primary-foreground shadow-sm'
                    : 'border-border/60 bg-card text-muted-foreground'
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Sound toggle button */}
        <button
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          aria-label="الصوت"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-all active:scale-95 active:bg-secondary"
          title="الصوت"
        >
          {soundEnabled ? <Volume2 size={16} className="text-primary" /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* Reader area */}
      <div className="relative flex-1 overflow-hidden" data-no-pull-refresh>
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
              transition={{ type: 'tween', duration: 0.2 }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onClick={handleTap}
              className="flex h-full w-full cursor-pointer select-none flex-col justify-between touch-none"
            >
              {/* Progress + index + bookmark bar */}
              <div className="flex items-center justify-between px-5 pt-3 text-xs text-muted-foreground shrink-0">
                <span className="font-semibold text-foreground/80">
                  {activeIndex + 1} / {categoryItems.length}
                </span>

                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
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
                      aria-pressed={isFavorite(item.id)}
                      aria-label="المفضلة"
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full transition-colors active:scale-90',
                        isFavorite(item.id)
                          ? 'text-amber-500'
                          : 'text-muted-foreground active:text-foreground'
                      )}
                      title="المفضلة"
                    >
                      <Bookmark size={17} fill={isFavorite(item.id) ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
              </div>

              {/* Zekr text container - vertically centered */}
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-4 overflow-y-auto">
                <p
                  className={cn(
                    'font-arabic-quran text-center font-bold tracking-normal transition-colors duration-200',
                    fontSizeClass,
                    isFinished ? 'text-emerald-500' : 'text-foreground'
                  )}
                  dir="rtl"
                  lang="ar"
                >
                  {item?.zekr}
                </p>

                {item?.description && (
                  <p className="mt-3 max-w-sm text-center text-xs text-muted-foreground leading-relaxed" dir="rtl">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Bottom interactive counter & controls */}
              <div className="flex flex-col items-center justify-center pb-6 pt-2 shrink-0">
                {/* Visual tap button / counter indicator */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTap();
                  }}
                  className={cn(
                    'relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-150 active:scale-90 touch-manipulation',
                    isFinished
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                      : 'border-primary/40 bg-card hover:border-primary text-foreground'
                  )}
                >
                  {isFinished ? (
                    <div className="flex flex-col items-center gap-1 text-emerald-500">
                      <Check size={28} strokeWidth={3} />
                      <span className="text-[11px] font-bold">تم الإتمام</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-black tracking-tight text-primary">
                        {completedCount}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        من {targetCount}
                      </span>
                    </div>
                  )}

                  {/* Circular progress highlight indicator */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-1 bg-primary rounded-full transition-all duration-200"
                    style={{
                      width: `${progressPct}%`,
                      margin: '0 auto',
                      backgroundColor: isFinished ? '#10b981' : undefined
                    }}
                  />
                </button>

                {/* Gesture hint */}
                <div className="mt-4 text-center text-[11px] text-muted-foreground select-none">
                  اضغط للعد • اسحب لليسار للتالي • اسحب لليمين للسابق
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
