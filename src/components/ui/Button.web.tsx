import { forwardRef } from 'react';
import { cn } from './cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * Web button. Same API as before (existing call sites keep working), now on
 * the design tokens: one radius, one focus ring, 44px minimum target on touch.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        data-ds
        className={cn(
          'ds-t inline-flex items-center justify-center gap-2 rounded-control font-medium select-none',
          'disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-ink text-surface hover:opacity-90': variant === 'default',
            'bg-sunken text-ink hover:bg-hover': variant === 'secondary',
            'bg-danger text-surface hover:opacity-90': variant === 'destructive',
            'text-ink hover:bg-hover': variant === 'ghost',
            'border border-separator bg-transparent text-ink hover:bg-hover': variant === 'outline',
            'min-h-11 px-3 text-label md:min-h-8': size === 'sm',
            'min-h-11 px-4 text-label md:min-h-10': size === 'md',
            'min-h-12 px-6 text-body': size === 'lg',
            'min-h-11 min-w-11 p-0 md:min-h-10 md:min-w-10': size === 'icon',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
