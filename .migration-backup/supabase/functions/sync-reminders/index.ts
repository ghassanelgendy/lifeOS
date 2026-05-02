/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const syncRemSecret = Deno.env.get('SYNC_REM') ?? Deno.env.get('SYNC-REM') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-rem',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

type Mode = 'push' | 'pull' | 'ack' | 'delete';

interface ReminderInput {
  id: string;
  title: string;
  notes?: string | null;
  due_date?: string | null; // YYYY-MM-DD
  due_time?: string | null; // HH:mm or HH:mm:ss
  due_at?: string | null; // ISO-8601 (optional)
  completed?: boolean | null;
  completed_at?: string | null;
  list?: string | null;
  priority?: number | null; // iOS priority 1-9
  url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

function normalizeReminderId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return v.length > 0 ? v : null;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRemindersInput(input: unknown): ReminderInput[] {
  if (Array.isArray(input)) return input as ReminderInput[];
  if (input && typeof input === 'object') return [input as ReminderInput];
  if (typeof input !== 'string') return [];

  const text = input.trim();
  if (!text) return [];

  // Support newline-delimited JSON objects from Shortcuts logs.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ReminderInput[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object') out.push(parsed as ReminderInput);
    } catch {
      // Ignore malformed lines.
    }
  }
  return out;
}

function dedupeRemindersById(reminders: ReminderInput[]): ReminderInput[] {
  const byId = new Map<string, ReminderInput>();
  for (const r of reminders) {
    const rid = normalizeReminderId(r?.id);
    if (!r || !rid) continue;
    const prev = byId.get(rid);
    if (!prev) {
      byId.set(rid, { ...r, id: rid });
      continue;
    }
    const prevTime = parseIso(prev.updated_at) ?? parseIso(prev.completed_at) ?? parseIso(prev.created_at) ?? '1970-01-01T00:00:00.000Z';
    const nextTime = parseIso(r.updated_at) ?? parseIso(r.completed_at) ?? parseIso(r.created_at) ?? '1970-01-01T00:00:00.000Z';
    if (new Date(nextTime) >= new Date(prevTime)) {
      byId.set(rid, { ...r, id: rid });
    }
  }
  return Array.from(byId.values());
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidUuid(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

function parseIso(input: unknown): string | null {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function normalizeDate(value?: string | null, fallbackIso?: string | null): string | null {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (fallbackIso) {
    const parsed = parseIso(fallbackIso);
    if (parsed) return parsed.split('T')[0];
  }
  return null;
}

function normalizeTime(value?: string | null, fallbackIso?: string | null): string | null {
  if (value) {
    if (/^\d{1,2}:\d{2}$/.test(value)) return value;
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(value)) return value;
  }
  if (fallbackIso) {
    const parsed = parseIso(fallbackIso);
    if (parsed) return parsed.slice(11, 16);
  }
  return null;
}

function mapPriority(value?: number | null): 'none' | 'low' | 'medium' | 'high' {
  if (typeof value !== 'number') return 'none';
  if (value <= 3) return 'high';
  if (value <= 6) return 'medium';
  if (value <= 9) return 'low';
  return 'none';
}

function normalizeCompleted(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'yes' || v === 'true' || v === '1' || v === 'completed') return true;
    if (v === 'no' || v === 'false' || v === '0' || v === 'not completed') return false;
  }
  return false;
}

function normalizePriority(value: unknown): 'none' | 'low' | 'medium' | 'high' {
  if (typeof value === 'number') return mapPriority(value);
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'high' || v === '1') return 'high';
    if (v === 'medium' || v === '5') return 'medium';
    if (v === 'low' || v === '9') return 'low';
  }
  return 'none';
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function normalizeToken(token: string): string {
  return token.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const accessToken = getBearerToken(req);
  const headerSecret = (req.headers.get('x-sync-rem') ?? '').trim();
  const secretAuthorized = !!syncRemSecret && headerSecret === syncRemSecret;
  if (!secretAuthorized && !accessToken) return jsonResponse({ error: 'Unauthorized' }, 401);

  try {
    if (!anonKey) return jsonResponse({ error: 'SUPABASE_ANON_KEY is not configured.' }, 500);

    const body = await req.json();
    const mode = (body?.mode ?? 'push') as Mode;
    const userId = body?.user_id;

    if (!isValidUuid(userId)) {
      return jsonResponse({ error: 'Invalid or missing user_id (UUID required).' }, 400);
    }

    if (!secretAuthorized) {
      const normalizedAccessToken = normalizeToken(accessToken!);
      const isProjectKey =
        normalizedAccessToken === normalizeToken(anonKey) ||
        normalizedAccessToken === normalizeToken(serviceRoleKey);

      if (!isProjectKey) {
        const authClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${normalizedAccessToken}` } },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser();
        if (authError || !authData.user) {
          return jsonResponse({ error: 'Invalid bearer token. Use SUPABASE_ANON_KEY, service role key, or a valid user access token.' }, 401);
        }
        if (authData.user.id !== userId) {
          return jsonResponse({ error: 'user_id does not match authenticated user.' }, 403);
        }
      }
    }

    const nowIso = new Date().toISOString();

    if (mode === 'pull') {
      const sinceRaw = body?.since;
      const sinceIso = parseIso(sinceRaw);

      let query = supabase
        .from('tasks')
        .select('id,title,description,due_date,due_time,is_completed,completed_at,priority,url,ios_reminder_id,ios_reminder_list,ios_reminders_enabled,updated_at')
        .eq('user_id', userId)
        .eq('ios_reminders_enabled', true);

      if (sinceIso) {
        query = query.gt('updated_at', sinceIso);
      }

      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);

      // Defensive dedupe in case legacy duplicates exist in DB.
      const deduped = new Map<string, Record<string, unknown>>();
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const key = (row.ios_reminder_id as string | null) ?? `task:${String(row.id)}`;
        const prev = deduped.get(key);
        if (!prev) {
          deduped.set(key, row);
          continue;
        }
        const prevTime = parseIso(prev.updated_at) ?? '1970-01-01T00:00:00.000Z';
        const nextTime = parseIso(row.updated_at) ?? '1970-01-01T00:00:00.000Z';
        if (new Date(nextTime) > new Date(prevTime)) deduped.set(key, row);
      }

      return jsonResponse({
        success: true,
        server_time: nowIso,
        tasks: Array.from(deduped.values()),
      });
    }

    if (mode === 'ack') {
      const taskId = body?.task_id;
      const reminderId = body?.ios_reminder_id;
      if (!isValidUuid(taskId) || typeof reminderId !== 'string' || !reminderId) {
        return jsonResponse({ error: 'task_id (UUID) and ios_reminder_id are required.' }, 400);
      }

      const updatePayload = {
        ios_reminders_enabled: true,
        ios_reminder_id: reminderId,
        ios_reminder_list: body?.ios_reminder_list ?? null,
        ios_reminder_updated_at: parseIso(body?.ios_reminder_updated_at) ?? nowIso,
        updated_at: nowIso,
      };

      const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ success: true });
    }

    if (mode === 'delete') {
      const deletedIds = Array.isArray(body?.deleted_ids) ? body.deleted_ids.filter((id: unknown) => typeof id === 'string') : [];
      if (deletedIds.length === 0) {
        return jsonResponse({ success: true, deleted: 0 });
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', userId)
        .in('ios_reminder_id', deletedIds);

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ success: true, deleted: deletedIds.length });
    }

    // Default: push (iOS -> LifeOS)
    const reminders = dedupeRemindersById(parseRemindersInput(body?.reminders));
    const deletedIds = Array.isArray(body?.deleted_ids) ? body.deleted_ids.filter((id: unknown) => typeof id === 'string') : [];

    if (deletedIds.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', userId)
        .in('ios_reminder_id', deletedIds);

      if (error) return jsonResponse({ error: error.message }, 500);
    }

    if (reminders.length === 0) {
      return jsonResponse({ success: true, upserted: 0, skipped: 0, invalid: 0, received: 0, deleted: deletedIds.length });
    }

    // Ensure reminder lists exist as task lists, per user.
    const reminderListNames = Array.from(new Set(reminders
      .map((r) => normalizeName(r?.list))
      .filter((n): n is string => !!n)));
    const listIdByName = new Map<string, string>();

    if (reminderListNames.length > 0) {
      const { data: existingLists, error: listsError } = await supabase
        .from('task_lists')
        .select('id,name,sort_order')
        .eq('user_id', userId);
      if (listsError) return jsonResponse({ error: listsError.message }, 500);

      let maxSortOrder = 0;
      for (const row of (existingLists ?? []) as Array<{ id: string; name: string; sort_order: number | null }>) {
        const key = row.name.trim().toLowerCase();
        if (!listIdByName.has(key)) listIdByName.set(key, row.id);
        maxSortOrder = Math.max(maxSortOrder, Number(row.sort_order ?? 0));
      }

      const missingListRows: Array<{ user_id: string; name: string; sort_order: number }> = [];
      for (const name of reminderListNames) {
        const key = name.toLowerCase();
        if (listIdByName.has(key)) continue;
        maxSortOrder += 1;
        missingListRows.push({ user_id: userId, name, sort_order: maxSortOrder });
      }

      if (missingListRows.length > 0) {
        const { data: insertedLists, error: insertListsError } = await supabase
          .from('task_lists')
          .insert(missingListRows)
          .select('id,name');
        if (insertListsError) return jsonResponse({ error: insertListsError.message }, 500);
        for (const row of (insertedLists ?? []) as Array<{ id: string; name: string }>) {
          listIdByName.set(row.name.trim().toLowerCase(), row.id);
        }
      }

    }

    const reminderIds = reminders.map((r) => normalizeReminderId(r?.id)).filter((id): id is string => !!id);
    type ExistingTaskRow = { id: string; ios_reminder_id: string; updated_at?: string | null; ios_reminder_updated_at?: string | null };
    const existingByReminderId = new Map<string, ExistingTaskRow[]>();

    if (reminderIds.length > 0) {
      const { data, error } = await supabase
        .from('tasks')
        .select('id,ios_reminder_id,updated_at,ios_reminder_updated_at')
        .eq('user_id', userId)
        .in('ios_reminder_id', reminderIds);

      if (error) return jsonResponse({ error: error.message }, 500);

      for (const row of (data ?? []) as ExistingTaskRow[]) {
        if (row.ios_reminder_id) {
          const list = existingByReminderId.get(row.ios_reminder_id) ?? [];
          list.push(row);
          existingByReminderId.set(row.ios_reminder_id, list);
        }
      }
    }
    const cleanupDuplicateTaskIds = new Set<string>();
    const writes: Array<{ reminderId: string; row: Record<string, unknown>; targetTaskId: string | null }> = [];
    let skipped = 0;
    let invalid = 0;

    for (const reminder of reminders) {
      if (!reminder || typeof reminder.id !== 'string' || !reminder.title) {
        invalid += 1;
        continue;
      }

      const incomingUpdatedAt = parseIso(reminder.updated_at)
        ?? parseIso(reminder.completed_at)
        ?? parseIso(reminder.created_at)
        ?? nowIso;

      const reminderId = normalizeReminderId(reminder.id);
      if (!reminderId) {
        invalid += 1;
        continue;
      }
      const existingRows = existingByReminderId.get(reminderId) ?? [];
      const canonical = existingRows
        .slice()
        .sort((a, b) => {
          const aTime = parseIso(a.ios_reminder_updated_at) ?? parseIso(a.updated_at) ?? '1970-01-01T00:00:00.000Z';
          const bTime = parseIso(b.ios_reminder_updated_at) ?? parseIso(b.updated_at) ?? '1970-01-01T00:00:00.000Z';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        })[0];
      for (const row of existingRows) {
        if (canonical && row.id !== canonical.id) cleanupDuplicateTaskIds.add(row.id);
      }

      if (canonical) {
        const existingTime = parseIso(canonical.ios_reminder_updated_at) ?? parseIso(canonical.updated_at) ?? null;
        // Skip if incoming is older OR same timestamp as stored row.
        if (existingTime && new Date(incomingUpdatedAt) <= new Date(existingTime)) {
          skipped += 1;
          continue;
        }
      }

      const dueSource = reminder.due_at ?? reminder.due_date ?? null;
      const dueDate = normalizeDate(reminder.due_date ?? null, dueSource);
      const dueTime = normalizeTime(reminder.due_time ?? null, dueSource);
      const completed = normalizeCompleted(reminder.completed);
      const reminderListName = normalizeName(reminder.list);
      const reminderListKey = reminderListName?.toLowerCase() ?? null;
      const mappedListId = reminderListKey ? (listIdByName.get(reminderListKey) ?? null) : null;

      const row: Record<string, unknown> = {
        user_id: userId,
        title: reminder.title.trim() || 'Untitled',
        description: reminder.notes ?? null,
        due_date: dueDate,
        due_time: dueTime,
        is_completed: completed,
        completed_at: completed ? (parseIso(reminder.completed_at) ?? nowIso) : null,
        priority: normalizePriority(reminder.priority),
        url: reminder.url ?? null,
        reminders_enabled: !!(dueDate || dueTime),
        ios_reminders_enabled: true,
        ios_reminder_id: reminderId,
        ios_reminder_list: reminder.list ?? null,
        ios_reminder_updated_at: incomingUpdatedAt,
        updated_at: nowIso,
      };

      if (mappedListId) {
        row.list_id = mappedListId;
      }

      if (!canonical) {
        row.tag_ids = [];
        row.recurrence = 'none';
      }

      writes.push({ reminderId, row, targetTaskId: canonical?.id ?? null });
    }

    let upserted = 0;
    if (writes.length > 0) {
      for (const write of writes) {
        if (write.targetTaskId) {
          const { error } = await supabase
            .from('tasks')
            .update(write.row)
            .eq('id', write.targetTaskId)
            .eq('user_id', userId);
          if (error) return jsonResponse({ error: error.message }, 500);
          upserted += 1;
          continue;
        }

        // Final duplicate guard (handles stale lookup/concurrent pushes without DB unique index).
        const { data: alreadyExists, error: existsErr } = await supabase
          .from('tasks')
          .select('id,ios_reminder_updated_at,updated_at')
          .eq('user_id', userId)
          .eq('ios_reminder_id', write.reminderId);
        if (existsErr) return jsonResponse({ error: existsErr.message }, 500);

        if ((alreadyExists ?? []).length > 0) {
          const canonical = (alreadyExists as Array<{ id: string; ios_reminder_updated_at?: string | null; updated_at?: string | null }>)
            .slice()
            .sort((a, b) => {
              const aTime = parseIso(a.ios_reminder_updated_at) ?? parseIso(a.updated_at) ?? '1970-01-01T00:00:00.000Z';
              const bTime = parseIso(b.ios_reminder_updated_at) ?? parseIso(b.updated_at) ?? '1970-01-01T00:00:00.000Z';
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            })[0];
          if (!canonical) continue;
          for (const row of (alreadyExists as Array<{ id: string }>)) {
            if (canonical && row.id !== canonical.id) cleanupDuplicateTaskIds.add(row.id);
          }
          const { error } = await supabase
            .from('tasks')
            .update(write.row)
            .eq('user_id', userId)
            .eq('id', canonical.id);
          if (error) return jsonResponse({ error: error.message }, 500);
          upserted += 1;
          continue;
        }

        // Secondary dedupe: if iOS identifier changed, match by stable task content.
        const { data: contentMatches, error: contentErr } = await (() => {
          let q = supabase
            .from('tasks')
            .select('id,updated_at')
            .eq('user_id', userId)
            .eq('ios_reminders_enabled', true)
            .eq('title', String(write.row.title ?? ''))
            .eq('is_completed', Boolean(write.row.is_completed));
          const listVal = write.row.ios_reminder_list as string | null | undefined;
          const dueDateVal = write.row.due_date as string | null | undefined;
          const dueTimeVal = write.row.due_time as string | null | undefined;
          q = listVal ? q.eq('ios_reminder_list', listVal) : q.is('ios_reminder_list', null);
          q = dueDateVal ? q.eq('due_date', dueDateVal) : q.is('due_date', null);
          q = dueTimeVal ? q.eq('due_time', dueTimeVal) : q.is('due_time', null);
          return q.limit(5);
        })();
        if (contentErr) return jsonResponse({ error: contentErr.message }, 500);
        if ((contentMatches ?? []).length > 0) {
          const canonical = (contentMatches as Array<{ id: string; updated_at?: string | null }>)
            .slice()
            .sort((a, b) => {
              const aTime = parseIso(a.updated_at) ?? '1970-01-01T00:00:00.000Z';
              const bTime = parseIso(b.updated_at) ?? '1970-01-01T00:00:00.000Z';
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            })[0];
          if (canonical) {
            const { error } = await supabase
              .from('tasks')
              .update(write.row)
              .eq('user_id', userId)
              .eq('id', canonical.id);
            if (error) return jsonResponse({ error: error.message }, 500);
            upserted += 1;
            continue;
          }
        }

        const { error } = await supabase.from('tasks').insert(write.row);
        if (error) return jsonResponse({ error: error.message }, 500);
        upserted += 1;
      }
    }

    if (cleanupDuplicateTaskIds.size > 0) {
      const duplicateIds = Array.from(cleanupDuplicateTaskIds);
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', userId)
        .in('id', duplicateIds);
      if (error) return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({
      success: true,
      upserted,
      skipped,
      invalid,
      received: reminders.length,
      deleted: deletedIds.length,
      cleaned_duplicates: cleanupDuplicateTaskIds.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 400);
  }
});
