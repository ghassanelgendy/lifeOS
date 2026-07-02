import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  isPushSupported,
  isVapidConfigured,
  getNotificationPermission,
  requestNotificationPermission,
  subscribePush,
  subscriptionToJson,
} from '../lib/push';

const PUSH_KEY = ['push-notifications'];

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const isNative = Capacitor.isNativePlatform();

  const supported = isNative ? true : isPushSupported();
  const vapidConfigured = isNative ? true : isVapidConfigured();

  const { data: permission } = useQuery({
    queryKey: [...PUSH_KEY, 'permission'],
    queryFn: async () => {
      if (isNative) {
        const perm = await LocalNotifications.checkPermissions();
        return perm.display === 'granted' ? 'granted' : perm.display === 'denied' ? 'denied' : 'default';
      }
      return getNotificationPermission();
    },
    initialData: () => {
      if (isNative) return 'default' as NotificationPermission;
      return typeof Notification !== 'undefined' ? Notification.permission : ('denied' as NotificationPermission);
    },
    staleTime: 60_000,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (isNative) {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') throw new Error('Notification permission denied');
        return true;
      }

      if (!supported || !vapidConfigured) throw new Error('Push not supported or VAPID not configured');
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') throw new Error('Notification permission denied');
      const sub = await subscribePush();
      if (!sub) throw new Error('Failed to subscribe');
      const { endpoint, p256dh, auth } = subscriptionToJson(sub);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        endpoint,
        p256dh: p256dh,
        auth,
        timezone,
      };
      if (user?.id) payload.user_id = user.id;
      const { error } = await supabase.from('push_subscriptions').upsert(payload, {
        onConflict: 'endpoint',
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData([...PUSH_KEY, 'permission'], 'granted');
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (isNative) {
        // Cancel scheduled notifications
        await LocalNotifications.cancel({ notifications: [] });
        return true;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const json = sub.toJSON();
        if (json.endpoint) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', json.endpoint);
        }
      }
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData([...PUSH_KEY, 'permission'], 'default');
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      if (isNative) {
        // Trigger a test local notification instantly
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 9999,
              title: 'Test Notification',
              body: 'Native iOS local reminders are configured correctly!',
              schedule: { at: new Date(Date.now() + 1000) },
              sound: 'default'
            }
          ]
        });
        return true;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) throw new Error('No subscription found');

      const { endpoint } = sub.toJSON();
      if (!endpoint) throw new Error('Invalid subscription');

      const { error } = await supabase.functions.invoke('send-test-notification', {
        body: { endpoint },
      });

      if (error) throw error;
      return true;
    },
  });

  return {
    supported,
    vapidConfigured,
    permission: permission ?? 'default',
    isEnabled: permission === 'granted',
    enable: enableMutation.mutateAsync,
    disable: disableMutation.mutateAsync,
    sendTestNotification: testNotificationMutation.mutateAsync,
    isEnabling: enableMutation.isPending,
    isDisabling: disableMutation.isPending,
    isSendingTest: testNotificationMutation.isPending,
    error: enableMutation.error ?? disableMutation.error ?? testNotificationMutation.error,
  };
}
