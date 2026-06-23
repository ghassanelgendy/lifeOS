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

// --- Push notifications (task reminders) ---

const NOTIFICATION_ACTIONS = [
  { action: 'done', title: 'Mark as done' },
  { action: 'postpone', title: 'Postpone 1 Hour' },
] as const;

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: {
    taskId?: string;
    habitId?: string;
    kind?: string;
    title?: string;
    body?: string;
    prayerName?: string;
    calendarEventId?: string;
    isCustom?: boolean;
    reportType?: 'weekly' | 'monthly';
  } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() || 'Task reminder' };
  }

  const taskId = payload.taskId ?? '';
  const habitId = payload.habitId ?? '';
  const reportType = payload.reportType ?? '';
  const isHabit = payload.kind === 'habit' || !!habitId;
  const isPrayer = !!payload.prayerName;
  const isCalendar = !!payload.calendarEventId;
  const isReport = !!reportType;
  const isCustom = !!payload.isCustom || isCalendar || isHabit || isReport;

  const notificationTitle = isPrayer 
    ? (payload.title ?? `Time to pray ${payload.prayerName}`) 
    : isReport
    ? (payload.title ?? `${reportType === 'monthly' ? 'Monthly' : 'Weekly'} Report Ready`)
    : isHabit
    ? (payload.title ?? 'Habit reminder')
    : isCustom 
    ? (payload.title ?? 'lifeOS') 
    : 'lifeOS';
    
  const body = isPrayer 
    ? (payload.body ?? '') 
    : isReport
    ? (payload.body ?? '')
    : isHabit
    ? (payload.body ?? '')
    : isCustom 
    ? (payload.body ?? '') 
    : `Ready to "${payload.title ?? 'Task'}"`;

  event.waitUntil(
    self.registration.showNotification(notificationTitle, {
      body: body || undefined,
      tag: isPrayer 
        ? `prayer-${payload.prayerName}-${Date.now()}` 
        : isCalendar 
        ? `calendar-${payload.calendarEventId}-${Date.now()}` 
        : isHabit
        ? `habit-${habitId}-${Date.now()}`
        : isReport
        ? `report-${reportType}-${Date.now()}`
        : (taskId || `task-${Date.now()}`),
      renotify: true,
      requireInteraction: false,
      data: {
        taskId,
        habitId,
        prayerName: payload.prayerName,
        calendarEventId: payload.calendarEventId,
        reportType,
        title: payload.title
      },
      actions: (isPrayer || isCalendar || isHabit || isReport) ? [] : [...NOTIFICATION_ACTIONS],
      icon: '/web-app-manifest-192x192.png',
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const { taskId, habitId, calendarEventId, prayerName, reportType } = event.notification.data ?? {};
  const action = event.action === 'done' ? 'done' : event.action === 'postpone' ? 'postpone' : '';

  const url = new URL(reportType ? '/analytics' : '/dashboard', self.location.origin);
  if (taskId) {
    url.searchParams.set('taskId', taskId);
    if (action) url.searchParams.set('notification', action);
  }
  if (habitId) {
    url.searchParams.set('habitId', habitId);
  }
  if (calendarEventId) {
    url.searchParams.set('calendarEventId', calendarEventId);
  }
  if (prayerName) {
    url.searchParams.set('prayerName', prayerName);
  }

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windowClients.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        (existing as WindowClient).navigate?.(url.toString());
      } else {
        await self.clients.openWindow(url.toString());
      }
    })()
  );
});
