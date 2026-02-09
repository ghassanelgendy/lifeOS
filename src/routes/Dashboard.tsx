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
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO } from 'date-fns';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { useHealthMetrics } from '../hooks/useHealthData';
import { useOverdueTasks } from '../hooks/useTasks';
import { useWeeklyAdherence, useHabits } from '../hooks/useHabits';
import { useCategoryBreakdown } from '../hooks/useFinance';
import { useUpcomingEvents } from '../hooks/useCalendar';
import { useProjects } from '../hooks/useProjects';
import { habitLogDB } from '../db/database';
import { useUIStore } from '../stores/useUIStore';
import { DASHBOARD_WIDGET_IDS } from '../stores/useUIStore';
import { PrayerWidget } from '../components/PrayerWidget';
import { useScreentimeMetrics, useTodayScreentime } from '../hooks/useScreentime';

export default function Dashboard() {
  const { metrics, hasData: hasHealthData } = useHealthMetrics();
  const { data: overdueTasks = [] } = useOverdueTasks();
  const { adherence } = useWeeklyAdherence();
  const { totalExpenses, balance } = useCategoryBreakdown();
  const upcomingEvents = useUpcomingEvents(7);
  const { data: projects = [] } = useProjects();
  const { data: allHabits = [] } = useHabits();
  const { privacyMode, dashboardWidgetOrder, dashboardWidgetVisible } = useUIStore();
  const { avg7Days: screentimeAvg, trend: screentimeTrend, history: screentimeHistory, avgSwitches7Days, todaySwitches } = useScreentimeMetrics(7);
  const todayScreentime = useTodayScreentime();

  const order = dashboardWidgetOrder?.length ? dashboardWidgetOrder : [...DASHBOARD_WIDGET_IDS];
  const isVisible = (id: string) => dashboardWidgetVisible?.[id] !== false;

  // Get today's habit completion
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayLogs = habitLogDB.getByDate(todayStr);
  const completedToday = todayLogs.filter(l => l.completed).length;

  // Active projects count
  const activeProjects = projects.filter(p => p.status === 'Active').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {format(today, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Widgets in user-defined order */}
      {order.filter(isVisible).map((widgetId) => {
        if (widgetId === 'prayer') return <PrayerWidget key="prayer" />;
        if (widgetId === 'stats')
          return (
            <div key="stats" className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Weight */}
        <Link to="/health" className="group">
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

        {/* Muscle Mass */}
        <Link to="/health" className="group">
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

        {/* Weekly Adherence */}
        <Link to="/habits" className="group">
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

        {/* Monthly Balance */}
        <Link to="/finance" className="group">
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

        {/* Screen Time */}
        <Link to="/screentime" className="group">
          <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-zinc-700 h-full">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Monitor size={14} className="text-muted-foreground" />
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Screen Time</h3>
                </div>
                <div className={cn("mt-2 text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                  {screentimeAvg > 0 ? `${Math.floor(screentimeAvg / 60)}h ${screentimeAvg % 60}m` : '-'}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-muted-foreground">7-day avg</p>
                  {todayScreentime.totalSwitches > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <RefreshCw size={10} />
                      <span className={cn(privacyMode && "blur-sm")}>{todayScreentime.totalSwitches.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
              {screentimeTrend !== 0 && (
                <div className={cn("text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1",
                  screentimeTrend < 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                )}>
                  {screentimeTrend < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {Math.abs(screentimeTrend)}%
                </div>
              )}
            </div>
            {screentimeHistory.length > 0 && (
              <div className="h-8 w-full mt-2 opacity-50">
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
      </div>
          );
        if (widgetId === 'overdue')
          return (
        <section key="overdue" className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-amber-500" size={18} />
              <h2 className="font-semibold">Overdue Tasks</h2>
            </div>
            <span className="text-xs text-muted-foreground">{overdueTasks.length} items</span>
          </div>
          <div className="p-4">
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
        if (widgetId === 'events')
          return (
        <section key="events" className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="text-blue-500" size={18} />
              <h2 className="font-semibold">Upcoming Events</h2>
            </div>
            <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="p-4">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="mx-auto mb-2 opacity-50" size={24} />
                <p className="text-sm">No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 5).map(event => (
                  <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div
                      className="w-2 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {isToday(parseISO(event.start_time))
                          ? `Today, ${format(parseISO(event.start_time), 'h:mm a')}`
                          : format(parseISO(event.start_time), 'EEE, MMM d · h:mm a')
                        }
                      </p>
                    </div>
                    {event.type === 'Shift' && (
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
        if (widgetId === 'quickstats')
          return (
      <div key="quickstats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      })}
    </div>
  );
}
