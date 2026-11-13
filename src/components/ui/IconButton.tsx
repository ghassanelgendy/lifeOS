import { forwardRef } from 'react';
import { cn } from './cn';

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: an icon-only control must have an accessible name. */
  label: string;
  size?: 'md' | 'sm';
  active?: boolean;
}

/** Icon-only button. 44px target on touch, 36px (md) / 32px (sm) with a pointer. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = 'md', active, className, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      data-ds
      className={cn(
        'ds-t inline-flex shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-hover hover:text-ink',
        'min-h-11 min-w-11',
        size === 'md' ? 'md:min-h-9 md:min-w-9' : 'md:min-h-8 md:min-w-8',
        active && 'bg-hover text-ink',
        'disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = 'IconButton';
