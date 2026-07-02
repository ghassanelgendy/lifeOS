import { useState, useEffect, useRef } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { cn } from '../lib/utils';

export interface LiquidTab {
  href: string;
  label: string;
  icon: any; // LucideIcon component
}

interface LiquidTabBarProps {
  tabs: LiquidTab[];
  activeTabHref: string;
  onTabClick: (href: string, e: React.MouseEvent) => void;
  showDotForHref?: (href: string) => boolean;
}

export default function LiquidTabBar({
  tabs,
  activeTabHref,
  onTabClick,
  showDotForHref,
}: LiquidTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyles, setIndicatorStyles] = useState({ left: '6px', width: '0px' });

  // 1. Unified Haptic Feedback Engine
  const triggerHaptic = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      console.log('Haptic skipped:', e);
    }
  };

  // 2. Geometric Calculation Engine
  const updateIndicatorPosition = () => {
    const activeIndex = tabs.findIndex(
      (tab) =>
        tab.href === '/'
          ? activeTabHref === '/'
          : activeTabHref === tab.href || activeTabHref.startsWith(tab.href + '/')
    );
    
    if (activeIndex >= 0) {
      const activeTabElement = tabRefs.current[activeIndex];
      if (activeTabElement && containerRef.current) {
        const elementWidth = activeTabElement.offsetWidth;
        const targetLeftPosition = activeTabElement.offsetLeft + 2;
        const targetWidth = elementWidth - 4;

        setIndicatorStyles({
          left: `${targetLeftPosition}px`,
          width: `${targetWidth}px`,
        });
      }
    }
  };

  // 3. Keep layout synchronized during tab changes or layout updates
  useEffect(() => {
    updateIndicatorPosition();
  }, [activeTabHref, tabs]);

  // 4. Window and Viewport Resize Adaptive Protection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      updateIndicatorPosition();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [activeTabHref, tabs]);

  const handleTabClick = (tabHref: string, e: React.MouseEvent) => {
    void triggerHaptic();
    onTabClick(tabHref, e);
  };

  return (
    <>
      {/* 5. Component Styles Injector */}
      <style>{`
        .liquid-tab-bar-container {
          position: fixed;
          bottom: calc(16px + env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          width: 92%;
          max-width: 440px;
          height: 64px;
          border-radius: 32px;
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(25px) saturate(200%);
          -webkit-backdrop-filter: blur(25px) saturate(200%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 10px 35px rgba(0, 0, 0, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          padding: 0 6px;
          z-index: 49;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .dark .liquid-tab-bar-container {
          background: rgba(20, 20, 22, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0px rgba(255, 255, 255, 0.08);
        }

        .active-indicator {
          position: absolute;
          height: 52px;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.75);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          z-index: 1;
          transition: all 0.35s cubic-bezier(0.25, 1, 0.33, 1);
        }

        .dark .active-indicator {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }

        .liquid-tab-bar-container:active .active-indicator {
          transform: scaleX(0.97);
        }

        .tab-item-btn {
          flex: 1;
          height: 100%;
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 2;
          cursor: pointer;
          color: #8e8e93;
          transition: color 0.2s ease, transform 0.1s ease;
        }

        .tab-item-btn:active {
          transform: scale(0.95);
        }

        .tab-item-btn.active {
          color: var(--color-primary);
        }

        .tab-item-btn .icon-wrapper {
          font-size: 22px;
          display: inline-block;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
        }

        .tab-item-btn.active .icon-wrapper {
          transform: scale(1.15);
        }
      `}</style>

      {/* 6. Layout Shell Render */}
      <nav className="liquid-tab-bar-container" ref={containerRef}>
        <div 
          className="active-indicator" 
          style={{ left: indicatorStyles.left, width: indicatorStyles.width }}
        />
        
        {tabs.map((tab, idx) => {
          const isActive = tab.href === '/'
            ? activeTabHref === '/'
            : activeTabHref === tab.href || activeTabHref.startsWith(tab.href + '/');
          const Icon = tab.icon;
          const showDot = showDotForHref?.(tab.href);

          return (
            <button
              key={tab.href}
              ref={(el) => { tabRefs.current[idx] = el; }}
              className={cn("tab-item-btn", isActive && "active")}
              onClick={(e) => handleTabClick(tab.href, e)}
              type="button"
            >
              <div className="icon-wrapper">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                {showDot && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>
    </>
  );
}
