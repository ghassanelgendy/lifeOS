import { cn } from '../../lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'size-3.5 border-[1.5px]',
  sm: 'size-5 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-2',
  xl: 'size-14 border-2',
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  decorative?: boolean;
}

/**
 * Unified loading spinner used across screens, cards, and auth gates.
 */
export function Spinner({
  size = 'lg',
  className,
  label = 'Loading',
  decorative = false,
}: SpinnerProps) {
  return (
    <span
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={cn(
        'inline-block shrink-0 rounded-full border-primary/20 border-t-primary animate-spin motion-reduce:animate-none',
        SIZE_CLASSES[size],
        className
      )}
    />
  );
}

interface SectionLoaderProps {
  label?: string;
  size?: SpinnerSize;
  className?: string;
}

/**
 * Centered loading state for route sections and async panels.
 */
export function SectionLoader({
  label,
  size = 'lg',
  className,
}: SectionLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center min-h-[16rem] gap-3 text-muted-foreground', className)}
    >
      <Spinner size={size} decorative />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
