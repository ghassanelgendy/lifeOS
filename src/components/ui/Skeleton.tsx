import { cn } from './cn';

/** Placeholder block. Size it with className (h-*, w-*). Hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('ds-skeleton h-4 w-full', className)} />;
}

/** Generic list placeholder: use while a list's data loads instead of a lone spinner. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-separator">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-6 w-6 rounded-pill" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
