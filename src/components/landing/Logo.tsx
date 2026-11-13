/**
 * The lifeOS mark redrawn as vectors: a ring on a stem with three branches,
 * after the app icon. Variants:
 *  - outline: strokes only, takes the text color
 *  - solid:   filled disc with the branches cut out
 *  - tile:    dark rounded tile, as on a home screen
 *  - accent:  accent-colored tile
 * The same drawings are exported as files in public/brand/.
 */
import { cn } from '../../lib/utils';

type Variant = 'outline' | 'solid' | 'tile' | 'accent';

const RING = <circle cx="32" cy="25" r="16.5" />;
const TREE = <path d="M32 59V20M32 32l-8.5-8.5M32 32l8.5-8.5" />;

export function LogoMark({ variant = 'outline', size = 28, className }: { variant?: Variant; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': true, className: cn('shrink-0', className) } as const;

  if (variant === 'solid') {
    return (
      <svg {...common}>
        <circle cx="32" cy="25" r="18.75" fill="currentColor" />
        <path d="M32 59V43.75" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M32 43V20M32 32l-8.5-8.5M32 32l8.5-8.5" stroke="var(--lp-bg, #0c0c0e)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (variant === 'tile' || variant === 'accent') {
    const accent = variant === 'accent';
    return (
      <svg {...common}>
        <rect width="64" height="64" rx="15" fill={accent ? 'var(--lp-accent, #5aa9ff)' : 'var(--lp-raised, #161618)'} />
        {!accent && <rect x=".75" y=".75" width="62.5" height="62.5" rx="14.25" stroke="var(--lp-line, #2a2a2e)" strokeWidth="1.5" />}
        <g transform="translate(9.6 8.6) scale(.7)" stroke={accent ? 'var(--lp-on-accent, #04101f)' : 'var(--lp-ink, #f4f4f5)'} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          {RING}
          {TREE}
        </g>
      </svg>
    );
  }

  return (
    <svg {...common}>
      <g stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        {RING}
        {TREE}
      </g>
    </svg>
  );
}
