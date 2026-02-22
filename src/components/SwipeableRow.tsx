import { useRef, useState } from 'react';
import { Check, Clock, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 280; // Increased to accommodate all 3 buttons (Done ~100px + +1h ~90px + Delete ~100px)

interface SwipeableRowProps {
  children: React.ReactNode;
  onDone?: () => void;
  onPostpone?: () => void;
  onDelete?: () => void;
  showPostpone?: boolean;
  className?: string;
}

export function SwipeableRow({
  children,
  onDone,
  onPostpone,
  onDelete,
  showPostpone = true,
  className,
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    // Only allow swipe left (positive diff)
    const value = Math.max(0, Math.min(diff, MAX_SWIPE));
    setOffset(value);
  };

  const handleTouchEnd = () => {
    if (offset >= SWIPE_THRESHOLD) {
      setOffset(MAX_SWIPE);
    } else {
      setOffset(0);
    }
  };

  const hasActions = onDone || onPostpone || onDelete;

  if (!hasActions) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl', className)}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Background actions - no outline so they don't show through */}
      <div className="absolute inset-y-0 right-0 flex items-stretch rounded-r-xl overflow-hidden">
        {onDone && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOffset(0);
              onDone();
            }}
            className="flex items-center justify-center gap-1.5 px-4 bg-green-600 text-white font-medium text-sm min-w-[80px] active:opacity-80 outline-none border-0"
          >
            <Check size={18} />
            Done
          </button>
        )}
        {showPostpone && onPostpone && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOffset(0);
              onPostpone();
            }}
            className="flex items-center justify-center gap-1.5 px-3 bg-amber-600 text-white font-medium text-sm min-w-[70px] active:opacity-80 outline-none border-0"
          >
            <Clock size={16} />
            +1h
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOffset(0);
              onDelete();
            }}
            className="flex items-center justify-center gap-1.5 px-4 bg-red-600 text-white font-medium text-sm min-w-[80px] active:opacity-80 outline-none border-0"
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>

      {/* Foreground (main content) - solid bg, border, overflow-hidden so no outline bleeds through */}
      <div
        className="relative z-10 bg-card border border-border rounded-xl transition-transform duration-150 ease-out shadow-sm overflow-hidden"
        style={{ transform: `translateX(-${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
