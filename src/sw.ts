/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision?: string }> };

// Take control and activate immediately
self.skipWaiting();
clientsClaim();

// Precaching (manifest injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Background sync stub: when supported, we can register a sync from the app
// and react here. For now, we just listen for a named sync event and nudge
// clients to run their own processOfflineQueue (so logic stays in app bundle).
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag !== 'lifeos-sync-offline-queue') return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'LIFEOS_SYNC_OFFLINE_QUEUE' });
      }
    })()
  );
});

// --- Push notifications (task reminders) ---

const NOTIFICATION_ACTIONS = [
  { action: 'done', title: 'Mark as done' },
  { action: 'postpone', title: 'Postpone 1 Hour' },
] as const;

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: { taskId?: string; title?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() || 'Task reminder' };
  }

  const taskId = payload.taskId ?? '';
  const title = payload.title ?? 'Task';
  const notificationTitle = 'lifeOS';
  const body = `Ready to "${title}"`;

  event.waitUntil(
    self.registration.showNotification(notificationTitle, {
      body,
      tag: taskId || `task-${Date.now()}`,
      renotify: true,
      requireInteraction: false,
      data: { taskId, title: payload.title },
      actions: [...NOTIFICATION_ACTIONS],
      icon: '/web-app-manifest-192x192.png',
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const { taskId } = event.notification.data ?? {};
  const action = event.action === 'done' ? 'done' : event.action === 'postpone' ? 'postpone' : '';

  const url = new URL('/tasks', self.location.origin);
  if (taskId) {
    url.searchParams.set('taskId', taskId);
    if (action) url.searchParams.set('notification', action);
  }

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appUrl = self.location.origin + '/';
      const existing = windowClients.find((c) => c.url === appUrl || c.url.startsWith(self.location.origin + '/tasks'));
      if (existing) {
        await existing.focus();
        (existing as WindowClient).navigate?.(url.toString());
      } else {
        await self.clients.openWindow(url.toString());
      }
    })()
  );
});
