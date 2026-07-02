import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { Badge } from '@capawesome/capacitor-badge';
import { LocalNotifications } from '@capacitor/local-notifications';

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

// Share content using iOS Native Share Sheet
export async function shareContent(title: string, text: string, url?: string) {
  if (!Capacitor.isNativePlatform()) {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      alert("Sharing is not supported on this browser.");
    }
    return;
  }
  try {
    await Share.share({ title, text, url, dialogTitle: title });
  } catch (e) {
    console.error('Share failed', e);
  }
}

// Sync native status bar color with app theme
export async function syncStatusBar(theme: 'light' | 'dark') {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({
      style: theme === 'dark' ? Style.Dark : Style.Light,
    });
  } catch (e) {
    console.error('Status bar sync failed', e);
  }
}

// Global initialization for premium iOS native experience
export async function initializeNativeApp() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // 1. Hide Keyboard Accessory Bar (prevents the gray 'prev/next/done' bar)
    await Keyboard.setAccessoryBarVisible({ visible: false });

    // 2. Clear application badge and ask for permissions
    const permissions = await Badge.checkPermissions();
    if (permissions.display !== 'granted') {
      await Badge.requestPermissions();
    }
    await Badge.clear();

    // 3. Hide splash screen after app is fully loaded
    await SplashScreen.hide();
  } catch (e) {
    console.error('Native initialization failed', e);
  }
}

// Helper to convert string UUIDs/keys to unique numbers for notification IDs
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash | 0);
}

// Automatically sync all upcoming task reminders to iOS Local Notifications
export async function syncLocalNotifications(tasks: any[]) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const hasPermission = await LocalNotifications.checkPermissions();
    if (hasPermission.display !== 'granted') {
      return;
    }

    // 1. Get all pending (already scheduled) notifications
    const pending = await LocalNotifications.getPending();
    const pendingIds = new Set(pending.notifications.map((n) => n.id));

    // 2. Filter tasks that need a notification scheduled
    const now = Date.now();
    const tasksWithReminders = tasks.filter((task) => {
      if (task.is_completed || task.is_wont_do) return false;
      if (!task.due_date) return false;
      
      const datePart = task.due_date.split('T')[0];
      const timePart = task.due_time && /^\d{2}:\d{2}$/.test(task.due_time) ? `${task.due_time}:00` : '00:00:00';
      const triggerTime = new Date(`${datePart}T${timePart}`).getTime();

      return triggerTime > now;
    });

    // iOS limits local notifications to 64, so sort and schedule the top 60
    const upcomingTasks = tasksWithReminders
      .map((task) => {
        const datePart = task.due_date.split('T')[0];
        const timePart = task.due_time && /^\d{2}:\d{2}$/.test(task.due_time) ? `${task.due_time}:00` : '00:00:00';
        const triggerAt = new Date(`${datePart}T${timePart}`);
        return {
          id: hashCode(task.id),
          title: 'Task Reminder',
          body: task.title,
          at: triggerAt,
          taskId: task.id
        };
      })
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 60);

    const upcomingIds = new Set(upcomingTasks.map((t) => t.id));

    // 3. Cancel notifications that are no longer in our upcoming list
    const cancelIds = pending.notifications
      .filter((n) => !upcomingIds.has(n.id))
      .map((n) => ({ id: n.id }));

    if (cancelIds.length > 0) {
      await LocalNotifications.cancel({ notifications: cancelIds });
    }

    // 4. Schedule new notifications that are not yet pending
    const scheduleList = upcomingTasks.filter((t) => !pendingIds.has(t.id));
    if (scheduleList.length > 0) {
      await LocalNotifications.schedule({
        notifications: scheduleList.map((t) => ({
          id: t.id,
          title: t.title,
          body: t.body,
          schedule: { at: t.at },
          extra: { taskId: t.taskId },
          sound: 'default'
        }))
      });
      console.log(`[LocalNotifications] Scheduled ${scheduleList.length} new reminders`);
    }
  } catch (e) {
    console.error('[LocalNotifications] Sync failed:', e);
  }
}
