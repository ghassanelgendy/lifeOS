import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  getCurrentPushSubscription,
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

  const { data: isEnabled = false } = useQuery({
    queryKey: [...PUSH_KEY, 'subscription'],
    queryFn: async () => {
      if (!supported) return false;
      try {
        const sub = await getCurrentPushSubscription();
        return Boolean(sub);
      } catch {
        return false;
      }
    },
    initialData: false,
    staleTime: 15_000,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!supported || !vapidConfigured) throw new Error('Push not supported or VAPID not configured');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sign in required to enable notifications');
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') throw new Error('Notification permission denied');
      const sub = await subscribePush();
      if (!sub) throw new Error('Failed to subscribe');
      const { endpoint, p256dh, auth } = subscriptionToJson(sub);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payload: Record<string, unknown> = {
        endpoint,
        p256dh: p256dh,
        auth,
        timezone,
        user_id: user.id,
      };
      const { error } = await supabase.from('push_subscriptions').upsert(payload, {
        onConflict: 'endpoint',
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData([...PUSH_KEY, 'permission'], 'granted');
      queryClient.setQueryData([...PUSH_KEY, 'subscription'], true);
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const sub = await getCurrentPushSubscription();
      if (sub) {
        const { endpoint } = subscriptionToJson(sub);
        await sub.unsubscribe();
        if (endpoint) {
          const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
          if (error) throw error;
        }
      }
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData([...PUSH_KEY, 'subscription'], false);
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sign in required to send a test notification');
      const sub = await getCurrentPushSubscription();
      if (!sub) throw new Error('No notification subscription found. Enable notifications, then reload once and try again.');

      const { endpoint } = sub.toJSON();
      if (!endpoint) throw new Error('Invalid subscription');

      const { error } = await supabase.functions.invoke('send-test-notification', { body: { endpoint } });

      if (error) throw error;
      return true;
    },
  });

  return {
    supported,
    vapidConfigured,
    permission: permission ?? 'default',
    isEnabled,
    enable: enableMutation.mutateAsync,
    disable: disableMutation.mutateAsync,
    sendTestNotification: testNotificationMutation.mutateAsync,
    isEnabling: enableMutation.isPending,
    isDisabling: disableMutation.isPending,
    isSendingTest: testNotificationMutation.isPending,
    error: enableMutation.error ?? disableMutation.error ?? testNotificationMutation.error,
  };
}
