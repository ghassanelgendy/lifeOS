import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { Badge } from '@capawesome/capacitor-badge';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';

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
    // 1. Hide Keyboard Accessory Bar (prevents the gray 'prev/next/done' bar on iOS)
    try {
      await Keyboard.setAccessoryBarVisible({ visible: false });
    } catch {
      // Non-fatal: plugin may not be available on all configurations
    }

    // 2. Request Badge permissions and clear badge count
    const badgePermissions = await Badge.checkPermissions();
    if (badgePermissions.display !== 'granted') {
      await Badge.requestPermissions();
    }
    await Badge.clear();

    // 3. Request Local Notifications permission once at startup
    const notifPermissions = await LocalNotifications.checkPermissions();
    if (notifPermissions.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 4. Register notification action types for quick-action long-press on iOS/Android
    await LocalNotifications.registerActionTypes({
      types: [
        {
          // Tasks: mark done or postpone by 1 hour
          id: 'task-actions',
          actions: [
            { id: 'done', title: 'Done' },
            { id: 'postpone', title: 'Postpone 1h' },
          ],
        },
        {
          // Habits: done or snooze 5 mins
          id: 'habit-actions',
          actions: [
            { id: 'done', title: 'Done' },
            { id: 'snooze5', title: '+5 mins' },
          ],
        },
        {
          // Prayers: done or snooze 5 mins
          id: 'prayer-actions',
          actions: [
            { id: 'done', title: 'Done' },
            { id: 'snooze5', title: '+5 mins' },
          ],
        },
      ],
    });

    // 5. Hide splash screen after app is fully loaded
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

import { format } from 'date-fns';

function generateEventInstances(event: any, daysAhead = 7): Date[] {
  const instances: Date[] = [];
  const start = new Date(event.start_time);
  if (Number.isNaN(start.getTime())) return [];

  const now = new Date();
  const endLimit = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  if (!event.recurrence || event.recurrence === 'none') {
    if (start >= now && start <= endLimit) {
      instances.push(start);
    }
    return instances;
  }

  for (let i = 0; i <= daysAhead; i++) {
    const candidateDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (event.recurrence_end) {
      const recEnd = new Date(event.recurrence_end);
      recEnd.setHours(23, 59, 59, 999);
      if (candidateDate > recEnd) continue;
    }

    const candidateTime = new Date(
      candidateDate.getFullYear(),
      candidateDate.getMonth(),
      candidateDate.getDate(),
      start.getHours(),
      start.getMinutes(),
      start.getSeconds()
    );

    if (candidateTime < now || candidateTime > endLimit) continue;

    if (event.recurrence === 'daily') {
      instances.push(candidateTime);
    } else if (event.recurrence === 'weekly') {
      if (candidateTime.getDay() === start.getDay()) {
        instances.push(candidateTime);
      }
    } else if (event.recurrence.startsWith('weekly:')) {
      const daysStr = event.recurrence.split(':')[1];
      const days = daysStr.split(',').map(Number);
      if (days.includes(candidateTime.getDay())) {
        instances.push(candidateTime);
      }
    } else if (event.recurrence === 'monthly') {
      if (candidateTime.getDate() === start.getDate()) {
        instances.push(candidateTime);
      }
    }
  }
  return instances;
}

function isHabitScheduledForDate(habit: any, date: Date): boolean {
  if (habit.frequency === 'Daily') return true;
  const weekDays = habit.week_days ?? [];
  if (weekDays.length === 0) return false;
  const day = date.getDay();
  return weekDays.some((d: any) => Number(d) === day);
}

function parseTimeToMinutes(time: string): number {
  const parts = time.split(':');
  const h = Number(parts[0] || 0);
  const m = Number(parts[1] || 0);
  return h * 60 + m;
}

function isInQuietHours(date: Date, quietStart?: string | null, quietEnd?: string | null): boolean {
  if (!quietStart || !quietEnd) return false;
  const h = date.getHours();
  const m = date.getMinutes();
  const minuteOfDay = h * 60 + m;

  const start = parseTimeToMinutes(quietStart);
  const end = parseTimeToMinutes(quietEnd);

  if (start === end) return false;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

// Automatically sync tasks, habits, events, and prayers to native iOS/Android Local Notifications
// Automatically sync tasks, habits, events, and prayers to native iOS/Android Local Notifications
export async function syncAllLocalNotifications(
  tasks: any[],
  habits: any[],
  events: any[],
  prayerSettings: any[],
  lat: number,
  lng: number,
  todayHabitLogs: any[] = [],
  todayPrayerLogs: any[] = []
) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Permission is requested once at app startup (initializeNativeApp).
    // Here we only check — if not yet granted we bail silently.
    const hasPermission = await LocalNotifications.checkPermissions();
    if (hasPermission.display !== 'granted') {
      console.warn('[LocalNotifications] Permission not granted – skipping sync');
      return;
    }

    const pending = await LocalNotifications.getPending();
    const pendingIds = new Set(pending.notifications.map((n) => n.id));
    const now = new Date();
    const nowMs = now.getTime();
    const endLimit = new Date(nowMs + 7 * 24 * 60 * 60 * 1000);
    const todayStr = format(now, 'yyyy-MM-dd');

    const upcomingList: Array<{
      id: number;
      title: string;
      body: string;
      at: Date;
      extra?: Record<string, any>;
      actionTypeId?: string;
    }> = [];

    // Helper: detect if a string contains Arabic characters
    const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

    // 1. Sync Tasks (Cap at 20)
    // Helper: parse "YYYY-MM-DD" + "HH:MM" into a safe local Date
    function taskTriggerDate(due_date: string, due_time?: string | null, early_reminder_minutes?: number | null): Date {
      const [y, mo, d] = due_date.split('T')[0].split('-').map(Number);
      let h = 9, m = 0; // default to 9am if no specific time
      if (due_time && /^\d{2}:\d{2}$/.test(due_time)) {
        const [th, tm] = due_time.split(':').map(Number);
        h = th; m = tm;
      }
      const date = new Date(y, mo - 1, d, h, m, 0);
      if (early_reminder_minutes) {
        date.setTime(date.getTime() - early_reminder_minutes * 60000);
      }
      return date;
    }

    const taskReminders = tasks
      .filter((task) => {
        if (task.is_completed || task.is_wont_do) return false;
        // Default reminders to true if task has due_time
        const isReminderEnabled = task.reminders_enabled || !!task.due_time;
        if (!task.due_date || !isReminderEnabled) return false;
        const triggerAt = taskTriggerDate(task.due_date, task.due_time, task.early_reminder_minutes);
        return triggerAt.getTime() > nowMs;
      })
      .map((task) => {
        const isAr = isArabic(task.title);
        return {
          id: hashCode('task-' + task.id),
          title: 'Task Reminder',
          body: isAr ? `يلا عشان وراك مهمة: ${task.title}` : `Ready to tackle: ${task.title}`,
          at: taskTriggerDate(task.due_date, task.due_time, task.early_reminder_minutes),
          extra: { taskId: task.id },
          actionTypeId: 'task-actions'
        };
      })
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 20);

    upcomingList.push(...taskReminders);

    // 2. Sync Habits (Cap at 15)
    const activeHabits = habits.filter(h => h.notify_enabled && !h.is_archived && h.habit_type !== 'detox');
    const habitReminders: typeof upcomingList = [];

    for (let i = 0; i <= 7; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateString = format(targetDate, 'yyyy-MM-dd');

      for (const habit of activeHabits) {
        if (!isHabitScheduledForDate(habit, targetDate)) continue;

        // Skip scheduling if it's already completed today
        const isCompletedToday = todayHabitLogs.some(
          (log) => log.habit_id === habit.id && log.completed === true
        );
        if (isCompletedToday && dateString === todayStr) continue;

        const rawTime = habit.notify_time || habit.time || '09:00';
        const [h, m] = rawTime.split(':').map(Number);
        const triggerAt = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), h, m, 0);

        if (triggerAt.getTime() > nowMs && triggerAt.getTime() <= endLimit.getTime()) {
          const isAr = isArabic(habit.title);
          habitReminders.push({
            id: hashCode(`habit-${habit.id}-${dateString}`),
            title: 'Habit Reminder',
            body: isAr ? `يلا عشان دة وقت: ${habit.title}` : `Time to focus on: ${habit.title}`,
            at: triggerAt,
            extra: { habitId: habit.id, date: dateString },
            actionTypeId: 'habit-actions'
          });
        }
      }
    }
    habitReminders.sort((a, b) => a.at.getTime() - b.at.getTime());
    upcomingList.push(...habitReminders.slice(0, 15));

    // 3. Sync Calendar Events (Cap at 15)
    const eventReminders: typeof upcomingList = [];
    for (const event of events) {
      const instances = generateEventInstances(event, 7);
      for (const start of instances) {
        if (start.getTime() > nowMs) {
          eventReminders.push({
            id: hashCode(`event-${event.id}-${start.toISOString()}`),
            title: 'Calendar Event',
            body: `${event.title} is starting`,
            at: start,
            extra: { calendarEventId: event.id }
          });
        }
      }
    }
    eventReminders.sort((a, b) => a.at.getTime() - b.at.getTime());
    upcomingList.push(...eventReminders.slice(0, 15));

    // 4. Sync Prayer Alerts (Cap at 14)
    const prayerAlerts: typeof upcomingList = [];
    const enabledSettings = prayerSettings.filter(s => s.enabled);

    if (enabledSettings.length > 0 && lat && lng) {
      const coords = new Coordinates(lat, lng);
      const params = CalculationMethod.MuslimWorldLeague();
      params.madhab = Madhab.Shafi;

      for (let i = 0; i <= 7; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const dateString = format(targetDate, 'yyyy-MM-dd');

        try {
          const times = new PrayerTimes(coords, targetDate, params);
          const dailyPrayers = [
            { name: 'Fajr', time: times.fajr },
            { name: 'Dhuhr', time: times.dhuhr },
            { name: 'Asr', time: times.asr },
            { name: 'Maghrib', time: times.maghrib },
            { name: 'Isha', time: times.isha },
          ];

          for (const prayer of dailyPrayers) {
            const setting = enabledSettings.find(s => s.prayer_habit?.prayer_name === prayer.name);
            if (!setting) continue;

            const baseTime = prayer.time;
            if (!baseTime) continue;

            const triggerAt = new Date(baseTime.getTime() + (setting.offset_minutes || 0) * 60000);

            if (isInQuietHours(triggerAt, setting.quiet_hours_start, setting.quiet_hours_end)) continue;

            // Skip scheduling if this prayer was already completed today
            const isCompletedToday = todayPrayerLogs.some(
              (log) => log.prayer_habit_id === setting.prayer_habit_id && (log.status === 'done' || log.status === 'late')
            );
            if (isCompletedToday && dateString === todayStr) continue;

            if (triggerAt.getTime() > nowMs && triggerAt.getTime() <= endLimit.getTime()) {
              prayerAlerts.push({
                id: hashCode(`prayer-${prayer.name}-${dateString}`),
                title: `${prayer.name} Prayer`,
                body: `Time for ${prayer.name}`,
                at: triggerAt,
                extra: { 
                  prayerName: prayer.name, 
                  date: dateString,
                  prayerHabitId: setting.prayer_habit_id,
                  habitId: setting.prayer_habit?.habit_id
                },
                actionTypeId: 'prayer-actions'
              });
            }
          }
        } catch { }
      }
    }
    prayerAlerts.sort((a, b) => a.at.getTime() - b.at.getTime());
    upcomingList.push(...prayerAlerts.slice(0, 14));

    const finalUpcoming = upcomingList.sort((a, b) => a.at.getTime() - b.at.getTime());
    const upcomingIds = new Set(finalUpcoming.map((n) => n.id));

    const cancelIds = pending.notifications
      .filter((n) => !upcomingIds.has(n.id))
      .map((n) => ({ id: n.id }));

    if (cancelIds.length > 0) {
      await LocalNotifications.cancel({ notifications: cancelIds });
    }

    const scheduleList = finalUpcoming.filter((n) => !pendingIds.has(n.id));
    if (scheduleList.length > 0) {
      await LocalNotifications.schedule({
        notifications: scheduleList.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: n.at },
          extra: n.extra,
          sound: 'default',
          ...(n.actionTypeId ? { actionTypeId: n.actionTypeId } : {})
        }))
      });
      console.log(`[LocalNotifications] Synced ${finalUpcoming.length} active reminders (${scheduleList.length} new)`);
    }
  } catch (e) {
    console.error('[LocalNotifications] Sync failed:', e);
  }
}

// Send a test notification in 5 seconds — verifies local notifications are working
export async function sendTestNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    alert('Local notifications only work in the native iOS/Android app.');
    return;
  }
  try {
    const perms = await LocalNotifications.checkPermissions();
    if (perms.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    const fireAt = new Date(Date.now() + 5000);
    await LocalNotifications.schedule({
      notifications: [{
        id: 999999,
        title: 'Test Notification',
        body: 'lifeOS notifications are working!',
        schedule: { at: fireAt },
        sound: 'default',
        actionTypeId: 'task-actions',
      }]
    });
    console.log('[LocalNotifications] Test notification scheduled for 5s from now');
  } catch (e) {
    console.error('[LocalNotifications] Test notification failed:', e);
    throw e;
  }
}

// Helper: reschedule a notification N minutes later (used for Postpone/Snooze actions)
export async function rescheduleNotificationSnooze(
  id: number,
  minutes: number,
  title: string,
  body: string,
  actionTypeId?: string,
  extra?: Record<string, any>
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const at = new Date(Date.now() + minutes * 60000);
    await LocalNotifications.schedule({
      notifications: [{ 
        id, 
        title, 
        body, 
        schedule: { at }, 
        sound: 'default', 
        ...(actionTypeId ? { actionTypeId } : {}),
        ...(extra ? { extra } : {})
      }]
    });
  } catch (e) {
    console.error('[LocalNotifications] Snooze failed:', e);
  }
}

async function upsertPrayerLogWithHabitSyncDirect(
  supabaseClient: any,
  input: {
    prayerHabitId: string;
    habitId: string;
    date: string;
    status: 'done' | 'late';
    userId?: string;
  }
) {
  const nowIso = new Date().toISOString();
  const completed = true;

  // 1. Maybe get existing prayer log
  const { data: existingPrayerLog } = await supabaseClient
    .from('prayer_logs')
    .select('id')
    .eq('prayer_habit_id', input.prayerHabitId)
    .eq('date', input.date)
    .maybeSingle();

  let prayerLogId: string;
  if (existingPrayerLog?.id) {
    const { data, error } = await supabaseClient
      .from('prayer_logs')
      .update({
        status: input.status,
        prayed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', existingPrayerLog.id)
      .select('id')
      .single();
    if (error) throw error;
    prayerLogId = data.id as string;
  } else {
    const { data, error } = await supabaseClient
      .from('prayer_logs')
      .insert({
        prayer_habit_id: input.prayerHabitId,
        date: input.date,
        status: input.status,
        prayed_at: nowIso,
        ...(input.userId ? { user_id: input.userId } : {})
      })
      .select('id')
      .single();
    if (error) throw error;
    prayerLogId = data.id as string;
  }

  // 2. Sync with habit logs
  const { data: existingHabitLog } = await supabaseClient
    .from('habit_logs')
    .select('id')
    .eq('habit_id', input.habitId)
    .eq('date', input.date)
    .maybeSingle();

  let habitLogId: string;
  if (existingHabitLog?.id) {
    const { data, error } = await supabaseClient
      .from('habit_logs')
      .update({
        completed,
        source: 'prayer',
      })
      .eq('id', existingHabitLog.id)
      .select('id')
      .single();
    if (error) throw error;
    habitLogId = data.id as string;
  } else {
    const { data, error } = await supabaseClient
      .from('habit_logs')
      .insert({
        habit_id: input.habitId,
        date: input.date,
        completed,
        source: 'prayer',
        ...(input.userId ? { user_id: input.userId } : {})
      })
      .select('id')
      .single();
    if (error) throw error;
    habitLogId = data.id as string;
  }

  // 3. Link back
  await supabaseClient
    .from('prayer_logs')
    .update({ habit_log_id: habitLogId })
    .eq('id', prayerLogId);
}

// Wire up quick-action listeners (Done / Postpone / Snooze / Late).
// Call once at app startup with access to supabase + react-query client.
export function setupNotificationActionListeners(supabaseClient: any, queryClient: any) {
  if (!Capacitor.isNativePlatform()) return;

  LocalNotifications.addListener('localNotificationActionPerformed', async (result) => {
    const { actionId, notification } = result;

    // iOS sometimes delivers extra as a JSON string — parse defensively
    let extra: Record<string, any> = {};
    try {
      const raw = notification.extra;
      if (typeof raw === 'string') {
        extra = JSON.parse(raw);
      } else if (raw && typeof raw === 'object') {
        extra = raw as Record<string, any>;
      }
    } catch {
      extra = {};
    }

    console.log(`[LocalNotifications] Action "${actionId}"`, JSON.stringify(extra));

    // Ensure session is loaded before queries run
    let userId: string | undefined;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      userId = session?.user?.id;
    } catch (e) {
      console.error('[Notif] Failed to get user session:', e);
    }

    // TASK: Done or Postpone 1h
    if (extra.taskId) {
      if (actionId === 'done') {
        try {
          await supabaseClient.from('tasks')
            .update({ is_completed: true, completed_at: new Date().toISOString() })
            .eq('id', extra.taskId);
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
          console.log('[Notif] Task marked done:', extra.taskId);
        } catch (e) {
          console.error('[Notif] Failed to complete task:', e);
        }
      } else if (actionId === 'postpone') {
        try {
          void rescheduleNotificationSnooze(
            (notification.id + 100000) % 2147483647,
            60,
            notification.title ?? 'Task Reminder',
            notification.body ?? '',
            'task-actions',
            extra
          );
        } catch (e) {
          console.error('[Notif] Failed to postpone task:', e);
        }
      }
    }

    // HABIT: Done or Snooze 5 mins
    if (extra.habitId && extra.date) {
      if (actionId === 'done') {
        try {
          const dateOnly = extra.date.split('T')[0];
          
          const { data: existing } = await supabaseClient
            .from('habit_logs')
            .select('id')
            .eq('habit_id', extra.habitId)
            .eq('date', dateOnly)
            .maybeSingle();

          if (existing?.id) {
            await supabaseClient
              .from('habit_logs')
              .update({
                completed: true,
                completed_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          } else {
            await supabaseClient
              .from('habit_logs')
              .insert({
                habit_id: extra.habitId,
                date: dateOnly,
                completed: true,
                completed_at: new Date().toISOString(),
                ...(userId ? { user_id: userId } : {})
              });
          }

          void queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
          void queryClient.invalidateQueries({ queryKey: ['habits'] });
          console.log('[Notif] Habit logged done:', extra.habitId, extra.date);
        } catch (e) {
          console.error('[Notif] Failed to log habit:', e);
        }
      } else if (actionId === 'snooze5') {
        try {
          void rescheduleNotificationSnooze(
            (notification.id + 300000) % 2147483647,
            5,
            notification.title ?? 'Habit Reminder',
            notification.body ?? '',
            'habit-actions',
            extra
          );
        } catch (e) {
          console.error('[Notif] Failed to snooze habit:', e);
        }
      }
    }

    // PRAYER: Done or Snooze +5m
    if (extra.prayerName && extra.date && extra.prayerHabitId && extra.habitId) {
      if (actionId === 'done' || actionId === 'late') {
        try {
          await upsertPrayerLogWithHabitSyncDirect(supabaseClient, {
            prayerHabitId: extra.prayerHabitId,
            habitId: extra.habitId,
            date: extra.date,
            status: actionId as 'done' | 'late',
            userId
          });

          void queryClient.invalidateQueries({ queryKey: ['prayer-logs'] });
          void queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
          void queryClient.invalidateQueries({ queryKey: ['habits'] });
          console.log('[Notif] Prayer logged via helper:', extra.prayerName, actionId);
        } catch (e) {
          console.error('[Notif] Failed to log prayer via helper:', e);
        }
      } else if (actionId === 'snooze5') {
        try {
          void rescheduleNotificationSnooze(
            (notification.id + 200000) % 2147483647,
            5,
            notification.title ?? 'Prayer',
            notification.body ?? '',
            'prayer-actions',
            extra
          );
        } catch (e) {
          console.error('[Notif] Failed to snooze prayer:', e);
        }
      }
    }
  });
}
