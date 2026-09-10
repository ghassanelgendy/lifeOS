/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_ORIGINS') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const isAllowed = !!origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

function cleanAiResponse(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractJSON(text: string): any {
  let cleaned = cleanAiResponse(text).trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    cleaned = match[0];
  }
  return JSON.parse(cleaned.trim());
}

interface CandidateConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const DAHL_BASE_URL = 'https://inference.dahl.global/v1';
const BYNARA_BASE_URL = 'https://router.bynara.id/v1';

// Mirrors the priority-ordered model lists in src/lib/aiFallback.ts's AI_PROVIDERS catalog
// (top few per provider only, to keep worst-case latency bounded — this cron job processes
// many notes per run and each attempt gets its own 35s timeout).
const DAHL_MODELS = ['MiniMaxAI/MiniMax-M2.7', 'moonshotai/Kimi-K2.6', 'deepseek-ai/DeepSeek-V4-Flash-0731'];
const BYNARA_MODELS = ['agnes-2.5-flash', 'mistral-large', 'deepseek-v4-pro'];

// cron-job.org (and most cron dispatchers) give up waiting on the HTTP response well before
// a batch of AI calls can finish — each candidate attempt alone gets a 35s timeout, and a
// note can fall through several candidates. So this only ever processes a bounded slice of
// notes per invocation, synchronously enough to respond inside that window; anything left
// over waits for the next scheduled run instead of piling more work onto a request that's
// already about to time out.
const MAX_NOTES_PER_RUN = 3;

/** A previously-organized note's body is `Summary + Action Items + ... + Raw Thoughts Log`.
 * Re-organizing must feed the AI only the genuine raw entries, not the AI's own prior
 * summary/checkboxes nested inside "Raw Thoughts Log" — otherwise each re-organize pass
 * buries the real content one level deeper until the model sees nothing new to extract. */
function extractRawMaterial(body: string): string {
  const marker = '### 🕒 Raw Thoughts Log';
  const idx = body.lastIndexOf(marker);
  if (idx === -1) return body;
  return body.slice(idx + marker.length).trim();
}

/** Expands one resolved (baseUrl, apiKey) pair into one candidate per model in that
 * provider's priority list, so a single dead/renamed model doesn't sink an otherwise-valid key. */
function expandCandidates(baseUrl: string, apiKey: string, models: string[]): CandidateConfig[] {
  return models.map((model) => ({ baseUrl, apiKey, model }));
}

async function callChatCompletion(candidates: CandidateConfig[], systemPrompt: string, userPrompt: string): Promise<any> {
  let lastError: any = null;

  for (const candidate of candidates) {
    if (!candidate.apiKey || !candidate.baseUrl) continue;
    const cleanBaseUrl = candidate.baseUrl.trim().replace(/\/+$/, '');
    const endpoint = `${cleanBaseUrl}/chat/completions`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${candidate.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: candidate.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const resData = await response.json();
      const content = resData?.choices?.[0]?.message?.content || '';
      if (!content) {
        throw new Error('Empty AI response content');
      }

      const parsed = extractJSON(content);
      return parsed;
    } catch (err) {
      lastError = err;
      console.warn(`[BrainDump Organizer] Candidate ${candidate.model} on ${candidate.baseUrl} failed:`, err);
    }
  }

  throw lastError || new Error('No valid AI candidate responded successfully');
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Verify auth / cron secret. Accepts either an env-configured secret (Vercel cron proxy /
  // cron-job.org) or the Vault-stored secret used by the Postgres pg_cron job
  // (process_midnight_braindumps) that drives the actual midnight auto-organize run.
  const configuredSecrets = [
    Deno.env.get('CRON_SECRET')?.trim(),
    Deno.env.get('BRAINDUMP_CRON_SECRET')?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = req.headers.get('x-cron-secret')?.trim();
  const apiKeyHeader = req.headers.get('apikey')?.trim();
  const providedSecret = headerSecret ?? authHeader ?? apiKeyHeader;

  let isAuthorized =
    !!providedSecret && (configuredSecrets.includes(providedSecret) || providedSecret === serviceRoleKey);

  if (!isAuthorized && providedSecret) {
    const { data: vaultOk } = await supabase.rpc('verify_braindump_cron_secret', { p_secret: providedSecret });
    isAuthorized = vaultOk === true;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let requestBody: any = {};
  if (req.method === 'POST') {
    try {
      requestBody = await req.json();
    } catch {}
  }

  const { note_id: forcedNoteId, force = false, target_date } = requestBody;

  try {
    const now = new Date();
    const todayStr = target_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    console.log(`[BrainDump Organizer] Starting run for date boundary: ${todayStr}, forceNoteId=${forcedNoteId || 'none'}`);

    // 1. Fetch user app settings to obtain API keys and active models. Only users who have
    // explicitly opted in via `brainDumpAutoOrganizeEnabled` (default false) are eligible —
    // this job must never run for a user's notes without their consent, and must never use
    // one user's AI keys/settings to process another user's data.
    const { data: allUserSettings, error: settingsError } = await supabase
      .from('user_app_settings')
      .select('user_id, settings');

    if (settingsError) {
      console.error('[BrainDump Organizer] Error loading user settings:', settingsError);
    }

    const optedInUserSettings = new Map<string, any>();
    for (const row of allUserSettings || []) {
      if (row.settings?.brainDumpAutoOrganizeEnabled === true && row.user_id) {
        optedInUserSettings.set(row.user_id, row.settings);
      }
    }

    const optedInUserIds = Array.from(optedInUserSettings.keys());
    console.log(`[BrainDump Organizer] ${optedInUserIds.length} user(s) opted in to auto-organize`);

    if (optedInUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed_count: 0, results: [], skipped: 'no_opted_in_users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch unorganized brain dump notes, restricted to opted-in users only
    let notesQuery = supabase
      .from('notes')
      .select('*')
      .eq('is_brain_dump', true)
      .in('user_id', optedInUserIds);

    if (forcedNoteId) {
      notesQuery = notesQuery.eq('id', forcedNoteId);
    } else {
      notesQuery = notesQuery.lt('note_date', todayStr);
      // Not filtering by `ai_analysis is null` here on purpose: a note previously stamped
      // {empty:true} (or successfully organized) but edited afterward must still be picked
      // up. The already-processed-and-unedited case is instead filtered in JS below by
      // comparing updated_at against ai_analysis.processed_at.
    }

    const { data: rawNotes, error: notesError } = await notesQuery.order('created_at', { ascending: false });

    if (notesError) {
      throw notesError;
    }

    console.log(`[BrainDump Organizer] Found ${rawNotes?.length || 0} candidate notes to process`);

    const allCandidateNotes = rawNotes || [];
    if (allCandidateNotes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed_count: 0, results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only a bounded slice is actually attempted this invocation (see MAX_NOTES_PER_RUN)
    // — the rest wait for the next scheduled run rather than risk this one running long.
    const batch = forcedNoteId ? allCandidateNotes : allCandidateNotes.slice(0, MAX_NOTES_PER_RUN);
    const deferredCount = allCandidateNotes.length - batch.length;

    // Respond to the caller (cron-job.org et al) immediately, then keep working via
    // EdgeRuntime.waitUntil() — AI calls can each take up to 35s and a note may fall through
    // several candidates, which blows past any cron dispatcher's HTTP wait (cron-job.org
    // caps at 30s). The caller only needed confirmation the run was picked up; the actual
    // per-note results are only in the function logs from here on.
    EdgeRuntime.waitUntil(
      processNoteBatch(batch, optedInUserSettings, todayStr, force, forcedNoteId)
        .then((results) => {
          console.log(`[BrainDump Organizer] Background batch complete:`, JSON.stringify(results));
        })
        .catch((err) => {
          console.error('[BrainDump Organizer] Background batch failed:', err);
        })
    );

    return new Response(
      JSON.stringify({
        success: true,
        accepted: true,
        queued_count: batch.length,
        deferred_count: deferredCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (globalErr: any) {
    console.error('[BrainDump Organizer] Global error:', globalErr);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processNoteBatch(
  notes: any[],
  optedInUserSettings: Map<string, any>,
  todayStr: string,
  force: boolean,
  forcedNoteId: string | undefined
): Promise<any[]> {
  const processedResults: any[] = [];

  for (const rawDump of notes) {
      if (!force && !forcedNoteId) {
        const processedAt = rawDump.ai_analysis?.processed_at;
        if (processedAt && new Date(rawDump.updated_at) <= new Date(processedAt)) {
          // Already processed (organized or stamped empty) and not touched since — skip.
          continue;
        }
      }

      const cleanBody = extractRawMaterial(rawDump.body || '')
        .replace(/\*\*🕒[^\n]+\*\*/g, '')
        .replace(/New Day Started\. Capture your thoughts\.\.\./g, '')
        .trim();

      if (!cleanBody || cleanBody.length < 5) {
        // Mark as empty / processed to avoid repeatedly scanning empty template notes. Share
        // one timestamp with updated_at (see the success path below for why).
        const emptyProcessedAtIso = new Date().toISOString();
        await supabase
          .from('notes')
          .update({ ai_analysis: { empty: true, processed_at: emptyProcessedAtIso }, updated_at: emptyProcessedAtIso })
          .eq('id', rawDump.id);

        processedResults.push({ id: rawDump.id, title: rawDump.title, status: 'skipped_empty' });
        continue;
      }

      // The notes query above is already restricted to opted-in users, so every row here has
      // a user_id present in optedInUserSettings. Never fall back to another user's settings —
      // if this note's owner has no settings row for some reason, skip rather than guess.
      const noteUserId: string = rawDump.user_id;
      const userSettings = optedInUserSettings.get(noteUserId);
      if (!userSettings) {
        console.warn(`[BrainDump Organizer] Skipping note ${rawDump.id}: owner ${noteUserId} has no opted-in settings`);
        processedResults.push({ id: rawDump.id, title: rawDump.title, status: 'skipped_not_opted_in' });
        continue;
      }

      // Build AI candidates. If the user picked an explicit custom model/base URL, honor it
      // first (respecting their choice), then cascade through every other configured key
      // across each provider's own priority-ordered model list — mirroring the client's
      // getFallbackCandidates() in src/lib/aiFallback.ts instead of trying one hardcoded
      // model per key and giving up.
      let candidates: CandidateConfig[] = [];

      if (userSettings.aiApiKey && userSettings.aiBaseUrl && userSettings.aiActiveModel) {
        candidates.push({ baseUrl: userSettings.aiBaseUrl, apiKey: userSettings.aiApiKey, model: userSettings.aiActiveModel });
      }
      if (userSettings.aiDahlApiKey) {
        candidates = candidates.concat(expandCandidates(DAHL_BASE_URL, userSettings.aiDahlApiKey, DAHL_MODELS));
      }
      if (userSettings.aiBynaraApiKey) {
        candidates = candidates.concat(expandCandidates(BYNARA_BASE_URL, userSettings.aiBynaraApiKey, BYNARA_MODELS));
      }
      // A generic aiApiKey with no explicit provider info attached is treated as a Dahl key
      // (matching resolvedDahlKey's fallback order in aiFallback.ts), tried after the
      // user's explicitly-labeled provider keys above.
      if (userSettings.aiApiKey && !(userSettings.aiBaseUrl && userSettings.aiActiveModel)) {
        candidates = candidates.concat(expandCandidates(DAHL_BASE_URL, userSettings.aiApiKey, DAHL_MODELS));
      }

      // Environment fallbacks (Supabase Edge Function secrets — set via `supabase secrets
      // set`, NOT the frontend's VITE_-prefixed .env vars, which never reach this runtime).
      const envDahl = Deno.env.get('DAHL_API_KEY');
      if (envDahl) {
        candidates = candidates.concat(expandCandidates(DAHL_BASE_URL, envDahl, DAHL_MODELS));
      }
      const envBynara = Deno.env.get('BYNARA_API_KEY');
      if (envBynara) {
        candidates = candidates.concat(expandCandidates(BYNARA_BASE_URL, envBynara, BYNARA_MODELS));
      }
      const envOpenAI = Deno.env.get('OPENAI_API_KEY');
      if (envOpenAI) {
        candidates.push({ baseUrl: 'https://api.openai.com/v1', apiKey: envOpenAI, model: 'gpt-4o-mini' });
      }

      if (candidates.length === 0) {
        console.warn(`[BrainDump Organizer] No AI keys found for note ${rawDump.id}`);
        processedResults.push({ id: rawDump.id, title: rawDump.title, status: 'failed_no_ai_keys' });
        continue;
      }

      // 3. Ensure 'Organized Brain Dumps' folder exists for this user
      const { data: existingFolders } = await supabase
        .from('note_folders')
        .select('*')
        .ilike('name', 'organized brain dumps')
        .eq('user_id', noteUserId);
      let orgFolder = existingFolders?.[0];

      if (!orgFolder) {
        const { data: createdFolder } = await supabase
          .from('note_folders')
          .insert({
            name: 'Organized Brain Dumps',
            sort_order: 1,
            user_id: noteUserId,
          })
          .select()
          .single();
        orgFolder = createdFolder;
      }
      const orgFolderId: string | null = orgFolder?.id || null;

      // 4. Fetch this user's own task lists and tags only — never another user's
      const { data: userLists } = await supabase.from('task_lists').select('id, name').eq('user_id', noteUserId);
      const { data: userTags } = await supabase.from('tags').select('id, name').eq('user_id', noteUserId);

      const listNames = (userLists || []).map((l: any) => l.name).join(', ') || 'Work, Learn, Personal, Ideas, Reminders, Shopping, Someday';
      const tagNames = (userTags || []).map((t: any) => t.name).join(', ') || 'servixa, ischool, assignment, research, quiz, mov, lifeos, urgent, important, quick win, waiting';

      const systemPrompt = `You are lifeOS Executive Summarizer & Task Classifier. Analyze this brain dump. Produce a BRIEF, CONCISE, bulleted summary of key insights, action points, and ideas.
Available Task Lists: ${listNames}
Available Tags: ${tagNames}

Return ONLY valid JSON in this format:
{
  "summary": "Concise 1-2 sentence overview",
  "clarity_score": 90,
  "insights": ["Key takeaway 1", "Key takeaway 2"],
  "tasks": [
    {
      "title": "Actionable task title",
      "suggested_list": "Best matching list from available lists",
      "suggested_tag": "Best matching tag from available tags",
      "priority": "high" | "medium" | "low" | "urgent",
      "estimated_duration": 30
    }
  ],
  "projects_or_notes": [{"title": "Core concept or project title", "content": "Brief description"}]
}`;

      try {
        const parsed = await callChatCompletion(candidates, systemPrompt, cleanBody);

        // 4b. Actually create real Task rows for extracted action items (not just
        // "- [ ]" checkboxes baked into the note text), carrying the raw dump text
        // into each task's description. Skip titles already linked to this note so
        // repeated runs (e.g. force re-organize) don't create duplicates.
        if (parsed?.tasks?.length) {
          const { data: existingLinkedTasks } = await supabase
            .from('tasks')
            .select('title')
            .eq('source_note_id', rawDump.id);
          const alreadyLinkedTitles = new Set(
            (existingLinkedTasks || []).map((t: any) => (t.title || '').trim().toLowerCase())
          );
          const listByName = new Map((userLists || []).map((l: any) => [l.name.toLowerCase(), l.id]));
          const tagByName = new Map((userTags || []).map((t: any) => [t.name.toLowerCase(), t.id]));

          for (const t of parsed.tasks) {
            const title = (t?.title || '').trim();
            if (!title || alreadyLinkedTitles.has(title.toLowerCase())) continue;
            const listId = listByName.get((t.suggested_list || '').toLowerCase()) || (userLists || [])[0]?.id || null;
            const tagId = tagByName.get((t.suggested_tag || '').toLowerCase());
            const { error: taskInsertError } = await supabase.from('tasks').insert({
              title,
              description: cleanBody,
              priority: t.priority || 'medium',
              due_date: todayStr,
              duration_minutes: t.estimated_duration || 30,
              list_id: listId,
              tag_ids: tagId ? [tagId] : [],
              source_note_id: rawDump.id,
              user_id: noteUserId,
              is_completed: false,
            });
            if (taskInsertError) {
              console.error(`[BrainDump Organizer] Failed to create task "${title}" for note ${rawDump.id}:`, taskInsertError);
            }
          }
        }

        // 5. Build unified note body with structured AI summary on top and raw thoughts below
        const unifiedBody = [
          `### 📌 Brief Summary\n${parsed?.summary || 'Concise daily dump organization.'}`,
          parsed?.insights?.length ? `\n### 💡 Key Takeaways\n${parsed.insights.map((i: string) => `- ${i}`).join('\n')}` : '',
          parsed?.tasks?.length ? `\n### ⚡ Action Items\n${parsed.tasks.map((t: any) => `- [ ] ${t.title}`).join('\n')}` : '',
          parsed?.projects_or_notes?.length ? `\n### 📝 Core Ideas\n${parsed.projects_or_notes.map((p: any) => `**${p.title}:** ${p.content}`).join('\n')}` : '',
          `\n---\n### 🕒 Raw Thoughts Log\n${cleanBody}`,
        ].filter(Boolean).join('\n');

        // 6. Update existing note in-place (Single Unified Note per Day - No Duplicate Notes)
        let organizedTitle = rawDump.title;
        if (rawDump.note_date) {
          const parts = rawDump.note_date.split('T')[0].split('-');
          if (parts.length === 3) {
            organizedTitle = `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}`;
          }
        }
        // Share one timestamp between updated_at and ai_analysis.processed_at — if updated_at
        // ended up even 1ms later than processed_at, the next cron run's "edited since last
        // processed" check (updated_at <= processed_at) would treat this note as freshly
        // edited and reprocess it every single run.
        const processedAtIso = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            title: organizedTitle,
            body: unifiedBody,
            ai_analysis: { ...parsed, processed_at: processedAtIso },
            folder_id: orgFolderId,
            user_id: noteUserId,
            is_brain_dump: true,
            updated_at: processedAtIso,
          })
          .eq('id', rawDump.id);

        if (updateError) {
          throw updateError;
        }

        // 7. Delete any previous orphaned duplicate organized note for this date/user if it exists
        if (rawDump.note_date) {
          await supabase
            .from('notes')
            .delete()
            .eq('user_id', noteUserId)
            .eq('note_date', rawDump.note_date)
            .ilike('title', '% organized%')
            .neq('id', rawDump.id);
        }

        processedResults.push({
          id: rawDump.id,
          title: rawDump.title,
          status: 'success',
          summary: parsed.summary,
        });
    } catch (err: any) {
      console.error(`[BrainDump Organizer] Error analyzing note ${rawDump.id}:`, err);
      processedResults.push({ id: rawDump.id, title: rawDump.title, status: 'error', error: String(err) });
    }
  }

  return processedResults;
}
