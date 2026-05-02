import { useEffect, useState } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { getLastSyncAt, getOfflineQueueLengthAsync } from '../lib/offlineSync';

interface SyncStatus {
  online: boolean;
  queueLength: number;
  lastSyncAt: string | null;
}

export function useSyncStatus(): SyncStatus {
  const { online } = useConnectionStatus();
  const [queueLength, setQueueLength] = useState<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => getLastSyncAt());

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const len = await getOfflineQueueLengthAsync();
        const last = getLastSyncAt();
        if (!cancelled) {
          setQueueLength(len);
          setLastSyncAt(last);
        }
      } catch {
        if (!cancelled) {
          setQueueLength(0);
        }
      }
    };

    void refresh();

    // Refresh when connection status changes (e.g. after coming back online)
    if (online) {
      const id = setInterval(refresh, 30000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [online]);

  return { online, queueLength, lastSyncAt };
}

