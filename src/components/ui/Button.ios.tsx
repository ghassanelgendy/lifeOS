import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          {
            // Variants
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
            'hover:bg-secondary hover:text-secondary-foreground': variant === 'ghost',
            'border border-border bg-transparent hover:bg-secondary': variant === 'outline',
            'bg-secondary/45 dark:bg-white/5 backdrop-blur-md border border-border/40 dark:border-white/10 text-foreground hover:bg-secondary/70 dark:hover:bg-white/10 shadow-sm': variant === 'glass',
            // Sizes – touch-friendly min 44px on mobile (via min-h)
            'min-h-[44px] h-8 px-3 text-xs md:min-h-0': size === 'sm',
            'min-h-[44px] h-10 px-4 text-sm md:min-h-0': size === 'md',
            'min-h-[48px] h-12 px-6 text-base': size === 'lg',
            'min-h-[44px] min-w-[44px] h-10 w-10 p-0 md:min-h-0 md:min-w-0': size === 'icon',
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
