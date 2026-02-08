import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PullToRefreshProps {
    children: React.ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
    const queryClient = useQueryClient();
    const [startY, setStartY] = useState<number | null>(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const THRESHOLD = 80; // Pixels to pull to trigger refresh
    const MAX_PULL = 120; // Max visual pull distance

    useEffect(() => {
        // Add non-passive touch listeners to handle prevention of default scroll
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e: TouchEvent) => {
            // Only enable pull if at the top of the container
            if (container.scrollTop <= 0) {
                setStartY(e.touches[0].clientY);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (startY === null) return;
            if (isRefreshing) return;

            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            // Only handle downward pull and if we are at the top
            if (diff > 0 && container.scrollTop <= 0) {
                // Prevent document/body overscroll so the LifeOS header doesn't get dragged (iOS)
                if (e.cancelable) {
                    e.preventDefault();
                }

                const resistance = diff * 0.5;
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
    }, [startY, pullDistance, isRefreshing]);

    const refresh = async () => {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD); // Snap to threshold

        try {
            // Haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(50);

            // Invalidate all queries
            await queryClient.invalidateQueries();
            // Artificial delay to show the spinner
            await new Promise(resolve => setTimeout(resolve, 800));
        } finally {
            setIsRefreshing(false);
            setPullDistance(0);
        }
    };

    return (
        <div
            ref={containerRef}
            className="h-full min-h-0 overflow-auto relative no-scrollbar overscroll-contain"
        >
            {/* Refresh indicator in fixed top area - content does NOT move */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-50 h-12"
                style={{ transform: `translateY(${Math.min(pullDistance, 48) - 48}px)` }}
            >
                <div className={cn(
                    "bg-card border border-border rounded-full p-2 shadow-sm flex items-center justify-center transition-opacity",
                    pullDistance > 10 ? "opacity-100" : "opacity-0"
                )}>
                    <Loader2
                        size={20}
                        className={cn("text-primary", isRefreshing && "animate-spin")}
                        style={{ transform: `rotate(${pullDistance * 2}deg)` }}
                    />
                </div>
            </div>

            {/* Content stays fixed - no translate so title doesn't move */}
            <div className="relative">
                {children}
            </div>
        </div>
    );
}
