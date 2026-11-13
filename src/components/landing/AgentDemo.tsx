/**
 * A working miniature of the assistant: pick a prompt, read the reply, and
 * press Execute on the actions it proposes. Nothing here talks to a server;
 * it shows the real flow (propose, then run only what you approve) with
 * scripted demo data.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Mic } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LogoMark } from './Logo';

type Action = { id: string; verb: string; detail: string };
type Script = { id: string; prompt: string; dir?: 'rtl'; reply: string; actions: Action[] };

const SCRIPTS: Script[] = [
  {
    id: 'evening',
    prompt: 'Plan my evening around Maghrib',
    reply: 'Maghrib is at 17:03. You have two tasks left and evening azkar is not done. Here is a plan that keeps the prayer first.',
    actions: [
      { id: 'a1', verb: 'Create task', detail: 'Evening azkar · 17:20' },
      { id: 'a2', verb: 'Move task', detail: 'Draft project outline · 18:45' },
      { id: 'a3', verb: 'Start focus', detail: '25 minutes after Isha' },
    ],
  },
  {
    id: 'money',
    prompt: 'Where did my money go this week?',
    reply: 'Groceries took the largest share this week, and eating out is over the budget you set. Want me to tighten it?',
    actions: [
      { id: 'b1', verb: 'Set budget', detail: 'Eating out · weekly cap' },
      { id: 'b2', verb: 'Add rule', detail: 'CARREFOUR is Groceries' },
    ],
  },
  {
    id: 'fajr',
    prompt: 'فاتني الفجر مرتين هذا الأسبوع',
    dir: 'rtl',
    reply: 'Both are in your qadaa backlog now. You went to sleep after 1am on both nights, so an earlier wind-down is the likely fix.',
    actions: [
      { id: 'c1', verb: 'Create task', detail: 'Qadaa Fajr · before Dhuhr' },
      { id: 'c2', verb: 'Add habit', detail: 'In bed by 23:00' },
    ],
  },
];

export function AgentDemo() {
  const reduce = useReducedMotion();
  const [scriptId, setScriptId] = useState(SCRIPTS[0].id);
  const [ran, setRan] = useState<string[]>([]);
  const script = SCRIPTS.find((s) => s.id === scriptId) ?? SCRIPTS[0];

  const enter = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay, ease: [0.2, 0.7, 0.2, 1] as const } };

  return (
    <div className="rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--lp-line)] px-5 py-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--lp-ink)]">
          <LogoMark size={18} className="text-[var(--lp-accent)]" />
          lifeOS Assistant
        </span>
        <span className="rounded-full border border-[var(--lp-line)] px-2.5 py-0.5 font-mono text-[12px] text-[var(--lp-ink-3)]">demo</span>
      </div>

      <div className="flex min-h-[340px] flex-col gap-3 p-5" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={script.id} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.12 }} className="flex flex-col gap-3">
            <motion.p
              {...enter(0)}
              dir={script.dir}
              className="max-w-[85%] self-end rounded-[14px] rounded-br-[4px] bg-[var(--lp-accent)] px-4 py-2.5 text-[15px] font-medium text-[var(--lp-on-accent)]"
            >
              {script.prompt}
            </motion.p>
            <motion.p {...enter(0.25)} className="max-w-[92%] rounded-[14px] rounded-bl-[4px] bg-[var(--lp-sunken)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--lp-ink)]">
              {script.reply}
            </motion.p>
            <ul className="flex flex-col gap-2">
              {script.actions.map((a, i) => {
                const done = ran.includes(a.id);
                return (
                  <motion.li
                    key={a.id}
                    {...enter(0.45 + i * 0.1)}
                    className={cn('flex items-center justify-between gap-3 rounded-[12px] border px-4 py-2.5', done ? 'border-[var(--lp-ok)]' : 'border-[var(--lp-line)]')}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--lp-ink-3)]">{a.verb}</span>
                      <span className="block truncate text-[14px] font-medium text-[var(--lp-ink)]">{a.detail}</span>
                    </span>
                    <button
                      type="button"
                      disabled={done}
                      onClick={() => setRan((r) => [...r, a.id])}
                      className={cn(
                        'lp-btn inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[9px] px-3.5 text-[14px] font-bold',
                        done ? 'text-[var(--lp-ok)]' : 'bg-[var(--lp-ink)] text-[var(--lp-bg)] hover:bg-white',
                      )}
                    >
                      {done ? (<><Check size={15} strokeWidth={3} /> Done</>) : 'Execute'}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--lp-line)] p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--lp-line)] text-[var(--lp-ink-3)]" aria-hidden>
          <Mic size={16} />
        </span>
        {SCRIPTS.map((s) => (
          <button
            key={s.id}
            type="button"
            dir={s.dir}
            aria-pressed={s.id === script.id}
            onClick={() => setScriptId(s.id)}
            className={cn(
              'lp-btn h-11 rounded-full border px-4 text-[14px] font-medium',
              s.id === script.id ? 'border-[var(--lp-accent)] text-[var(--lp-ink)]' : 'border-[var(--lp-line)] text-[var(--lp-ink-2)] hover:border-[var(--lp-ink-3)] hover:text-[var(--lp-ink)]',
            )}
          >
            {s.prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
