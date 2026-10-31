import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { trackPageView, setUserId } from '../lib/gtag';

/**
 * GoogleAnalyticsTracker
 * Mounts inside <Router> to automatically report SPA page transitions and
 * authenticated user ID to Google Analytics 4 (G-E33S655RMQ).
 */
export function GoogleAnalyticsTracker() {
  const location = useLocation();
  const { user } = useAuth();

  // Sync user ID with GA4 whenever auth state resolves
  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
    } else {
      setUserId(null);
    }
  }, [user?.id]);

  // Track pageviews on route transitions
  useEffect(() => {
    const fullPath = location.pathname + location.search + location.hash;
    trackPageView(fullPath);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
