import { useEffect } from 'react';
import { format } from 'date-fns';
import { usePrayerTimes } from './usePrayerTimes';
import { habitDB } from '../db/database';

export function usePrayerHabits() {
    const { times, location } = usePrayerTimes();

    useEffect(() => {
        // specific prayer names to track
        const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        if (!location || times.length === 0) return;

        // Get all current active habits
        const habits = habitDB.getAll();

        times.forEach((prayer) => {
            if (!PRAYER_NAMES.includes(prayer.name)) return;

            const timeString = format(prayer.time, 'h:mm a');
            const desiredTitle = `${prayer.name} (${timeString})`;

            // Find existing habit for this prayer
            // We look for a habit that starts with the prayer name
            const existingHabit = habits.find((h) =>
                h.title.startsWith(prayer.name)
            );

            if (existingHabit) {
                // Update title if it changed (time changed)
                if (existingHabit.title !== desiredTitle) {
                    habitDB.update(existingHabit.id, {
                        title: desiredTitle,
                        description: `Daily ${prayer.name} prayer at ${timeString}`,
                    });
                    console.log(`Updated habit: ${desiredTitle}`);
                }
            } else {
                // Create new habit
                habitDB.create({
                    title: desiredTitle,
                    description: `Daily ${prayer.name} prayer at ${timeString}`,
                    frequency: 'Daily',
                    target_count: 1,
                    color: '#8b5cf6', // Violet color for spiritual habits
                    is_archived: false,
                });
                console.log(`Created habit: ${desiredTitle}`);
            }
        });

    }, [times, location]); // Dependencies: times will change if location changes or day changes
}
