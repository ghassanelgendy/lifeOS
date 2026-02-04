import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Helper to round numbers to 1 decimal place
export function round1(num: number): number {
    return Math.round(num * 10) / 10;
}
