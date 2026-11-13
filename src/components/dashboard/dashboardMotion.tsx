/**
 * Motion helpers for the web dashboard. Everything here is transform/opacity
 * only (no layout animation) and rests in its final state under
 * prefers-reduced-motion.
 */
import { useEffect, useRef } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** Props for a card that rises into place once on load, staggered by its index. */
export function useRise() {
  const reduce = useReducedMotion();
  return (index: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay: 0.05 + index * 0.07, ease: EASE_OUT },
        };
}

/** A number that counts to its value on mount and rolls whenever it changes. */
export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  const text = (v: number) => v.toFixed(decimals);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prev.current;
    prev.current = value;
    if (reduce || from === value) {
      node.textContent = text(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => { node.textContent = text(v); },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, reduce]);

  return <span ref={ref} className={className}>{text(value)}</span>;
}

/** A progress bar that fills from the left. The fill slides (transform), the track clips it. */
export function GrowBar({ pct, className, trackClassName, delay = 0 }: { pct: number; className?: string; trackClassName?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = `${clamped - 100}%`;
  return (
    <span className={cn('block h-1.5 w-full overflow-hidden rounded-pill bg-sunken', trackClassName)} aria-hidden>
      <motion.span
        className={cn('block h-full w-full rounded-pill', className)}
        initial={reduce ? false : { x: '-100%' }}
        animate={{ x: offset }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay }}
      />
    </span>
  );
}
