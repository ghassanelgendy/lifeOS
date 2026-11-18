import { useId, type ReactNode } from 'react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/** One easing for everything in the flow: quick out, soft landing. */
const EASE = [0.22, 1, 0.36, 1] as const;

/* ───────────────────────── Shell ───────────────────────── */

interface ShellProps {
  /** 0-1 */
  progress: number;
  groupLabel: string;
  onSkip: () => void;
  footer: ReactNode;
  children: ReactNode;
  screenKey: string;
  direction: 1 | -1;
}

export function OnboardingShell({
  progress,
  groupLabel,
  onSkip,
  footer,
  children,
  screenKey,
  direction,
}: ShellProps) {
  return (
    <MotionConfig reducedMotion="user">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set up lifeOS"
        className="fixed inset-0 z-[400] flex flex-col overflow-hidden bg-background text-ink"
      >
        {/* Quiet ambient light in the accent colour. Two slow blobs, no grid, no noise. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-primary/15 blur-3xl"
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-48 -right-32 size-[30rem] rounded-full bg-primary/10 blur-3xl"
            animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <header className="relative z-10 flex items-center gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-10">
          <span className="text-sm font-semibold tracking-tight">lifeOS</span>
          <div
            className="h-1.5 flex-1 max-w-md overflow-hidden rounded-full bg-sunken"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Setup progress"
          >
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${Math.max(4, progress * 100)}%` }}
              transition={{ duration: 0.5, ease: EASE }}
            />
          </div>
          <span className="hidden text-xs font-medium text-ink-3 sm:inline">{groupLabel}</span>
          <button
            type="button"
            onClick={onSkip}
            className="ml-auto min-h-11 rounded-full px-3 text-sm font-medium text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Skip setup
          </button>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 py-8 sm:px-10 sm:py-12">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={screenKey}
                custom={direction}
                variants={screenVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <footer className="relative z-10 border-t border-separator/60 bg-background/80 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-10">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">{footer}</div>
        </footer>
      </div>
    </MotionConfig>
  );
}

const screenVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.32, ease: EASE } },
  // leaving is faster than arriving
  exit: (dir: number) => ({ opacity: 0, x: dir * -24, transition: { duration: 0.16, ease: 'easeIn' } }),
};

/* ───────────────────────── Text ───────────────────────── */

export function ScreenHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-6 sm:mb-8">
      <h1 className="max-w-[22ch] text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h1>
      {hint && <p className="mt-2 max-w-prose text-base text-ink-2">{hint}</p>}
    </div>
  );
}

/** Reveals a headline word by word. */
export function WordReveal({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 + i * 0.07 }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

/* ───────────────────────── Choices ───────────────────────── */

interface TileProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  index?: number;
  /** radio shows a dot, check shows a tick */
  kind?: 'check' | 'radio';
  disabled?: boolean;
  trailing?: ReactNode;
  titleDir?: 'auto' | 'ltr';
}

export function ChoiceTile({
  selected,
  onClick,
  title,
  subtitle,
  icon,
  index = 0,
  kind = 'check',
  disabled,
  trailing,
  titleDir,
}: TileProps) {
  return (
    <motion.button
      type="button"
      role={kind === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 10) * 0.045 }}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={cn(
        'group flex min-h-16 w-full items-center gap-3.5 rounded-2xl border px-4 py-3 text-left',
        'transition-[background-color,border-color,box-shadow] duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        selected
          ? 'border-primary bg-primary/10 shadow-[0_6px_20px_-10px] shadow-primary/50'
          : 'border-separator bg-raised/70 hover:border-ink-3/40 hover:bg-raised',
        disabled && 'cursor-default opacity-70'
      )}
    >
      {icon && (
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
            selected ? 'bg-primary text-primary-foreground' : 'bg-sunken text-ink-2 group-hover:text-ink'
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-snug text-ink" dir={titleDir}>
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block text-sm leading-snug text-ink-3">{subtitle}</span>}
      </span>
      {trailing}
      <Indicator selected={selected} kind={kind} />
    </motion.button>
  );
}

function Indicator({ selected, kind }: { selected: boolean; kind: 'check' | 'radio' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-6 shrink-0 items-center justify-center border-2 transition-colors duration-200',
        kind === 'radio' ? 'rounded-full' : 'rounded-lg',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-ink-3/30'
      )}
    >
      <AnimatePresence initial={false}>
        {selected && (
          <motion.span
            key="on"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 22 }}
            className="flex"
          >
            {kind === 'radio' ? (
              <span className="size-2 rounded-full bg-primary-foreground" />
            ) : (
              <Check className="size-3.5" strokeWidth={3.5} />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Small toggle pill, for short labels. */
export function Chip({
  selected,
  onClick,
  children,
  icon,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      layout
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-separator bg-raised/70 text-ink-2 hover:border-ink-3/40 hover:text-ink',
        disabled && 'cursor-default opacity-70'
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}

/** Sliding-indicator segmented control. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-base font-medium text-ink">{label}</span>
      <div role="radiogroup" aria-label={label} className="relative flex rounded-full bg-sunken p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'relative min-h-10 min-w-12 rounded-full px-3.5 text-sm font-semibold tabular-nums transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                active ? 'text-primary-foreground' : 'text-ink-2 hover:text-ink'
              )}
            >
              {active && (
                <motion.span
                  layoutId={`seg-${id}`}
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Buttons ───────────────────────── */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  arrow = true,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      className={cn(
        'group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-7',
        'bg-primary text-base font-semibold text-primary-foreground',
        'shadow-[0_10px_24px_-12px] shadow-primary transition-shadow duration-200 hover:shadow-[0_14px_28px_-12px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {/* light sweep on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/20 opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100"
      />
      {loading && <Loader2 className="size-4 animate-spin" />}
      <span className="relative">{children}</span>
      {arrow && !loading && (
        <ArrowRight className="relative size-4 transition-transform duration-200 group-hover:translate-x-1" />
      )}
    </motion.button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className="inline-flex h-12 items-center justify-center rounded-full border border-separator bg-raised/70 px-6 text-base font-semibold text-ink transition-colors hover:border-ink-3/40 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60"
    >
      {children}
    </motion.button>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-base font-medium text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" />
      Back
    </button>
  );
}

/** Stagger wrapper for lists so tiles arrive one after another. */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2.5', className)}>{children}</div>;
}
