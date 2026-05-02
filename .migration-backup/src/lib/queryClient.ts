import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24h so offline cache lasts
      retry: (failureCount) => {
        // Don't retry on network errors when likely offline
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // refetch when browser regains connection
    },
  },
});
