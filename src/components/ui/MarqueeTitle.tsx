import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface MarqueeTitleProps {
  title: string;
  className?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
}

export function MarqueeTitle({ title, className, dir = 'auto' }: MarqueeTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (container && textEl) {
      const overflow = textEl.scrollWidth > container.clientWidth;
      setIsOverflowing(overflow);
      if (overflow) {
        setScrollDistance(textEl.scrollWidth - container.clientWidth);
      }
    }
  }, [title]);

  const handleMouseEnter = () => {
    if (isOverflowing) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Duration scales dynamically with overflow distance (approx 35px per sec)
  const animDuration = Math.max(1.8, scrollDistance / 35);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseEnter}
      onTouchEnd={handleMouseLeave}
      className="relative overflow-hidden w-full select-none"
      title={title}
      dir={dir}
    >
      <div
        className={cn(
          'w-full transition-transform duration-700 ease-out',
          !isHovered && 'truncate'
        )}
        style={
          isHovered && isOverflowing
            ? {
                transform: `translateX(-${scrollDistance + 8}px)`,
                transitionDuration: `${animDuration}s`,
                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
              }
            : {
                transform: 'translateX(0px)',
                transitionDuration: '0.4s',
              }
        }
      >
        <span
          ref={textRef}
          className={cn('inline-block whitespace-nowrap', className)}
        >
          {title}
        </span>
      </div>
    </div>
  );
}
