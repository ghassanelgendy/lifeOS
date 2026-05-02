import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface ConfirmSheetProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmSheet({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    if (isOpen) {
      setSheetVisible(false);
      document.addEventListener('keydown', handleEscape);

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
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const sheetContent = (
    <div
      ref={overlayRef}
      data-lifeos-modal
      data-lifeos-confirm-sheet
      className={cn(
        'fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm transition-opacity duration-300 font-sans text-foreground',
        sheetVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ height: '100dvh', overscrollBehavior: 'contain' }}
      onClick={(e) => e.target === overlayRef.current && !isLoading && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sheet-title"
    >
      <div
        className={cn(
          'absolute left-0 right-0 bottom-0 w-full max-w-lg mx-auto bg-card shadow-2xl flex flex-col min-h-0',
          'rounded-[24px] border border-border overflow-hidden'
        )}
        style={{
          maxHeight: '92dvh',
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
        <header
          className="sticky top-0 z-10 flex items-center justify-between min-h-[56px] px-4 shrink-0 bg-card border-b border-border"
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
            if (shouldClose && !isLoading) onCancel();
          }}
          onTouchCancel={() => {
            setDragY(0);
            touchStartYRef.current = null;
          }}
          style={{ touchAction: 'none' }}
        >
          <button
            type="button"
            onClick={() => !isLoading && onCancel()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-secondary transition-colors touch-manipulation -ml-1"
            aria-label="Close"
          >
            <X size={22} className="text-foreground" />
          </button>
          <h2 id="confirm-sheet-title" className="text-lg font-semibold text-foreground truncate absolute left-1/2 -translate-x-1/2 px-12">
            {title}
          </h2>
          <div className="min-w-[44px]" />
        </header>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={isLoading}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(sheetContent, document.body);
}
