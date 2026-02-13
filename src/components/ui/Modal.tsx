import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      // Save current scroll position
      scrollPositionRef.current = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      
      // Lock body scroll while maintaining scroll position
      document.addEventListener('keydown', handleEscape);
      const body = document.body;
      body.style.position = 'fixed';
      body.style.top = `-${scrollPositionRef.current}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      
      // Restore scroll position and unlock body
      const body = document.body;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      
      // Restore scroll position
      window.scrollTo(0, scrollPositionRef.current);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-ios",
        "min-h-[100dvh] sm:min-h-0",
        "pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0 sm:p-4 sm:bg-background/80"
      )}
      style={{ height: '100dvh' }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className={cn(
          "relative w-full max-w-lg bg-card border border-border shadow-2xl modal-sheet-ios",
          "rounded-t-2xl sm:rounded-xl",
          "flex flex-col border-b-0 sm:border-b border-border",
          "max-h-[calc(100dvh-64px-env(safe-area-inset-bottom)-0.5rem)] sm:max-h-[85vh]",
          "min-h-0",
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold truncate pr-8">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-secondary transition-colors touch-manipulation absolute right-3 top-3"
          >
            <X size={20} />
          </button>
        </div>
        <div
          className="p-4 overflow-y-auto overflow-x-hidden min-h-0 flex-1 overscroll-contain overscroll-y-auto min-w-0"
          style={{ 
            WebkitOverflowScrolling: 'touch', 
            paddingBottom: 'calc(1rem + max(env(safe-area-inset-bottom), 0px))',
            maxHeight: 'calc(100dvh - 64px - env(safe-area-inset-bottom) - 4rem)'
          }}
        >
          <div className="min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
