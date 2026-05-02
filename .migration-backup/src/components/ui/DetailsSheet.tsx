import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  children: React.ReactNode;
  confirmDisabled?: boolean;
  /** Optional: show divider under header when content has scrolled */
  stickyHeaderDivider?: boolean;
}

export function DetailsSheet({
  isOpen,
  onClose,
  onConfirm,
  title = 'Details',
  children,
  confirmDisabled = false,
  stickyHeaderDivider = true,
}: DetailsSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [dragY, setDragY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    if (isOpen) {
      setSheetVisible(false);
      document.addEventListener('keydown', handleEscape);

      // Lock the main content scroll (PullToRefresh container) so opening from deep in the list doesn't jump
      const scrollRoot = document.querySelector('[data-lifeos-scroll-root]') as HTMLElement | null;
      if (scrollRoot) {
        scrollPositionRef.current = scrollRoot.scrollTop;
        scrollRoot.style.overflow = 'hidden';
      } else {
        scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
        const body = document.body;
        const html = document.documentElement;
        body.style.overflow = 'hidden';
        html.style.overflow = 'hidden';
      }

      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setSheetVisible(true));
      });

      return () => {
        cancelAnimationFrame(t);
        document.removeEventListener('keydown', handleEscape);
        if (scrollRoot) {
          scrollRoot.style.overflow = '';
          scrollRoot.scrollTop = scrollPositionRef.current;
        } else {
          const body = document.body;
          const html = document.documentElement;
          body.style.overflow = '';
          html.style.overflow = '';
          requestAnimationFrame(() => window.scrollTo(0, scrollPositionRef.current));
        }
      };
    }
    setSheetVisible(false);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleScroll = () => {
    const el = contentRef.current;
    setScrolled(!!el && el.scrollTop > 2);
  };

  // Reset content scroll when sheet opens so header and top content are visible
  useEffect(() => {
    if (isOpen && sheetVisible) {
      const t = requestAnimationFrame(() => {
        contentRef.current && (contentRef.current.scrollTop = 0);
      });
      return () => cancelAnimationFrame(t);
    }
  }, [isOpen, sheetVisible]);

  if (!isOpen) return null;

  const sheetContent = (
    <div
      ref={overlayRef}
      data-lifeos-details-sheet
      data-lifeos-modal
      className={cn(
        'fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm transition-opacity duration-300 font-sans text-foreground',
        sheetVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ height: '100dvh', overscrollBehavior: 'contain' }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-sheet-title"
    >
      {/* Sheet anchored to bottom of viewport — same position whether opened from top or deep in list */}
      <div
        className={cn(
          'absolute left-0 right-0 bottom-0 w-full max-w-lg mx-auto bg-card shadow-2xl flex flex-col min-h-0',
          'rounded-[24px] border border-border overflow-hidden',
        )}
        style={{
          height: '92dvh',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: dragY > 0
            ? `translateY(${dragY}px)`
            : sheetVisible
              ? 'translateY(0)'
              : 'translateY(100%)',
          transition: dragY > 0
            ? 'none'
            : 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header: close (left), title (center), confirm (right) */}
        <header
          className={cn(
            'sticky top-0 z-10 flex items-center justify-between min-h-[56px] px-4 shrink-0 bg-card',
            stickyHeaderDivider && scrolled && 'border-b border-border'
          )}
          onTouchStart={(e) => {
            if (window.innerWidth >= 640) return;
            touchStartYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (window.innerWidth >= 640) return;
            if (touchStartYRef.current == null) return;
            e.preventDefault();
            const delta = e.touches[0].clientY - touchStartYRef.current;
            setDragY(Math.max(0, delta));
          }}
          onTouchEnd={() => {
            if (window.innerWidth >= 640) return;
            const shouldClose = dragY > 90;
            setDragY(0);
            touchStartYRef.current = null;
            if (shouldClose) onClose();
          }}
          onTouchCancel={() => {
            setDragY(0);
            touchStartYRef.current = null;
          }}
          style={{ touchAction: 'none' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-secondary transition-colors touch-manipulation -ml-1"
            aria-label="Close"
          >
            <X size={22} className="text-foreground" />
          </button>
          <h1 id="details-sheet-title" className="text-lg font-semibold text-foreground truncate absolute left-1/2 -translate-x-1/2 px-12">
            {title}
          </h1>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors touch-manipulation"
            aria-label="Save"
          >
            <Check size={22} />
          </button>
        </header>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 min-w-0"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="px-4 pt-2 pb-8 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );

  return createPortal(sheetContent, document.body);
}
