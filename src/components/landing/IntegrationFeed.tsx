/**
 * "Everything in one place". Three stacked parts, no diagram:
 *  1. a feed of things that arrived on their own today, one new line at a time
 *     (with a pause control, and still under reduced motion),
 *  2. the nine sources that feed lifeOS, each with one line of what it does,
 *  3. the twelve modules it all lands in.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity, ArrowRight, Bot, CalendarSync, Clock, MessageSquareText, Moon, Pause, Play, Puzzle, Smartphone, Zap,
} from 'lucide-react';
import { usePublicLang } from './i18n';

// Same order as the copy's `sources` and `events`.
const ICONS = [MessageSquareText, CalendarSync, Zap, Puzzle, Smartphone, Moon, Activity, Clock, Bot];
const VISIBLE = 5;
const STEP_MS = 2600;

export function IntegrationFeed() {
  const { t, lang } = usePublicLang();
  const reduce = useReducedMotion();
  const c = t.integrations;
  const total = c.events.length;
  const [head, setHead] = useState(VISIBLE - 1);
  const [paused, setPaused] = useState(false);
  const [base] = useState(() => Date.now());

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => setHead((h) => h + 1), STEP_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused]);

  // Newest first. `n` is a running counter so every arrival has its own key.
  const rows = Array.from({ length: VISIBLE }, (_, k) => {
    const n = head - k;
    const i = ((n % total) + total) % total;
    return { n, i };
  });

  const stamp = (minutesAgo: number) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .format(new Date(base - minutesAgo * 60_000));

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
      {/* 1. feed */}
      <div className="min-w-0 rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--lp-line)] py-2 pe-2 ps-5">
          <h3 className="min-w-0 text-[15px] font-semibold text-[var(--lp-ink)]">{c.feedTitle}</h3>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? c.play : c.pause}
            className="lp-btn flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--lp-ink-2)] hover:text-[var(--lp-ink)] motion-reduce:hidden"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>
        <ul className="relative h-[340px] overflow-hidden px-3 py-2" aria-live="off">
          <AnimatePresence initial={false}>
            {rows.map(({ n, i }, k) => {
              const Icon = ICONS[i];
              const e = c.events[i];
              return (
                <motion.li
                  key={n}
                  layout={reduce ? false : 'position'}
                  initial={reduce ? false : { opacity: 0, y: -18 }}
                  animate={{ opacity: k === VISIBLE - 1 ? 0.45 : 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="flex h-[64px] items-center gap-3 border-b border-[var(--lp-line)] px-2 last:border-b-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--lp-sunken)] text-[var(--lp-accent)]">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[var(--lp-ink)]">{e.text}</span>
                    <span className="flex items-center gap-1.5 text-[13px] text-[var(--lp-ink-3)]">
                      {c.sources[i].title}
                      <ArrowRight size={12} className="lp-flip shrink-0" />
                      <span className="font-semibold text-[var(--lp-ink-2)]">{e.to}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-[var(--lp-ink-3)]">{stamp(k * 23 + 4)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      {/* 2. sources */}
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-[var(--lp-ink)]">{c.sourcesTitle}</h3>
        <ul className="mt-3">
          {c.sources.map((s, i) => {
            const Icon = ICONS[i];
            return (
              <li key={s.title} className="flex gap-3 border-t border-[var(--lp-line)] py-2.5">
                <Icon size={16} className="mt-1 shrink-0 text-[var(--lp-ink-3)]" />
                <p className="text-[14px] leading-relaxed text-[var(--lp-ink-2)]">
                  <span className="font-semibold text-[var(--lp-ink)]">{s.title}.</span> {s.body}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 3. modules */}
      <div className="border-t border-[var(--lp-line)] pt-6 lg:col-span-2">
        <h3 className="text-[15px] font-semibold text-[var(--lp-ink)]">{c.modulesTitle}</h3>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {c.modules.map((m) => (
            <li key={m} className="text-[15px] text-[var(--lp-ink-2)]">{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
