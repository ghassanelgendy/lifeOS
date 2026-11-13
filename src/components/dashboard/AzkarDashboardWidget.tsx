import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAllAzkar,
  useTodayAzkarProgress,
  useContextualAzkarCategory,
} from '../../hooks/useAzkar';
import { AnimatedNumber } from './dashboardMotion';

interface AzkarDashboardWidgetProps {
  className?: string;
}

const RING_R = 26;

export function AzkarDashboardWidget({ className }: AzkarDashboardWidgetProps = {}) {
  const reduce = useReducedMotion();
  const allAzkar = useAllAzkar();
  const { progress } = useTodayAzkarProgress();
  const contextual = useContextualAzkarCategory();

  // Get items for recommended category
  const currentCategoryAzkar = useMemo(() => {
    return allAzkar.filter((item) => item.category === contextual.category);
  }, [allAzkar, contextual.category]);

  const stats = useMemo(() => {
    if (!currentCategoryAzkar.length) return { completed: 0, total: 0, percent: 0, isDone: false };
    let completed = 0;
    for (const item of currentCategoryAzkar) {
      const count = progress.counts[item.id] || 0;
      if (count >= item.count) completed++;
    }
    const percent = Math.round((completed / currentCategoryAzkar.length) * 100);
    return {
      completed,
      total: currentCategoryAzkar.length,
      percent,
      isDone: completed === currentCategoryAzkar.length,
    };
  }, [currentCategoryAzkar, progress.counts]);

  const ringColor = stats.isDone ? 'var(--ds-success)' : 'var(--ds-accent)';

  return (
    <Link
      to="/azkar"
      dir="rtl"
      lang="ar"
      data-ds
      className={cn(
        'fx-card group flex h-full items-center gap-5 rounded-card border border-separator bg-raised p-5 shadow-ds select-none',
        className
      )}
    >
      {/* Progress ring: draws itself to today's completion */}
      <span className="relative flex size-[72px] shrink-0 items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={RING_R} fill="none" stroke="var(--ds-sunken)" strokeWidth="6" />
          <motion.circle
            cx="32" cy="32" r={RING_R} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: stats.percent / 100 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }}
          />
        </svg>
        {stats.isDone ? (
          <motion.span
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1], delay: 0.5 }}
            className="text-success"
          >
            <Check size={26} strokeWidth={3} />
          </motion.span>
        ) : (
          <span className="text-title font-bold tabular-nums text-ink" dir="ltr">
            <AnimatedNumber value={stats.percent} />
            <span className="text-caption font-semibold text-ink-3">%</span>
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-title font-semibold leading-tight text-ink">الأذكار والورد اليومي</span>
          <span className="rounded-pill border border-separator px-2 py-0.5 text-caption font-medium text-ink-2">
            {contextual.badge}
          </span>
        </span>
        <span className="truncate text-label text-ink-2">{contextual.category}</span>
        <span className={cn('text-caption font-semibold tabular-nums', stats.isDone ? 'text-success' : 'text-ink-3')}>
          {stats.isDone ? 'تم إتمام الورد' : `${stats.completed} من ${stats.total} ذكر`}
        </span>
      </span>

      <span className="ds-t flex shrink-0 items-center gap-1 text-label font-medium text-ink-3 group-hover:text-accent-ds">
        <span className="hidden sm:inline">قراءة الأذكار</span>
        <ChevronLeft size={18} className="transition-transform duration-200 group-hover:-translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
      </span>
    </Link>
  );
}
