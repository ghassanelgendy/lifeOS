/**
 * Web Push subscription helpers for task reminders.
 * Requires VITE_VAPID_PUBLIC_KEY in .env (base64-encoded public key).
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Url);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isVapidConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 0);
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export async function subscribePush(): Promise<PushSubscription | null> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return null;

  const reg = await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key as unknown as BufferSource,
  });
  return sub;
}

export function subscriptionToJson(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} {
  const json = sub.toJSON();
  const key = sub.getKey('p256dh');
  const auth = sub.getKey('auth');
  return {
    endpoint: json.endpoint!,
    p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
    auth: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
  };
}
