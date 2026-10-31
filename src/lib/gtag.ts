/**
 * lifeOS - Google Analytics (gtag.js) Integration
 * Measurement ID: G-E33S655RMQ
 *
 * Provides typed, defensive event tracking for pageviews, lifeOS domain events
 * (tasks, habits, focus, prayer, finance, notes), and user identity.
 */

export const GA_MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-E33S655RMQ').trim();

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Defensive wrapper around window.gtag
 */
export function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  } else if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }
}

/**
 * Tracks a pageview with path and optional title
 */
export function trackPageView(path: string, title?: string) {
  if (!GA_MEASUREMENT_ID) return;
  gtag('event', 'page_view', {
    page_path: path,
    page_title: title || (typeof document !== 'undefined' ? document.title : ''),
    send_to: GA_MEASUREMENT_ID,
  });
}

/**
 * Tracks a custom event
 */
export function trackEvent(action: string, params: Record<string, any> = {}) {
  if (!GA_MEASUREMENT_ID) return;
  gtag('event', action, params);
}

/**
 * Set user ID for authenticated user tracking
 */
export function setUserId(userId: string | null) {
  if (!GA_MEASUREMENT_ID) return;
  if (userId) {
    gtag('config', GA_MEASUREMENT_ID, { user_id: userId });
  } else {
    gtag('config', GA_MEASUREMENT_ID, { user_id: undefined });
  }
}

// -----------------------------------------------------------------------------
// lifeOS Domain-Specific Tracking Functions
// -----------------------------------------------------------------------------

export function trackTaskCreated(task: { id?: string; priority?: string; list?: string; hasDue?: boolean }) {
  trackEvent('task_created', {
    task_priority: task.priority || 'none',
    task_list: task.list || 'inbox',
    has_due_date: !!task.hasDue,
  });
}

export function trackTaskCompleted(task: { id?: string; priority?: string }) {
  trackEvent('task_completed', {
    task_priority: task.priority || 'none',
  });
}

export function trackHabitLogged(habit: { id?: string; type?: string; streak?: number }) {
  trackEvent('habit_logged', {
    habit_type: habit.type || 'standard',
    current_streak: habit.streak || 0,
  });
}

export function trackFocusSession(session: { durationMinutes: number; completed: boolean }) {
  trackEvent('focus_session_completed', {
    duration_minutes: session.durationMinutes,
    completed: session.completed,
  });
}

export function trackPrayerLogged(prayer: { prayerName: string; isLate?: boolean }) {
  trackEvent('prayer_logged', {
    prayer_name: prayer.prayerName,
    is_late: !!prayer.isLate,
  });
}

export function trackTransactionLogged(tx: { type: 'income' | 'expense' | 'transfer'; category?: string; amount?: number }) {
  trackEvent('transaction_logged', {
    transaction_type: tx.type,
    category: tx.category || 'other',
  });
}

export function trackNoteCreated(note: { folder?: string; hasAttachments?: boolean }) {
  trackEvent('note_created', {
    folder: note.folder || 'general',
    has_attachments: !!note.hasAttachments,
  });
}
