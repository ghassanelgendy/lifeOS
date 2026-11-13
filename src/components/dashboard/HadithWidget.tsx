import { Fragment, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RefreshCw, Copy, Check, BookOpen, Languages } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getDailyHadith, getRandomHadith, SHORT_HADITHS, type ShortHadith } from '../../data/shortHadiths';
import { triggerHaptics } from '../../lib/nativeBridge';

interface HadithWidgetProps {
  className?: string;
  isIOS?: boolean;
  compact?: boolean;
}

const iconButton =
  'ds-t flex size-8 items-center justify-center rounded-control border border-separator text-ink-3 hover:bg-hover hover:text-ink active:scale-95';

export function HadithWidget({ className, isIOS = false, compact = false }: HadithWidgetProps) {
  const reduce = useReducedMotion();
  const dailyHadith = useMemo(() => getDailyHadith(), []);
  const [currentHadith, setCurrentHadith] = useState<ShortHadith>(dailyHadith);
  const [copied, setCopied] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [turns, setTurns] = useState(0);

  const isDaily = currentHadith.id === dailyHadith.id;

  const [seenIds, setSeenIds] = useState<string[]>([dailyHadith.id]);

  const handleNextHadith = useCallback(() => {
    setTurns((t) => t + 1);
    void triggerHaptics('light');
    const currentIndex = SHORT_HADITHS.findIndex((h) => h.id === currentHadith.id);
    const { hadith } = getRandomHadith(currentIndex, seenIds);
    setSeenIds((prev) => (prev.length > 100 ? [hadith.id] : [...prev, hadith.id]));
    setCurrentHadith(hadith);
  }, [currentHadith.id, seenIds]);

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

  const words = useMemo(() => currentHadith.text.split(/\s+/).filter(Boolean), [currentHadith.text]);

  const cardStyle = isIOS
    ? 'rounded-2xl border border-border/80 dark:border-white/10 bg-card/90 dark:bg-black/40 backdrop-blur-xl p-4 shadow-sm'
    : 'rounded-card border border-separator bg-raised p-5 shadow-ds';

  return (
    <div className={cn(cardStyle, 'group flex h-full flex-col justify-between', className)}>
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-label font-semibold text-ink-2">
            {isDaily ? 'حديث اليوم' : 'حديث شريف'}
          </span>
          {currentHadith.category && (
            <span className="rounded-pill border border-separator px-2 py-0.5 text-caption font-medium text-ink-3">
              {currentHadith.category}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {currentHadith.translation && (
            <button
              type="button"
              onClick={() => {
                setShowTranslation((prev) => !prev);
                void triggerHaptics('selection');
              }}
              aria-pressed={showTranslation}
              aria-label={showTranslation ? 'عرض النص العربي' : 'Show English translation'}
              title={showTranslation ? 'عرض النص العربي' : 'Show English Translation'}
              className={cn(iconButton, showTranslation && 'border-accent-ds text-accent-ds')}
            >
              <Languages className="size-4" />
            </button>
          )}

          <button type="button" onClick={handleCopy} aria-label="نسخ الحديث" title="نسخ الحديث" className={iconButton}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? 'done' : 'copy'}
                initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reduce ? undefined : { scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex"
              >
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </button>

          <button type="button" onClick={handleNextHadith} aria-label="حديث آخر" title="حديث آخر" className={iconButton}>
            <motion.span
              className="flex"
              animate={reduce ? undefined : { rotate: turns * 360 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <RefreshCw className="size-4" />
            </motion.span>
          </button>
        </div>
      </div>

      {/* Hadith: the text is dealt in word by word whenever it changes */}
      <AnimatePresence mode="wait" initial={!reduce}>
        <motion.div
          key={currentHadith.id}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
          className="flex flex-1 flex-col justify-between gap-3"
        >
          <p
            dir="rtl"
            lang="ar"
            className={cn(
              'flex-1 text-right font-semibold text-ink',
              compact ? 'text-body leading-relaxed' : 'text-title leading-loose sm:text-xl sm:leading-loose'
            )}
          >
            «
            {words.map((word, i) => (
              <Fragment key={i}>
                <motion.span
                  className="inline-block"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: Math.min(i * 0.035, 1.1), ease: [0.2, 0.7, 0.2, 1] }}
                >
                  {word}
                </motion.span>
                {i < words.length - 1 ? ' ' : ''}
              </Fragment>
            ))}
            »
          </p>

          {/* Optional English Translation */}
          {showTranslation && currentHadith.translation && (
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-separator pt-3 text-label italic leading-relaxed text-ink-2"
            >
              "{currentHadith.translation}"
            </motion.p>
          )}

          {/* Footer Source */}
          <div className="flex items-center justify-between pt-1" dir="rtl">
            <span className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-3">
              <BookOpen className="size-3.5" />
              {currentHadith.source}
            </span>

            {!isDaily && (
              <button
                type="button"
                onClick={() => setCurrentHadith(dailyHadith)}
                className="ds-t text-caption font-medium text-accent-ds hover:underline"
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
