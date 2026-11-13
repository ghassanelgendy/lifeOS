import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AnimatePresence, animate, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll,
} from 'framer-motion';
import {
  ArrowRight, BarChart3, BookOpen, Calendar, Check, CheckSquare, Coins, Download, Dumbbell,
  FileText, Flame, Focus as FocusIcon, Layout, Monitor, Moon, Puzzle, Wallet,
} from 'lucide-react';
import { cn } from '../lib/utils';
import WikiGraphView from '../components/wiki/WikiGraphView';
import { HeroFrame } from '../components/landing/HeroFrame';
import { DayPrism } from '../components/landing/DayPrism';
import '../components/landing/landing.css';

type Feature = {
  icon: typeof CheckSquare;
  title: string;
  description: string;
  details: string[];
};

const FEATURES: Feature[] = [
  { icon: CheckSquare, title: 'Tasks', description: 'Smart task management with priorities, due dates, subtasks, and recurrence.', details: ['Priorities and due dates', 'Subtasks and recurrence', 'Quick capture to inbox'] },
  { icon: FocusIcon, title: 'Focus', description: 'Pomodoro timer to protect deep work time and track productive sessions.', details: ['Pomodoro sessions', 'Distraction-free mode', 'Session streaks'] },
  { icon: Flame, title: 'Habits', description: 'Build streaks, track daily habits, and watch consistency compound.', details: ['Daily streak tracking', 'Completion history', 'Habit consistency score'] },
  { icon: Calendar, title: 'Calendar', description: 'Week and month view with events, tasks, and upcoming deadlines at a glance.', details: ['Week and month views', 'Event scheduling', 'Deadline visibility'] },
  { icon: Layout, title: 'Planner', description: 'Plan your week on a structured time-block grid to stay on top of everything.', details: ['Time-block planning', 'Drag-style layout', 'Weekly structure overview'] },
  { icon: FileText, title: 'Notes', description: 'Capture ideas, meeting notes, and thoughts in rich Markdown notes.', details: ['Markdown notes', 'Quick idea capture', 'Organized notebooks'] },
  { icon: Wallet, title: 'Finance', description: 'Track income, expenses, and budgets so your money goes where you want.', details: ['Income and expense tracking', 'Budget overview', 'Cashflow snapshots'] },
  { icon: Moon, title: 'Sleep', description: 'Log sleep sessions and review quality trends to protect your recovery.', details: ['Log sleep sessions', 'Analyze quality trends', 'Track recovery insights'] },
  { icon: Dumbbell, title: 'Bio-Metrics', description: 'Log workouts, body composition, and physical activity all in one place.', details: ['Workouts and movement', 'Body measurements', 'Daily health logs'] },
  { icon: Coins, title: 'Points & Rewards', description: 'Gamify your execution by earning coins for completed tasks and habits.', details: ['Completion rewards', 'Daily point milestones', 'Gamification store'] },
  { icon: Monitor, title: 'Screen Time', description: 'Monitor daily screen usage and set healthy limits to reclaim focus.', details: ['Usage tracking', 'Healthy limits', 'Focus recovery'] },
  { icon: BarChart3, title: 'Analytics', description: "Bird's-eye view of your productivity, habits, and growth over time.", details: ['Productivity trends', 'Habit growth charts', 'Whole-life overview'] },
];

const STATS = [
  { value: 12, suffix: '', label: 'Built-in modules' },
  { value: 100, suffix: '%', label: 'Free to use' },
  { value: 1, suffix: '', label: 'Dashboard for everything' },
];

const WORDS = ['organised', 'focused', 'consistent', 'in control'];

const NAV = [
  { id: 'day', label: 'A day in lifeOS' },
  { id: 'try', label: 'Try it' },
  { id: 'modules', label: 'Modules' },
  { id: 'wiki', label: 'Wiki' },
];

const EXTENSION_URL = 'https://github.com/ghassanelgendy/lifeOS/releases/latest/download/lifeOS-extension.zip';
const DESKTOP_URL = 'https://github.com/ghassanelgendy/lifeOS/releases/latest';

const btnPrimary = 'lp-btn inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-[var(--lp-ink)] px-5 text-[15px] font-semibold text-[var(--lp-bg)] hover:bg-white';
const btnSecondary = 'lp-btn inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--lp-line)] bg-[var(--lp-raised)] px-5 text-[15px] font-semibold text-[var(--lp-ink)] hover:border-[var(--lp-ink-3)]';
const card = 'rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)]';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/** Mono label with an accent bar, used above every section heading. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border-l-2 border-[var(--lp-accent)] bg-[var(--lp-raised)] px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--lp-ink-2)]">
      {children}
    </span>
  );
}

function SectionHead({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn(center && 'mx-auto flex max-w-2xl flex-col items-center text-center')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-[var(--lp-ink)] sm:text-[44px]">{title}</h2>
      {body && <p className={cn('mt-4 text-[17px] leading-relaxed text-[var(--lp-ink-2)]', !center && 'max-w-[52ch]')}>{body}</p>}
    </div>
  );
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    if (reduce) { node.textContent = `${to}${suffix}`; return; }
    const controls = animate(0, to, {
      duration: 1.4, ease: 'easeOut',
      onUpdate: (v) => { node.textContent = `${Math.round(v)}${suffix}`; },
    });
    return () => controls.stop();
  }, [inView, reduce, to, suffix]);

  return <span ref={ref} className="tabular-nums">0{suffix}</span>;
}

function RotatingWord() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2200);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <span className="relative inline-flex overflow-hidden align-bottom text-[var(--lp-accent)]" style={{ minWidth: '6.2ch' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
          className="inline-block whitespace-nowrap"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const SANDBOX_TASKS = [
  { id: 1, text: 'Ship v1.0 of lifeOS', points: 20 },
  { id: 2, text: 'Log daily sleep analysis', points: 10 },
  { id: 3, text: 'Complete 10m focus sprint', points: 15 },
];
const SANDBOX_HABITS = [
  { id: 1, name: '8h Sleep Rest', streak: 5 },
  { id: 2, name: 'Read 5 Pages', streak: 12 },
  { id: 3, name: 'Morning Reflection', streak: 2 },
];
const BASE_XP = 120;
const HABIT_XP = 15;

/** The interactive sandbox: tick tasks and log habits, and the XP score follows. */
function Sandbox() {
  const [doneTasks, setDoneTasks] = useState<number[]>([]);
  const [doneHabits, setDoneHabits] = useState<number[]>([]);

  const xp = BASE_XP
    + SANDBOX_TASKS.filter((t) => doneTasks.includes(t.id)).reduce((sum, t) => sum + t.points, 0)
    + doneHabits.length * HABIT_XP;

  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className={cn(card, 'p-5 sm:p-7')}>
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--lp-line)] pb-5">
        <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--lp-ink-3)]">Interactive Sandbox</span>
        <span className="flex items-center gap-2 rounded-full border border-[var(--lp-line)] bg-[var(--lp-sunken)] px-3.5 py-1.5 text-[14px] font-bold text-[var(--lp-warn)]" aria-live="polite">
          <Coins size={15} />
          <motion.span key={xp} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }} className="tabular-nums">
            {xp} XP
          </motion.span>
        </span>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--lp-ink-2)]">Inbox Tasks</h3>
            <span className="text-[12px] tabular-nums text-[var(--lp-ink-3)]">{SANDBOX_TASKS.length - doneTasks.length} active</span>
          </div>
          <ul className="space-y-2.5">
            {SANDBOX_TASKS.map((task) => {
              const done = doneTasks.includes(task.id);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => setDoneTasks((l) => toggle(l, task.id))}
                    className={cn(
                      'lp-btn flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left',
                      done ? 'border-[var(--lp-ok)] bg-[var(--lp-sunken)]' : 'border-[var(--lp-line)] bg-[var(--lp-sunken)] hover:border-[var(--lp-ink-3)]',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-[6px] border', done ? 'border-transparent bg-[var(--lp-ok)] text-[var(--lp-bg)]' : 'border-[var(--lp-ink-3)]')}>
                        {done && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className={cn('truncate text-[15px] font-medium', done ? 'text-[var(--lp-ink-3)] line-through' : 'text-[var(--lp-ink)]')}>{task.text}</span>
                    </span>
                    <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums', done ? 'text-[var(--lp-ok)]' : 'text-[var(--lp-ink-3)]')}>
                      {done ? 'Done!' : `+${task.points} XP`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--lp-ink-2)]">Daily Habits</h3>
            <span className="text-[12px] tabular-nums text-[var(--lp-ink-3)]">{doneHabits.length}/{SANDBOX_HABITS.length} tracked</span>
          </div>
          <ul className="space-y-2.5">
            {SANDBOX_HABITS.map((habit) => {
              const done = doneHabits.includes(habit.id);
              return (
                <li key={habit.id}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => setDoneHabits((l) => toggle(l, habit.id))}
                    className={cn(
                      'lp-btn flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-left',
                      done ? 'border-[var(--lp-warn)] bg-[var(--lp-sunken)]' : 'border-[var(--lp-line)] bg-[var(--lp-sunken)] hover:border-[var(--lp-ink-3)]',
                    )}
                  >
                    <span className="min-w-0 truncate text-[15px] font-medium text-[var(--lp-ink)]">{habit.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className={cn('flex items-center gap-1 text-[12px] font-semibold tabular-nums', done ? 'text-[var(--lp-warn)]' : 'text-[var(--lp-ink-3)]')}>
                        <Flame size={13} />
                        {habit.streak + (done ? 1 : 0)} days
                      </span>
                      <span className={cn('rounded-[6px] border px-2 py-0.5 text-[12px] font-bold uppercase', done ? 'border-transparent text-[var(--lp-warn)]' : 'border-[var(--lp-line)] text-[var(--lp-ink-2)]')}>
                        {done ? 'Logged' : 'Log'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Modules() {
  const [active, setActive] = useState(0);
  const current = FEATURES[active];
  const Icon = current.icon;

  return (
    <div className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FEATURES.map((f, i) => {
          const FIcon = f.icon;
          const on = i === active;
          return (
            <li key={f.title}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={cn(
                  'lp-btn flex h-full min-h-[104px] w-full flex-col justify-between gap-4 rounded-[14px] border p-4 text-left',
                  on ? 'border-[var(--lp-accent)] bg-[var(--lp-sunken)]' : 'border-[var(--lp-line)] bg-[var(--lp-raised)] hover:border-[var(--lp-ink-3)]',
                )}
              >
                <FIcon size={20} className={on ? 'text-[var(--lp-accent)]' : 'text-[var(--lp-ink-3)]'} />
                <span className="text-[15px] font-semibold text-[var(--lp-ink)]">{f.title}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={cn(card, 'relative overflow-hidden p-6 sm:p-7 lg:min-h-[340px]')} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <span className="flex size-12 items-center justify-center rounded-[14px] bg-[var(--lp-sunken)] text-[var(--lp-accent)]">
              <Icon size={22} />
            </span>
            <h3 className="mt-5 text-[26px] font-bold leading-tight tracking-tight text-[var(--lp-ink)]">{current.title}</h3>
            <p className="mt-2 text-[16px] leading-relaxed text-[var(--lp-ink-2)]">{current.description}</p>
            <ul className="mt-6 space-y-3">
              {current.details.map((d) => (
                <li key={d} className="flex items-center gap-3 text-[15px] text-[var(--lp-ink)]">
                  <Check size={16} className="shrink-0 text-[var(--lp-accent)]" />
                  {d}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [spy, setSpy] = useState('');

  const { scrollY, scrollYProgress } = useScroll({ container: scroller });
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 8));

  // Scrollspy: the nav item of the section crossing the middle of the screen.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setSpy(e.target.id);
          else setSpy((cur) => (cur === e.target.id ? '' : cur));
        }
      },
      { root, rootMargin: '-45% 0px -50% 0px' },
    );
    NAV.forEach(({ id }) => {
      const el = root.querySelector(`#${id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div ref={scroller} className="lp relative h-[100dvh] overflow-y-auto overflow-x-hidden bg-[var(--lp-bg)] text-[var(--lp-ink)]">
      <a href="#main" onClick={jump('main')} className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-[var(--lp-ink)] focus:px-4 focus:py-2 focus:text-[var(--lp-bg)]">
        Skip to content
      </a>

      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
          scrolled ? 'border-[var(--lp-line)] bg-[rgb(12_12_14/0.82)] backdrop-blur-xl' : 'border-transparent bg-transparent',
        )}
      >
        <div className="px-5 sm:px-8"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/icon-main.png" alt="" width={28} height={28} className="size-7 rounded-[7px]" />
            <span className="text-[19px] font-bold tracking-tight">lifeOS</span>
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
            {NAV.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={jump(id)}
                aria-current={spy === id ? 'true' : undefined}
                className={cn(
                  'rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors duration-150',
                  spy === id ? 'bg-[var(--lp-raised)] text-[var(--lp-ink)]' : 'text-[var(--lp-ink-3)] hover:text-[var(--lp-ink)]',
                )}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link to="/login" className="lp-btn hidden h-11 items-center rounded-[10px] px-4 text-[14px] font-medium text-[var(--lp-ink-2)] hover:text-[var(--lp-ink)] sm:inline-flex">Sign in</Link>
            <Link to="/signup" className="lp-btn inline-flex h-11 items-center rounded-[10px] bg-[var(--lp-ink)] px-4 text-[14px] font-semibold text-[var(--lp-bg)] hover:bg-white">Get started</Link>
          </div>
        </div></div>
        <motion.div aria-hidden className="absolute inset-x-0 bottom-[-1px] h-px origin-left bg-[var(--lp-accent)]" style={{ scaleX: scrollYProgress }} />
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
          <div aria-hidden className="lp-dots pointer-events-none absolute inset-x-0 top-[-64px] h-[620px]" />
          <div className="relative mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
              className="grid items-end gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12"
            >
              <div>
                <Eyebrow>Your personal operating system</Eyebrow>
                <h1 className="mt-6 text-[46px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[68px] lg:text-[80px]">
                  Stay <RotatingWord />
                  <br />
                  <span className="text-[var(--lp-ink-3)]">every single day.</span>
                </h1>
              </div>
              <div className="lg:pb-3">
                <p className="max-w-[44ch] text-[18px] leading-relaxed text-[var(--lp-ink-2)]">
                  Tasks, habits, focus, finance, sleep, notes, and more, all connected in one personal dashboard.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link to="/signup" className={cn(btnPrimary, 'group')}>
                    Create free account
                    <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                  <Link to="/login" className={btnSecondary}>
                    <GoogleIcon className="size-4" />
                    Continue with Google
                  </Link>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
              className="mt-12 sm:mt-16"
            >
              <HeroFrame scroller={scroller} />
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-[var(--lp-line)] bg-[var(--lp-raised)] px-5 sm:px-8">
          <dl className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-[var(--lp-line)]">
            {STATS.map(({ value, suffix, label }) => (
              <div key={label} className="flex flex-col-reverse px-4 py-10 text-center sm:py-12">
                <dt className="mt-2 text-[13px] text-[var(--lp-ink-3)] sm:text-[14px]">{label}</dt>
                <dd className="text-[36px] font-bold leading-none tracking-tight sm:text-[52px]"><Counter to={value} suffix={suffix} /></dd>
              </div>
            ))}
          </dl>
        </section>

        {/* A day in lifeOS: pinned, scroll-driven 3D prism */}
        <DayPrism
          scroller={scroller}
          heading={<SectionHead eyebrow="A day in lifeOS" title="One dashboard, from morning to night" />}
        />

        {/* Sandbox */}
        <section id="try" className="scroll-mt-16 px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-4xl">
            <SectionHead
              center
              eyebrow="Try it"
              title="Try it yourself"
              body="Click tasks and habits in this interactive mockup to see how lifeOS gamifies your day-to-day execution."
            />
            <div className="mt-12"><Sandbox /></div>
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="scroll-mt-16 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <SectionHead
              eyebrow="Modules"
              title="Everything in one place"
              body="12 modules that cover every corner of your life, all talking to each other."
            />
            <Modules />
          </div>
        </section>

        {/* Wiki */}
        <section id="wiki" className="scroll-mt-16 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <SectionHead
                eyebrow="Wiki"
                title="Explore the lifeOS Wiki"
                body="Interact with our public knowledge graph. Drag nodes to explore connections, and click any node to read the system specifications and product guidelines."
              />
              <Link to="/wiki" className={cn(btnSecondary, 'shrink-0')}>
                <BookOpen size={16} />
                Browse Full Documentation
              </Link>
            </div>
            <div className={cn(card, 'mt-12 flex justify-center overflow-hidden p-4')}>
              <WikiGraphView
                onNavigate={(nodeId) => {
                  const [pageTitle] = nodeId.split('#');
                  navigate(`/wiki/${encodeURIComponent(pageTitle)}`);
                }}
              />
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <img src="/icon-main.png" alt="" width={56} height={56} className="size-14 rounded-[14px]" />
              <h2 className="mt-6 text-[40px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[64px]">
                Your personal
                <br />
                operating system.
              </h2>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto">
              <Link to="/signup" className={cn(btnPrimary, 'group')}>
                Create free account
                <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
              <a href={EXTENSION_URL} target="_blank" rel="noreferrer" className={btnSecondary}>
                <Puzzle size={16} />
                Download Browser Extension
              </a>
              <a href={DESKTOP_URL} target="_blank" rel="noreferrer" className={btnSecondary}>
                <Download size={16} />
                Get the Desktop App
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--lp-line)] px-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 py-8 text-[14px] text-[var(--lp-ink-3)] sm:flex-row sm:items-center">
          <span className="font-semibold text-[var(--lp-ink-2)]">lifeOS</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/wiki" className="transition-colors duration-150 hover:text-[var(--lp-ink)]">Docs & Wiki</Link>
            <Link to="/login" className="transition-colors duration-150 hover:text-[var(--lp-ink)]">Sign in</Link>
            <a href="https://github.com/ghassanelgendy" target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-[var(--lp-ink)]">GitHub</a>
            <a href="https://www.linkedin.com/in/ghassanelgendy/" target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-[var(--lp-ink)]">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
