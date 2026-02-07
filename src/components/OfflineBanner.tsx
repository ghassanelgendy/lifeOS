import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { getOfflineQueueLength } from '../lib/offlineSync';
import { cn } from '../lib/utils';

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!online) setPendingCount(getOfflineQueueLength());
    const interval = setInterval(() => {
      if (!navigator.onLine) setPendingCount(getOfflineQueueLength());
    }, 2000);
    return () => clearInterval(interval);
  }, [online]);

  if (online) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium",
        "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-b border-amber-500/30"
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff size={16} />
      <span>You're offline</span>
      {pendingCount > 0 && (
        <span className="opacity-90">· {pendingCount} change{pendingCount !== 1 ? 's' : ''} will sync when back online</span>
      )}
    </div>
  );
}
