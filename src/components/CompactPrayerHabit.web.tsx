import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MoonStar,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Clock3,
  CheckCircle2,
  XCircle,
  Minus,
  MapPin,
  ListTodo,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { isPrayerStatusComplete } from '../lib/prayerStatus';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { usePrayerTracker } from '../hooks/usePrayerHabits';
import { useQadaaTracker, type QadaaPrayerKey } from '../hooks/useQadaaTracker';
import type { PrayerStatus } from '../types/schema';

const STATUS_BUTTONS: Record<PrayerStatus, { label: string; className: string }> = {
  Prayed: { label: 'Prayed', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  Late: { label: 'Late', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  Missed: { label: 'Skip', className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  Skipped: { label: 'Skip', className: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' },
};

type CompactPrayerHabitProps = {
  /** When true, render as a panel inside an outer card (no second card chrome). */
  embedded?: boolean;
};

export function CompactPrayerHabit({ embedded = false }: CompactPrayerHabitProps) {
  const { times, locationLabel } = usePrayerTimes();
  const today = new Date();
  const { isLoading: isTrackerLoading, tracker, statusOptions, togglePrayerStatus } = usePrayerTracker(today);
  const {
    todayLog,
    settings: qadaaSettings,
    remaining,
    incrementPrayer,
    batchFullDay,
    pushTasks,
    isPushingTasks,
  } = useQadaaTracker();

  const [isExpanded, setIsExpanded] = useState(true);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

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

  const prayedCount = tracker.filter((t) => isPrayerStatusComplete(t.status)).length;
  const totalCount = tracker.length;
  const percentage = totalCount > 0 ? Math.round((prayedCount / totalCount) * 100) : 0;

  // Qadaa metrics for today
  const todayQadaaTotal =
    (todayLog.fajr_count || 0) +
    (todayLog.dhuhr_count || 0) +
    (todayLog.asr_count || 0) +
    (todayLog.maghrib_count || 0) +
    (todayLog.isha_count || 0) +
    (qadaaSettings.include_witr ? todayLog.witr_count || 0 : 0);

  const dailyTarget = Math.max(1, qadaaSettings.daily_target_prayers);
  const qadaaPercentage = Math.min(100, Math.round((todayQadaaTotal / dailyTarget) * 100));

  const shell = embedded
    ? 'bg-transparent p-0 h-full flex flex-col min-h-0'
    : 'rounded-2xl border border-border/70 bg-card p-4 h-full flex flex-col shadow-sm';

  const handlePushTasks = async () => {
    try {
      const res = await pushTasks();
      if (res.created > 0) {
        setPushStatusMessage(`تم دفع ${res.created} مهام`);
      } else {
        setPushStatusMessage('مهام اليوم مضافة بالفعل');
      }
      setTimeout(() => setPushStatusMessage(null), 3000);
    } catch {
      setPushStatusMessage('خطأ في الإضافة');
      setTimeout(() => setPushStatusMessage(null), 3000);
    }
  };

  if (isTrackerLoading) {
    return (
      <div className={embedded ? 'bg-transparent p-0' : 'rounded-2xl border border-border/70 bg-card p-4 shadow-sm'}>
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      {/* Compact Header Summary */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer hover:bg-muted/40 rounded-xl p-2.5 -m-1 transition-colors select-none"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary shrink-0">
            <MoonStar size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">{embedded ? 'الصلوات اليومية' : 'Daily Prayers'}</div>
            {locationLabel ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{locationLabel}</span>
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground mt-0.5">
              {prayedCount}/{totalCount} صلوات مؤداة اليوم
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right">
              <div className="text-base font-bold tabular-nums text-foreground">{percentage}%</div>
              <div className="text-[11px] text-muted-foreground">الإنجاز</div>
            </div>
            {isExpanded ? (
              <ChevronUp size={18} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={18} className="text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Prayer Rows + Inline Qadaa */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50 flex-1 min-h-0 flex flex-col justify-between">
          <div className="space-y-1.5 flex-1">
            {tracker.map((item) => {
              const prayerTime = times.find((t) => t.name === item.prayerName)?.time;
              const Icon = getIcon(item.prayerName);
              const qadaaKey = item.prayerName.toLowerCase() as QadaaPrayerKey;
              const isValidQadaaKey = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(qadaaKey);
              const doneQadaaToday = isValidQadaaKey ? (todayLog as any)[`${qadaaKey}_count`] || 0 : 0;

              return (
                <div
                  key={item.prayerName}
                  className={cn(
                    'flex items-center justify-between gap-2 p-2 rounded-xl transition-colors border border-transparent',
                    'hover:bg-muted/30 flex-wrap sm:flex-nowrap'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/60 text-muted-foreground shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-xs md:text-sm text-foreground flex items-center gap-1.5">
                        <span>{item.prayerName}</span>
                        {item.status === 'Prayed' && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                        {item.status === 'Late' && <Clock3 size={13} className="text-amber-500 shrink-0" />}
                        {item.status === 'Missed' && <XCircle size={13} className="text-rose-500 shrink-0" />}
                        {item.status === 'Skipped' && <Minus size={13} className="text-slate-400 shrink-0" />}
                      </p>
                      <span className="text-[11px] text-muted-foreground tabular-nums block">
                        {prayerTime ? format(prayerTime, 'h:mm a') : '--:--'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 select-none shrink-0 flex-wrap sm:flex-nowrap justify-end">
                    {/* Fardh Status Buttons */}
                    <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/20 p-0.5 rounded-lg border border-border/40">
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
                              'text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-1 rounded-md transition-all cursor-pointer',
                              isActive
                                ? meta.className
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                            )}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Integrated 1-Tap Qadaa Counter */}
                    {isValidQadaaKey && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          incrementPrayer(qadaaKey, 1);
                        }}
                        title={`تسجيل قضاء ${item.prayerName} اليوم`}
                        className={cn(
                          'text-[11px] sm:text-xs font-semibold px-2 py-1 rounded-lg transition-all border flex items-center gap-1 shrink-0 cursor-pointer',
                          doneQadaaToday > 0
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-secondary/40 hover:bg-secondary border-border/60 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span className="text-[10px] sm:text-[11px]">قضاء</span>
                        {doneQadaaToday > 0 ? (
                          <span className="text-[10px] font-bold tabular-nums">+{doneQadaaToday}</span>
                        ) : (
                          <span className="text-[10px] opacity-60">+1</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Integrated Daily Qadaa Pace Footer */}
          <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2.5 text-xs flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-foreground text-xs">قضاء اليوم:</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {todayQadaaTotal} / {dailyTarget}
              </span>
              <div className="w-14 bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${qadaaPercentage}%` }}
                />
              </div>
              {remaining && remaining.completionPct > 0 && (
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tabular-nums">
                  {remaining.completionPct}% مكتمل
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => batchFullDay(1)}
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary/50 hover:bg-secondary text-foreground border border-border/60 transition cursor-pointer"
                title="تسجيل 1 صلاة قضاء لكل فريضة اليوم"
              >
                +1 يوم كامل
              </button>
              <button
                type="button"
                onClick={handlePushTasks}
                disabled={isPushingTasks}
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                title="دفع صلوات القضاء المتبقية كمهام لليوم في قائمة المهام"
              >
                {pushStatusMessage ? (
                  <>
                    <Check size={12} />
                    <span>{pushStatusMessage}</span>
                  </>
                ) : (
                  <>
                    <ListTodo size={12} />
                    <span>دفع للمهام</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
