/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision?: string }> };

// Take control and activate immediately
self.skipWaiting();
clientsClaim();

// Precaching (manifest injected by vite-plugin-pwa)
// Store manifest in variable - Workbox injectManifest expects exactly ONE occurrence of self.__WB_MANIFEST
const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);
cleanupOutdatedCaches();

// App-shell style navigation: serve cached index.html for all navigations, so the SPA loads offline.
// Exclude API routes so they can still go to network when online.
// In dev, the manifest may be empty and '/index.html' won't be precached, which would make
// createHandlerBoundToURL throw. Guard on presence of index.html before registering.
const hasIndexHtml = manifest.some(
  (entry) => entry.url === 'index.html' || entry.url === '/index.html'
);

if (hasIndexHtml) {
  const appShellHandler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(appShellHandler, {
    denylist: [/^\/api\//],
  });
  registerRoute(navigationRoute);
}

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

// --- Push notifications ---

const NOTIFICATION_ACTIONS = [
  { action: 'done', title: 'Mark as done' },
  { action: 'postpone', title: 'Postpone 1 Hour' },
] as const;

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: {
    kind?: 'task' | 'habit' | 'prayer';
    route?: string;
    taskId?: string;
    habitId?: string;
    title?: string;
    body?: string;
    prayerName?: string;
  } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() || 'Task reminder' };
  }

  const taskId = payload.taskId ?? '';
  const habitId = payload.habitId ?? '';
  const kind = payload.kind ?? (payload.prayerName ? 'prayer' : habitId ? 'habit' : 'task');
  const isPrayer = kind === 'prayer';
  const isHabit = kind === 'habit';

  const notificationTitle = isPrayer
    ? (payload.title ?? `Time to pray ${payload.prayerName}`)
    : 'lifeOS';
  const body = isPrayer
    ? (payload.body ?? '')
    : isHabit
      ? (payload.body ?? `Time for "${payload.title ?? 'Habit'}"`)
      : `Ready to "${payload.title ?? 'Task'}"`;

  event.waitUntil(
    self.registration.showNotification(notificationTitle, {
      body: body || undefined,
      tag: isPrayer
        ? `prayer-${payload.prayerName}-${Date.now()}`
        : isHabit
          ? (habitId || `habit-${Date.now()}`)
          : (taskId || `task-${Date.now()}`),
      renotify: true,
      requireInteraction: false,
      data: {
        kind,
        route: payload.route,
        taskId,
        habitId,
        title: payload.title,
        prayerName: payload.prayerName,
      },
      actions: isPrayer || isHabit ? [] : [...NOTIFICATION_ACTIONS],
      icon: '/web-app-manifest-192x192.png',
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const { taskId, habitId, prayerName, kind, route } = event.notification.data ?? {};
  const action = event.action === 'done' ? 'done' : event.action === 'postpone' ? 'postpone' : '';

  const targetPath = typeof route === 'string' && route
    ? route
    : kind === 'habit' || habitId || kind === 'prayer' || prayerName
      ? '/habits'
      : '/tasks';
  const url = new URL(targetPath, self.location.origin);
  if (taskId) {
    url.searchParams.set('taskId', taskId);
    if (action) url.searchParams.set('notification', action);
  }
  if (habitId) url.searchParams.set('habitId', habitId);
  if (prayerName) url.searchParams.set('prayer', prayerName);

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windowClients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        (existing as WindowClient).navigate?.(url.toString());
      } else {
        await self.clients.openWindow(url.toString());
      }
    })()
  );
});
