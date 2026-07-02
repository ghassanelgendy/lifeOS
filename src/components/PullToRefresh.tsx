import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface PullToRefreshProps {
    children: React.ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
    const location = useLocation();
    const queryClient = useQueryClient();
    const isTasks = location.pathname === '/tasks';
    const [startY, setStartY] = useState<number | null>(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const THRESHOLD = 65; // Pixels to pull to trigger refresh
    const MAX_PULL = 90; // Max visual pull distance

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);

        try {
            // Trigger native iOS light haptic mechanical feedback
            if (Capacitor.isNativePlatform()) {
                void Haptics.impact({ style: ImpactStyle.Light });
            } else if (navigator.vibrate) {
                navigator.vibrate(40);
            }

            // Invalidate all queries
            await queryClient.invalidateQueries();
            // Artificial delay to show the spinner
            await new Promise(resolve => setTimeout(resolve, 800));
        } finally {
            setIsRefreshing(false);
            setPullDistance(0);
        }
    }, [queryClient, THRESHOLD]);

    useEffect(() => {
        // Add non-passive touch listeners to handle prevention of default scroll
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e: TouchEvent) => {
            const target = e.target as Node;
            if (target && document.body.contains(target) && (target as Element).closest?.('[data-lifeos-modal]')) {
                return;
            }
            if (container.scrollTop <= 0) {
                setStartY(e.touches[0].clientY);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (startY === null) return;
            if (isRefreshing) return;

            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0 && container.scrollTop <= 0) {
                if (e.cancelable) {
                    e.preventDefault();
                }

                // Physics rubber-banding: logarithmic-like power curve
                const resistance = Math.pow(diff, 0.8) * 1.6;
                setPullDistance(Math.min(resistance, MAX_PULL));
            }
        };

        const handleTouchEnd = () => {
            if (pullDistance > THRESHOLD) {
                refresh();
            } else {
                setPullDistance(0);
            }
            setStartY(null);
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [startY, pullDistance, isRefreshing, refresh]);

    // Calculate scale and rotation based on pull distance
    const pullRatio = Math.min(pullDistance / THRESHOLD, 1);

    return (
        <div
            ref={containerRef}
            data-lifeos-scroll-root
            className="h-full min-h-0 overflow-auto relative no-scrollbar overscroll-contain"
        >
            {/* Playful Floating Spinner Container */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-50"
                style={{ 
                    height: '52px',
                    opacity: pullRatio,
                    transform: `translateY(${Math.min(pullDistance - 44, 4)}px) scale(${0.4 + pullRatio * 0.6})`,
                    transition: startY === null ? 'all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
                }}
            >
                <Loader2
                    size={22}
                    className={cn(isRefreshing && "animate-spin")}
                    style={{ 
                        color: 'var(--color-primary)',
                        transform: isRefreshing ? undefined : `rotate(${pullDistance * 4.5}deg)`,
                        transition: isRefreshing ? 'none' : 'transform 0.1s ease-out'
                    }}
                />
            </div>

            {/* Elastic content container that slides down and springs back */}
            <div 
                className={cn("relative origin-top will-change-transform", isTasks ? "h-full" : "min-h-full")}
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: startY === null ? 'transform 0.45s cubic-bezier(0.25, 1, 0.3, 1.18)' : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
}
