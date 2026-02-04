import { useState, useEffect } from 'react';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';

export interface PrayerTimeData {
    name: string;
    time: Date;
    isNext: boolean;
}

export function usePrayerTimes() {
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [nextPrayer, setNextPrayer] = useState<string | null>(null);
    const [timeToNext, setTimeToNext] = useState<string>('');

    // Get Location
    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            (err) => {
                setError('Unable to retrieve location');
                console.error(err);
                // Default to Mecca coordinates if location fails? Or just show error.
                // Let's default to Mecca for a nice fallback experience
                setLocation({ lat: 21.4225, lng: 39.8262 });
            }
        );
    }, []);

    // Calculate Times
    useEffect(() => {
        if (!location) return;

        const coords = new Coordinates(location.lat, location.lng);
        const date = new Date();
        const params = CalculationMethod.MuslimWorldLeague();
        params.madhab = Madhab.Shafi; // Default, maybe make configurable

        try {
            const times = new PrayerTimes(coords, date, params);
            setPrayerTimes(times);
        } catch (e) {
            console.error("Error calculating prayer times", e);
        }
    }, [location]);

    // Update Countdown and Next Prayer
    useEffect(() => {
        if (!prayerTimes) return;

        const interval = setInterval(() => {
            const now = new Date();
            const current = prayerTimes.currentPrayer();
            const next = prayerTimes.nextPrayer();

            let nextTime = prayerTimes.timeForPrayer(next);

            // If next is none, it means we passed Isha, so next is Fajr tomorrow
            if (next === 'none') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const coords = new Coordinates(location!.lat, location!.lng);
                const params = CalculationMethod.MuslimWorldLeague();
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
    }, [prayerTimes, location]);

    const formattedTimes: PrayerTimeData[] = prayerTimes ? [
        { name: 'Fajr', time: prayerTimes.fajr, isNext: nextPrayer === 'fajr' },
        { name: 'Sunrise', time: prayerTimes.sunrise, isNext: nextPrayer === 'sunrise' },
        { name: 'Dhuhr', time: prayerTimes.dhuhr, isNext: nextPrayer === 'dhuhr' },
        { name: 'Asr', time: prayerTimes.asr, isNext: nextPrayer === 'asr' },
        { name: 'Maghrib', time: prayerTimes.maghrib, isNext: nextPrayer === 'maghrib' },
        { name: 'Isha', time: prayerTimes.isha, isNext: nextPrayer === 'isha' },
    ] : [];

    return {
        times: formattedTimes,
        location,
        error,
        nextPrayer,
        timeToNext
    };
}
