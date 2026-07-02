import { useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function useNativeInteraction() {
  const isNative = Capacitor.isNativePlatform();

  // Trigger light haptic tap for cards, buttons, checkboxes
  const triggerLightTap = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      console.warn('Light haptic tap skipped:', e);
    }
  }, [isNative]);

  // Trigger selection change haptic for switching navigation tabs
  const triggerSelectionChange = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
    } catch (e) {
      console.warn('Selection haptic skipped:', e);
    }
  }, [isNative]);

  // Trigger success notification haptic
  const triggerSuccessTap = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e2) {
        console.warn('Success haptic skipped:', e2);
      }
    }
  }, [isNative]);

  // Maps click and touch events onto haptics
  const pressProps = useCallback(
    (onClickAction?: (e: React.MouseEvent) => void, mode: 'tap' | 'select' | 'success' = 'tap') => {
      return {
        onTouchStart: () => {
          if (mode === 'tap') void triggerLightTap();
          if (mode === 'select') void triggerSelectionChange();
        },
        onClick: (e: React.MouseEvent) => {
          if (mode === 'success') void triggerSuccessTap();
          if (onClickAction) onClickAction(e);
        }
      };
    },
    [triggerLightTap, triggerSelectionChange, triggerSuccessTap]
  );

  return {
    triggerLightTap,
    triggerSelectionChange,
    triggerSuccessTap,
    pressProps
  };
}
