import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { set, format as formatDateFn } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to round numbers to 1 decimal place
export function round1(num: number): number {
  return Math.round(num * 10) / 10;
}

// App currency (Egyptian Pound)
export const CURRENCY_SYMBOL = 'E£';

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString()}`;
}

/**
 * Format a stored time string (\"HH:mm\" or \"HH:mm:ss\") into 12h with AM/PM for display.
 * Returns the original string if parsing fails.
 */
export function formatTime12h(time?: string | null): string {
  if (!time) return '';
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return time;
  }
  const [hours, minutes] = parts;
  const base = new Date();
  const d = set(base, { hours, minutes, seconds: 0, milliseconds: 0 });
  return formatDateFn(d, 'h:mm a');
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
