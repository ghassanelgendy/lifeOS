import { Bell, BellOff, CheckCircle2, Clock3, Loader2, MapPin, Moon, MoonStar, Sunrise, Sun, Sunset, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { usePrayerTracker } from '../hooks/usePrayerHabits';
import type { PrayerStatus } from '../types/schema';
import { useState } from 'react';

const STATUS_BUTTONS: { status: PrayerStatus; label: string; className: string }[] = [
  { status: 'Prayed', label: 'Prayed', className: 'bg-green-500/15 text-green-500 border-green-500/30' },
  { status: 'Missed', label: 'Missed', className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  { status: 'Skipped', label: 'Skip', className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
];

export function PrayerWidget() {
  const { times, locationLabel, nextPrayer, timeToNext } = usePrayerTimes();
  const { isLoading, tracker, completionRate, weeklyCompletion, settings, togglePrayerStatus, setPrayerNotifications } = usePrayerTracker();
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);

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

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-lg">Prayer Tracker</h3>
          {locationLabel ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </div>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-xl font-bold tabular-nums">{completionRate}%</p>
          {nextPrayer && (
            <p className="text-xs text-primary">
              Next {nextPrayer} in {timeToNext}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[120px] flex items-center justify-center text-muted-foreground">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : (
        <div className="space-y-3">
          {tracker.map((item) => {
            const prayerTime = times.find((t) => t.name === item.prayerName)?.time;
            const Icon = getIcon(item.prayerName);
            const currentSetting = settings.find((x) => x.prayer_habit_id === item.prayerHabitId);
            const enabled = currentSetting?.enabled ?? false;
            const timezone = currentSetting?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const offset = Number(currentSetting?.offset_minutes ?? 0);
            const quietStart = currentSetting?.quiet_hours_start?.slice(0, 5) ?? '';
            const quietEnd = currentSetting?.quiet_hours_end?.slice(0, 5) ?? '';
            const isExpanded = expandedNotificationId === item.prayerHabitId;
            return (
              <div key={item.prayerName} className="rounded-lg border border-border p-3 bg-secondary/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={16} className="text-primary" />
                    <p className="font-medium text-sm">{item.prayerName}</p>
                    {item.status === 'Prayed' && <CheckCircle2 size={14} className="text-green-500" />}
                    {item.status === 'Missed' && <XCircle size={14} className="text-red-500" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {prayerTime ? format(prayerTime, 'h:mm a') : '--:--'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrayerNotifications(item.prayerHabitId, !enabled, {
                        offsetMinutes: offset,
                        timezone,
                        quietHoursStart: quietStart || null,
                        quietHoursEnd: quietEnd || null,
                      })}
                      className={cn(
                        "p-1 rounded border transition-colors",
                        enabled ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-secondary"
                      )}
                      title={enabled ? 'Disable prayer notification' : 'Enable prayer notification'}
                    >
                      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedNotificationId(isExpanded ? null : item.prayerHabitId)}
                      className="text-[11px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary"
                    >
                      Alerts
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mb-2 rounded border border-border p-2 bg-background/60 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground">
                        Offset (min)
                        <input
                          type="number"
                          value={offset}
                          onChange={(e) => setPrayerNotifications(item.prayerHabitId, enabled, {
                            offsetMinutes: Number(e.target.value || 0),
                            timezone,
                            quietHoursStart: quietStart || null,
                            quietHoursEnd: quietEnd || null,
                          })}
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Timezone
                        <input
                          type="text"
                          value={timezone}
                          onChange={(e) => setPrayerNotifications(item.prayerHabitId, enabled, {
                            offsetMinutes: offset,
                            timezone: e.target.value || 'UTC',
                            quietHoursStart: quietStart || null,
                            quietHoursEnd: quietEnd || null,
                          })}
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground">
                        Quiet from
                        <input
                          type="time"
                          value={quietStart}
                          onChange={(e) => setPrayerNotifications(item.prayerHabitId, enabled, {
                            offsetMinutes: offset,
                            timezone,
                            quietHoursStart: e.target.value || null,
                            quietHoursEnd: quietEnd || null,
                          })}
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Quiet to
                        <input
                          type="time"
                          value={quietEnd}
                          onChange={(e) => setPrayerNotifications(item.prayerHabitId, enabled, {
                            offsetMinutes: offset,
                            timezone,
                            quietHoursStart: quietStart || null,
                            quietHoursEnd: e.target.value || null,
                          })}
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_BUTTONS.map((s) => (
                    <button
                      key={s.status}
                      type="button"
                      onClick={() => togglePrayerStatus(item, s.status)}
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
      )}

      <div className="rounded-lg border border-border p-3 bg-secondary/20">
        <p className="text-xs text-muted-foreground mb-2">Weekly completion</p>
        <div className="grid grid-cols-7 gap-1">
          {weeklyCompletion.slice(-7).map((d) => (
            <div key={d.date} className="text-center">
              <div className="h-10 rounded bg-secondary overflow-hidden flex items-end">
                <div
                  className="w-full bg-primary transition-all"
                  style={{ height: `${Math.max(8, d.percent)}%` }}
                  title={`${d.percent}%`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
