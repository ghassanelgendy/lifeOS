/** YYYY-MM-DD for comparisons (handles ISO timestamps from some clients). */
export function screentimeDateKey(date: string | null | undefined): string {
  if (!date) return '';
  const s = String(date).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export type ScreentimeUiPlatform = 'ios' | 'windows';

/**
 * Map DB/platform strings to the UI bucket. Windows agents may send Win32, etc.
 * Only iOS and Windows are tracked on the Screen Time page.
 */
export function screentimeUiPlatform(platform: string | null | undefined): ScreentimeUiPlatform | null {
  const n = String(platform ?? '')
    .toLowerCase()
    .trim();
  if (!n) return null;
  if (n === 'ios' || n === 'iphone' || n === 'ipados') return 'ios';
  if (
    n === 'windows' ||
    n === 'win32' ||
    n === 'win64' ||
    n.startsWith('windows ') ||
    n.includes('windows nt') ||
    (n.includes('microsoft') && (n.includes('windows') || n.includes('win32') || n.includes('win64')))
  ) {
    return 'windows';
  }
  return null;
}

export function platformLabelTracked(platform: string | null | undefined): string {
  const b = screentimeUiPlatform(platform);
  if (b === 'ios') return 'IOS';
  if (b === 'windows') return 'windows';
  return '';
}
