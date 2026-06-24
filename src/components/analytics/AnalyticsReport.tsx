import { useState } from 'react';
import { format } from 'date-fns';
import {
  Moon, Monitor, CheckSquare, Flame, Wallet, Trophy, TrendingDown, TrendingUp,
  ChevronLeft, ChevronRight, Sparkles, Lightbulb, ChevronDown, ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area,
  LineChart, Line, Cell,
} from 'recharts';
import { cn, formatCurrency } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { useWeeklyReport, useMonthlyReport, type ReportData } from '../../hooks/useReport';
import { AnimatedCounter } from './AnimatedCounter';

// ── Helpers ──────────────────────────────────────────────────────────

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
function fmtSec(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function DeltaBadge({ delta, invert }: { delta: number | null; invert?: boolean }) {
  if (delta == null) return null;
  const isPositive = invert ? delta <= 0 : delta >= 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md',
      isPositive ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'
    )}>
      {delta >= 0 ? '+' : ''}{Math.round(delta)}%
    </span>
  );
}

// ── Score Ring (SVG) ─────────────────────────────────────────────────

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="report-ring-fill" style={{ '--ring-circumference': circumference, '--ring-target': offset } as any}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={8} className="text-secondary" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedCounter value={score} className="text-4xl font-bold tabular-nums" />
        <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────

function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="report-section-in" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ── Expandable card ──────────────────────────────────────────────────

function ExpandableCard({ children, expandedContent, className, onClick, defaultExpanded = true }: {
  children: React.ReactNode;
  expandedContent?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div
      className={cn('rounded-xl border border-border bg-card overflow-hidden transition-all cursor-pointer', className)}
      onClick={() => {
        if (onClick) {
          onClick();
        } else if (expandedContent) {
          setExpanded(!expanded);
        }
      }}
    >
      <div className="p-4">{children}</div>
      {expanded && expandedContent && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0">
          <div className="pt-3">{expandedContent}</div>
        </div>
      )}
      {expandedContent && (
        <div className="flex justify-center pb-2">
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

interface AnalyticsReportProps {
  onDismiss: () => void;
  isWeeklyWrapDay: boolean;
  isMonthlyWrapDay: boolean;
  onOpenDayDetails?: (date: string, source?: string) => void;
}

export function AnalyticsReport({ onDismiss, isWeeklyWrapDay, isMonthlyWrapDay, onOpenDayDetails }: AnalyticsReportProps) {
  const { privacyMode } = useUIStore();
  const bothDays = isWeeklyWrapDay && isMonthlyWrapDay;
  const [mode, setMode] = useState<'weekly' | 'monthly'>(isMonthlyWrapDay && !isWeeklyWrapDay ? 'monthly' : 'weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const weeklyData = useWeeklyReport(weekOffset);
  const monthlyData = useMonthlyReport(monthOffset);
  const data: ReportData = mode === 'weekly' ? weeklyData : monthlyData;

  const offset = mode === 'weekly' ? weekOffset : monthOffset;
  const setOffset = mode === 'weekly' ? setWeekOffset : setMonthOffset;

  if (data.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        <p className="text-sm text-muted-foreground">Preparing your {mode} wrap…</p>
      </div>
    );
  }

  const sparkData = data.days.map((d, i) => ({
    i,
    day: format(new Date(`${d.date}T12:00:00`), 'EEE'),
    sleep: d.sleepMinutes ?? 0,
    screen: d.screenSeconds ? d.screenSeconds / 3600 : 0,
    tasks: d.tasksCompleted ?? 0,
    habits: d.habitsAdherencePct ?? 0,
  }));

  const scoreMessage =
    data.weekScore >= 90 ? 'Outstanding week! You\'re in the zone 🔥' :
    data.weekScore >= 75 ? 'Great week! Keep the momentum going 💪' :
    data.weekScore >= 60 ? 'Solid week with room to grow 📈' :
    data.weekScore >= 40 ? 'Decent effort — small tweaks make big differences 🌱' :
    'Tough week. Reset and come back stronger 💫';

  return (
    <div className="w-full max-w-4xl mx-auto pb-20 space-y-6 overflow-x-hidden">
      {/* ── Header ──────────────────────────────────────────────── */}
      <Section>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onDismiss}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                Regular analytics
              </button>
              {bothDays && (
                <div className="flex p-0.5 bg-secondary/50 rounded-lg">
                  {(['weekly', 'monthly'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium transition-all capitalize cursor-pointer',
                        mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="text-primary" size={20} />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {mode === 'weekly' ? 'Your Week in Review' : 'Your Month in Review'}
              </h1>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setOffset(offset + 1)} className="p-1 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                <ChevronLeft size={16} className="text-muted-foreground" />
              </button>
              <span className="text-sm text-muted-foreground font-medium">{data.periodLabel}</span>
              <button
                onClick={() => setOffset(Math.max(0, offset - 1))}
                disabled={offset === 0}
                className="p-1 rounded-lg hover:bg-secondary/50 transition-colors disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Section 1: Overview Metrics ─────────────────────────── */}
      <Section delay={100}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Sleep */}
          <ExpandableCard expandedContent={
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-foreground)' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  />
                  <Area type="monotone" dataKey="sleep" stroke="#818cf8" fill="#818cf8" fillOpacity={0.15} name="Sleep (min)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          }>
            <div className="flex items-center gap-2 mb-2">
              <Moon size={14} className="text-indigo-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Sleep</span>
            </div>
            <div className={cn('text-xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
              {data.avgSleepMinutes != null ? fmtMin(data.avgSleepMinutes) : '—'}
            </div>
            <div className="mt-1"><DeltaBadge delta={data.sleepDelta} /></div>
          </ExpandableCard>

          {/* Screen Time */}
          <ExpandableCard
            onClick={() => data.days.length > 0 && onOpenDayDetails?.(data.days[data.days.length - 1].date, 'Screen Time')}
            expandedContent={
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-foreground)' }}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                      labelStyle={{ color: 'var(--color-muted-foreground)' }}
                    />
                    <Area type="monotone" dataKey="screen" stroke="#f472b6" fill="#f472b6" fillOpacity={0.15} name="Screen (hours)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            }
          >
            <div className="flex items-center gap-2 mb-2">
              <Monitor size={14} className="text-pink-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Screen</span>
            </div>
            <div className={cn('text-xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
              {data.avgScreenSeconds != null ? fmtSec(data.avgScreenSeconds) : '—'}
            </div>
            <div className="mt-1"><DeltaBadge delta={data.screenDelta} invert /></div>
          </ExpandableCard>

          {/* Tasks */}
          <ExpandableCard expandedContent={
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sparkData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-foreground)' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  />
                  <Bar dataKey="tasks" fill="#34d399" radius={[4, 4, 0, 0]} name="Tasks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }>
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare size={14} className="text-emerald-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tasks Done</span>
            </div>
            <div className="text-xl font-bold tabular-nums">
              <AnimatedCounter value={data.totalTasksCompleted} />
            </div>
            <div className="mt-1"><DeltaBadge delta={data.tasksDelta} /></div>
          </ExpandableCard>

          {/* Habits */}
          <ExpandableCard expandedContent={
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-foreground)' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  />
                  <Line type="monotone" dataKey="habits" stroke="#fb923c" strokeWidth={2} dot={{ r: 3 }} name="Habits %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          }>
            <div className="flex items-center gap-2 mb-2">
              <Flame size={14} className="text-orange-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Habits</span>
            </div>
            <div className="text-xl font-bold tabular-nums">
              {data.avgHabitsAdherence != null ? <><AnimatedCounter value={data.avgHabitsAdherence} />%</> : '—'}
            </div>
            <div className="mt-1"><DeltaBadge delta={data.habitsDelta} /></div>
          </ExpandableCard>

          {/* Total Spending */}
          <ExpandableCard onClick={() => data.days.length > 0 && onOpenDayDetails?.(data.days[data.days.length - 1].date, 'Total Spending')}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={14} className="text-cyan-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Spending</span>
            </div>
            <div className={cn('text-xl font-bold tabular-nums text-red-400', privacyMode && 'blur-sm')}>
              <AnimatedCounter value={data.totalExpense} formatter={formatCurrency} prefix="-" />
            </div>
            <div className="mt-1"><DeltaBadge delta={data.financeDelta} /></div>
          </ExpandableCard>

          {/* Total Income */}
          <ExpandableCard onClick={() => data.days.length > 0 && onOpenDayDetails?.(data.days[data.days.length - 1].date, 'Total Income')}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Income</span>
            </div>
            <div className={cn('text-xl font-bold tabular-nums text-green-400', privacyMode && 'blur-sm')}>
              <AnimatedCounter value={data.totalIncome} formatter={formatCurrency} prefix="+" />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">Received this period</div>
          </ExpandableCard>
        </div>
      </Section>

      {/* ── Section 2: Best & Worst Day ─────────────────────────── */}
      {(data.bestDay || data.worstDay) && (
        <Section delay={200}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.bestDay && (
              <div
                onClick={() => onOpenDayDetails?.(data.bestDay!.date)}
                className="rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-card p-4 cursor-pointer hover:bg-green-500/10 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={16} className="text-green-500" />
                  <span className="text-xs text-green-500 uppercase tracking-wider font-semibold">Best Day</span>
                </div>
                <p className="text-lg font-bold">{format(new Date(`${data.bestDay.date}T12:00:00`), 'EEEE, MMM d')}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.bestDay.reasons.map((r, i) => (
                    <span key={i} className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-md">{r}</span>
                  ))}
                </div>
              </div>
            )}
            {data.worstDay && data.worstDay.date !== data.bestDay?.date && (
              <div
                onClick={() => onOpenDayDetails?.(data.worstDay!.date)}
                className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/5 to-card p-4 cursor-pointer hover:bg-red-500/10 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={16} className="text-red-400" />
                  <span className="text-xs text-red-400 uppercase tracking-wider font-semibold">Toughest Day</span>
                </div>
                <p className="text-lg font-bold">{format(new Date(`${data.worstDay.date}T12:00:00`), 'EEEE, MMM d')}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.worstDay.reasons.map((r, i) => (
                    <span key={i} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Section 3: Outlier Spotlight ────────────────────────── */}
      {data.outliers.length > 0 && (
        <Section delay={300}>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              Outlier Spotlight
            </h3>
            <div className="space-y-2">
              {data.outliers.map((o, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg p-3 border-l-4 bg-secondary/20',
                    Math.abs(o.z) > 2 ? 'border-red-500' : 'border-amber-500'
                  )}
                >
                  <p className="text-sm font-medium">{o.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Average: {o.metric === 'Screen time' ? fmtSec(o.average) : o.metric === 'Sleep' ? fmtMin(o.average) : o.metric === 'Daily Spending' ? formatCurrency(o.average) : Math.round(o.average).toString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── Section 4: Habits Deep Dive ────────────────────────── */}
      <Section delay={400}>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Flame size={14} className="text-orange-400" />
            Habits by Day of Week
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.habitsByDow}>
                <XAxis dataKey="dow" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-foreground)' }}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-muted-foreground)' }}
                  formatter={(v: number) => [`${v}%`, 'Adherence']}
                />
                <Bar dataKey="adherence" radius={[6, 6, 0, 0]}>
                  {data.habitsByDow.map((entry, i) => (
                    <Cell key={i} fill={entry.adherence >= 70 ? '#22c55e' : entry.adherence >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* ── Section 5: Digital Footprint ────────────────────────── */}
      {data.topApps.length > 0 && (
        <Section delay={500}>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Monitor size={14} className="text-pink-400" />
              Top Apps
            </h3>
            <div className="space-y-2">
              {data.topApps.slice(0, 5).map((app, i) => {
                const maxTime = data.topApps[0]?.total_time_seconds ?? 1;
                const pct = (app.total_time_seconds / maxTime) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-0.5">
                      <span className="font-medium truncate mr-2">{app.app_name}</span>
                      <span className={cn('text-xs text-muted-foreground tabular-nums whitespace-nowrap', privacyMode && 'blur-sm')}>
                        {fmtSec(app.total_time_seconds)}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Section 6: Top Expense Categories ──────────────────── */}
      {data.topCategories.length > 0 && (
        <Section delay={550}>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Wallet size={14} className="text-cyan-400" />
              Top Spending Categories
            </h3>
            <div className="space-y-2">
              {data.topCategories.slice(0, 5).map((cat, i) => {
                const maxAmt = data.topCategories[0]?.amount ?? 1;
                const pct = (cat.amount / maxAmt) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-0.5">
                      <span className="font-medium capitalize">{cat.category.replace(/_/g, ' ')}</span>
                      <span className={cn('text-xs text-muted-foreground tabular-nums', privacyMode && 'blur-sm')}>
                        {cat.amount.toFixed(0)}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Section 7: Game Plan ────────────────────────────────── */}
      {data.suggestions.length > 0 && (
        <Section delay={600}>
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Lightbulb size={14} className="text-primary" />
              Game Plan for Next {mode === 'weekly' ? 'Week' : 'Month'}
            </h3>
            <div className="space-y-2">
              {data.suggestions.map((s, i) => (
                <ExpandableCard
                  key={i}
                  defaultExpanded={false}
                  expandedContent={
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{s.icon}</span>
                    <p className="text-sm font-medium leading-snug">{s.title}</p>
                  </div>
                </ExpandableCard>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── Section 8: Week Score ───────────────────────────────── */}
      <Section delay={700}>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 text-center">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
            {mode === 'weekly' ? 'Week' : 'Month'} Score
          </h3>
          <div className="flex justify-center mb-4">
            <ScoreRing score={data.weekScore} />
          </div>
          {data.prevWeekScore > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              Previous: {data.prevWeekScore}/100
              <span className={cn('ml-1.5 font-semibold', data.weekScore >= data.prevWeekScore ? 'text-green-500' : 'text-red-400')}>
                ({data.weekScore >= data.prevWeekScore ? '+' : ''}{data.weekScore - data.prevWeekScore})
              </span>
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2">{scoreMessage}</p>
        </div>
      </Section>
    </div>
  );
}
