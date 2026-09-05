/**
 * lifeOS Lightweight Supabase Client
 * Pure Fetch-based PostgREST API client for Browser Extension.
 */

import { ENV_CONFIG } from './envConfig.js';

/** Swallow a failed sub-query into an empty list, EXCEPT for an expired-session error —
 * that one must keep propagating so the caller can distinguish "disconnected" from
 * "genuinely nothing here" instead of quietly rendering 0. */
function toEmptyUnlessAuthExpired(err) {
  if (err && err.authExpired) throw err;
  return [];
}

export class SupabaseClient {
  constructor() {
    this.supabaseUrl = ENV_CONFIG.supabaseUrl || 'https://vlbgxbzwasgpbfzfabnl.supabase.co';
    this.supabaseKey = ENV_CONFIG.supabaseAnonKey || '';
    this.accessToken = '';
    this.refreshToken = '';
    this.userId = '';
    this.userEmail = '';
    this.defaultNoteName = ENV_CONFIG.defaultNoteName || 'Projects I wanna try';
    this.lifeOsUrl = ENV_CONFIG.lifeOsUrl || 'http://localhost:5173';
  }

  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ['supabaseUrl', 'supabaseKey', 'accessToken', 'refreshToken', 'userId', 'userEmail', 'defaultNoteName', 'lifeOsUrl'],
        (items) => {
          this.supabaseUrl = items.supabaseUrl || ENV_CONFIG.supabaseUrl || 'https://vlbgxbzwasgpbfzfabnl.supabase.co';
          this.supabaseKey = items.supabaseKey || ENV_CONFIG.supabaseAnonKey || '';
          this.accessToken = items.accessToken || '';
          this.refreshToken = items.refreshToken || '';
          this.userId = items.userId || '';
          this.userEmail = items.userEmail || '';
          this.defaultNoteName = items.defaultNoteName || ENV_CONFIG.defaultNoteName || 'Projects I wanna try';
          this.lifeOsUrl = items.lifeOsUrl || ENV_CONFIG.lifeOsUrl || 'http://localhost:5173';
          resolve(items);
        }
      );
    });
  }

  async saveConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(config, () => {
        if (config.supabaseUrl) this.supabaseUrl = config.supabaseUrl;
        if (config.supabaseKey) this.supabaseKey = config.supabaseKey;
        if (config.accessToken !== undefined) this.accessToken = config.accessToken;
        if (config.refreshToken !== undefined) this.refreshToken = config.refreshToken;
        if (config.userId !== undefined) this.userId = config.userId;
        if (config.userEmail !== undefined) this.userEmail = config.userEmail;
        if (config.defaultNoteName !== undefined) this.defaultNoteName = config.defaultNoteName;
        if (config.lifeOsUrl !== undefined) this.lifeOsUrl = config.lifeOsUrl;
        resolve(true);
      });
    });
  }

  isConfigured() {
    return Boolean(this.supabaseUrl && (this.supabaseKey || this.accessToken));
  }

  isAuthenticated() {
    return Boolean(this.accessToken || (this.supabaseUrl && this.supabaseKey));
  }

  async refreshSession() {
    if (!this.refreshToken) return false;
    try {
      const cleanBase = (this.supabaseUrl || ENV_CONFIG.supabaseUrl).replace(/\/+$/, '');
      const res = await fetch(`${cleanBase}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey || ENV_CONFIG.supabaseAnonKey,
        },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data && data.access_token) {
        this.accessToken = data.access_token;
        if (data.refresh_token) this.refreshToken = data.refresh_token;
        if (data.user?.id) this.userId = data.user.id;
        if (data.user?.email) this.userEmail = data.user.email;

        await this.saveConfig({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          userId: this.userId,
          userEmail: this.userEmail,
        });
        return true;
      }
    } catch (e) {
      console.warn('Failed to refresh session token:', e);
    }
    return false;
  }

  getHeaders(customHeaders = {}) {
    const keyToUse = this.supabaseKey || ENV_CONFIG.supabaseAnonKey;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': keyToUse,
      ...customHeaders,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (keyToUse) {
      headers['Authorization'] = `Bearer ${keyToUse}`;
    }

    return headers;
  }

  async request(path, options = {}, isRetry = false) {
    const baseUrl = this.supabaseUrl || ENV_CONFIG.supabaseUrl || 'https://vlbgxbzwasgpbfzfabnl.supabase.co';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}${path.startsWith('/') ? path : '/' + path}`;

    const fetchOptions = {
      ...options,
      headers: this.getHeaders(options.headers || {}),
    };

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      const errorText = await res.text();
      let errJson;
      try {
        errJson = JSON.parse(errorText);
      } catch (e) {}
      const msg = errJson?.message || errJson?.error || errorText || `HTTP ${res.status}`;

      // Handle expired JWT tokens automatically with refresh token
      if (res.status === 401 && !isRetry && (msg.toLowerCase().includes('jwt') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('unauthorized'))) {
        console.warn('lifeOS Extension: JWT expired. Attempting token refresh...');
        const refreshed = await this.refreshSession();
        if (refreshed) {
          return this.request(path, options, true);
        }
        // Refresh failed too — this session is genuinely dead (most likely: the refresh
        // token was already rotated by the main lifeOS tab's own background refresh, since
        // both copies are the same account's token and Supabase refresh tokens are
        // single-use). Previously this silently switched to the anon key and retried, which
        // returns HTTP 200 with an EMPTY array once RLS blocks the unauthenticated request —
        // indistinguishable from "you genuinely have 0 tasks/habits/screentime today". Throw
        // a typed error instead so callers can show a real "disconnected" state and attempt
        // recovery (re-syncing from an open lifeOS tab), rather than rendering a misleading 0.
        this.accessToken = '';
        this.refreshToken = '';
        await this.saveConfig({ accessToken: '', refreshToken: '' });
        const authErr = new Error('Your lifeOS session has expired. Reopen lifeOS in a browser tab (or click Refresh) to reconnect.');
        authErr.status = 401;
        authErr.authExpired = true;
        throw authErr;
      }

      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    if (res.status === 204) {
      return null;
    }

    return res.json();
  }

  /**
   * Verify token and fetch current user profile
   */
  async getCurrentUser() {
    if (!this.accessToken) {
      return null;
    }
    try {
      const user = await this.request('/auth/v1/user', { method: 'GET' });
      if (user && user.id) {
        this.userId = user.id;
        this.userEmail = user.email || '';
        await this.saveConfig({ userId: user.id, userEmail: user.email || '' });
        return user;
      }
    } catch (e) {
      console.warn('Failed to get user from token:', e);
    }
    return null;
  }

  /**
   * Fetch Today's Screentime stats
   */
  async fetchTodayScreentime() {
    const todayStr = new Date().toISOString().split('T')[0];

    let appQuery = `/rest/v1/screentime_daily_app_stats?date=eq.${todayStr}&select=id,app_name,total_time_seconds,session_count&order=total_time_seconds.desc`;
    let webQuery = `/rest/v1/screentime_daily_website_stats?date=eq.${todayStr}&select=id,domain,total_time_seconds,session_count&order=total_time_seconds.desc`;

    if (this.userId) {
      appQuery += `&user_id=eq.${this.userId}`;
      webQuery += `&user_id=eq.${this.userId}`;
    }

    const [appStats, webStats] = await Promise.all([
      this.request(appQuery).catch(toEmptyUnlessAuthExpired),
      this.request(webQuery).catch(toEmptyUnlessAuthExpired),
    ]);

    const appItems = Array.isArray(appStats) ? appStats : [];
    const webItems = Array.isArray(webStats) ? webStats : [];

    const totalSeconds = [...appItems, ...webItems].reduce(
      (sum, item) => sum + (Number(item.total_time_seconds) || 0),
      0
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    let formatted = '0m';
    if (hours > 0) {
      formatted = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      formatted = `${minutes}m`;
    } else if (totalSeconds > 0) {
      formatted = `${totalSeconds}s`;
    }

    return {
      totalSeconds,
      formatted,
      appCount: appItems.length,
      webCount: webItems.length,
      topItem: appItems[0]?.app_name || webItems[0]?.domain || 'Active',
    };
  }

  /**
   * Fetch Today's Tasks (Today only)
   */
  async fetchTodayTasks() {
    const todayStr = new Date().toISOString().split('T')[0];
    let query = `/rest/v1/tasks?select=id,title,description,is_completed,priority,due_date,due_time,url,list_id,created_at&is_completed=eq.false&due_date=eq.${todayStr}&order=due_time.asc.nullslast,priority.desc&limit=50`;
    
    if (this.userId) {
      query += `&user_id=eq.${this.userId}`;
    }

    const tasks = await this.request(query);
    const list = Array.isArray(tasks) ? tasks : [];

    const priorityWeight = { high: 3, medium: 2, low: 1, none: 0 };

    return list.sort((a, b) => {
      // 1. Due Time
      if (a.due_time && b.due_time) {
        const tDiff = a.due_time.localeCompare(b.due_time);
        if (tDiff !== 0) return tDiff;
      } else if (a.due_time && !b.due_time) return -1;
      else if (!a.due_time && b.due_time) return 1;

      // 2. Priority
      const pA = priorityWeight[a.priority] || 0;
      const pB = priorityWeight[b.priority] || 0;
      return pB - pA;
    });
  }

  /**
   * Quick Add Task
   */
  async createTask({ title, priority = 'none', dueDate = null, dueTime = null, url = null, description = '' }) {
    const todayStr = new Date().toISOString().split('T')[0];
    const payload = {
      title: title.trim(),
      priority,
      is_completed: false,
      tag_ids: [],
      recurrence: 'none',
      due_date: dueDate || todayStr,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.userId) payload.user_id = this.userId;
    if (dueTime) payload.due_time = dueTime.length === 5 ? `${dueTime}:00` : dueTime;
    if (url) payload.url = url;
    if (description) payload.description = description;

    const res = await this.request('/rest/v1/tasks', {
      method: 'POST',
      headers: {
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    return Array.isArray(res) ? res[0] : res;
  }

  /**
   * Toggle Task Completed
   */
  async toggleTask(taskId, isCompleted) {
    const payload = {
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const res = await this.request(`/rest/v1/tasks?id=eq.${taskId}`, {
      method: 'PATCH',
      headers: {
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    return Array.isArray(res) ? res[0] : res;
  }

  /**
   * Fetch Today's Habits (excluding detox habits, with full prayer tracker integration)
   */
  async fetchTodayHabits() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon ...

    let habitsQuery = `/rest/v1/habits?is_archived=eq.false&select=id,title,description,color,icon,frequency,week_days,points_value,adherence_weight,time,habit_type,created_at&order=time.asc.nullslast,created_at.asc`;
    if (this.userId) habitsQuery += `&user_id=eq.${this.userId}`;

    let logsQuery = `/rest/v1/habit_logs?date=eq.${todayStr}&select=id,habit_id,completed,completed_at`;
    if (this.userId) logsQuery += `&user_id=eq.${this.userId}`;

    let prayerHabitsQuery = `/rest/v1/prayer_habits?select=id,habit_id,prayer_name`;
    if (this.userId) prayerHabitsQuery += `&user_id=eq.${this.userId}`;

    let prayerLogsQuery = `/rest/v1/prayer_logs?date=eq.${todayStr}&select=id,prayer_habit_id,status,prayed_at`;
    if (this.userId) prayerLogsQuery += `&user_id=eq.${this.userId}`;

    const [habitsData, logsData, prayerHabitsData, prayerLogsData] = await Promise.all([
      this.request(habitsQuery).catch(toEmptyUnlessAuthExpired),
      this.request(logsQuery).catch(toEmptyUnlessAuthExpired),
      this.request(prayerHabitsQuery).catch(toEmptyUnlessAuthExpired),
      this.request(prayerLogsQuery).catch(toEmptyUnlessAuthExpired),
    ]);

    const habits = Array.isArray(habitsData) ? habitsData : [];
    const logs = Array.isArray(logsData) ? logsData : [];
    const prayerHabits = Array.isArray(prayerHabitsData) ? prayerHabitsData : [];
    const prayerLogs = Array.isArray(prayerLogsData) ? prayerLogsData : [];

    const logMap = new Map();
    logs.forEach((log) => {
      logMap.set(log.habit_id, log);
    });

    const prayerHabitByHabitId = new Map();
    prayerHabits.forEach((ph) => {
      if (ph.habit_id) prayerHabitByHabitId.set(ph.habit_id, ph);
    });

    const prayerLogByPrayerHabitId = new Map();
    prayerLogs.forEach((pl) => {
      if (pl.prayer_habit_id) prayerLogByPrayerHabitId.set(pl.prayer_habit_id, pl);
    });

    // Filter out detox habits and habits not scheduled for today
    const filteredHabits = habits.filter((habit) => {
      if (habit.habit_type === 'detox') return false;
      if (habit.frequency === 'Daily') return true;
      if (Array.isArray(habit.week_days) && habit.week_days.length > 0) {
        return habit.week_days.map(Number).includes(todayDayOfWeek);
      }
      return true;
    });

    const mapped = filteredHabits.map((habit) => {
      const log = logMap.get(habit.id);
      const prayerHabit = prayerHabitByHabitId.get(habit.id);
      const prayerLog = prayerHabit ? prayerLogByPrayerHabitId.get(prayerHabit.id) : null;

      const isPrayerStatusDone = prayerLog && (prayerLog.status === 'Prayed' || prayerLog.status === 'Mosque' || prayerLog.status === 'Late');
      const isCompleted = Boolean(log?.completed || isPrayerStatusDone);

      const isPrayer = Boolean(prayerHabit || habit.title?.toLowerCase().match(/fajr|dhuhr|asr|maghrib|isha|فجر|ظهر|عصر|مغرب|عشاء/));

      return {
        ...habit,
        isPrayer,
        prayerHabitId: prayerHabit?.id || null,
        isCompletedToday: isCompleted,
        logId: log?.id || null,
      };
    });

    // Sort: Uncompleted first, then by due time, then by title
    return mapped.sort((a, b) => {
      if (a.isCompletedToday !== b.isCompletedToday) {
        return a.isCompletedToday ? 1 : -1;
      }
      if (a.time && b.time) {
        const tDiff = a.time.localeCompare(b.time);
        if (tDiff !== 0) return tDiff;
      } else if (a.time && !b.time) return -1;
      else if (!a.time && b.time) return 1;

      return (a.title || '').localeCompare(b.title || '');
    });
  }

  /**
   * Toggle Habit & Prayer Log for today
   */
  async toggleHabit(habitId, completed) {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    // 1. Check if habit is a prayer habit
    let phQuery = `/rest/v1/prayer_habits?habit_id=eq.${habitId}&select=id,prayer_name`;
    if (this.userId) phQuery += `&user_id=eq.${this.userId}`;
    const phRes = await this.request(phQuery).catch(toEmptyUnlessAuthExpired);
    const prayerHabit = Array.isArray(phRes) && phRes.length > 0 ? phRes[0] : null;

    // 2. Upsert habit_logs
    let checkQuery = `/rest/v1/habit_logs?habit_id=eq.${habitId}&date=eq.${todayStr}&select=id`;
    if (this.userId) checkQuery += `&user_id=eq.${this.userId}`;
    const existing = await this.request(checkQuery);

    let habitLogId = null;

    if (Array.isArray(existing) && existing.length > 0) {
      habitLogId = existing[0].id;
      await this.request(`/rest/v1/habit_logs?id=eq.${habitLogId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          completed,
          completed_at: completed ? nowIso : null,
          ...(prayerHabit ? { source: 'prayer' } : {}),
        }),
      });
    } else {
      const payload = {
        habit_id: habitId,
        date: todayStr,
        completed,
        completed_at: completed ? nowIso : null,
        ...(prayerHabit ? { source: 'prayer' } : {}),
      };
      if (this.userId) payload.user_id = this.userId;

      const created = await this.request('/rest/v1/habit_logs', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(payload),
      });
      habitLogId = Array.isArray(created) ? created[0]?.id : created?.id;
    }

    // 3. If prayer habit, also upsert prayer_logs so webapp prayer tracker reflects the done status
    if (prayerHabit && prayerHabit.id) {
      let plQuery = `/rest/v1/prayer_logs?prayer_habit_id=eq.${prayerHabit.id}&date=eq.${todayStr}&select=id`;
      if (this.userId) plQuery += `&user_id=eq.${this.userId}`;
      const existingPl = await this.request(plQuery).catch(toEmptyUnlessAuthExpired);

      const prayerStatus = completed ? 'Prayed' : 'Not Prayed';
      const prayedAt = completed ? nowIso : null;

      if (Array.isArray(existingPl) && existingPl.length > 0) {
        await this.request(`/rest/v1/prayer_logs?id=eq.${existingPl[0].id}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            status: prayerStatus,
            prayed_at: prayedAt,
            habit_log_id: habitLogId,
          }),
        });
      } else {
        const plPayload = {
          prayer_habit_id: prayerHabit.id,
          date: todayStr,
          status: prayerStatus,
          prayed_at: prayedAt,
          habit_log_id: habitLogId,
        };
        if (this.userId) plPayload.user_id = this.userId;

        await this.request('/rest/v1/prayer_logs', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(plPayload),
        });
      }
    }

    return true;
  }

  /**
   * Fetch user Notes
   */
  async fetchNotes() {
    let query = `/rest/v1/notes?select=id,title,body,is_pinned,folder_id,created_at,updated_at&order=is_pinned.desc,updated_at.desc&limit=100`;
    if (this.userId) {
      query += `&user_id=eq.${this.userId}`;
    }

    const notes = await this.request(query);
    return Array.isArray(notes) ? notes : [];
  }

  /**
   * Find default note for clipping (e.g. "Projects I wanna try")
   */
  async findDefaultNote() {
    const notes = await this.fetchNotes();
    const targetName = (this.defaultNoteName || 'Projects I wanna try').toLowerCase().trim();

    const exactMatch = notes.find((n) => n.title && n.title.toLowerCase().trim() === targetName);
    if (exactMatch) return exactMatch;

    const fuzzyMatch = notes.find((n) => n.title && n.title.toLowerCase().includes('project'));
    if (fuzzyMatch) return fuzzyMatch;

    return notes[0] || null;
  }

  /**
   * Create a new Note
   */
  async createNote({ title, body, folderId = null, isPinned = false }) {
    const payload = {
      title: title.trim(),
      body: body.trim(),
      is_pinned: isPinned,
      folder_id: folderId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (this.userId) payload.user_id = this.userId;

    const res = await this.request('/rest/v1/notes', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(payload),
    });

    return Array.isArray(res) ? res[0] : res;
  }

  /**
   * Update or Append to Note
   */
  async updateNote(noteId, newContent, { append = true, prepend = false } = {}) {
    let finalBody = newContent;

    if (append || prepend) {
      const current = await this.request(`/rest/v1/notes?id=eq.${noteId}&select=id,title,body`);
      const existingBody = (Array.isArray(current) && current[0]?.body) ? current[0].body.trim() : '';

      if (append) {
        finalBody = existingBody ? `${existingBody}\n\n${newContent.trim()}` : newContent.trim();
      } else if (prepend) {
        finalBody = existingBody ? `${newContent.trim()}\n\n${existingBody}` : newContent.trim();
      }
    }

    const payload = {
      body: finalBody,
      updated_at: new Date().toISOString(),
    };

    const res = await this.request(`/rest/v1/notes?id=eq.${noteId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(payload),
    });

    return Array.isArray(res) ? res[0] : res;
  }

  /**
   * Log or increment active website screentime (Chronos tracker)
   */
  async logWebsiteScreentime({ domain, faviconUrl = null, seconds = 0 }) {
    // A row without user_id fails the "auth.uid() = user_id" RLS check (42501) instead of
    // silently attributing to nobody, so bail out rather than firing a doomed request when
    // the userId hasn't loaded yet (e.g. right after the service worker restarts).
    if (!domain || seconds <= 0 || !this.isConfigured() || !this.userId) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    let query = `/rest/v1/screentime_daily_website_stats?date=eq.${todayStr}&domain=eq.${encodeURIComponent(domain)}&source=eq.web&platform=eq.web&select=id,total_time_seconds,session_count`;
    if (this.userId) query += `&user_id=eq.${this.userId}`;

    try {
      const existing = await this.request(query);
      if (Array.isArray(existing) && existing.length > 0) {
        const item = existing[0];
        const updatedTotal = (Number(item.total_time_seconds) || 0) + seconds;

        await this.request(`/rest/v1/screentime_daily_website_stats?id=eq.${item.id}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            total_time_seconds: updatedTotal,
            last_active_at: nowIso,
            last_seen_at: nowIso,
            updated_at: nowIso,
            ...(faviconUrl ? { favicon_url: faviconUrl } : {}),
          }),
        });
      } else {
        const payload = {
          date: todayStr,
          source: 'web',
          platform: 'web',
          domain,
          favicon_url: faviconUrl,
          total_time_seconds: seconds,
          session_count: 1,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          last_active_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
          user_id: this.userId,
        };

        await this.request('/rest/v1/screentime_daily_website_stats', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(payload),
        });
      }
    } catch (err) {
      console.warn('Failed to log website screentime:', err);
    }
  }
}

export const supabaseClient = new SupabaseClient();
