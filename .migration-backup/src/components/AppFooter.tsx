import { Heart } from 'lucide-react';
import { cn, formatTime12h } from '../lib/utils';
import { useSyncStatus } from '../hooks/useSyncStatus';

export function AppFooter() {
  const { online, queueLength, lastSyncAt } = useSyncStatus();

  let syncLabel: string | null = null;
  if (queueLength > 0) {
    syncLabel = `Pending sync (${queueLength})`;
  } else if (lastSyncAt) {
    try {
      const d = new Date(lastSyncAt);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      syncLabel = `Last sync: ${formatTime12h(`${h}:${m}`)}`;
    } catch {
      syncLabel = null;
    }
  }

  return (
    <footer
      className={cn(
        'border-t border-border bg-card/80 text-xs text-muted-foreground',
        'px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2',
        'pb-[calc(0.35rem+env(safe-area-inset-bottom))]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <Heart size={12} className="text-red-500" />
        <span>Made with love by Ghassan</span>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/ghassanelgendy/lifeOS"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          GitHub repo
        </a>
        <div className="flex items-center gap-1 text-[11px]">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              online ? 'bg-green-500' : 'bg-amber-500'
            )}
          />
          <span>{online ? 'Online' : 'Offline'}</span>
          {syncLabel && <span className="text-muted-foreground">· {syncLabel}</span>}
        </div>
      </div>
    </footer>
  );
}

