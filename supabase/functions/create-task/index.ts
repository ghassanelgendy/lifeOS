/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const taskSecret = Deno.env.get('TASK_WEBHOOK_SECRET') ?? Deno.env.get('CREATE_TASK_SECRET') ?? Deno.env.get('SYNC_REM') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-task-secret, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

type PriorityType = 'none' | 'low' | 'medium' | 'high';

function isValidUuid(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

function parsePriority(val: unknown): PriorityType {
  if (typeof val === 'number') {
    if (val <= 3) return 'high';
    if (val <= 6) return 'medium';
    if (val <= 9) return 'low';
    return 'none';
  }
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (['high', 'urgent', 'p1', '1', 'critical', 'important'].includes(s)) return 'high';
    if (['medium', 'med', 'p2', '5', 'normal'].includes(s)) return 'medium';
    if (['low', 'p3', '9'].includes(s)) return 'low';
    if (['none', 'p4', '0'].includes(s)) return 'none';
  }
  return 'none';
}

function getLocalTodayAndTomorrow(timeZone = 'Africa/Cairo'): { today: string; tomorrow: string } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = formatter.format(now);

    const tmrwDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrow = formatter.format(tmrwDate);
    return { today, tomorrow };
  } catch {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    return { today, tomorrow };
  }
}

function parseDateAndTime(
  dateInput?: unknown,
  timeInput?: unknown,
  timeZone = 'Africa/Cairo'
): { dueDate: string | null; dueTime: string | null } {
  let dueDate: string | null = null;
  let dueTime: string | null = null;

  const dateStr = typeof dateInput === 'string' ? dateInput.trim() : (dateInput ? String(dateInput).trim() : '');
  const timeStr = typeof timeInput === 'string' ? timeInput.trim() : (timeInput ? String(timeInput).trim() : '');

  const { today, tomorrow } = getLocalTodayAndTomorrow(timeZone);

  if (dateStr) {
    const lower = dateStr.toLowerCase();
    if (lower === 'today' || lower === 'اليوم') {
      dueDate = today;
    } else if (lower === 'tomorrow' || lower === 'غدا' || lower === 'بكرة') {
      dueDate = tomorrow;
    } else {
      // 1. Check DD-MM-YYYY or DD/MM/YYYY with optional time, e.g. "30-08-2026 14:20:17" or "30-08-2026"
      const dmyMatch = dateStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
      if (dmyMatch) {
        const d = parseInt(dmyMatch[1], 10);
        const m = parseInt(dmyMatch[2], 10);
        const y = parseInt(dmyMatch[3], 10);
        dueDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (dmyMatch[4] && dmyMatch[5]) {
          const h = String(parseInt(dmyMatch[4], 10)).padStart(2, '0');
          const min = String(parseInt(dmyMatch[5], 10)).padStart(2, '0');
          const s = dmyMatch[6] ? String(parseInt(dmyMatch[6], 10)).padStart(2, '0') : '00';
          dueTime = `${h}:${min}:${s}`;
        }
      }

      // 2. Check YYYY-MM-DD or YYYY/MM/DD with optional time, e.g. "2026-08-30 14:20:17" or "2026-08-30"
      if (!dueDate) {
        const ymdMatch = dateStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
        if (ymdMatch) {
          const y = parseInt(ymdMatch[1], 10);
          const m = parseInt(ymdMatch[2], 10);
          const d = parseInt(ymdMatch[3], 10);
          dueDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (ymdMatch[4] && ymdMatch[5]) {
            const h = String(parseInt(ymdMatch[4], 10)).padStart(2, '0');
            const min = String(parseInt(ymdMatch[5], 10)).padStart(2, '0');
            const s = ymdMatch[6] ? String(parseInt(ymdMatch[6], 10)).padStart(2, '0') : '00';
            dueTime = `${h}:${min}:${s}`;
          }
        }
      }

      // 3. Fallback to ISO / RFC date parse if not matched yet
      if (!dueDate) {
        const parsed = new Date(dateStr);
        if (!Number.isNaN(parsed.getTime())) {
          try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
              timeZone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            dueDate = formatter.format(parsed);

            if (!timeStr && !dueTime) {
              const timeFormatter = new Intl.DateTimeFormat('en-GB', {
                timeZone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              });
              const extractedTime = timeFormatter.format(parsed);
              if (extractedTime && extractedTime !== '00:00:00') {
                dueTime = extractedTime;
              }
            }
          } catch {
            dueDate = parsed.toISOString().split('T')[0];
          }
        }
      }
    }
  }

  // If timeInput is explicitly provided, it takes precedence over time extracted from dateStr
  if (timeStr) {
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match24) {
      const h = String(parseInt(match24[1], 10)).padStart(2, '0');
      const m = String(parseInt(match24[2], 10)).padStart(2, '0');
      const s = match24[3] ? String(parseInt(match24[3], 10)).padStart(2, '0') : '00';
      dueTime = `${h}:${m}:${s}`;
    } else {
      const match12 = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
      if (match12) {
        let h = parseInt(match12[1], 10);
        const m = match12[2] ? parseInt(match12[2], 10) : 0;
        const ampm = match12[3].toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      }
    }
  }

  return { dueDate, dueTime };
}

function extractSubtasksAndCleanDescription(description?: string | null): {
  subtasks: string[];
  cleanedDescription: string;
} {
  if (!description) return { subtasks: [], cleanedDescription: '' };
  const lines = description.split(/\r?\n/);
  const subtasks: string[] = [];
  const remainingLines: string[] = [];

  for (const line of lines) {
    const checkboxMatch = line.match(/^\s*(?:-\s*\[\s*\]|\*\s*\[\s*\])\s+(.+)$/);
    const bulletMatch = line.match(/^\s*-\s+(.+)$/);
    if (checkboxMatch) {
      const title = checkboxMatch[1].trim();
      if (title) subtasks.push(title);
    } else if (bulletMatch && line.trim().startsWith('- ')) {
      const title = bulletMatch[1].trim();
      if (title && title.length < 120 && !title.includes('http')) {
        subtasks.push(title);
      } else {
        remainingLines.push(line);
      }
    } else {
      remainingLines.push(line);
    }
  }

  return {
    subtasks,
    cleanedDescription: remainingLines.join('\n').trim(),
  };
}

async function parseIncoming(req: Request): Promise<Record<string, unknown>> {
  const url = new URL(req.url);
  const queryParams: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  if (req.method === 'GET') {
    return queryParams;
  }

  const ct = (req.headers.get('content-type') || '').toLowerCase();
  let bodyData: Record<string, unknown> = {};

  if (ct.includes('application/json')) {
    try {
      bodyData = (await req.json()) as Record<string, unknown>;
    } catch {
      bodyData = {};
    }
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    const raw = await req.text();
    const parts = raw.split('&');
    for (const p of parts) {
      if (!p) continue;
      const eq = p.indexOf('=');
      const k = eq >= 0 ? p.slice(0, eq) : p;
      const v = eq >= 0 ? p.slice(eq + 1) : '';
      const key = decodeURIComponent((k || '').replace(/\+/g, ' '));
      const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
      if (key) bodyData[key] = val;
    }
  } else {
    const raw = await req.text();
    if (raw && raw.trim()) {
      try {
        bodyData = JSON.parse(raw);
      } catch {
        bodyData = { text: raw.trim() };
      }
    }
  }

  return { ...queryParams, ...bodyData };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseIncoming(req);

    // 1. Resolve User ID
    let userId: string | null = null;
    const bodyUserId = body.user_id ?? body.userId;
    if (typeof bodyUserId === 'string' && isValidUuid(bodyUserId)) {
      userId = bodyUserId;
    }

    const emailParam = body.email ?? body.user_email;
    const userEmail = typeof emailParam === 'string' ? emailParam.trim() : null;

    // Check authorization header
    const authHeader = req.headers.get('authorization') ?? '';
    const secretHeader = req.headers.get('x-task-secret') ?? req.headers.get('x-api-key') ?? (body.secret as string) ?? '';
    const isSecretAuthorized = !!taskSecret && secretHeader === taskSecret;

    if (!userId && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      if (token && !token.includes('eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYmd4Ynp3YXNncGJmemZhYm5sIiwicm9sZSI6ImFub24i')) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user?.id) userId = user.id;
        } catch {}
      }
    }

    if (!userId && userEmail) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const found = (userData?.users || []).find((u: any) => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (found) userId = found.id;
    }

    // Default fallback to primary user if single user setup
    if (!userId) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      if (userData?.users?.length) {
        const primary = userData.users.find((u: any) => u.email?.includes('ghassan')) || userData.users[0];
        if (primary) userId = primary.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'user_id is required or could not be determined.',
          hint: 'Provide "user_id" (UUID) or "email" in the request body, or pass an Authorization Bearer token.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Extract Task Attributes
    const rawTitle =
      body.title ??
      body.subject ??
      body.task ??
      body.name ??
      body.summary ??
      body.text ??
      '';
    const titleStr = typeof rawTitle === 'string' ? rawTitle.trim() : String(rawTitle).trim();

    if (!titleStr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Task title is required.',
          usage: {
            method: 'POST',
            body: {
              title: 'Task Title',
              description: 'Task details / email body',
              due_date: '30-08-2026 14:20:17',
              priority: 'high',
              list: 'Work',
              tags: ['servixa'],
              url: 'message://...',
            },
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawDescription =
      body.description ??
      body.notes ??
      body.content ??
      body.body ??
      body.details ??
      body.email_body ??
      '';
    const descriptionStr = typeof rawDescription === 'string' ? rawDescription.trim() : (rawDescription ? String(rawDescription).trim() : '');

    const timeZone = typeof body.timezone === 'string' ? body.timezone : 'Africa/Cairo';

    const rawDueDate = body.due_date ?? body.dueDate ?? body.due ?? body.deadline ?? body.date ?? body.due_at ?? body.dueAt ?? body.datetime;
    const rawDueTime = body.due_time ?? body.dueTime ?? body.time;

    const { dueDate, dueTime } = parseDateAndTime(rawDueDate, rawDueTime, timeZone);

    const priority = parsePriority(body.priority);
    const isUrgent = Boolean(body.is_urgent ?? body.urgent ?? (priority === 'high'));
    const isFlagged = Boolean(body.is_flagged ?? body.flagged);
    const taskUrl = typeof body.url === 'string' ? body.url.trim() : (typeof body.link === 'string' ? body.link.trim() : null);
    const pointsValue = typeof body.points_value === 'number' ? body.points_value : (typeof body.points === 'number' ? body.points : null);
    const durationMinutes = typeof body.duration_minutes === 'number' ? body.duration_minutes : (typeof body.duration === 'number' ? body.duration : null);

    // 3. Resolve or Create List
    let listId: string | null = null;
    let resolvedListName: string | null = null;
    const rawList = body.list_id ?? body.list ?? body.list_name ?? body.category ?? body.folder ?? body.project;

    if (rawList) {
      if (typeof rawList === 'string' && isValidUuid(rawList)) {
        listId = rawList;
      } else if (typeof rawList === 'string' && rawList.trim()) {
        const targetName = rawList.trim();
        const { data: existingLists } = await supabase
          .from('task_lists')
          .select('id, name')
          .eq('user_id', userId);

        const match = (existingLists || []).find(
          (l: any) => l.name.trim().toLowerCase() === targetName.toLowerCase()
        );

        if (match) {
          listId = match.id;
          resolvedListName = match.name;
        } else {
          // Auto-create the list if it doesn't exist
          const { data: newList, error: createListErr } = await supabase
            .from('task_lists')
            .insert({
              user_id: userId,
              name: targetName,
              sort_order: (existingLists?.length || 0) + 1,
            })
            .select('id, name')
            .single();

          if (!createListErr && newList) {
            listId = newList.id;
            resolvedListName = newList.name;
          }
        }
      }
    }

    // 4. Resolve Tags (defaults to ['servixa'] if no tags provided)
    const rawTags = body.tags ?? body.tag_names ?? body.tag_ids;
    let tagNamesToMatch: string[] = [];
    let explicitTagIds: string[] = [];

    if (Array.isArray(rawTags)) {
      for (const t of rawTags) {
        if (typeof t === 'string') {
          if (isValidUuid(t)) explicitTagIds.push(t);
          else if (t.trim()) tagNamesToMatch.push(t.trim());
        }
      }
    } else if (typeof rawTags === 'string' && rawTags.trim()) {
      const parts = rawTags.split(',').map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (isValidUuid(p)) explicitTagIds.push(p);
        else tagNamesToMatch.push(p);
      }
    }

    // If no tags were provided, default to 'servixa'
    if (tagNamesToMatch.length === 0 && explicitTagIds.length === 0) {
      tagNamesToMatch.push('servixa');
    }

    const finalTagIds: string[] = [...explicitTagIds];
    const resolvedTagNames: string[] = [];

    if (tagNamesToMatch.length > 0) {
      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name');

      for (const name of tagNamesToMatch) {
        const found = (existingTags || []).find(
          (t: any) => t.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (found) {
          if (!finalTagIds.includes(found.id)) {
            finalTagIds.push(found.id);
            resolvedTagNames.push(found.name);
          }
        } else {
          // Auto-create missing tag
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ name, color: '#6366f1' })
            .select('id, name')
            .single();
          if (newTag && !finalTagIds.includes(newTag.id)) {
            finalTagIds.push(newTag.id);
            resolvedTagNames.push(newTag.name);
          }
        }
      }
    }

    // 5. Parse Subtasks
    const { subtasks: extractedSubtasks, cleanedDescription } = extractSubtasksAndCleanDescription(descriptionStr);
    let explicitSubtasks: string[] = [];
    if (Array.isArray(body.subtasks)) {
      for (const st of body.subtasks) {
        if (typeof st === 'string' && st.trim()) explicitSubtasks.push(st.trim());
        else if (st && typeof st === 'object' && typeof (st as any).title === 'string') {
          explicitSubtasks.push((st as any).title.trim());
        }
      }
    }
    const allSubtasks = Array.from(new Set([...extractedSubtasks, ...explicitSubtasks]));
    const finalDescription = cleanedDescription || descriptionStr || null;

    // 6. Duplicate Guard (Idempotency)
    const idempotencyKey = body.idempotency_key ?? body.email_id ?? body.message_id;
    const nowIso = new Date().toISOString();

    const { data: recentDuplicates } = await supabase
      .from('tasks')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .eq('title', titleStr)
      .gte('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString())
      .limit(1);

    if (recentDuplicates && recentDuplicates.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          message: 'Task with the same title was recently created (idempotency guard).',
          task: recentDuplicates[0],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Insert Main Task
    const taskPayload: Record<string, unknown> = {
      user_id: userId,
      title: titleStr,
      description: finalDescription,
      due_date: dueDate,
      due_time: dueTime,
      is_completed: false,
      priority,
      is_urgent: isUrgent,
      is_flagged: isFlagged,
      url: taskUrl,
      list_id: listId,
      tag_ids: finalTagIds,
      recurrence: 'none',
      reminders_enabled: Boolean(dueDate || dueTime),
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (pointsValue !== null) taskPayload.points_value = pointsValue;
    if (durationMinutes !== null) taskPayload.duration_minutes = durationMinutes;

    const { data: createdTask, error: insertError } = await supabase
      .from('tasks')
      .insert(taskPayload)
      .select()
      .single();

    if (insertError) {
      console.error('Task insert error:', insertError);
      throw insertError;
    }

    // 8. Insert Subtasks if any
    const createdSubtasks: any[] = [];
    if (allSubtasks.length > 0 && createdTask?.id) {
      const subtaskRows = allSubtasks.map((title, idx) => ({
        user_id: userId,
        parent_id: createdTask.id,
        title,
        is_completed: false,
        priority: 'none',
        tag_ids: [],
        recurrence: 'none',
        sort_order: idx + 1,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { data: insertedSubtasks, error: subtaskErr } = await supabase
        .from('tasks')
        .insert(subtaskRows)
        .select();

      if (!subtaskErr && insertedSubtasks) {
        createdSubtasks.push(...insertedSubtasks);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Task created successfully',
        task: {
          ...createdTask,
          list_name: resolvedListName,
          tag_names: resolvedTagNames,
        },
        subtasks: createdSubtasks,
        subtasks_count: createdSubtasks.length,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('create-task error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal server error while creating task',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
