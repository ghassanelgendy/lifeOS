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
import { usePublicLang } from './i18n';

export function AgentDemo() {
  const reduce = useReducedMotion();
  const { t } = usePublicLang();
  const scripts = t.assistant.scripts;
  const [index, setIndex] = useState(0);
  const [ran, setRan] = useState<string[]>([]);
  const script = scripts[index] ?? scripts[0];

  const enter = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay, ease: [0.2, 0.7, 0.2, 1] as const } };

  return (
    <div className="rounded-[18px] border border-[var(--lp-line)] bg-[var(--lp-raised)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--lp-line)] px-5 py-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--lp-ink)]">
          <LogoMark size={18} className="text-[var(--lp-accent)]" />
          {t.assistant.name}
        </span>
        <span className="rounded-full border border-[var(--lp-line)] px-2.5 py-0.5 text-[12px] text-[var(--lp-ink-3)]">{t.assistant.demo}</span>
      </div>

      <div className="flex min-h-[340px] flex-col gap-3 p-5" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={index} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.12 }} className="flex flex-col gap-3">
            <motion.p
              {...enter(0)}
              className="max-w-[85%] self-end rounded-[14px] rounded-ee-[4px] bg-[var(--lp-accent)] px-4 py-2.5 text-[15px] font-medium text-[var(--lp-on-accent)]"
            >
              {script.prompt}
            </motion.p>
            <motion.p {...enter(0.25)} className="max-w-[92%] self-start rounded-[14px] rounded-es-[4px] bg-[var(--lp-sunken)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--lp-ink)]">
              {script.reply}
            </motion.p>
            <ul className="flex flex-col gap-2">
              {script.actions.map((a, i) => {
                const id = `${index}-${i}`;
                const done = ran.includes(id);
                return (
                  <motion.li
                    key={id}
                    {...enter(0.45 + i * 0.1)}
                    className={cn('flex items-center justify-between gap-3 rounded-[12px] border px-4 py-2.5', done ? 'border-[var(--lp-ok)]' : 'border-[var(--lp-line)]')}
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-[var(--lp-ink-3)]">{a.verb}</span>
                      <span className="block truncate text-[14px] font-medium text-[var(--lp-ink)]">{a.detail}</span>
                    </span>
                    <button
                      type="button"
                      disabled={done}
                      onClick={() => setRan((r) => [...r, id])}
                      className={cn(
                        'lp-btn inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[9px] px-3.5 text-[14px] font-bold',
                        done ? 'text-[var(--lp-ok)]' : 'bg-[var(--lp-ink)] text-[var(--lp-bg)] hover:bg-white',
                      )}
                    >
                      {done ? (<><Check size={15} strokeWidth={3} /> {t.assistant.done}</>) : t.assistant.execute}
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
        {scripts.map((s, i) => (
          <button
            key={s.prompt}
            type="button"
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              'lp-btn h-11 rounded-full border px-4 text-[14px] font-medium',
              i === index ? 'border-[var(--lp-accent)] text-[var(--lp-ink)]' : 'border-[var(--lp-line)] text-[var(--lp-ink-2)] hover:border-[var(--lp-ink-3)] hover:text-[var(--lp-ink)]',
            )}
          >
            {s.prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
