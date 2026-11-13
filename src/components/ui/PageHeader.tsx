import type { ReactNode } from 'react';
import { cn } from './cn';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Canonical module header matching Finance (plain title + muted subtitle, no icon chrome or divider bar). */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-muted-foreground mt-0.5">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div> : null}
    </div>
  );
}
