import { useMemo, useState, useEffect, useRef } from 'react';
import { endOfYear, format, min, startOfYear } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen } from 'lucide-react';
import { useAnalyticsDailyRange } from '../../hooks/useAnalytics';
import { useUIStore } from '../../stores/useUIStore';
import { cn } from '../../lib/utils';
import { StrategicAnnualGoalsSection } from './StrategicAnnualGoalsSection';

function aggregateScreentimeSecondsByDate(
  rows: { date: string; app_time_seconds: number | null; web_time_seconds: number | null }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const app = r.app_time_seconds ?? 0;
    const web = r.web_time_seconds ?? 0;
    m.set(r.date, (m.get(r.date) ?? 0) + app + web);
  }
  return m;
}

export function DashboardAnnualReview() {
  const calendarYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(calendarYear);
  const annualReviewNotesByYear = useUIStore((s) => s.annualReviewNotesByYear);
  const setAnnualReviewNotesForYear = useUIStore((s) => s.setAnnualReviewNotesForYear);

  const yKey = String(selectedYear);
  const storedNote = annualReviewNotesByYear[yKey] ?? '';
  const [draft, setDraft] = useState(storedNote);
  const lastFlushed = useRef(storedNote);

  useEffect(() => {
    const n = annualReviewNotesByYear[yKey] ?? '';
    setDraft(n);
    lastFlushed.current = n;
  }, [selectedYear, annualReviewNotesByYear, yKey]);

  useEffect(() => {
    if (draft === lastFlushed.current) return;
    const t = setTimeout(() => {
      setAnnualReviewNotesForYear(yKey, draft);
      lastFlushed.current = draft;
    }, 900);
    return () => clearTimeout(t);
  }, [draft, yKey, setAnnualReviewNotesForYear]);

  const rangeStart = format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd');
  const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
  const today = new Date();
  const rangeEnd = format(
    selectedYear === calendarYear ? min([today, yearEnd]) : yearEnd,
    'yyyy-MM-dd',
  );

  const { habits, sleep, screentime, tasks } = useAnalyticsDailyRange(rangeStart, rangeEnd);

  const monthlyHabits = useMemo(() => {
    const rows = habits.data ?? [];
    const buckets = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const month = r.date.slice(0, 7);
      const v = r.adherence_pct ?? 0;
      const b = buckets.get(month) ?? { sum: 0, n: 0 };
      b.sum += v;
      b.n += 1;
      buckets.set(month, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { sum, n }]) => ({
        label: month.slice(5),
        adherence: n ? Math.round(sum / n) : 0,
      }));
  }, [habits.data]);

  const ytdTotals = useMemo(() => {
    const habitRows = habits.data ?? [];
    const sleepRows = sleep.data ?? [];
    const taskRows = tasks.data ?? [];
    const stRows = screentime.data ?? [];

    const avgHabit =
      habitRows.length > 0
        ? Math.round(
            habitRows.reduce((s, r) => s + (r.adherence_pct ?? 0), 0) / habitRows.length,
          )
        : null;

    const sleepNights = sleepRows.filter((r) => (r.total_minutes ?? 0) > 0);
    const avgSleep =
      sleepNights.length > 0
        ? Math.round(sleepNights.reduce((s, r) => s + (r.total_minutes ?? 0), 0) / sleepNights.length)
        : null;

    const tasksDone = taskRows.reduce((s, r) => s + (r.completed_count ?? 0), 0);

    const byDate = aggregateScreentimeSecondsByDate(stRows);
    let screenSeconds = 0;
    for (const v of byDate.values()) screenSeconds += v;
    const screenHours = Math.round(screenSeconds / 3600);

    return { avgHabit, avgSleep, tasksDone, screenHours, daysHabit: habitRows.length };
  }, [habits.data, sleep.data, tasks.data, screentime.data]);

  const yearOptions = [calendarYear, calendarYear - 1, calendarYear - 2];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <p className="text-xs text-muted-foreground sm:max-w-md">
          Annual review — year in data, strategic goals, and reflection.
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="annual-year" className="text-sm text-muted-foreground">
            Year
          </label>
          <select
            id="annual-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <StrategicAnnualGoalsSection year={selectedYear} />

      <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg habit %</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {ytdTotals.avgHabit != null ? `${ytdTotals.avgHabit}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{ytdTotals.daysHabit} days logged</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg sleep</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {ytdTotals.avgSleep != null ? `${Math.floor(ytdTotals.avgSleep / 60)}h ${ytdTotals.avgSleep % 60}m` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Tasks done</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{ytdTotals.tasksDone}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Screen (approx h)</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{ytdTotals.screenHours || '—'}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-4">Monthly habit adherence (avg)</h2>
        {monthlyHabits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No habit data for this year.</p>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHabits} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} width={36} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="adherence" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="text-violet-500" size={18} />
          <h2 className="font-semibold">Reflection</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Private notes for {selectedYear}. Synced with your account when signed in.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          className={cn(
            'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          placeholder="What went well? What will you change next year?"
          aria-label={`Reflection notes for ${selectedYear}`}
        />
      </section>
    </div>
  );
}
