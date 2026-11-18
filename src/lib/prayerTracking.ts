import { format } from 'date-fns';

/**
 * The first day prayers can be counted as missed. Days before the account existed
 * were never tracked, so an empty log there means "no data", not "missed".
 * Returns null when the account age is unknown (offline users); callers then keep
 * the legacy behaviour.
 */
export function getPrayerTrackingStart(createdAt?: string | null): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
}

/** True when an unlogged day should count as a missed prayer. */
export function isUnloggedDayMissed(dayStr: string, todayStr: string, trackingStart: string | null): boolean {
  if (dayStr >= todayStr) return false;
  if (trackingStart && dayStr < trackingStart) return false;
  return true;
}
