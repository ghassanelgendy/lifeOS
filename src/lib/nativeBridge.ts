import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App } from '@capacitor/app';

// Trigger device haptics
export async function triggerHaptics(style: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'medium') {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (style === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (style === 'error') {
      await Haptics.notification({ type: NotificationType.Error });
    } else {
      const impactStyle = style === 'light' ? ImpactStyle.Light : style === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Medium;
      await Haptics.impact({ style: impactStyle });
    }
  } catch (e) {
    console.error('Haptics failed', e);
  }
}

// Deep Linking Handler Setup
export function setupDeepLinkListener(onDeepLink: (url: string) => void) {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener('appUrlOpen', (event) => {
    onDeepLink(event.url);
  });
}
