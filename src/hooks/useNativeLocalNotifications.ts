import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Helper to convert string UUIDs/keys to unique numbers for notification IDs
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash | 0);
}

export function useNativeLocalNotifications() {
  const isNative = Capacitor.isNativePlatform();

  const scheduleTaskReminder = async (taskId: string, title: string, body: string, triggerAt: Date) => {
    if (!isNative) return;
    try {
      const hasPermission = await LocalNotifications.requestPermissions();
      if (hasPermission.display !== 'granted') return;

      const notificationId = hashCode(taskId);

      // Clear any previous notification for this task
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });

      // Only schedule if the trigger time is in the future
      if (triggerAt.getTime() > Date.now()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: notificationId,
              schedule: { at: triggerAt },
              extra: { taskId },
            },
          ],
        });
      }
    } catch (err) {
      console.error('Failed to schedule local notification', err);
    }
  };

  const cancelTaskReminder = async (taskId: string) => {
    if (!isNative) return;
    try {
      const notificationId = hashCode(taskId);
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch (err) {
      console.error('Failed to cancel local notification', err);
    }
  };

  return { scheduleTaskReminder, cancelTaskReminder };
}
