import { useState } from 'react';
import { ChevronDown, ChevronUp, MoonStar, Sunrise, Sun, Sunset, Moon, Clock3, CheckCircle2, XCircle, Minus, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { isPrayerStatusComplete } from '../lib/prayerStatus';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { usePrayerTracker } from '../hooks/usePrayerHabits';
import type { PrayerStatus } from '../types/schema';

const STATUS_BUTTONS: Record<PrayerStatus, { label: string; className: string }> = {
  Prayed: { label: 'Prayed', className: 'bg-green-500/15 text-green-500 border-green-500/30' },
  Late: { label: 'Late', className: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  Missed: { label: 'Skip', className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  Skipped: { label: 'Skip', className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
};

type CompactPrayerHabitProps = {
  /** When true, render as a panel inside an outer card (no second card chrome). */
  embedded?: boolean;
};

export function CompactPrayerHabit({ embedded = false }: CompactPrayerHabitProps) {
  const { times, locationLabel } = usePrayerTimes();
  const today = new Date();
  const { isLoading, tracker, statusOptions, togglePrayerStatus } = usePrayerTracker(today);
  const [isExpanded, setIsExpanded] = useState(true);

  const getIcon = (name: string) => {
    switch (name) {
      case 'Fajr': return MoonStar;
      case 'Sunrise': return Sunrise;
      case 'Dhuhr': return Sun;
      case 'Asr': return Sun;
      case 'Maghrib': return Sunset;
      case 'Isha': return Moon;
      default: return Clock3;
    }
  };

  const prayedCount = tracker.filter(t => isPrayerStatusComplete(t.status)).length;
  const totalCount = tracker.length;
  const percentage = totalCount > 0 ? Math.round((prayedCount / totalCount) * 100) : 0;

  const shell = embedded
    ? 'rounded-lg border border-border/80 bg-secondary/15 p-3 md:p-4 h-full flex flex-col min-h-0'
    : 'rounded-xl border border-border/40 bg-card/50 backdrop-blur-lg p-4 h-full flex flex-col shadow-sm';

  if (isLoading) {
    return (
      <div className={embedded ? 'rounded-lg border border-border/80 bg-secondary/15 p-4' : 'rounded-xl border border-border/40 bg-card/50 backdrop-blur-lg p-4 shadow-sm'}>
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      {/* Compact View */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer hover:bg-secondary/20 rounded-lg p-3 -m-3 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
            <MoonStar size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{embedded ? 'Today' : 'Prayers'}</div>
            {locationLabel ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">{locationLabel}</span>
              </div>
            ) : null}
            <div className="text-sm text-muted-foreground">
              {prayedCount}/{totalCount} completed today
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-lg font-bold">{percentage}%</div>
              <div className="text-xs text-muted-foreground">completion</div>
            </div>
            {isExpanded ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/40 flex-1 min-h-0">
          <div className="flex flex-col gap-1">
            {tracker.map((item) => {
              const prayerTime = times.find((t) => t.name === item.prayerName)?.time;
              const Icon = getIcon(item.prayerName);
              return (
                <div 
                  key={item.prayerName} 
                  className={cn(
                    "flex items-center justify-between gap-4 p-2 rounded-lg transition-colors border border-transparent",
                    "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center bg-secondary/50 text-muted-foreground shrink-0">
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        {item.prayerName}
                        {item.status === 'Prayed' && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                        {item.status === 'Late' && <Clock3 size={12} className="text-amber-500 shrink-0" />}
                        {item.status === 'Missed' && <XCircle size={12} className="text-red-500 shrink-0" />}
                        {item.status === 'Skipped' && <Minus size={12} className="text-blue-500 shrink-0" />}
                      </p>
                      <span className="text-[10px] text-muted-foreground tabular-nums block mt-0.5">
                        {prayerTime ? format(prayerTime, 'h:mm a') : '--:--'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 select-none">
                    {statusOptions.map((status) => {
                      const meta = STATUS_BUTTONS[status];
                      const isActive = item.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePrayerStatus(item, status);
                          }}
                          className={cn(
                            "text-[10px] font-semibold px-2 py-1 rounded transition-all duration-150 border cursor-pointer",
                            isActive 
                              ? meta.className 
                              : "border-transparent bg-transparent text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                          )}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
