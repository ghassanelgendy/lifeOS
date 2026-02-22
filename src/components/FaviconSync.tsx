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
const DEFAULT_APPLE_TOUCH_ICON = '/apple-touch-icon.png';

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
    // iOS Add to Home Screen prefers a 180x180 PNG; use route-specific apple-touch-icon.png when in a route folder
    const appleHref = folder ? `/${folder}/apple-touch-icon.png` : DEFAULT_APPLE_TOUCH_ICON;

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
