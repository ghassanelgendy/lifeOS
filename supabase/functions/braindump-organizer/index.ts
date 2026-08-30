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

  // Verify auth / cron secret
  const configuredSecrets = [
    Deno.env.get('CRON_SECRET')?.trim(),
    Deno.env.get('BRAINDUMP_CRON_SECRET')?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = req.headers.get('x-cron-secret')?.trim();
  const apiKeyHeader = req.headers.get('apikey')?.trim();
  const providedSecret = headerSecret ?? authHeader ?? apiKeyHeader;

  if (configuredSecrets.length > 0) {
    const isAuthorized = !!providedSecret && (configuredSecrets.includes(providedSecret) || providedSecret === serviceRoleKey);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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

    // 1. Fetch user app settings to obtain API keys and active models
    const { data: allUserSettings, error: settingsError } = await supabase
      .from('user_app_settings')
      .select('user_id, settings');

    if (settingsError) {
      console.error('[BrainDump Organizer] Error loading user settings:', settingsError);
    }

    const userSettingsMap = new Map<string, any>();
    let primaryUserSetting: any = null;

    for (const row of allUserSettings || []) {
      if (row.settings) {
        userSettingsMap.set(row.user_id, row.settings);
        if (row.settings.aiEnabled && !primaryUserSetting) {
          primaryUserSetting = { user_id: row.user_id, settings: row.settings };
        }
      }
    }

    // 2. Fetch unorganized brain dump notes
    let notesQuery = supabase
      .from('notes')
      .select('*')
      .eq('is_brain_dump', true);

    if (forcedNoteId) {
      notesQuery = notesQuery.eq('id', forcedNoteId);
    } else {
      notesQuery = notesQuery.lt('note_date', todayStr);
      if (!force) {
        notesQuery = notesQuery.is('ai_analysis', null);
      }
    }

    const { data: rawNotes, error: notesError } = await notesQuery.order('created_at', { ascending: false });

    if (notesError) {
      throw notesError;
    }

    console.log(`[BrainDump Organizer] Found ${rawNotes?.length || 0} candidate notes to process`);

    const processedResults: any[] = [];

    for (const rawDump of rawNotes || []) {
      const cleanBody = (rawDump.body || '')
        .replace(/\*\*🕒[^\n]+\*\*/g, '')
        .replace(/New Day Started\. Capture your thoughts\.\.\./g, '')
        .trim();

      if (!cleanBody || cleanBody.length < 5) {
        // Mark as empty / processed to avoid repeatedly scanning empty template notes
        await supabase
          .from('notes')
          .update({
            ai_analysis: { empty: true, processed_at: new Date().toISOString() },
            ...(rawDump.user_id ? {} : { user_id: primaryUserSetting?.user_id || null })
          })
          .eq('id', rawDump.id);

        processedResults.push({ id: rawDump.id, title: rawDump.title, status: 'skipped_empty' });
        continue;
      }

      // Determine the user settings for AI calls
      const noteUserId = rawDump.user_id || primaryUserSetting?.user_id;
      const userSettings = (noteUserId ? userSettingsMap.get(noteUserId) : null) || primaryUserSetting?.settings || {};

      // Build AI candidates
      const candidates: CandidateConfig[] = [];
      const primaryApiKey = userSettings.aiApiKey || userSettings.aiDahlApiKey;
      const primaryBaseUrl = userSettings.aiBaseUrl || 'https://inference.dahl.global/v1';
      const primaryModel = userSettings.aiActiveModel || userSettings.aiModel || 'MiniMaxAI/MiniMax-M2.7';

      if (primaryApiKey) {
        candidates.push({ baseUrl: primaryBaseUrl, apiKey: primaryApiKey, model: primaryModel });
      }
      if (userSettings.aiDahlApiKey && userSettings.aiDahlApiKey !== primaryApiKey) {
        candidates.push({ baseUrl: 'https://inference.dahl.global/v1', apiKey: userSettings.aiDahlApiKey, model: 'MiniMaxAI/MiniMax-M2.7' });
      }
      if (userSettings.aiBynaraApiKey) {
        candidates.push({ baseUrl: 'https://inference.dahl.global/v1', apiKey: userSettings.aiBynaraApiKey, model: 'MiniMaxAI/MiniMax-M2.7' });
      }
      // Environment fallbacks
      const envDahl = Deno.env.get('DAHL_API_KEY');
      if (envDahl) {
        candidates.push({ baseUrl: 'https://inference.dahl.global/v1', apiKey: envDahl, model: 'MiniMaxAI/MiniMax-M2.7' });
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
      let orgFolderId: string | null = null;
      let folderQuery = supabase.from('note_folders').select('*').ilike('name', 'organized brain dumps');
      if (noteUserId) {
        folderQuery = folderQuery.eq('user_id', noteUserId);
      }
      const { data: existingFolders } = await folderQuery;
      let orgFolder = existingFolders?.[0];

      if (!orgFolder) {
        const { data: createdFolder } = await supabase
          .from('note_folders')
          .insert({
            name: 'Organized Brain Dumps',
            sort_order: 1,
            user_id: noteUserId || null,
          })
          .select()
          .single();
        orgFolder = createdFolder;
      }
      orgFolderId = orgFolder?.id || null;

      // 4. Fetch user's task lists and tags for smart categorization
      const { data: userLists } = await supabase.from('task_lists').select('id, name');
      const { data: userTags } = await supabase.from('tags').select('id, name');

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

        // 5. Build unified note body with structured AI summary on top and raw thoughts below
        const unifiedBody = [
          `### 📌 Brief Summary\n${parsed?.summary || 'Concise daily dump organization.'}`,
          parsed?.insights?.length ? `\n### 💡 Key Takeaways\n${parsed.insights.map((i: string) => `- ${i}`).join('\n')}` : '',
          parsed?.tasks?.length ? `\n### ⚡ Action Items\n${parsed.tasks.map((t: any) => `- [ ] ${t.title}`).join('\n')}` : '',
          parsed?.projects_or_notes?.length ? `\n### 📝 Core Ideas\n${parsed.projects_or_notes.map((p: any) => `**${p.title}:** ${p.content}`).join('\n')}` : '',
          `\n---\n### 🕒 Raw Thoughts Log\n${rawDump.body || ''}`,
        ].filter(Boolean).join('\n');

        // 6. Update existing note in-place (Single Unified Note per Day - No Duplicate Notes)
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            body: unifiedBody,
            ai_analysis: parsed,
            folder_id: orgFolderId,
            user_id: noteUserId || null,
            is_brain_dump: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rawDump.id);

        if (updateError) {
          throw updateError;
        }

        // 7. Delete any previous orphaned duplicate organized note for this date if it exists
        if (rawDump.note_date) {
          await supabase
            .from('notes')
            .delete()
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

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedResults.length,
        results: processedResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (globalErr: any) {
    console.error('[BrainDump Organizer] Global error:', globalErr);
    return new Response(
      JSON.stringify({ error: String(globalErr) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
