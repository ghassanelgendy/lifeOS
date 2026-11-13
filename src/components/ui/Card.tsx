import { cn } from './cn';

/**
 * Card: one raised surface with one border. Do not nest a Card inside a Card;
 * use Rows separated by dividers instead.
 */
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-card border border-separator bg-raised shadow-ds', className)} {...props}>
      {children}
    </div>
  );
}

/** Sentence-case section heading above a Card. No uppercase, no tracking. */
export function SectionTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('px-1 pb-2 text-label font-semibold text-ink-2', className)} {...props}>
      {children}
    </h2>
  );
}

interface ListRowProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** When set, the row renders as a button (whole row is the target). */
  onPress?: () => void;
}

/** Row inside a Card. Rows are separated by a hairline, never boxed individually. */
export function ListRow({ title, subtitle, leading, trailing, onPress, className, ...props }: ListRowProps) {
  const body = (
    <>
      {leading && <span className="flex shrink-0 items-center text-ink-2">{leading}</span>}
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-body text-ink">{title}</span>
        {subtitle && <span className="block truncate text-caption text-ink-3">{subtitle}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-label text-ink-2">{trailing}</span>}
    </>
  );
  const cls = cn(
    'flex min-h-14 w-full items-center gap-3 px-4 py-2 border-t border-separator first:border-t-0',
    onPress && 'ds-t hover:bg-hover',
    className
  );
  return onPress ? (
    <button type="button" data-ds onClick={onPress} className={cls} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {body}
    </button>
  ) : (
    <div className={cls} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
      {body}
    </div>
  );
}
