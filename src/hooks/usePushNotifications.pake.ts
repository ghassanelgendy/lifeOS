import { useState, useEffect } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const enable = async () => {
    if (typeof Notification === 'undefined') return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    return perm === 'granted';
  };

  const disable = async () => {
    // Standard web does not allow revoking permission programmatically,
    // but we can update the state to default
    setPermission('default');
    return true;
  };

  const sendTestNotification = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification('Test Notification', {
        body: 'This is an offline test notification from lifeOS on desktop!',
      });
      n.onclick = () => {
        window.focus();
      };
    } else {
      console.warn('[PakeNotifications] Cannot send test notification: permission is', permission);
    }
    return true;
  };

  return {
    supported: typeof Notification !== 'undefined',
    vapidConfigured: true,
    permission,
    isEnabled: permission === 'granted',
    enable,
    disable,
    sendTestNotification,
    isEnabling: false,
    isDisabling: false,
    isSendingTest: false,
    error: null,
  };
}
