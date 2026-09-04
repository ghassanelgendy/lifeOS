import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronLeft, CheckCircle2, RotateCcw, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAllAzkar,
  useTodayAzkarProgress,
  useContextualAzkarCategory,
} from '../../hooks/useAzkar';

export function AzkarDashboardWidget() {
  const navigate = useNavigate();
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

  return (
    <div
      onClick={() => navigate('/azkar')}
      className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all duration-200 cursor-pointer shadow-sm group select-none relative overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm leading-tight text-foreground">الأذكار والورد اليومي</h3>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-primary/10 text-primary font-medium">
                {contextual.badge}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{contextual.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
          <span>قراءة الأذكار</span>
          <ChevronLeft size={16} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-2 border-t border-border/50">
        <span className="flex items-center gap-1">
          {stats.isDone ? (
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 size={14} /> تم إتمام الورد
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock size={13} /> {stats.completed} من {stats.total} ذكر
            </span>
          )}
        </span>

        <span className="font-mono font-bold text-foreground text-xs">{stats.percent}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-2">
        <div
          className={cn(
            'h-full transition-all duration-300 rounded-full',
            stats.isDone ? 'bg-emerald-500' : 'bg-primary'
          )}
          style={{ width: `${stats.percent}%` }}
        />
      </div>
    </div>
  );
}
