import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Copy, Check, Quote, BookOpen, ChevronRight, Languages } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getDailyHadith, getRandomHadith, SHORT_HADITHS, type ShortHadith } from '../../data/shortHadiths';
import { triggerHaptics } from '../../lib/nativeBridge';

interface HadithWidgetProps {
  className?: string;
  isIOS?: boolean;
  compact?: boolean;
}

export function HadithWidget({ className, isIOS = false, compact = false }: HadithWidgetProps) {
  const dailyHadith = useMemo(() => getDailyHadith(), []);
  const [currentHadith, setCurrentHadith] = useState<ShortHadith>(dailyHadith);
  const [copied, setCopied] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const isDaily = currentHadith.id === dailyHadith.id;

  const handleNextHadith = useCallback(() => {
    setIsRotating(true);
    void triggerHaptics('light');
    const currentIndex = SHORT_HADITHS.findIndex((h) => h.id === currentHadith.id);
    const { hadith } = getRandomHadith(currentIndex);
    setCurrentHadith(hadith);
    setTimeout(() => setIsRotating(false), 300);
  }, [currentHadith.id]);

  const handleCopy = useCallback(async () => {
    try {
      const fullText = `«${currentHadith.text}»\n- ${currentHadith.source}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      void triggerHaptics('success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy Hadith:', err);
    }
  }, [currentHadith]);

  const cardStyle = isIOS
    ? 'rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl p-4 shadow-sm'
    : 'rounded-2xl border border-border/70 bg-card/95 backdrop-blur-md p-4.5 shadow-sm hover:border-border transition-all duration-200';

  return (
    <div className={cn(cardStyle, 'relative overflow-hidden group', className)}>
      {/* Subtle background decorative ornament */}
      <div 
        className="pointer-events-none absolute -left-6 -top-6 size-28 rounded-full bg-emerald-500/5 blur-2xl dark:bg-emerald-400/10" 
        aria-hidden="true" 
      />
      <div 
        className="pointer-events-none absolute -right-6 -bottom-6 size-28 rounded-full bg-amber-500/5 blur-2xl dark:bg-amber-400/10" 
        aria-hidden="true" 
      />

      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 mb-3 border-b border-border/30 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Quote className="size-3.5 rotate-180" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold tracking-wide text-foreground">
              {isDaily ? 'حديث اليوم' : 'حديث شريف'}
            </span>
            {currentHadith.category && (
              <span className="inline-flex items-center rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/40">
                {currentHadith.category}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {currentHadith.translation && (
            <button
              type="button"
              onClick={() => {
                setShowTranslation((prev) => !prev);
                void triggerHaptics('selection');
              }}
              title={showTranslation ? 'عرض النص العربي' : 'Show English Translation'}
              className={cn(
                'flex size-7 items-center justify-center rounded-lg border text-xs transition-all',
                showTranslation
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'border-border/50 bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Languages className="size-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title="نسخ الحديث"
            className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleNextHadith}
            title="حديث آخر"
            className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            <RefreshCw className={cn('size-3.5 transition-transform duration-300', isRotating && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Main Hadith content with Framer Motion slide transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentHadith.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="space-y-2.5"
        >
          {/* Arabic Hadith Text */}
          <div dir="rtl" className="text-right">
            <p className={cn(
              'font-hadith text-emerald-900 dark:text-emerald-100 font-semibold tracking-wide text-right',
              compact ? 'text-base leading-relaxed' : 'text-lg leading-loose sm:text-xl sm:leading-loose'
            )}>
              «{currentHadith.text}»
            </p>
          </div>

          {/* Optional English Translation */}
          {showTranslation && currentHadith.translation && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-muted-foreground italic leading-relaxed pt-1 border-t border-border/20"
            >
              "{currentHadith.translation}"
            </motion.p>
          )}

          {/* Footer Source */}
          <div className="flex items-center justify-between pt-1" dir="rtl">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/90">
              <BookOpen className="size-3 text-emerald-500/80" />
              {currentHadith.source}
            </span>

            {!isDaily && (
              <button
                type="button"
                onClick={() => setCurrentHadith(dailyHadith)}
                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                العودة لحديث اليوم
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
