import { useState, useEffect } from 'react';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';
import { useUIStore } from '../stores/useUIStore';

export interface PrayerTimeData {
  name: string;
  time: Date;
  isNext: boolean;
}

export function usePrayerTimes() {
  const lat = useUIStore((s) => s.prayerLatitude);
  const lng = useUIStore((s) => s.prayerLongitude);
  const locationLabel = useUIStore((s) => s.prayerLocationLabel);

  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<string | null>(null);
  const [timeToNext, setTimeToNext] = useState<string>('');

  useEffect(() => {
    const coords = new Coordinates(lat, lng);
    const date = new Date();
    const params = CalculationMethod.MuslimWorldLeague();
    params.madhab = Madhab.Shafi;

    try {
      const times = new PrayerTimes(coords, date, params);
      setPrayerTimes(times);
    } catch (e) {
      console.error('Error calculating prayer times', e);
    }
  }, [lat, lng]);

  useEffect(() => {
    if (!prayerTimes) return;

    const interval = setInterval(() => {
      const now = new Date();
      const next = prayerTimes.nextPrayer();
      let nextTime = prayerTimes.timeForPrayer(next);

      if (next === 'none') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const coords = new Coordinates(lat, lng);
        const params = CalculationMethod.MuslimWorldLeague();
        params.madhab = Madhab.Shafi;
        const tomorrowTimes = new PrayerTimes(coords, tomorrow, params);
        nextTime = tomorrowTimes.fajr;
        setNextPrayer('fajr');
      } else {
        setNextPrayer(next);
      }

      if (nextTime) {
        const diff = nextTime.getTime() - now.getTime();
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeToNext(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeToNext('Now');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [prayerTimes, lat, lng]);

  const formattedTimes: PrayerTimeData[] = prayerTimes
    ? [
        { name: 'Fajr', time: prayerTimes.fajr, isNext: nextPrayer === 'fajr' },
        { name: 'Sunrise', time: prayerTimes.sunrise, isNext: nextPrayer === 'sunrise' },
        { name: 'Dhuhr', time: prayerTimes.dhuhr, isNext: nextPrayer === 'dhuhr' },
        { name: 'Asr', time: prayerTimes.asr, isNext: nextPrayer === 'asr' },
        { name: 'Maghrib', time: prayerTimes.maghrib, isNext: nextPrayer === 'maghrib' },
        { name: 'Isha', time: prayerTimes.isha, isNext: nextPrayer === 'isha' },
      ]
    : [];

  return {
    times: formattedTimes,
    location: { lat, lng },
    locationLabel,
    error: null,
    nextPrayer,
    timeToNext,
  };
}
