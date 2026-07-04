import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { Capacitor } from '@capacitor/core';
import {
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Button as FluentButton,
} from '@fluentui/react-components';
import { Dismiss24Regular, Checkmark24Regular } from '@fluentui/react-icons';

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

  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const confirmDisabledRef = useRef(confirmDisabled);
  confirmDisabledRef.current = confirmDisabled;

  const platformUIOverride = useUIStore((s) => s.platformUIOverride) || 'auto';
  const isPake = import.meta.env.MODE === 'pake' && (platformUIOverride === 'pake' || platformUIOverride === 'auto');

  const isIOS = import.meta.env.MODE === 'ios' || (typeof window !== 'undefined' && Capacitor.getPlatform() === 'ios');
  // ponytail: svh (small viewport height) already excludes the iOS keyboard — no JS tracking needed
  // Since Capacitor Keyboard.resize=none, we scroll the focused element into view ourselves
  useEffect(() => {
    if (!isIOS || !isOpen) return;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !contentRef.current?.contains(target)) return;
      // Small delay lets the keyboard animation start before scrolling
      setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [isIOS, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      } else if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const isTextarea = target?.tagName === 'TEXTAREA';
        if (!isTextarea && !confirmDisabledRef.current) {
          e.preventDefault();
          onConfirmRef.current();
        }
      }
    };

    if (isOpen) {
      setSheetVisible(false);
      document.addEventListener('keydown', handleKeyDown);

      if (!isPake) {
        // Lock the main content scroll so opening from deep in the list doesn't jump
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
      }

      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setSheetVisible(true));
      });

      return () => {
        cancelAnimationFrame(t);
        document.removeEventListener('keydown', handleKeyDown);
        if (!isPake) {
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
        }
      };
    }
    setSheetVisible(false);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPake]);

  const handleScroll = () => {
    const el = contentRef.current;
    setScrolled(!!el && el.scrollTop > 2);
  };

  // Reset content scroll when sheet opens
  useEffect(() => {
    if (isOpen && sheetVisible) {
      const t = requestAnimationFrame(() => {
        contentRef.current && (contentRef.current.scrollTop = 0);
      });
      return () => cancelAnimationFrame(t);
    }
  }, [isOpen, sheetVisible]);

  if (!isOpen) return null;

  if (isPake) {
    const pakeDrawer = (
      <OverlayDrawer
        position="end"
        open={isOpen}
        onOpenChange={(_, data) => { if (!data.open) onClose(); }}
        style={{ width: '450px', maxWidth: '100vw' }}
        className="font-sans text-foreground bg-card border-l border-border shadow-2xl"
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <FluentButton
                  appearance="primary"
                  aria-label="save"
                  icon={<Checkmark24Regular />}
                  onClick={onConfirm}
                  disabled={confirmDisabled}
                />
                <FluentButton
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                  onClick={onClose}
                />
              </div>
            }
          >
            {title}
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody style={{ padding: '16px 20px 60px 20px' }}>
          {children}
        </DrawerBody>
      </OverlayDrawer>
    );
    return createPortal(pakeDrawer, document.body);
  }

  const sheetContent = (
    <div
      ref={overlayRef}
      data-lifeos-details-sheet
      data-lifeos-modal
      className={cn(
        'fixed inset-0 z-[110] transition-opacity duration-300 font-sans text-foreground',
        isIOS ? 'bg-black/30 backdrop-blur-md' : 'bg-black/50 backdrop-blur-sm',
        sheetVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ overscrollBehavior: 'contain' }}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-sheet-title"
    >
      {/* Sheet panel: top pinned below status bar, bottom pinned to screen bottom */}
      <div
        className={cn(
          'absolute left-0 right-0 w-full max-w-lg mx-auto flex flex-col min-h-0',
          isIOS
            ? 'liquid-glass-card rounded-[24px] border-white/20 dark:border-white/10'
            : 'rounded-[24px] border border-border bg-card shadow-2xl'
        )}
        style={{
          // Pin to bottom; top bound ensures we never overlap the status bar
          bottom: 0,
          top: 'calc(env(safe-area-inset-top) + 8px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          willChange: 'transform',
          transform: dragY > 0
            ? `translateY(${dragY}px)`
            : sheetVisible
              ? 'translateY(0)'
              : 'translateY(100%)',
          transition: dragY > 0 ? 'none' : 'transform 0.36s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <header
          className={cn(
            'sticky top-0 z-10 flex items-center justify-between min-h-[56px] px-4 shrink-0',
            isIOS ? 'bg-transparent' : 'bg-card',
            stickyHeaderDivider && scrolled && (isIOS ? 'border-b border-black/5 dark:border-white/10' : 'border-b border-border')
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
            className={cn(
              "min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors touch-manipulation -ml-1 active:scale-95",
              isIOS ? "text-muted-foreground hover:text-foreground hover:bg-white/10" : "hover:bg-secondary text-foreground"
            )}
            aria-label="Close"
          >
            <X size={22} />
          </button>
          <h1 id="details-sheet-title" className="text-lg font-semibold text-foreground truncate absolute left-1/2 -translate-x-1/2 px-12">
            {title}
          </h1>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              "min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg disabled:opacity-50 disabled:pointer-events-none transition-colors touch-manipulation active:scale-95",
              isIOS
                ? "bg-white/10 hover:bg-white/20 text-primary border border-white/10"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
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
