import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  swipeToClose?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, swipeToClose = true }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const preferred = root.querySelector<HTMLElement>('[data-autofocus="true"], input[autofocus], textarea[autofocus]');
      const firstField = root.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      const target = preferred ?? firstField;
      target?.focus();
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.select?.();
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      // Save current scroll position BEFORE any changes
      scrollPositionRef.current = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      
      // Lock body and html scroll while maintaining scroll position
      document.addEventListener('keydown', handleEscape);
      
      const body = document.body;
      const html = document.documentElement;
      
      // Store original styles
      const originalBodyOverflow = body.style.overflow;
      const originalBodyPosition = body.style.position;
      const originalBodyTop = body.style.top;
      const originalBodyLeft = body.style.left;
      const originalBodyRight = body.style.right;
      const originalBodyWidth = body.style.width;
      const originalHtmlOverflow = html.style.overflow;
      
      // Lock scrolling - prevent scroll jump by fixing position
      const scrollY = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        
        // Restore original styles
        body.style.position = originalBodyPosition;
        body.style.top = originalBodyTop;
        body.style.left = originalBodyLeft;
        body.style.right = originalBodyRight;
        body.style.width = originalBodyWidth;
        body.style.overflow = originalBodyOverflow;
        html.style.overflow = originalHtmlOverflow;
        
        // Restore scroll position AFTER styles are restored
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPositionRef.current);
        });
      };
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      data-lifeos-modal
      className={cn(
        "fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-ios",
        "min-h-[100dvh] sm:min-h-0",
        "sm:p-4 sm:bg-background/80"
      )}
      style={{ 
        height: '100dvh',
        overscrollBehavior: 'contain'
      }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        ref={panelRef}
        className={cn(
          "relative w-full max-w-lg bg-card border border-border shadow-2xl modal-sheet-ios",
          "rounded-t-[24px] sm:rounded-2xl",
          "flex flex-col border-b-0 sm:border-b border-border",
          "max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem)] sm:max-h-[85vh]",
          "min-h-0",
          className
        )}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY > 0 ? 'none' : undefined,
          marginBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
        onTouchStart={(e) => {
          if (!swipeToClose || window.innerWidth >= 640) return;
          touchStartYRef.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (!swipeToClose || window.innerWidth >= 640 || touchStartYRef.current == null) return;
          const delta = e.touches[0].clientY - touchStartYRef.current;
          setDragY(Math.max(0, delta));
        }}
        onTouchEnd={() => {
          if (!swipeToClose || window.innerWidth >= 640) return;
          const shouldClose = dragY > 90;
          setDragY(0);
          touchStartYRef.current = null;
          if (shouldClose) onClose();
        }}
        onTouchCancel={() => {
          setDragY(0);
          touchStartYRef.current = null;
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/40 sm:hidden" />
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
            touchAction: 'pan-y'
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
