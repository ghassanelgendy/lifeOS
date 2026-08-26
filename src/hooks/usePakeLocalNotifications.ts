import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useTasks } from './useTasks';
import { useHabits, useTodayHabitLogs, useHabitAverages } from './useHabits';
import { useCalendarEvents } from './useCalendar';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentWirdInfo } from '../../lib/quran-memorizer/src/services/quranData';

function generateEventInstances(event: any, daysAhead = 1): Date[] {
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

function taskTriggerDate(due_date: string, due_time?: string | null, early_reminder_minutes?: number | null): Date {
  const [y, mo, d] = due_date.split('T')[0].split('-').map(Number);
  let h = 9, m = 0;
  if (due_time && /^\d{1,2}:\d{2}(:\d{2})?$/.test(due_time)) {
    const [th, tm] = due_time.split(':').map(Number);
    h = th; m = tm;
  }
  const date = new Date(y, mo - 1, d, h, m, 0);
  if (early_reminder_minutes) {
    date.setTime(date.getTime() - early_reminder_minutes * 60000);
  }
  return date;
}

export function usePakeLocalNotifications() {
  const { user } = useAuth();
  const { data: tasks } = useTasks();
  const { data: habits } = useHabits();
  const { data: events } = useCalendarEvents();
  const { data: todayHabitLogs = [] } = useTodayHabitLogs();
  const { data: habitAverages = {} } = useHabitAverages();

  const isPake = import.meta.env.MODE === 'pake';

  const shownNotifsRef = useRef<Set<string>>(new Set());

  // Load shown notifications from localStorage to avoid double alerting
  useEffect(() => {
    if (!isPake) return;
    try {
      const saved = localStorage.getItem('pake_shown_notifications');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          shownNotifsRef.current = new Set(arr);
        }
      }
    } catch (e) {
      console.error('[PakeNotifications] Failed to load shown list', e);
    }
  }, [isPake]);

  // Request browser notification permission
  useEffect(() => {
    if (!isPake) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  }, [isPake]);

  useEffect(() => {
    if (!isPake || !user || !tasks || !habits || !events) return;

    const checkInterval = setInterval(() => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const now = new Date();
      const nowMs = now.getTime();
      const todayStr = now.toLocaleDateString('en-CA');

      // 15 minutes lookback limit to avoid trigger spam on startup
      const fifteenMinsAgo = nowMs - 15 * 60 * 1000;

      // 1. Check Tasks Reminders
      tasks.forEach((task) => {
        if (task.is_completed || task.is_wont_do) return;
        const isReminderEnabled = task.reminders_enabled || !!task.due_time;
        if (!task.due_date || !isReminderEnabled) return;

        const triggerAt = taskTriggerDate(task.due_date, task.due_time, task.early_reminder_minutes);
        const triggerTime = triggerAt.getTime();

        if (triggerTime > fifteenMinsAgo && triggerTime <= nowMs) {
          const key = `task-${task.id}-${triggerTime}`;
          if (!shownNotifsRef.current.has(key)) {
            shownNotifsRef.current.add(key);
            localStorage.setItem('pake_shown_notifications', JSON.stringify(Array.from(shownNotifsRef.current)));

            const isAr = /[\u0600-\u06FF]/.test(task.title);
            const n = new Notification('Task Reminder', {
              body: isAr ? `يلا عشان وراك مهمة ${task.title}` : `Ready to tackle ${task.title}`,
              tag: key,
            });
            n.onclick = () => {
              window.focus();
            };
          }
        }
      });

      // 2. Check Habit Reminders
      const activeHabits = habits.filter(h => h.notify_enabled && !h.is_archived && h.habit_type !== 'detox');
      activeHabits.forEach((habit) => {
        if (!isHabitScheduledForDate(habit, now)) return;

        const isCompletedToday = todayHabitLogs.some(
          (log) => log.habit_id === habit.id && log.completed === true
        );
        if (isCompletedToday) return;

        let h = 9, m = 0;
        const rawTime = habit.notify_time || habit.time;
        if (rawTime) {
          const [th, tm] = rawTime.split(':').map(Number);
          if (!Number.isNaN(th) && !Number.isNaN(tm)) {
            h = th; m = tm;
          }
        } else if (habitAverages && typeof habitAverages[habit.id] === 'number') {
          const avgMinutes = habitAverages[habit.id];
          h = Math.floor(avgMinutes / 60);
          m = avgMinutes % 60;
        }
        const triggerAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
        const triggerTime = triggerAt.getTime();

        if (triggerTime > fifteenMinsAgo && triggerTime <= nowMs) {
          const key = `habit-${habit.id}-${todayStr}`;
          if (!shownNotifsRef.current.has(key)) {
            shownNotifsRef.current.add(key);
            localStorage.setItem('pake_shown_notifications', JSON.stringify(Array.from(shownNotifsRef.current)));

            const isAr = /[\u0600-\u06FF]/.test(habit.title);
            const isMemHabit = /memoriz|حفظ|تحفيظ|تسميع|تثبيت/i.test(habit.title) || habit.habit_type === 'quran_memorization';
            const isReadHabit = /read|تلاوة|قراءة|ورد/i.test(habit.title) || habit.habit_type === 'quran_reading';
            const isQuranHabit = isMemHabit || isReadHabit || /quran|قران|قرآن|قراٰن/i.test(habit.title);

            let notifTitle = isAr ? `تذكير بالعادات: ${habit.title}` : 'Habit Reminder';
            let notifBody = isAr ? `يلا عشان دة وقت: ${habit.title}` : `Time to focus on: ${habit.title}`;
            let targetPage: number | null = null;
            let targetSurah: number | null = null;
            let targetMode: 'memorization' | 'reading' = 'memorization';

            if (isQuranHabit) {
              const wird = getCurrentWirdInfo();
              if (isReadHabit && !isMemHabit) {
                targetPage = wird.reading.page;
                targetSurah = wird.reading.surahId;
                targetMode = 'reading';
                notifTitle = isAr ? 'ورد تلاوة القرآن الكريم 📖' : 'Quran Reading 📖';
                notifBody = isAr
                  ? `حان وقت ورد التلاوة — صفحة ${wird.reading.page} (سورة ${wird.reading.surahName})`
                  : `Time for Quran Reading — Page ${wird.reading.page} (Surah ${wird.reading.surahName})`;
              } else {
                targetPage = wird.memorization.page;
                targetSurah = wird.memorization.surahId;
                targetMode = 'memorization';
                notifTitle = isAr ? 'ورد حفظ القرآن الكريم 🎯' : 'Quran Memorization 🎯';
                notifBody = isAr
                  ? `حان وقت ورد الحفظ — صفحة ${wird.memorization.page} (سورة ${wird.memorization.surahName})`
                  : `Time for Quran Memorization — Page ${wird.memorization.page} (Surah ${wird.memorization.surahName})`;
              }
            }

            const n = new Notification(notifTitle, {
              body: notifBody,
              tag: key,
            });
            n.onclick = () => {
              window.focus();
              if (targetPage) {
                localStorage.setItem('quran_active_page_v1', targetPage.toString());
                localStorage.setItem('quran_last_position_v1', JSON.stringify({ activeTab: 'reader', selectedSurah: targetSurah }));
                window.dispatchEvent(new CustomEvent('lifeos:openQuran', { detail: { page: targetPage, surah: targetSurah, mode: targetMode, tab: 'reader' } }));
                if (window.location.pathname !== '/quran') {
                  window.location.href = '/quran';
                }
              }
            };
          }
        }
      });

      // 3. Check Calendar Event Reminders
      events.forEach((event) => {
        const instances = generateEventInstances(event, 1);
        instances.forEach((start) => {
          const startTime = start.getTime();
          if (startTime > fifteenMinsAgo && startTime <= nowMs) {
            const key = `event-${event.id}-${startTime}`;
            if (!shownNotifsRef.current.has(key)) {
              shownNotifsRef.current.add(key);
              localStorage.setItem('pake_shown_notifications', JSON.stringify(Array.from(shownNotifsRef.current)));

              const isAr = /[\u0600-\u06FF]/.test(event.title);
              const isQuranEvent = /sheikh|حفظ|قران|قرآن|تسميع|تحفيظ|تثبيت|شيخ|tahfez|quran|halqah|حلقة/i.test(event.title) || event.category === 'quran' || event.type === 'quran';

              let notifTitle = isAr ? `موعد ${event.title}` : 'Calendar Event';
              let notifBody = `${event.title} is starting`;
              let targetPage: number | null = null;
              let targetSurah: number | null = null;

              if (isQuranEvent) {
                const wird = getCurrentWirdInfo();
                targetPage = wird.memorization.page;
                targetSurah = wird.memorization.surahId;
                notifTitle = isAr ? `موعد ${event.title} 🕌` : `${event.title} 🕌`;
                notifBody = isAr
                  ? `حان موعد الجلسة والتسميع — موضع الحفظ: صفحة ${wird.memorization.page} (سورة ${wird.memorization.surahName})`
                  : `${event.title} is starting — Memorization: Page ${wird.memorization.page} (${wird.memorization.surahName})`;
              }

              const n = new Notification(notifTitle, {
                body: notifBody,
                tag: key,
              });
              n.onclick = () => {
                window.focus();
                if (targetPage) {
                  localStorage.setItem('quran_active_page_v1', targetPage.toString());
                  localStorage.setItem('quran_last_position_v1', JSON.stringify({ activeTab: 'reader', selectedSurah: targetSurah }));
                  window.dispatchEvent(new CustomEvent('lifeos:openQuran', { detail: { page: targetPage, surah: targetSurah, mode: 'memorization', tab: 'reader' } }));
                  if (window.location.pathname !== '/quran') {
                    window.location.href = '/quran';
                  }
                }
              };
            }
          }
        });
      });

      // Clean up old keys (older than 3 days) to prevent unbounded storage growth
      if (shownNotifsRef.current.size > 200) {
        const threshold = nowMs - 3 * 24 * 60 * 60 * 1000;
        const cleaned = new Set<string>();
        shownNotifsRef.current.forEach((k) => {
          const parts = k.split('-');
          const ts = Number(parts[parts.length - 1]);
          if (!Number.isNaN(ts) && ts > threshold) {
            cleaned.add(k);
          } else if (k.startsWith('habit-')) {
            // Keep habit keys for the last 3 days
            cleaned.add(k);
          }
        });
        shownNotifsRef.current = cleaned;
        localStorage.setItem('pake_shown_notifications', JSON.stringify(Array.from(shownNotifsRef.current)));
      }

      }, 120_000); // 🔇 Reduced from 30s → 120s to stop burning API egress via dependency refetches

    return () => clearInterval(checkInterval);
  }, [isPake, user, tasks, habits, events, todayHabitLogs, habitAverages]);
}
