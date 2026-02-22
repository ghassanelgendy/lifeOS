import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pathname to public folder name. Only routes with a folder in public/ are listed.
 * Missing routes fall back to default favicon / apple-touch-icon.
 */
const ROUTE_FAVICON_MAP: Record<string, string> = {
  '/tasks': 'todo',
  '/habits': 'habits',
  '/calendar': 'calendar',
  '/screentime': 'screentime',
  '/sleep': 'sleep',
};

const DEFAULT_FAVICON_SVG = '/favicon.svg';
// Use manifest icon for iOS Add to Home Screen (192×192 is closest to Apple’s 180pt recommendation)
const DEFAULT_APPLE_TOUCH_ICON = '/web-app-manifest-192x192.png';

function getFaviconFolder(pathname: string): string | null {
  const base = pathname.split('/').filter(Boolean)[0];
  const path = base ? `/${base}` : '/';
  return ROUTE_FAVICON_MAP[path] ?? null;
}

export function FaviconSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    const folder = getFaviconFolder(pathname);
    const iconHref = folder ? `/${folder}/favicon.svg` : DEFAULT_FAVICON_SVG;
    // iOS Add to Home Screen: use shared manifest icon (192×192) for all routes
    const appleHref = DEFAULT_APPLE_TOUCH_ICON;

    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    if (iconLink && iconLink.getAttribute('href') !== iconHref) {
      iconLink.setAttribute('href', iconHref);
    }

    const appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleLink && appleLink.getAttribute('href') !== appleHref) {
      appleLink.setAttribute('href', appleHref);
    }
  }, [pathname]);

  return null;
}
