import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
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

  const supported = isPushSupported();
  const vapidConfigured = isVapidConfigured();

  const { data: permission } = useQuery({
    queryKey: [...PUSH_KEY, 'permission'],
    queryFn: getNotificationPermission,
    initialData: () =>
      typeof Notification !== 'undefined' ? Notification.permission : ('denied' as NotificationPermission),
    staleTime: 60_000,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!supported || !vapidConfigured) throw new Error('Push not supported or VAPID not configured');
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') throw new Error('Notification permission denied');
      const sub = await subscribePush();
      if (!sub) throw new Error('Failed to subscribe');
      const { endpoint, p256dh, auth } = subscriptionToJson(sub);
      const { error } = await supabase.from('push_subscriptions').upsert(
        { endpoint, p256dh: p256dh, auth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        { onConflict: 'endpoint' }
      );
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData([...PUSH_KEY, 'permission'], 'granted');
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
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

  return {
    supported,
    vapidConfigured,
    permission: permission ?? 'default',
    isEnabled: permission === 'granted',
    enable: enableMutation.mutateAsync,
    disable: disableMutation.mutateAsync,
    isEnabling: enableMutation.isPending,
    isDisabling: disableMutation.isPending,
    error: enableMutation.error ?? disableMutation.error,
  };
}
