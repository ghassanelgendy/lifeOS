import { forwardRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';

interface AddButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Accessible action description (exposed via aria-label and title tooltip). */
  label?: string;
  iconSize?: number;
}

/**
 * Canonical "+" add button shared across modules (excluding the Dashboard FAB)
 * so every primary create trigger shares identical sizing, icon weight, and chrome.
 */
export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ label = 'Add', iconSize = 18, className, type = 'button', ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      size="icon"
      aria-label={label}
      title={label}
      className={cn('shrink-0', className)}
      {...props}
    >
      <Plus size={iconSize} strokeWidth={2.25} />
    </Button>
  )
);

AddButton.displayName = 'AddButton';
