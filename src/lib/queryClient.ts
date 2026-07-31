import { QueryClient, type InvalidateQueryFilters } from '@tanstack/react-query';
import { getStatus } from './api-limiter';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 minutes — drastically reduce redundant fetches
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

// Override global reconnect handler to respect egress limiter emergency state
const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
queryClient.invalidateQueries = async <TInvalidateFilters extends InvalidateQueryFilters = InvalidateQueryFilters>(
  filters?: TInvalidateFilters
) => {
  const status = getStatus();
  if (status.emergency) {
    console.warn('[QueryClient] invalidateQueries SKIPPED during API emergency');
    return;
  }
  return originalInvalidate(filters);
};
