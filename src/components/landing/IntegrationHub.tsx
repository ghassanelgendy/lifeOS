/**
 * "Everything in one place": lifeOS in the middle, the things that feed it
 * around it, with dashes travelling inward along each line. Hover, focus or
 * tap a source to read what it does. The twelve modules sit underneath and
 * share the same detail panel.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, BarChart3, Bot, Calendar, CalendarSync, CheckSquare, Clock, Coins, Dumbbell, FileText, Flame,
  Focus as FocusIcon, Layout, MessageSquareText, Monitor, Moon, Pause, Play, Puzzle, Smartphone, Wallet, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LogoMark } from './Logo';

type Item = { icon: typeof Bot; title: string; description: string; kind: 'source' | 'module' };

const SOURCES: Item[] = [
  { icon: MessageSquareText, title: 'Bank SMS', description: 'Forward your bank messages and each one is parsed into a categorised transaction, usually before you open the app.', kind: 'source' },
  { icon: CalendarSync, title: 'Calendar feeds', description: 'Subscribe to work, school or family iCal calendars, and publish your own tasks as a feed other calendars can follow.', kind: 'source' },
  { icon: Zap, title: 'iOS Shortcuts', description: 'Log a cash expense from a Shortcut or a Back Tap without opening lifeOS.', kind: 'source' },
  { icon: Puzzle, title: 'Browser extension', description: 'Tracks time per website, clips pages into your notes, and lets you tick tasks and habits from the toolbar. Chrome, Brave, Edge and Firefox.', kind: 'source' },
  { icon: Smartphone, title: 'Screen time', description: 'App and website usage from iOS, Windows and Linux, broken down by device.', kind: 'source' },
  { icon: Moon, title: 'Sleep data', description: 'Import sleep sessions with their stages, or log a night by hand.', kind: 'source' },
  { icon: Activity, title: 'InBody scans', description: 'Body composition results synced into Health: weight, muscle, body fat and more, with trends.', kind: 'source' },
  { icon: Clock, title: 'Prayer times', description: 'Calculated for your location, with a reminder before each prayer and quiet hours at night.', kind: 'source' },
  { icon: Bot, title: 'AI providers', description: 'Bring your own keys. The assistant routes across providers and falls back when one is down.', kind: 'source' },
];

const MODULES: Item[] = [
  { icon: CheckSquare, title: 'Tasks', description: 'Smart task management with priorities, due dates, subtasks, and recurrence.', kind: 'module' },
  { icon: FocusIcon, title: 'Focus', description: 'Pomodoro timer to protect deep work time and track productive sessions.', kind: 'module' },
  { icon: Flame, title: 'Habits', description: 'Build streaks, track daily habits, and watch consistency compound.', kind: 'module' },
  { icon: Calendar, title: 'Calendar', description: 'Week and month view with events, tasks, and upcoming deadlines at a glance.', kind: 'module' },
  { icon: Layout, title: 'Planner', description: 'Plan your week on a structured time-block grid to stay on top of everything.', kind: 'module' },
  { icon: FileText, title: 'Notes', description: 'Capture ideas, meeting notes, and thoughts in rich Markdown notes.', kind: 'module' },
  { icon: Wallet, title: 'Finance', description: 'Track income, expenses, and budgets so your money goes where you want.', kind: 'module' },
  { icon: Moon, title: 'Sleep', description: 'Log sleep sessions and review quality trends to protect your recovery.', kind: 'module' },
  { icon: Dumbbell, title: 'Bio-Metrics', description: 'Log workouts, body composition, and physical activity all in one place.', kind: 'module' },
  { icon: Coins, title: 'Points & Rewards', description: 'Gamify your execution by earning coins for completed tasks and habits.', kind: 'module' },
  { icon: Monitor, title: 'Screen Time', description: 'Monitor daily screen usage and set healthy limits to reclaim focus.', kind: 'module' },
  { icon: BarChart3, title: 'Analytics', description: "Bird's-eye view of your productivity, habits, and growth over time.", kind: 'module' },
];

// Sources sit on an ellipse around the centre. Coordinates are percentages of the stage.
const CX = 50;
const CY = 50;
const POS = SOURCES.map((_, i) => {
  const a = (-90 + (360 / SOURCES.length) * i) * (Math.PI / 180);
  return { x: CX + Math.cos(a) * 40, y: CY + Math.sin(a) * 39 };
});

export function IntegrationHub() {
  const [active, setActive] = useState<Item>(SOURCES[0]);
  const [paused, setPaused] = useState(false);
  const Icon = active.icon;

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-10">
      {/* stage */}
      <div className={cn('relative mx-auto aspect-[10/9] w-full max-w-[640px] sm:aspect-[4/3]', paused && 'lp-paused')}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          {POS.map((p, i) => {
            const on = active === SOURCES[i];
            return (
              <g key={i}>
                <line x1={p.x} y1={p.y} x2={CX} y2={CY} stroke="var(--lp-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <line
                  x1={p.x} y1={p.y} x2={CX} y2={CY}
                  className="lp-flow"
                  stroke={on ? 'var(--lp-accent)' : 'var(--lp-ink-3)'}
                  strokeWidth={on ? 2 : 1.25}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ animationDelay: `${-i * 0.23}s` }}
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute left-1/2 top-1/2 flex size-[88px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-[22px] border border-[var(--lp-line)] bg-[var(--lp-bg)] sm:size-[112px]">
          <LogoMark size={40} className="text-[var(--lp-ink)]" />
          <span className="text-[13px] font-bold tracking-tight text-[var(--lp-ink)]">lifeOS</span>
        </div>

        {SOURCES.map((s, i) => {
          const SIcon = s.icon;
          const on = active === s;
          return (
            <button
              key={s.title}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(s)}
              onMouseEnter={() => setActive(s)}
              onFocus={() => setActive(s)}
              style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}
              className={cn(
                'lp-btn absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border bg-[var(--lp-raised)] p-2.5 text-[13px] font-semibold sm:px-3.5 sm:py-2',
                on ? 'border-[var(--lp-accent)] text-[var(--lp-ink)]' : 'border-[var(--lp-line)] text-[var(--lp-ink-2)]',
              )}
            >
              <SIcon size={16} className={on ? 'text-[var(--lp-accent)]' : 'text-[var(--lp-ink-3)]'} />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">{s.title}</span>
            </button>
          );
        })}

        {/* the lines keep moving, so they get a pause control */}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Play the line animation' : 'Pause the line animation'}
          className="lp-btn absolute bottom-0 right-0 flex size-11 items-center justify-center rounded-full motion-reduce:hidden"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--lp-sunken)] text-[var(--lp-ink-2)]">
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </span>
        </button>
      </div>

      {/* detail */}
      <div className="flex flex-col justify-center" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="min-h-[190px]"
          >
            <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--lp-ink-3)]">
              {active.kind === 'source' ? 'Feeds lifeOS' : 'Module'}
            </span>
            <h3 className="mt-2 flex items-center gap-3 text-[28px] font-bold leading-tight tracking-tight text-[var(--lp-ink)]">
              <Icon size={24} className="shrink-0 text-[var(--lp-accent)]" />
              {active.title}
            </h3>
            <p className="mt-3 max-w-[44ch] text-[16px] leading-relaxed text-[var(--lp-ink-2)]">{active.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* modules */}
      <div className="lg:col-span-2">
        <p className="text-[14px] text-[var(--lp-ink-3)]">All of it lands in 12 modules that share one database.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {MODULES.map((m) => {
            const MIcon = m.icon;
            const on = active === m;
            return (
              <li key={m.title}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActive(m)}
                  onMouseEnter={() => setActive(m)}
                  onFocus={() => setActive(m)}
                  className={cn(
                    'lp-btn inline-flex h-11 items-center gap-2 rounded-[10px] border px-3.5 text-[14px] font-medium',
                    on ? 'border-[var(--lp-accent)] text-[var(--lp-ink)]' : 'border-[var(--lp-line)] text-[var(--lp-ink-2)] hover:text-[var(--lp-ink)]',
                  )}
                >
                  <MIcon size={15} className={on ? 'text-[var(--lp-accent)]' : 'text-[var(--lp-ink-3)]'} />
                  {m.title}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
