import { cn, formatTime12h } from '../lib/utils';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { Text } from '@fluentui/react-components';

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
        'border-t text-xs text-muted-foreground',
        'px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2',
        'pb-[calc(0.35rem+env(safe-area-inset-bottom))]'
      )}
      style={{
        backgroundColor: 'var(--colorNeutralBackground3)',
        borderColor: 'var(--colorNeutralStroke1)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <Text size={100} className="text-muted-foreground">Made with ❤️ by Ghassan</Text>
      </div>
      <div className="flex items-center gap-3">
        <Text size={100}>
          <a
            href="https://github.com/ghassanelgendy/lifeOS"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline text-muted-foreground no-underline"
          >
            GitHub repo
          </a>
        </Text>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              online ? 'bg-green-500' : 'bg-amber-500'
            )}
          />
          <Text size={100} className="text-muted-foreground">{online ? 'Online' : 'Offline'}</Text>
          {syncLabel && <Text size={100} className="text-muted-foreground">· {syncLabel}</Text>}
        </div>
      </div>
    </footer>
  );
}
