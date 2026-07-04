import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { Capacitor } from '@capacitor/core';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  Button as FluentButton,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  panelStyle?: React.CSSProperties;
  swipeToClose?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, panelStyle, swipeToClose = true }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  // ponytail: svh already excludes iOS keyboard — no JS tracking needed

  const platformUIOverride = useUIStore((s) => s.platformUIOverride) || 'auto';
  const isPake = import.meta.env.MODE === 'pake' && (platformUIOverride === 'pake' || platformUIOverride === 'auto');

  const isIOS = import.meta.env.MODE === 'ios' || (typeof window !== 'undefined' && Capacitor.getPlatform() === 'ios');

  useEffect(() => {
    if (!isOpen || isPake) return;
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
  }, [isOpen, isPake]);


  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen && !isPake) {
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
        const scrollRoot = document.querySelector('[data-lifeos-scroll-root]') as HTMLElement | null;
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

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, isPake]);

  if (!isOpen) return null;

  if (isPake) {
    const pakeDialog = (
      <Dialog open={isOpen} onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
        <DialogSurface style={{ maxWidth: '600px', width: '100%', padding: '16px' }} className="font-sans text-foreground bg-card border border-border shadow-2xl">
          <DialogBody>
            <DialogTitle
              action={
                <FluentButton
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                  onClick={onClose}
                />
              }
            >
              {title}
            </DialogTitle>
            <DialogContent style={{ padding: '12px 0 0 0' }}>
              {children}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
    return createPortal(pakeDialog, document.body);
  }

  return createPortal(
    <div
      ref={overlayRef}
      data-lifeos-modal
      className={cn(
        'fixed inset-0 z-[110] font-sans text-foreground transition-opacity duration-300',
        isIOS ? 'bg-black/35 backdrop-blur-md' : 'bg-black/50 backdrop-blur-sm',
        sheetVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{
        height: '100dvh',
        overscrollBehavior: 'contain',
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
      }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        ref={panelRef}
        className={cn(
          'absolute left-0 right-0 bottom-0 w-full max-w-lg mx-auto flex flex-col min-h-0 shadow-2xl modal-sheet-ios overflow-hidden',
          isIOS
            ? 'liquid-glass-card rounded-[24px] border-white/20 dark:border-white/10'
            : 'bg-card border border-border rounded-[24px]',
          className
        )}
        style={{
          maxHeight: '92dvh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: dragY > 0
            ? `translateY(${dragY}px)`
            : sheetVisible
              ? 'translateY(0)'
              : 'translateY(100%)',
          transition: dragY > 0 ? 'none' : 'transform 0.36s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
          ...panelStyle,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="shrink-0 sticky top-0 z-10"
          onTouchStart={(e) => {
            if (!swipeToClose || window.innerWidth >= 640) return;
            touchStartYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (!swipeToClose || window.innerWidth >= 640 || touchStartYRef.current == null) return;
            e.preventDefault(); // Ensure the swipe only affects the sheet when starting from the title.
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
          style={{ touchAction: 'none' }}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/40 sm:hidden" />
          <div className={cn(
            'flex items-center justify-between p-4',
            isIOS ? 'border-b border-black/5 dark:border-white/10 bg-transparent' : 'border-b border-border bg-card'
          )}>
            <h2 className="text-lg font-semibold truncate pr-8">{title}</h2>
            <button
              onClick={onClose}
              className={cn(
                'p-1 rounded-full transition-all touch-manipulation absolute right-3 top-3 active:scale-95',
                isIOS
                  ? 'text-muted-foreground hover:text-foreground hover:bg-white/10'
                  : 'hover:bg-secondary text-foreground'
              )}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div
          className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain overscroll-y-auto min-w-0"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            padding: '1rem',
            paddingBottom: 'calc(1rem + max(env(safe-area-inset-bottom), 0px))',
          }}
        >
          <div className="min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
