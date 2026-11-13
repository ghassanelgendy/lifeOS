import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Web-only class merger. Same as lib/utils `cn`, plus it knows the design
 * system's custom scale, so `text-label text-ink` keeps both (size + color)
 * and `rounded-control` merges with other radii.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'label', 'body', 'title', 'heading', 'display'] }],
      rounded: [{ rounded: ['control', 'card', 'pill'] }],
      shadow: [{ shadow: ['ds', 'overlay'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
