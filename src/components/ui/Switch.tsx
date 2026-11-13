import { cn } from './cn';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. Required. */
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-ds
      onClick={() => onChange(!checked)}
      // 44px tap area around a 24x40 track
      className={cn('relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-pill disabled:opacity-50', className)}
    >
      <span className={cn('ds-t relative block h-6 w-10 rounded-pill', checked ? 'bg-accent-ds' : 'bg-sunken border border-separator')}>
        <span
          className={cn(
            'absolute left-0 top-0.5 h-5 w-5 rounded-pill bg-white shadow-ds transition-transform duration-150 motion-reduce:transition-none',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  );
}
