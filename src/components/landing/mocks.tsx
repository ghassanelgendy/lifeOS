/**
 * Live UI fragments for the landing page. Each one is a small, real piece of
 * lifeOS interface drawn in HTML (no screenshots), filled with demo data.
 * They only use the --lp-* variables set on the landing root, so they stay
 * dark regardless of the app theme.
 */
import { useEffect, useState } from 'react';
import { Check, Flame, Pause, Play } from 'lucide-react';
import { cn } from '../../lib/utils';

export const panel = 'rounded-[14px] border border-[var(--lp-line)] bg-[var(--lp-raised)]';
const label = 'font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--lp-ink-3)]';

const TASKS = [
  { text: 'Review weekly plan', meta: 'Today', tone: 'var(--lp-danger)', done: true },
  { text: 'Pay electricity bill', meta: 'Today', tone: 'var(--lp-warn)', done: true },
  { text: 'Draft project outline', meta: 'Tomorrow', tone: 'var(--lp-accent)', done: false },
  { text: 'Book dentist appointment', meta: 'Fri', tone: 'var(--lp-ink-3)', done: false },
];

export function TasksMock({ compact = false }: { compact?: boolean }) {
  const rows = compact ? TASKS.slice(0, 3) : TASKS;
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={label}>Inbox</span>
        <span className="text-[12px] text-[var(--lp-ink-3)]">2 of 4 done</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {rows.map((t) => (
          <li key={t.text} className="flex items-center gap-3 rounded-[10px] border border-[var(--lp-line)] bg-[var(--lp-sunken)] px-3 py-2.5">
            <span
              className={cn(
                'flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border',
                t.done ? 'border-transparent bg-[var(--lp-ok)] text-[var(--lp-bg)]' : 'border-[var(--lp-ink-3)]',
              )}
            >
              {t.done && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={cn('min-w-0 flex-1 truncate text-[14px]', t.done ? 'text-[var(--lp-ink-3)] line-through' : 'text-[var(--lp-ink)]')}>
              {t.text}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--lp-ink-3)]">
              <span className="size-1.5 rounded-full" style={{ background: t.tone }} />
              {t.meta}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** A working Pomodoro ring: it really counts down, and the button really pauses it. */
export function FocusMock({ autoStart = true }: { autoStart?: boolean }) {
  const TOTAL = 25 * 60;
  const [left, setLeft] = useState(TOTAL - 7 * 60 - 43);
  const [running, setRunning] = useState(autoStart);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLeft((s) => (s <= 1 ? TOTAL : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running, TOTAL]);

  const R = 54;
  const C = 2 * Math.PI * R;
  const done = 1 - left / TOTAL;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative size-[148px]">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--lp-sunken)" strokeWidth="6" />
          <circle
            cx="64" cy="64" r={R} fill="none" stroke="var(--lp-accent)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - done)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--lp-accent)]">{running ? 'Focus' : 'Paused'}</span>
          <span className="text-[30px] font-bold leading-none tabular-nums tracking-tight text-[var(--lp-ink)]">{fmt(left)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        aria-label={running ? 'Pause the focus timer' : 'Resume the focus timer'}
        className="lp-btn inline-flex h-11 items-center gap-2 rounded-[10px] border border-[var(--lp-line)] bg-[var(--lp-sunken)] px-4 text-[14px] font-semibold text-[var(--lp-ink)] hover:border-[var(--lp-ink-3)]"
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
        {running ? 'Pause session' : 'Resume session'}
      </button>
    </div>
  );
}

// 12 weeks x 7 days of habit completion levels (0-3), fixed so it never reshuffles.
const HEAT = Array.from({ length: 84 }, (_, i) => {
  const week = Math.floor(i / 7);
  const v = (i * 7 + week * 3) % 11;
  if (week < 3) return v > 7 ? 1 : 0;
  if (week < 7) return v > 4 ? (v > 8 ? 2 : 1) : 0;
  return v > 1 ? (v > 6 ? 3 : 2) : 1;
});
const HEAT_BG = ['var(--lp-sunken)', 'color-mix(in srgb, var(--lp-ok) 30%, var(--lp-sunken))', 'color-mix(in srgb, var(--lp-ok) 62%, var(--lp-sunken))', 'var(--lp-ok)'];

export function HabitsMock() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={label}>Read 5 pages</span>
        <span className="flex items-center gap-1 text-[12px] font-semibold text-[var(--lp-warn)]">
          <Flame size={13} /> 12 days
        </span>
      </div>
      <div className="grid flex-1 grid-flow-col grid-rows-7 content-center gap-[5px]" aria-hidden>
        {HEAT.map((v, i) => (
          <span key={i} className="aspect-square w-full rounded-[4px]" style={{ background: HEAT_BG[v] }} />
        ))}
      </div>
      <div className="flex items-center justify-between text-[12px] text-[var(--lp-ink-3)]">
        <span>Last 12 weeks</span>
        <span>Consistency 86%</span>
      </div>
    </div>
  );
}

const MONEY = [
  { m: 'Jun', inc: 62, out: 48 },
  { m: 'Jul', inc: 62, out: 55 },
  { m: 'Aug', inc: 70, out: 44 },
  { m: 'Sep', inc: 66, out: 51 },
  { m: 'Oct', inc: 78, out: 46 },
  { m: 'Nov', inc: 74, out: 39 },
];

export function FinanceMock() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <span className={label}>Left this month</span>
          <p className="text-[26px] font-bold leading-tight tabular-nums tracking-tight text-[var(--lp-ink)]">4,320</p>
        </div>
        <div className="flex gap-3 text-[12px] text-[var(--lp-ink-3)]">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-[var(--lp-accent)]" />Income</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-[var(--lp-ink-3)]" />Spent</span>
        </div>
      </div>
      <div className="flex flex-1 items-end gap-3" aria-hidden>
        {MONEY.map((b) => (
          <div key={b.m} className="flex h-full flex-1 flex-col justify-end gap-1.5">
            <div className="flex flex-1 items-end gap-1">
              <span className="flex-1 rounded-t-[4px] bg-[var(--lp-accent)]" style={{ height: `${b.inc}%` }} />
              <span className="flex-1 rounded-t-[4px] bg-[var(--lp-ink-3)] opacity-60" style={{ height: `${b.out}%` }} />
            </div>
            <span className="text-center text-[12px] text-[var(--lp-ink-3)]">{b.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const NIGHTS = [
  { d: 'M', h: 6.4 }, { d: 'T', h: 7.2 }, { d: 'W', h: 5.8 }, { d: 'T', h: 7.6 },
  { d: 'F', h: 8.1 }, { d: 'S', h: 7.9 }, { d: 'S', h: 7.4 },
];

export function SleepMock() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <span className={label}>Average this week</span>
          <p className="text-[26px] font-bold leading-tight tabular-nums tracking-tight text-[var(--lp-ink)]">
            7<span className="text-[var(--lp-ink-3)]">h</span> 12<span className="text-[var(--lp-ink-3)]">m</span>
          </p>
        </div>
        <span className="text-[12px] text-[var(--lp-ink-3)]">Goal 8h</span>
      </div>
      <div className="relative flex flex-1 items-end gap-2.5" aria-hidden>
        <span className="absolute inset-x-0 border-t border-dashed border-[var(--lp-ink-3)] opacity-50" style={{ bottom: `calc(${(8 / 9) * 100}% - 12px)` }} />
        {NIGHTS.map((n, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1.5">
            <span
              className="rounded-[5px]"
              style={{ height: `${(n.h / 9) * 100}%`, background: n.h >= 7 ? 'var(--lp-accent)' : 'color-mix(in srgb, var(--lp-accent) 35%, var(--lp-sunken))' }}
            />
            <span className="text-center text-[12px] text-[var(--lp-ink-3)]">{n.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
