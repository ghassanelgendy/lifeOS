import { useEffect, useState } from 'react';
import { isOnline } from '../lib/offlineSync';

export function useConnectionStatus() {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return isOnline();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { online };
}

