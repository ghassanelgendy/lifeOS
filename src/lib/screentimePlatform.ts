/** YYYY-MM-DD for comparisons (handles ISO timestamps from some clients). */
export function screentimeDateKey(date: string | null | undefined): string {
  if (!date) return '';
  const s = String(date).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export type ScreentimeUiPlatform = 'ios' | 'windows' | 'linux';

/**
 * Map DB/platform strings to the UI bucket. Windows agents may send Win32, Linux agents send linux/ubuntu, etc.
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
  if (
    n === 'linux' ||
    n === 'ubuntu' ||
    n === 'debian' ||
    n === 'fedora' ||
    n === 'arch' ||
    n.includes('linux') ||
    n.includes('ubuntu')
  ) {
    return 'linux';
  }
  return null;
}

export function platformLabelTracked(platform: string | null | undefined): string {
  const b = screentimeUiPlatform(platform);
  if (b === 'ios') return 'IOS';
  if (b === 'windows') return 'windows';
  if (b === 'linux') return 'Linux';
  return '';
}
