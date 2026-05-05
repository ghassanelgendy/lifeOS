import type { PrayerStatus } from '../types/schema';

export function isPrayerStatusComplete(status: PrayerStatus | null | undefined): boolean {
  return status === 'Prayed' || status === 'Late';
}

export function getPrayerStatusChoices(): PrayerStatus[] {
  return ['Prayed', 'Late', 'Missed'];
}
