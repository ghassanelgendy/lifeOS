import { useRef } from 'react';
import { cn } from './cn';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  /** Accessible name for the group. Required. */
  label: string;
  className?: string;
}

/** Single-choice control. Arrow keys move selection, Tab enters/leaves the group. */
export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-control bg-sunken p-0.5', className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-ds
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'ds-t min-h-11 rounded-[calc(var(--radius-control)-2px)] px-3 text-label font-medium md:min-h-8',
              on ? 'bg-raised text-ink shadow-ds' : 'text-ink-2 hover:text-ink'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
