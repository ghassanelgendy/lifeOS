import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useNativeInteraction } from '../hooks/useNativeInteraction';

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
  isVisible?: boolean;
}

export default function LiquidTabBar({
  tabs,
  activeTabHref,
  onTabClick,
  showDotForHref,
  isVisible = true,
}: LiquidTabBarProps) {
  const { triggerSelectionChange } = useNativeInteraction();

  const handleTabClick = (tabHref: string, e: React.MouseEvent) => {
    // Trigger lightweight iOS selection haptic when switching tabs
    const isActive = tabHref === '/'
      ? activeTabHref === '/'
      : activeTabHref === tabHref || activeTabHref.startsWith(tabHref + '/');
    if (!isActive) {
      void triggerSelectionChange();
    }
    onTabClick(tabHref, e);
  };

  return (
    <>
      {/* Component Styles Injector */}
      <style>{`
        .liquid-tab-bar-container {
          position: fixed;
          bottom: calc(16px + env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%) translateY(0) scale(1);
          width: 92%;
          max-width: 440px;
          height: 68px;
          border-radius: 34px;
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
          transition: transform 0.4s cubic-bezier(0.25, 1, 0.3, 1), opacity 0.35s ease, background-color 0.2s ease;
          will-change: transform, opacity;
        }

        .liquid-tab-bar-container.shrunk {
          transform: translateX(-50%) translateY(calc(12px + env(safe-area-inset-bottom) * 0.3)) scale(0.75);
          opacity: 0.55;
          backdrop-filter: blur(15px) saturate(160%);
          -webkit-backdrop-filter: blur(15px) saturate(160%);
        }

        .dark .liquid-tab-bar-container {
          background: rgba(20, 20, 22, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0px rgba(255, 255, 255, 0.08);
        }

        .active-indicator {
          position: absolute;
          inset: 6px 4px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.75);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          z-index: 1;
        }

        .dark .active-indicator {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
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
          transition: color 0.2s ease;
        }

        .tab-item-btn.active {
          color: var(--color-primary);
        }

        .tab-item-btn .icon-wrapper {
          font-size: 22px;
          display: inline-block;
          position: relative;
          z-index: 3;
        }
      `}</style>

      {/* Layout Shell Render */}
      <nav className={cn("liquid-tab-bar-container", !isVisible && "shrunk")}>
        {tabs.map((tab) => {
          const isActive = tab.href === '/'
            ? activeTabHref === '/'
            : activeTabHref === tab.href || activeTabHref.startsWith(tab.href + '/');
          const Icon = tab.icon;
          const showDot = showDotForHref?.(tab.href);

          return (
            <button
              key={tab.href}
              className={cn("tab-item-btn", isActive && "active")}
              onClick={(e) => handleTabClick(tab.href, e)}
              type="button"
            >
              {/* Framer Motion Liquid Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="active-indicator-pill"
                  className="active-indicator"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                    mass: 0.8
                  }}
                />
              )}

              <motion.div 
                className="icon-wrapper"
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              >
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                {showDot && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </motion.div>
            </button>
          );
        })}
      </nav>
    </>
  );
}
