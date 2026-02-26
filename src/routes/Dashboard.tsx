import {
  CheckCircle,
  AlertCircle,
  Flame,
  TrendingUp,
  TrendingDown,
  Calendar,
  Banknote,
  Dumbbell,
  Target,
  ArrowRight,
  Monitor,
  RefreshCw,
  Moon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO, addDays } from 'date-fns';
import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { useHealthMetrics } from '../hooks/useHealthData';
import { useOverdueTasks, useUpcomingTasks } from '../hooks/useTasks';
import { useWeeklyAdherence, useHabits } from '../hooks/useHabits';
import { useCategoryBreakdown } from '../hooks/useFinance';
import { useUpcomingEvents } from '../hooks/useCalendar';
import { useProjects } from '../hooks/useProjects';
import { useUIStore } from '../stores/useUIStore';
import { DASHBOARD_WIDGET_IDS } from '../stores/useUIStore';
import { PrayerTimesWidget } from '../components/PrayerTimesWidget';
import { useScreentimeMetrics, useTodayScreentime } from '../hooks/useScreentime';
import { useSleepMetrics } from '../hooks/useSleep';

export default function Dashboard() {
  const { metrics, hasData: hasHealthData } = useHealthMetrics();
  const { data: overdueTasks = [] } = useOverdueTasks();
  const { adherence, todayLogs } = useWeeklyAdherence();
  const { totalExpenses, balance } = useCategoryBreakdown();
  const upcomingEvents = useUpcomingEvents(7);
  const { data: upcomingTasks = [] } = useUpcomingTasks(7);
  const { data: projects = [] } = useProjects();
  const { data: allHabits = [] } = useHabits();
  const { privacyMode, pageWidgetOrder, pageWidgetVisible } = useUIStore();
  const { avg7Days: screentimeAvg, trend: screentimeTrend, history: screentimeHistory } = useScreentimeMetrics(7);
  const todayScreentime = useTodayScreentime();
  const { avgSleepMinutes, nightsCount } = useSleepMetrics(7);

  const order = pageWidgetOrder?.dashboard?.length ? pageWidgetOrder.dashboard : [...DASHBOARD_WIDGET_IDS];
  const isVisible = (id: string) => pageWidgetVisible?.dashboard?.[id] !== false;

  // Get today's habit completion
  const today = new Date();
  const completedToday = todayLogs.filter(l => l.completed).length;

  // Active projects count
  const activeProjects = projects.filter(p => p.status === 'Active').length;
  const screenHours = Math.floor(screentimeAvg / 60);
  const screenMinutes = screentimeAvg % 60;
  const screentimeLabel = screentimeAvg > 0
    ? (screenHours >= 9 ? `~${screenHours}h` : `${screenHours}h ${screenMinutes}m`)
    : '-';

  type UpcomingItem = {
    id: string;
    title: string;
    start_time: string;
    color: string;
    kind: 'event' | 'task' | 'habit';
    type?: string;
  };

  const upcomingItems = useMemo<UpcomingItem[]>(() => {
    const now = new Date();
    const end = addDays(now, 7);
    const items = new Map<string, UpcomingItem>();

    for (const event of upcomingEvents) {
      const eventKey = `event:${event.id}`;
      const hasLinkedTask = upcomingTasks.some((task) =>
        task.calendar_event_id === event.id || task.calendar_source_key === eventKey
      );
      if (hasLinkedTask) continue;
      items.set(eventKey, {
        id: `event-${event.id}`,
        title: event.title,
        start_time: event.start_time,
        color: event.color ?? '#3b82f6',
        kind: 'event',
        type: event.type,
      });
    }

    for (const task of upcomingTasks) {
      if (!task.due_date) continue;
      const timePart = task.due_time && task.due_time.length >= 5 ? task.due_time.slice(0, 5) : '00:00';
      const parsed = new Date(`${task.due_date}T${timePart}`);
      if (parsed <= now) continue; // exclude past due tasks from upcoming
      const startTime = Number.isNaN(parsed.getTime()) ? `${task.due_date}T00:00:00` : parsed.toISOString();
      const dedupeKey = task.calendar_event_id
        ? `event:${task.calendar_event_id}`
        : (task.calendar_source_key || `task:${task.id}`);
      items.set(dedupeKey, {
        id: `task-${task.id}`,
        title: task.title,
        start_time: startTime,
        color: '#a855f7',
        kind: 'task',
      });
    }

    const rangeDays = Array.from({ length: 8 }, (_, i) => addDays(now, i));
    for (const habit of allHabits) {
      if (habit.show_in_tasks) continue;
      for (const day of rangeDays) {
        const matchesDay = habit.frequency === 'Weekly'
          ? ((habit.week_days ?? []).length ? (habit.week_days ?? []).includes(day.getDay()) : true)
          : true;
        if (!matchesDay) continue;
        const datePart = format(day, 'yyyy-MM-dd');
        const timePart = habit.time && habit.time.length >= 5 ? habit.time.slice(0, 5) : '09:00';
        const start = new Date(`${datePart}T${timePart}`);
        if (start < now || start > end) continue;
        const key = `habit:${habit.id}:${datePart}`;
        if (items.has(key)) continue;
        items.set(key, {
          id: key,
          title: habit.title,
          start_time: start.toISOString(),
          color: habit.color || '#22c55e',
          kind: 'habit',
        });
      }
    }

    return Array.from(items.values()).sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [upcomingEvents, upcomingTasks, allHabits]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {format(today, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Widgets in user-defined order — single visible widget spans full width */}
      {(() => {
        const visibleIds = order.filter(isVisible);
        const isAlone = visibleIds.length === 1;
        const prayerAndQuickstatsBothVisible = visibleIds.includes('prayer') && visibleIds.includes('quickstats');
        const firstOfPrayerQuickstats = visibleIds.find(id => id === 'prayer' || id === 'quickstats');
        const quickstatsColumn = (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Projects</p>
              <p className="text-2xl font-bold mt-1">{activeProjects}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Body Fat</p>
              <p className={cn(
                "text-2xl font-bold mt-1 tabular-nums",
                metrics.pbf.current < 18 ? "text-green-500" : metrics.pbf.current > 25 ? "text-red-500" : "text-amber-500",
                privacyMode && "blur-sm"
              )}>
                {hasHealthData ? `${metrics.pbf.current}%` : '-'}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">BMR</p>
              <p className={cn("text-2xl font-bold mt-1 tabular-nums", privacyMode && "blur-sm")}>
                {hasHealthData ? `${metrics.bmr.current}` : '-'}
              </p>
              <p className="text-xs text-muted-foreground">kcal/day</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p>
              <p className={cn("text-2xl font-bold mt-1 text-red-500 tabular-nums", privacyMode && "blur-sm")}>
                {formatCurrency(totalExpenses)}
              </p>
              <p className="text-xs text-muted-foreground">{format(today, 'MMMM')}</p>
            </div>
          </div>
        );
        const prayerQuickstatsRow = (
          <div key="prayer-quickstats" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <PrayerTimesWidget />
            {quickstatsColumn}
          </div>
        );
        return visibleIds.map((widgetId) => {
          if ((widgetId === 'prayer' || widgetId === 'quickstats') && prayerAndQuickstatsBothVisible && widgetId !== firstOfPrayerQuickstats)
            return null;
        if (widgetId === 'prayer') {
          if (prayerAndQuickstatsBothVisible) return prayerQuickstatsRow;
          return <PrayerTimesWidget key="prayer" />;
        }
        if (widgetId === 'quickstats') {
          if (prayerAndQuickstatsBothVisible) return prayerQuickstatsRow;
          return (
            <div
              key="quickstats"
              className={cn(
                'grid gap-4',
                isAlone ? 'grid-cols-1' : 'grid-cols-2'
              )}
            >
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Projects</p>
                <p className="text-2xl font-bold mt-1">{activeProjects}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Body Fat</p>
                <p className={cn(
                  "text-2xl font-bold mt-1 tabular-nums",
                  metrics.pbf.current < 18 ? "text-green-500" : metrics.pbf.current > 25 ? "text-red-500" : "text-amber-500",
                  privacyMode && "blur-sm"
                )}>
                  {hasHealthData ? `${metrics.pbf.current}%` : '-'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">BMR</p>
                <p className={cn("text-2xl font-bold mt-1 tabular-nums", privacyMode && "blur-sm")}>
                  {hasHealthData ? `${metrics.bmr.current}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">kcal/day</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p>
                <p className={cn("text-2xl font-bold mt-1 text-red-500 tabular-nums", privacyMode && "blur-sm")}>
                  {formatCurrency(totalExpenses)}
                </p>
                <p className="text-xs text-muted-foreground">{format(today, 'MMMM')}</p>
              </div>
            </div>
          );
        }
        if (widgetId === 'stats')
          return (
            <div
              key="stats"
              className={cn(
                'grid gap-4',
                isAlone ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-6'
              )}
            >
        {(() => {
          const cards = [
            {
              key: 'weight',
              node: (
                <Link to="/health" className="group min-w-0">
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700 h-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <Dumbbell size={14} className="text-muted-foreground" />
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Weight</h3>
                        </div>
                        <div className={cn("mt-2 text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                          {hasHealthData ? `${metrics.weight.current} kg` : '-'}
                        </div>
                      </div>
                      {metrics.weight.trend !== 0 && (
                        <div className={cn("text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1",
                          metrics.weight.trend < 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {metrics.weight.trend < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                          {Math.abs(metrics.weight.trend)}%
                        </div>
                      )}
                    </div>
                    {metrics.weight.history.length > 0 && (
                      <div className="h-8 w-full mt-2 opacity-50">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={metrics.weight.history.map((val, i) => ({ i, val }))}>
                            <Line
                              type="monotone"
                              dataKey="val"
                              stroke="currentColor"
                              strokeWidth={2}
                              dot={false}
                              className={metrics.weight.trend < 0 ? "text-green-500" : "text-red-500"}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </Link>
              ),
            },
            {
              key: 'muscle',
              node: (
                <Link to="/health" className="group min-w-0">
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700 h-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-muted-foreground" />
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Muscle</h3>
                        </div>
                        <div className={cn("mt-2 text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                          {hasHealthData ? `${metrics.smm.current} kg` : '-'}
                        </div>
                      </div>
                      {metrics.smm.trend !== 0 && (
                        <div className={cn("text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1",
                          metrics.smm.trend > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {metrics.smm.trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(metrics.smm.trend)}%
                        </div>
                      )}
                    </div>
                    {metrics.smm.history.length > 0 && (
                      <div className="h-8 w-full mt-2 opacity-50">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={metrics.smm.history.map((val, i) => ({ i, val }))}>
                            <Line
                              type="monotone"
                              dataKey="val"
                              stroke="currentColor"
                              strokeWidth={2}
                              dot={false}
                              className={metrics.smm.trend > 0 ? "text-green-500" : "text-red-500"}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </Link>
              ),
            },
            {
              key: 'habits',
              node: (
                <Link to="/habits" className="group min-w-0">
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700 h-full">
                    <div>
                      <div className="flex items-center gap-2">
                        <Target size={14} className="text-muted-foreground" />
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Habits</h3>
                      </div>
                      <div className="mt-2 text-2xl font-bold tabular-nums">{adherence}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {completedToday}/{allHabits.length} today
                      </p>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full mt-3 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500",
                          adherence >= 80 ? "bg-green-500" : adherence >= 60 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${adherence}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ),
            },
            {
              key: 'balance',
              node: (
                <Link to="/finance" className="group min-w-0">
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700 h-full">
                    <div>
                      <div className="flex items-center gap-2">
                        <Banknote size={14} className="text-muted-foreground" />
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Balance</h3>
                      </div>
                      <div className={cn(
                        "mt-2 text-2xl font-bold tabular-nums",
                        balance >= 0 ? "text-green-500" : "text-red-500",
                        privacyMode && "blur-sm"
                      )}>
                        {formatCurrency(Math.abs(balance))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(today, 'MMMM')}
                      </p>
                    </div>
                  </div>
                </Link>
              ),
            },
            {
              key: 'sleep',
              node: (
                <Link to="/sleep" className="group min-w-0">
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700 h-full">
                    <div>
                      <div className="flex items-center gap-2">
                        <Moon size={14} className="text-muted-foreground" />
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sleep</h3>
                      </div>
                      <div className={cn("mt-2 text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                        {nightsCount > 0
                          ? `${Math.floor(avgSleepMinutes / 60)}h ${avgSleepMinutes % 60}m`
                          : '-'}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {nightsCount > 0 ? `7-night avg` : 'No data yet'}
                      </p>
                    </div>
                  </div>
                </Link>
              ),
            },
            {
              key: 'screentime',
              node: (
                <Link to="/screentime" className="group min-w-0">
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700 h-full min-h-0">
                    <div className="flex justify-between items-start gap-2 min-h-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Monitor size={14} className="text-muted-foreground flex-shrink-0" />
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Screen Time</h3>
                        </div>
                        <div className={cn("mt-2 text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                          {screentimeLabel}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>7-day avg</span>
                          {todayScreentime.totalSwitches > 0 && (
                            <span className="flex items-center gap-1">
                              <RefreshCw size={10} />
                              <span className={cn(privacyMode && "blur-sm")}>{todayScreentime.totalSwitches.toLocaleString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {screentimeTrend !== 0 && (
                        <div className={cn("text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0",
                          screentimeTrend < 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {screentimeTrend < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                          {Math.abs(screentimeTrend)}%
                        </div>
                      )}
                    </div>
                    {screentimeHistory.length > 0 && (
                      <div className="h-8 w-full mt-2 opacity-50 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={screentimeHistory.map((d, i) => ({ i, val: d.minutes }))}>
                            <Line
                              type="monotone"
                              dataKey="val"
                              stroke="currentColor"
                              strokeWidth={2}
                              dot={false}
                              className={screentimeTrend < 0 ? "text-green-500" : "text-red-500"}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </Link>
              ),
            },
          ];

          const total = cards.length;
          const remainder = total % 3;

          return cards.map((card, index) => {
            const isLast = index === total - 1;
            const isLastTwo = index >= total - 2;
            const spanClass = remainder === 1 && isLast
              ? 'lg:col-span-6'
              : remainder === 2 && isLastTwo
                ? 'lg:col-span-3'
                : 'lg:col-span-2';

            return (
              <div key={card.key} className={spanClass}>
                {card.node}
              </div>
            );
          });
        })()}
      </div>
          );
if (widgetId === 'overdue' || widgetId === 'events') {
          const bothVisible = visibleIds.includes('overdue') && visibleIds.includes('events');
          const firstOfPair = visibleIds.find(id => id === 'overdue' || id === 'events');
          if (bothVisible && widgetId !== firstOfPair) return null;

          const overdueSection = (
            <section className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-amber-500" size={18} />
                  <h2 className="font-semibold">Overdue Tasks</h2>
                </div>
                <span className="text-xs text-muted-foreground">{overdueTasks.length} items</span>
              </div>
              <div className="p-4 flex-1">
                {overdueTasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="mx-auto mb-2 opacity-50" size={24} />
                    <p className="text-sm">No overdue tasks. Great job!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {overdueTasks.slice(0, 5).map(task => (
                      <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <span className="font-medium text-sm truncate">{task.title}</span>
                        <span className="text-xs text-red-400 font-mono flex-shrink-0 ml-2">
                          {format(new Date(task.due_date!), 'MMM d')}
                        </span>
                      </div>
                    ))}
                    {overdueTasks.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{overdueTasks.length - 5} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
          const eventsSection = (
            <section className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="text-blue-500" size={18} />
                  <h2 className="font-semibold">Upcoming Events</h2>
                </div>
                <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <div className="p-4 flex-1">
                {upcomingItems.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="mx-auto mb-2 opacity-50" size={24} />
                    <p className="text-sm">No upcoming events</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <div
                          className="w-2 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {isToday(parseISO(item.start_time))
                              ? `Today, ${format(parseISO(item.start_time), 'h:mm a')}`
                              : format(parseISO(item.start_time), 'EEE, MMM d · h:mm a')
                            }
                          </p>
                        </div>
                        {item.kind === 'task' && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                            Task
                          </span>
                        )}
                        {item.kind === 'habit' && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            Habit
                          </span>
                        )}
                        {item.kind === 'event' && item.type === 'Shift' && (
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                            Shift
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );

          if (bothVisible)
            return (
              <div key="overdue-events" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {overdueSection}
                {eventsSection}
              </div>
            );
          if (widgetId === 'overdue') return <div key="overdue">{overdueSection}</div>;
          return <div key="events">{eventsSection}</div>;
        }
        if (widgetId === 'habits')
          return (
      <section key="habits" className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="text-amber-500" size={18} />
            <h2 className="font-semibold">Today's Habits</h2>
          </div>
          <Link to="/habits" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="p-4">
          {allHabits.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Flame className="mx-auto mb-2 opacity-50" size={24} />
              <p className="text-sm">No habits set up yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allHabits.map(habit => {
                const isCompleted = todayLogs.some(l => l.habit_id === habit.id && l.completed);
                return (
                  <Link
                    key={habit.id}
                    to="/habits"
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                      isCompleted
                        ? "bg-green-500/20 text-green-400"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: habit.color }}
                    />
                    <span className="text-sm font-medium">{habit.title}</span>
                    {isCompleted && <CheckCircle size={14} />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
          );
        return null;
      });
      })()}
    </div>
  );
}
