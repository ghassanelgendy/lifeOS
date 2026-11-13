import { cn } from './cn';

interface EmptyStateProps {
  title: string;
  /** One sentence: what goes here and what to do next. */
  description?: string;
  icon?: React.ReactNode;
  /** The single primary action, usually a <Button>. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('ds-enter flex flex-col items-center gap-2 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-1 text-ink-3" aria-hidden="true">{icon}</div>}
      <p className="text-title font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-label text-ink-2">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
