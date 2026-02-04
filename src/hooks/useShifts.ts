import { addDays, startOfToday, setHours } from 'date-fns';

export interface Shift {
    id: string;
    person: 'User' | 'Ghassan';
    start_time: string;
    end_time: string;
    note?: string;
    color: string; // UI helper
}

// Generate next 7 days of shifts
const generateShifts = (): Shift[] => {
    const shifts: Shift[] = [];
    const today = startOfToday();

    for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const isGhassan = i % 2 !== 0; // Alternate

        const start = setHours(date, 9);
        const end = setHours(date, 17);

        shifts.push({
            id: `shift-${i}`,
            person: isGhassan ? 'Ghassan' : 'User',
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            note: `Shift ${i + 1}`,
            color: isGhassan ? 'bg-indigo-500' : 'bg-emerald-500',
        });
    }
    return shifts;
};

const MOCK_SHIFTS = generateShifts();

export function useShifts() {
    return {
        shifts: MOCK_SHIFTS,
    };
}
