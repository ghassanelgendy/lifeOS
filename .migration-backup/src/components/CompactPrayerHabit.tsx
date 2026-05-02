import { useState } from 'react';
import { ChevronDown, ChevronUp, MoonStar, Sunrise, Sun, Sunset, Moon, Clock3, CheckCircle2, XCircle, Minus, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { usePrayerTracker } from '../hooks/usePrayerHabits';
import type { PrayerStatus } from '../types/schema';

const STATUS_BUTTONS: { status: PrayerStatus; label: string; className: string }[] = [
  { status: 'Prayed', label: 'Prayed', className: 'bg-green-500/15 text-green-500 border-green-500/30' },
  { status: 'Missed', label: 'Missed', className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  { status: 'Skipped', label: 'Skip', className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
];

type CompactPrayerHabitProps = {
  /** When true, render as a panel inside an outer card (no second card chrome). */
  embedded?: boolean;
};

export function CompactPrayerHabit({ embedded = false }: CompactPrayerHabitProps) {
  const { times, locationLabel } = usePrayerTimes();
  const today = new Date();
  const { isLoading, tracker, togglePrayerStatus } = usePrayerTracker(today);
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

  const prayedCount = tracker.filter(t => t.status === 'Prayed').length;
  const totalCount = tracker.length;
  const percentage = totalCount > 0 ? Math.round((prayedCount / totalCount) * 100) : 0;

  const shell = embedded
    ? 'rounded-lg border border-border/80 bg-secondary/15 p-3 md:p-4 h-full flex flex-col min-h-0'
    : 'rounded-xl border border-border bg-card p-4 h-full flex flex-col';

  if (isLoading) {
    return (
      <div className={embedded ? 'rounded-lg border border-border/80 bg-secondary/15 p-4' : 'rounded-xl border border-border bg-card p-4'}>
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground" />
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
        <div className="mt-4 pt-4 border-t border-border flex-1 min-h-0">
          <div className="grid grid-rows-5 gap-3 h-full">
            {tracker.map((item) => {
              const prayerTime = times.find((t) => t.name === item.prayerName)?.time;
              const Icon = getIcon(item.prayerName);
              return (
                <div key={item.prayerName} className="rounded-lg border border-border p-3 bg-secondary/20 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon size={16} className="text-primary" />
                      <p className="font-medium text-sm">{item.prayerName}</p>
                      {item.status === 'Prayed' && <CheckCircle2 size={14} className="text-green-500" />}
                      {item.status === 'Missed' && <XCircle size={14} className="text-red-500" />}
                      {item.status === 'Skipped' && <Minus size={14} className="text-blue-500" />}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {prayerTime ? format(prayerTime, 'h:mm a') : '--:--'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_BUTTONS.map((s) => (
                      <button
                        key={s.status}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePrayerStatus(item, s.status);
                        }}
                        className={cn(
                          "text-xs px-2 py-1.5 rounded border transition-colors",
                          item.status === s.status ? s.className : "border-border text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
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
