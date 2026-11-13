import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight, Check, CodeXml, Coins, Download, EyeOff, Flame, Languages, Puzzle, ShieldCheck, WifiOff } from 'lucide-react';
import { cn } from '../lib/utils';
import WikiGraphView from '../components/wiki/WikiGraphView';
import { HeroFrame } from '../components/landing/HeroFrame';
import { DayPrism } from '../components/landing/DayPrism';
import { AgentDemo } from '../components/landing/AgentDemo';
import { IntegrationFeed } from '../components/landing/IntegrationFeed';
import { LogoMark } from '../components/landing/Logo';
import { formatClock, usePublicLang, type Copy } from '../components/landing/i18n';
import '../components/landing/landing.css';

const ENTER = [0.22, 1, 0.36, 1] as const;
const NAV_IDS = ['day', 'life', 'assistant', 'integrations', 'wiki'] as const;
const TRUST_ICONS = [ShieldCheck, WifiOff, EyeOff, CodeXml];

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
      {!small && <span className="lp-key-cell"><ArrowRight size={15} strokeWidth={2.5} className="lp-flip" /></span>}
    </Link>
  );
}

function SectionHead({ title, body, center = false }: { title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn(center && 'mx-auto flex max-w-2xl flex-col items-center text-center')}>
      <h2 className="text-[34px] font-bold leading-[1.12] tracking-[-0.02em] text-[var(--lp-ink)] sm:text-[44px]">{title}</h2>
      {body && <p className={cn('mt-4 text-[17px] leading-relaxed text-[var(--lp-ink-2)]', !center && 'max-w-[52ch]')}>{body}</p>}
    </div>
  );
}

function RotatingWord({ words }: { words: string[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), 2200);
    return () => window.clearInterval(id);
  }, [reduce, words.length]);

  const word = words[index % words.length];
  return (
    <span className="relative inline-flex overflow-hidden pb-[0.12em] align-bottom text-[var(--lp-accent)]" style={{ minWidth: '6.2ch' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={word}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="inline-block whitespace-nowrap"
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The current time, refreshed twice a minute. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const TASK_POINTS = [20, 10, 15];
const HABIT_STREAKS = [5, 12, 2];
const BASE_XP = 120;
const HABIT_XP = 15;

/** The interactive sandbox: tick tasks and log habits, and the XP score follows. */
function Sandbox({ c }: { c: Copy['sandbox'] }) {
  const [doneTasks, setDoneTasks] = useState<number[]>([]);
  const [doneHabits, setDoneHabits] = useState<number[]>([]);

  const xp = BASE_XP + doneTasks.reduce((sum, i) => sum + TASK_POINTS[i], 0) + doneHabits.length * HABIT_XP;
  const toggle = (list: number[], i: number) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);
  const row = 'lp-btn flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[10px] border bg-[var(--lp-sunken)] px-4 py-3 text-start';

  return (
    <div className="rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)] p-5 sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--lp-line)] pb-5">
        <span className="text-[15px] font-semibold text-[var(--lp-ink)]">{c.today}</span>
        <span className="flex items-center gap-2 rounded-full border border-[var(--lp-line)] bg-[var(--lp-sunken)] px-3.5 py-1.5 text-[14px] font-bold text-[var(--lp-warn)]" aria-live="polite">
          <Coins size={15} />
          <motion.span key={xp} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }} className="tabular-nums" dir="ltr">
            {xp} XP
          </motion.span>
        </span>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--lp-ink-2)]">{c.tasks}</h3>
            <span className="text-[12px] tabular-nums text-[var(--lp-ink-3)]">{c.taskItems.length - doneTasks.length} {c.active}</span>
          </div>
          <ul className="space-y-2.5">
            {c.taskItems.map((text, i) => {
              const done = doneTasks.includes(i);
              return (
                <li key={text}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => setDoneTasks((l) => toggle(l, i))}
                    className={cn(row, done ? 'border-[var(--lp-ok)]' : 'border-[var(--lp-line)] hover:border-[var(--lp-ink-3)]')}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-[6px] border', done ? 'border-transparent bg-[var(--lp-ok)] text-[var(--lp-bg)]' : 'border-[var(--lp-ink-3)]')}>
                        {done && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className={cn('truncate text-[15px] font-medium', done ? 'text-[var(--lp-ink-3)] line-through' : 'text-[var(--lp-ink)]')}>{text}</span>
                    </span>
                    <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums', done ? 'text-[var(--lp-ok)]' : 'text-[var(--lp-ink-3)]')} dir={done ? undefined : 'ltr'}>
                      {done ? c.done : `+${TASK_POINTS[i]} XP`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--lp-ink-2)]">{c.habits}</h3>
            <span className="text-[12px] tabular-nums text-[var(--lp-ink-3)]">{doneHabits.length}/{c.habitItems.length} {c.tracked}</span>
          </div>
          <ul className="space-y-2.5">
            {c.habitItems.map((name, i) => {
              const done = doneHabits.includes(i);
              return (
                <li key={name}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => setDoneHabits((l) => toggle(l, i))}
                    className={cn(row, done ? 'border-[var(--lp-warn)]' : 'border-[var(--lp-line)] hover:border-[var(--lp-ink-3)]')}
                  >
                    <span className="min-w-0 truncate text-[15px] font-medium text-[var(--lp-ink)]">{name}</span>
                    <span className={cn('flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums', done ? 'text-[var(--lp-warn)]' : 'text-[var(--lp-ink-3)]')}>
                      <Flame size={13} />
                      {HABIT_STREAKS[i] + (done ? 1 : 0)} {c.days}
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
  const { t, lang, dir, toggle } = usePublicLang();
  const { hijri, time } = formatClock(useNow(), lang);
  const reduce = useReducedMotion();

  // Hero entrance, once on load, about 1.1s in all: headline lines rise out of
  // their masks, then the lead, the actions and the facts fade up in turn.
  const riseLine = (i: number) =>
    reduce ? {} : { initial: { y: '105%' }, animate: { y: '0%' }, transition: { duration: 0.7, delay: i * 0.08, ease: ENTER } };
  const fadeUp = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.52, delay: 0.43 + i * 0.06, ease: ENTER } };

  const { scrollY } = useScroll({ container: scroller });
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));

  // The section crossing the middle of the screen marks its nav word.
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
    NAV_IDS.forEach((id) => {
      const el = root.querySelector(`#${id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };

  const langButton = (
    <button
      type="button"
      onClick={toggle}
      lang={lang === 'ar' ? 'en' : 'ar'}
      aria-label={t.switchLabel}
      className="lp-btn inline-flex h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[14px] font-semibold text-[var(--lp-ink-2)] hover:text-[var(--lp-ink)]"
    >
      <Languages size={16} />
      {t.switchTo}
    </button>
  );

  return (
    <div ref={scroller} dir={dir} lang={lang} className="lp relative h-[100dvh] overflow-y-auto overflow-x-hidden bg-[var(--lp-bg)] text-[var(--lp-ink)]">
      <a href="#main" onClick={jump('main')} className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-[var(--lp-ink)] focus:px-4 focus:py-2 focus:text-[var(--lp-bg)]">
        {t.skip}
      </a>

      {/* Nav: a full-width bar at the top of the page that draws in to a floating dock once you scroll. */}
      <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div
          className={cn(
            'pointer-events-auto relative mx-auto flex h-14 items-center justify-between gap-3 rounded-[16px] border px-3 transition-[max-width,background-color,border-color] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:px-4',
            scrolled ? 'max-w-[64rem] border-[var(--lp-line)] bg-[rgb(22_22_24/0.86)] backdrop-blur-xl' : 'max-w-[74rem] border-transparent bg-transparent',
          )}
        >
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={t.nav.home}>
            <LogoMark size={26} />
            <span className="text-[18px] font-bold tracking-tight" dir="ltr">lifeOS</span>
          </Link>

          <nav aria-label={t.nav.sections} className="hidden items-center lg:flex">
            {NAV_IDS.map((id) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={jump(id)}
                aria-current={spy === id ? 'true' : undefined}
                className={cn(
                  'flex h-10 items-center px-3 text-[14px] font-medium transition-colors duration-150',
                  spy === id ? 'text-[var(--lp-ink)]' : 'text-[var(--lp-ink-3)] hover:text-[var(--lp-ink)]',
                )}
              >
                <span className={cn('lp-navword', spy === id && 'is-current')}>{t.nav[id]}</span>
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {hijri && (
              <span className="hidden items-center gap-2 text-[13px] text-[var(--lp-ink-3)] xl:flex" title={t.nav.clock}>
                <span>{hijri}</span>
                <span aria-hidden className="size-1 rounded-full bg-[var(--lp-ink-3)]" />
                <span className="tabular-nums text-[var(--lp-ink-2)]">{time}</span>
              </span>
            )}
            {langButton}
            <Link to="/login" className="lp-link hidden text-[14px] md:inline-flex">{t.nav.signIn}</Link>
            <span className="ps-1 pt-[3px]"><KeyLink to="/signup" small>{t.nav.start}</KeyLink></span>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
          <div aria-hidden className="lp-dots pointer-events-none absolute inset-x-0 top-[-72px] h-[620px]" />
          <div className="relative mx-auto max-w-6xl">
            <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
              <h1 className={cn('font-bold tracking-[-0.03em]', lang === 'ar' ? 'text-[42px] leading-[1.3] sm:text-[60px] lg:text-[68px]' : 'text-[46px] leading-[1.02] sm:text-[68px] lg:text-[80px]')}>
                <span className="block overflow-hidden pb-[0.08em]">
                  <motion.span className="block" {...riseLine(0)}>{t.hero.stay} <RotatingWord words={t.hero.words} /></motion.span>
                </span>
                <span className="block overflow-hidden pb-[0.12em]">
                  <motion.span className="block text-[var(--lp-ink-3)]" {...riseLine(1)}>{t.hero.line2}</motion.span>
                </span>
              </h1>
              <div className="lg:pb-3">
                <motion.p {...fadeUp(0)} className="max-w-[46ch] text-[18px] leading-relaxed text-[var(--lp-ink-2)]">{t.hero.lead}</motion.p>
                <motion.div {...fadeUp(1)} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <KeyLink to="/signup">{t.hero.cta}</KeyLink>
                  <Link to="/login" className="lp-link">
                    <GoogleIcon className="size-4" />
                    {t.hero.google}
                  </Link>
                </motion.div>
                <motion.p {...fadeUp(2)} className="mt-5 text-[14px] text-[var(--lp-ink-3)]">{t.hero.facts}</motion.p>
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
        <section className="border-y border-[var(--lp-line)] bg-[var(--lp-raised)] px-5 sm:px-8" aria-label={t.trustLabel}>
          <ul className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {t.trust.map(({ title, body }, i) => {
              const Icon = TRUST_ICONS[i];
              return (
                <li key={title}>
                  <Icon size={20} className="text-[var(--lp-accent)]" />
                  <h3 className="mt-3 text-[17px] font-bold tracking-tight text-[var(--lp-ink)]">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The day, from Fajr to sleep: pinned, scroll-driven 3D prism */}
        <DayPrism scroller={scroller} heading={<SectionHead title={t.day.title} />} />

        {/* Use cases */}
        <section id="life" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <SectionHead title={t.life.title} body={t.life.body} />
            <ul className="mt-12 grid gap-x-16 sm:grid-cols-2">
              {t.life.cases.map((u) => (
                <li key={u.title} className="border-t border-[var(--lp-line)] py-6">
                  <h3 className="text-[19px] font-bold leading-snug tracking-tight text-[var(--lp-ink)]">{u.title}</h3>
                  <p className="mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{u.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Assistant */}
        <section id="assistant" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
            <div>
              <SectionHead title={t.assistant.title} body={t.assistant.body} />
              <ul className="mt-8 space-y-4">
                {t.assistant.points.map((p) => (
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
            <SectionHead title={t.integrations.title} body={t.integrations.body} />
            <IntegrationFeed />
          </div>
        </section>

        {/* Sandbox */}
        <section id="try" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-4xl">
            <SectionHead center title={t.sandbox.title} body={t.sandbox.body} />
            <div className="mt-12"><Sandbox c={t.sandbox} /></div>
          </div>
        </section>

        {/* Wiki */}
        <section id="wiki" className="scroll-mt-20 border-t border-[var(--lp-line)] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <SectionHead title={t.wiki.title} body={t.wiki.body} />
              <Link to="/wiki" className="lp-link shrink-0">
                {t.wiki.link}
                <ArrowRight size={16} className="lp-flip" />
              </Link>
            </div>
            <div dir="ltr" className="mt-12 flex justify-center overflow-hidden rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)] p-4">
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
            <h2 className={cn('text-[40px] font-bold tracking-[-0.03em] sm:text-[64px]', lang === 'ar' ? 'leading-[1.3]' : 'leading-[1.04]')}>
              {t.close.line1}
              <br />
              {t.close.line2}
            </h2>
            <div className="pb-2"><KeyLink to="/signup">{t.hero.cta}</KeyLink></div>
          </div>
        </section>
      </main>

      {/* Footer: who it is, where everything is, how to get it */}
      <footer className="border-t border-[var(--lp-line)] bg-[var(--lp-raised)] px-5 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,2fr))]">
          <div>
            <Link to="/" className="flex w-fit items-center gap-2.5" aria-label={t.nav.home}>
              <LogoMark size={34} />
              <span className="text-[22px] font-bold tracking-tight" dir="ltr">lifeOS</span>
            </Link>
            <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[var(--lp-ink-2)]">{t.footer.tagline}</p>
            <p className="mt-3 text-[14px] text-[var(--lp-ink-3)]">{t.footer.platforms}</p>
          </div>

          <nav aria-label={t.footer.product}>
            <h3 className="text-[14px] font-semibold text-[var(--lp-ink)]">{t.footer.product}</h3>
            <ul className="mt-2">
              {NAV_IDS.map((id) => (
                <li key={id}>
                  <a href={`#${id}`} onClick={jump(id)} className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]">{t.nav[id]}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t.footer.get}>
            <h3 className="text-[14px] font-semibold text-[var(--lp-ink)]">{t.footer.get}</h3>
            <ul className="mt-2">
              <li><Link to="/signup" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]">{t.footer.web}</Link></li>
              <li><a href={EXTENSION_URL} target="_blank" rel="noreferrer" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]"><Puzzle size={15} />{t.footer.extension}</a></li>
              <li><a href={DESKTOP_URL} target="_blank" rel="noreferrer" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]"><Download size={15} />{t.footer.desktop}</a></li>
              <li><a href={GITHUB_URL} target="_blank" rel="noreferrer" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]"><CodeXml size={15} />{t.footer.source}</a></li>
            </ul>
          </nav>

          <nav aria-label={t.footer.more}>
            <h3 className="text-[14px] font-semibold text-[var(--lp-ink)]">{t.footer.more}</h3>
            <ul className="mt-2">
              <li><Link to="/wiki" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]">{t.footer.docs}</Link></li>
              <li><Link to="/login" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]">{t.nav.signIn}</Link></li>
              <li><a href="https://github.com/ghassanelgendy" target="_blank" rel="noreferrer" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]">GitHub</a></li>
              <li><a href="https://www.linkedin.com/in/ghassanelgendy/" target="_blank" rel="noreferrer" className="lp-link text-[14px] font-medium text-[var(--lp-ink-2)]">LinkedIn</a></li>
            </ul>
          </nav>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--lp-line)] py-5 text-[14px] text-[var(--lp-ink-3)]">
          <span dir="ltr">© {new Date().getFullYear()} lifeOS</span>
          <span className="flex items-center gap-4">
            {hijri && <span>{hijri}</span>}
            {langButton}
          </span>
        </div>
      </footer>
    </div>
  );
}
