import { Clock3, Loader2, MapPin, Moon, MoonStar, Sunrise, Sun, Sunset } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { usePrayerTimes } from '../hooks/usePrayerTimes';

export function PrayerTimesWidget() {
  const { times, location, locationLabel, nextPrayer, timeToNext } = usePrayerTimes();

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

  if (!location || times.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center text-muted-foreground text-sm min-h-[150px] gap-2">
        <Loader2 className="animate-spin" size={24} />
        <span>Loading prayer times...</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">Prayer Times</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 min-w-0">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </div>
        </div>
        {nextPrayer && (
          <div className="text-right ml-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next: {nextPrayer}</div>
            <div className="text-xl font-bold font-mono text-primary">{timeToNext}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {times.map((prayer) => {
          const Icon = getIcon(prayer.name);
          return (
            <div
              key={prayer.name}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-300",
                prayer.isNext
                  ? "bg-primary/10 border-primary shadow-sm scale-105"
                  : "bg-secondary/30 border-transparent hover:bg-secondary/50"
              )}
            >
              <Icon size={18} className={cn("mb-1", prayer.isNext ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-xs font-medium", prayer.isNext ? "text-foreground" : "text-muted-foreground")}>
                {prayer.name}
              </span>
              <span className={cn("text-sm font-bold mt-0.5", prayer.isNext ? "text-primary" : "text-foreground")}>
                {format(prayer.time, 'h:mm a')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
