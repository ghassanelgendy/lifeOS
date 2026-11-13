import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight, Check, CodeXml, Coins, Download, EyeOff, Flame, Puzzle, ShieldCheck, WifiOff } from 'lucide-react';
import { cn } from '../lib/utils';
import WikiGraphView from '../components/wiki/WikiGraphView';
import { HeroFrame } from '../components/landing/HeroFrame';
import { DayPrism } from '../components/landing/DayPrism';
import { AgentDemo } from '../components/landing/AgentDemo';
import { IntegrationHub } from '../components/landing/IntegrationHub';
import { LogoMark } from '../components/landing/Logo';
import '../components/landing/landing.css';

const WORDS = ['organised', 'focused', 'consistent', 'in control'];
const ENTER = [0.22, 1, 0.36, 1] as const;

const NAV = [
  { id: 'day', label: 'Your day' },
  { id: 'life', label: 'Use cases' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'wiki', label: 'Wiki' },
];

const TRUST = [
  { icon: ShieldCheck, title: 'Yours alone', body: 'Every record is scoped to your account with row-level security. No tracking without your consent.' },
  { icon: WifiOff, title: 'Works offline', body: 'Keep logging without a connection. It syncs when you are back online.' },
  { icon: EyeOff, title: 'Privacy mode', body: 'Blur your money and screen-time numbers when someone is looking over your shoulder.' },
  { icon: CodeXml, title: 'Open code', body: 'The source is public on GitHub. Read it, or host it on your own Supabase.' },
];

const USE_CASES = [
  { title: 'A two-minute morning check', body: 'Open the dashboard and see today’s prayers, tasks, habits and how you slept, on one screen.' },
  { title: 'A qadaa plan with an end date', body: 'Say how many make-up prayers you can manage a day. lifeOS shows when you will finish, and whether you are ahead or behind.' },
  { title: 'Spending that logs itself', body: 'Forward your bank SMS messages and each one lands as a categorised transaction.' },
  { title: 'A khatmah you can keep', body: 'Plan a full reading of the Quran and get today’s pages. All 604 pages are available offline.' },
  { title: 'A weekly review with evidence', body: 'See how your sleep, screen time, habits and spending moved together over the week.' },
  { title: 'Still works on a flight', body: 'Log tasks, habits and azkar with no connection. Everything syncs when you land.' },
];

const ASSISTANT_POINTS = [
  'Ask in English or Arabic, by typing or by voice.',
  'It reads your tasks, habits, sleep and spending before it answers.',
  'It proposes changes as cards. Nothing runs until you press Execute.',
  'It runs on your own AI keys. Switch it off and every AI entry point disappears.',
];

const GITHUB_URL = 'https://github.com/ghassanelgendy/lifeOS';
const EXTENSION_URL = 'https://github.com/ghassanelgendy/lifeOS/releases/latest/download/lifeOS-extension.zip';
const DESKTOP_URL = 'https://github.com/ghassanelgendy/lifeOS/releases/latest';

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

/** The primary action: a keycap with the arrow in its own cell. */
function KeyLink({ to, children, small = false }: { to: string; children: ReactNode; small?: boolean }) {
  return (
    <Link to={to} className={cn('lp-key', small && 'lp-key-sm')}>
      {children}
      {!small && <span className="lp-key-cell"><ArrowRight size={15} strokeWidth={2.5} /></span>}
    </Link>
  );
}

function SectionHead({ title, body, center = false }: { title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn(center && 'mx-auto flex max-w-2xl flex-col items-center text-center')}>
      <h2 className="text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-[var(--lp-ink)] sm:text-[44px]">{title}</h2>
      {body && <p className={cn('mt-4 text-[17px] leading-relaxed text-[var(--lp-ink-2)]', !center && 'max-w-[52ch]')}>{body}</p>}
    </div>
  );
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

/** Today's Hijri date and the local time, ticking once a minute. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  } catch {
    hijri = '';
  }
  const time = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  return { hijri, time };
}

const SANDBOX_TASKS = [
  { id: 1, text: 'Ship v1.0 of lifeOS', points: 20 },
  { id: 2, text: 'Log daily sleep analysis', points: 10 },
  { id: 3, text: 'Complete 10m focus sprint', points: 15 },
];
const SANDBOX_HABITS = [
  { id: 1, name: 'Morning azkar', streak: 5 },
  { id: 2, name: 'Read 5 pages of Quran', streak: 12 },
  { id: 3, name: '8h sleep', streak: 2 },
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
  const row = 'lp-btn flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[10px] border bg-[var(--lp-sunken)] px-4 py-3 text-left';

  return (
    <div className="rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)] p-5 sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--lp-line)] pb-5">
        <span className="text-[15px] font-semibold text-[var(--lp-ink)]">Today</span>
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
                    className={cn(row, done ? 'border-[var(--lp-ok)]' : 'border-[var(--lp-line)] hover:border-[var(--lp-ink-3)]')}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-[6px] border', done ? 'border-transparent bg-[var(--lp-ok)] text-[var(--lp-bg)]' : 'border-[var(--lp-ink-3)]')}>
                        {done && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className={cn('truncate text-[15px] font-medium', done ? 'text-[var(--lp-ink-3)] line-through' : 'text-[var(--lp-ink)]')}>{task.text}</span>
                    </span>
                    <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums', done ? 'text-[var(--lp-ok)]' : 'text-[var(--lp-ink-3)]')}>
                      {done ? 'Done' : `+${task.points} XP`}
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
                    className={cn(row, done ? 'border-[var(--lp-warn)]' : 'border-[var(--lp-line)] hover:border-[var(--lp-ink-3)]')}
                  >
                    <span className="min-w-0 truncate text-[15px] font-medium text-[var(--lp-ink)]">{habit.name}</span>
                    <span className={cn('flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums', done ? 'text-[var(--lp-warn)]' : 'text-[var(--lp-ink-3)]')}>
                      <Flame size={13} />
                      {habit.streak + (done ? 1 : 0)} days
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

export default function Landing() {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [spy, setSpy] = useState('');
  const { hijri, time } = useNow();
  const reduce = useReducedMotion();

  // Hero entrance, once on load, about 1.1s in all: headline lines rise out of
  // their masks, then the lead, the actions and the facts fade up in turn.
  const riseLine = (i: number) =>
    reduce ? {} : { initial: { y: '105%' }, animate: { y: '0%' }, transition: { duration: 0.7, delay: i * 0.08, ease: ENTER } };
  const fadeUp = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.52, delay: 0.43 + i * 0.06, ease: ENTER } };

  const { scrollY } = useScroll({ container: scroller });
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));

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

      {/* Nav: a full-width bar at the top of the page that draws in to a floating dock once you scroll. */}
      <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div
          className={cn(
            'pointer-events-auto relative mx-auto flex h-14 items-center justify-between gap-3 overflow-hidden rounded-[16px] border px-3 transition-[max-width,background-color,border-color] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] sm:px-4',
            scrolled ? 'max-w-[60rem] border-[var(--lp-line)] bg-[rgb(22_22_24/0.86)] backdrop-blur-xl' : 'max-w-[74rem] border-transparent bg-transparent',
          )}
        >
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="lifeOS home">
            <LogoMark size={26} />
            <span className="text-[18px] font-bold tracking-tight">lifeOS</span>
          </Link>

          <nav aria-label="Sections" className="hidden items-center lg:flex">
            {NAV.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={jump(id)}
                aria-current={spy === id ? 'true' : undefined}
                className={cn(
                  'relative flex h-10 items-center rounded-[10px] px-3 text-[14px] font-medium transition-colors duration-150',
                  spy === id ? 'text-[var(--lp-ink)]' : 'text-[var(--lp-ink-3)] hover:text-[var(--lp-ink)]',
                )}
              >
                <span className={cn('lp-navword', spy === id && 'is-current')}>{label}</span>
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            {hijri && (
              <span className="hidden items-center gap-2 font-mono text-[12px] text-[var(--lp-ink-3)] xl:flex" title="Today's Hijri date and your local time">
                <span>{hijri}</span>
                <span aria-hidden className="size-1 rounded-full bg-[var(--lp-ink-3)]" />
                <span className="tabular-nums text-[var(--lp-ink-2)]">{time}</span>
              </span>
            )}
            <Link to="/login" className="lp-link hidden text-[14px] sm:inline-flex">Sign in</Link>
            <span className="pt-[3px]"><KeyLink to="/signup" small>Get started</KeyLink></span>
          </div>

        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
          <div aria-hidden className="lp-dots pointer-events-none absolute inset-x-0 top-[-72px] h-[620px]" />
          <div className="relative mx-auto max-w-6xl">
            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
              <h1 className="text-[46px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[68px] lg:text-[80px]">
                <span className="block overflow-hidden pb-[0.08em]">
                  <motion.span className="block" {...riseLine(0)}>Stay <RotatingWord /></motion.span>
                </span>
                <span className="block overflow-hidden pb-[0.12em]">
                  <motion.span className="block text-[var(--lp-ink-3)]" {...riseLine(1)}>every single day.</motion.span>
                </span>
              </h1>
              <div className="lg:pb-3">
                <motion.p {...fadeUp(0)} className="max-w-[46ch] text-[18px] leading-relaxed text-[var(--lp-ink-2)]">
                  Your personal operating system. Prayers, tasks, habits, money and sleep in one dashboard, with an assistant that acts on them when you say so.
                </motion.p>
                <motion.div {...fadeUp(1)} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <KeyLink to="/signup">Create free account</KeyLink>
                  <Link to="/login" className="lp-link">
                    <GoogleIcon className="size-4" />
                    Continue with Google
                  </Link>
                </motion.div>
                <motion.p {...fadeUp(2)} className="mt-5 text-[14px] text-[var(--lp-ink-3)]">Free to use. 12 modules. Source on GitHub.</motion.p>
              </div>
            </div>

            {/* the picture is never hidden: it settles from slightly small */}
            <motion.div
              initial={reduce ? false : { scale: 0.98 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.9, ease: ENTER }}
              className="mt-12 sm:mt-16"
            >
              <HeroFrame scroller={scroller} />
            </motion.div>
          </div>
        </section>

        {/* Trust: four facts, no counters */}
        <section className="border-y border-[var(--lp-line)] bg-[var(--lp-raised)] px-5 sm:px-8" aria-label="Why you can trust lifeOS with your data">
          <ul className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon size={20} className="text-[var(--lp-accent)]" />
                <h3 className="mt-3 text-[17px] font-bold tracking-tight text-[var(--lp-ink)]">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* The day, from Fajr to sleep: pinned, scroll-driven 3D prism */}
        <DayPrism scroller={scroller} heading={<SectionHead title="From Fajr to sleep, one dashboard" />} />

        {/* Use cases */}
        <section id="life" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <SectionHead title="Life with lifeOS" body="Built around a Muslim’s day, and useful for anyone who wants their plans and their evidence in the same place." />
            <ol className="mt-12 grid gap-x-16 sm:grid-cols-2">
              {USE_CASES.map((u, i) => (
                <li key={u.title} className="flex gap-5 border-t border-[var(--lp-line)] py-6">
                  <span className="pt-1 font-mono text-[13px] tabular-nums text-[var(--lp-ink-3)]">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-[19px] font-bold leading-snug tracking-tight text-[var(--lp-ink)]">{u.title}</h3>
                    <p className="mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{u.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Assistant */}
        <section id="assistant" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
            <div>
              <SectionHead title="An assistant that does the work" body="lifeOS is an agentic organiser: it can plan with you and then make the changes itself, once you approve them." />
              <ul className="mt-8 space-y-4">
                {ASSISTANT_POINTS.map((p) => (
                  <li key={p} className="flex gap-3 text-[16px] leading-relaxed text-[var(--lp-ink)]">
                    <Check size={18} className="mt-1 shrink-0 text-[var(--lp-accent)]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <AgentDemo />
          </div>
        </section>

        {/* Integrations and modules */}
        <section id="integrations" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <SectionHead title="Everything in one place" body="Your bank, your calendars, your phone and your browser feed lifeOS on their own, so the dashboard is already up to date when you open it." />
            <IntegrationHub />
          </div>
        </section>

        {/* Sandbox */}
        <section id="try" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-4xl">
            <SectionHead center title="Try it yourself" body="Click tasks and habits in this interactive mockup to see how lifeOS gamifies your day-to-day execution." />
            <div className="mt-12"><Sandbox /></div>
          </div>
        </section>

        {/* Wiki */}
        <section id="wiki" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <SectionHead
                title="Explore the lifeOS Wiki"
                body="Our public knowledge graph. Drag nodes to move them around, and click a node to read its specification."
              />
              <Link to="/wiki" className="lp-link shrink-0">
                Browse the full documentation
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="mt-12 flex justify-center overflow-hidden rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)] p-4">
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
              <LogoMark size={72} className="text-[var(--lp-ink)]" />
              <h2 className="mt-6 text-[40px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[64px]">
                Your personal
                <br />
                operating system.
              </h2>
            </div>
            <div className="flex flex-col items-start gap-2">
              <KeyLink to="/signup">Create free account</KeyLink>
              <a href={EXTENSION_URL} target="_blank" rel="noreferrer" className="lp-link mt-2">
                <Puzzle size={16} />
                Download the browser extension
              </a>
              <a href={DESKTOP_URL} target="_blank" rel="noreferrer" className="lp-link">
                <Download size={16} />
                Get the desktop app
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="lp-link">
                <CodeXml size={16} />
                Read the source on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--lp-line)] px-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 py-8 text-[14px] text-[var(--lp-ink-3)] lg:flex-row lg:items-center">
          <span className="flex items-center gap-2 font-semibold text-[var(--lp-ink-2)]">
            <LogoMark size={18} />
            lifeOS
            <span className="font-normal text-[var(--lp-ink-3)]">Web, iOS, Android, desktop and browser extension</span>
          </span>
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
