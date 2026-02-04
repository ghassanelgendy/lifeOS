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
                // Prevent default only if we are actually pulling to refresh
                // This stops the browser's native overscroll/refresh behavior if desired
                // but here we might want to allow normal scroll if not committed to pull
                if (e.cancelable && diff < MAX_PULL) {
                    // e.preventDefault(); // Optional: depending on if we want to block native scroll completely
                }

                // Logarithmic resistance
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
            className="h-full overflow-y-auto relative no-scrollbar"
            style={{ touchAction: 'pan-y' }}
        >
            {/* Refresh Indicator */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-transform duration-200 ease-out z-50"
                style={{
                    transform: `translateY(${pullDistance - 40}px)`,
                    height: '40px'
                }}
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

            {/* Content */}
            <div
                style={{
                    transform: `translateY(${isRefreshing ? 40 : pullDistance}px)`,
                    transition: isRefreshing ? 'transform 0.2s ease-out' : 'transform 0s'
                }}
            >
                {children}
            </div>
        </div>
    );
}
