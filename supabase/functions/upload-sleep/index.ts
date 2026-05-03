/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface SleepSegmentInput {
  Started: string;
  Ended: string;
  Duration: number;
  Name: string;
}

interface SleepPayload {
  user_id: string;
  segments?: SleepSegmentInput[];
  file_content?: string; // If sending raw file content
}

const VALID_STAGES = new Set(['Core', 'Deep', 'REM', 'Awake']);

function normalizeStage(name: unknown): string {
  const n = String(name ?? '').trim().replace(/\s+/g, '');
  if (!n) return 'Core';
  const lower = n.toLowerCase();
  // Explicit REM (acronym: rem, REM, Rem, " rem " all -> REM)
  if (lower === 'rem') return 'REM';
  // Handle acronyms (all uppercase)
  const upper = n.toUpperCase();
  if (VALID_STAGES.has(upper)) return upper;
  // Handle title case (Core, Deep, Awake)
  const cap = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  return VALID_STAGES.has(cap) ? cap : 'Core';
}

function parseIso(iso: unknown): string | null {
  if (!iso) return null;
  const str = String(iso).trim();
  if (!str) return null;
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function parseDuration(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // If > 1000, assume seconds; else assume minutes
    return value > 1000 ? Math.round(value / 60) : Math.max(0, Math.round(value));
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return Number.isFinite(num) ? (num > 1000 ? Math.round(num / 60) : Math.max(0, Math.round(num))) : 0;
  }
  return 0;
}

function fixUnquotedStrings(jsonStr: string): string {
  // Fix unquoted string values (e.g., "Name" : Core -> "Name" : "Core", "Name" : REM -> "Name" : "REM")
  // Match: "key" : value (key case-insensitive) where value is not quoted and not a number/boolean/null
  return jsonStr.replace(/("(?:Started|Ended|Duration|Name)"\s*:\s*)([^",}\[\]]+?)(\s*[,}])/gi, (match, prefix, value, suffix) => {
    const trimmed = value.trim();
    // Skip if it's already quoted, a number, boolean, or null
    if (trimmed.startsWith('"') || trimmed.match(/^-?\d+(\.\d+)?$/) || trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
      return match;
    }
    // Quote the value so REM, Core, Deep, Awake all become valid JSON
    return `${prefix}"${trimmed}"${suffix}`;
  });
}

function parseFileContent(content: string): SleepSegmentInput[] {
  const segments: SleepSegmentInput[] = [];
  if (!content || typeof content !== 'string') return segments;
  
  // Remove leading/trailing whitespace
  let cleaned = content.trim();
  
  // Fix unquoted string values before parsing (e.g., "Name" : Core -> "Name" : "Core")
  cleaned = fixUnquotedStrings(cleaned);
  
  // Try to parse as array first: [{...}, {...}]
  try {
    const wrapped = cleaned.startsWith('[') ? cleaned : `[${cleaned}]`;
    const parsed = JSON.parse(wrapped);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object');
    }
  } catch {}
  
  // Parse comma-separated JSON objects
  // Find all { ... } patterns (handles nested objects)
  let depth = 0;
  let start = -1;
  const objects: string[] = [];
  
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(cleaned.substring(start, i + 1));
        start = -1;
      }
    }
  }
  
  for (const objStr of objects) {
    try {
      const trimmed = objStr.trim();
      if (!trimmed || trimmed === '{}') continue;
      // Remove trailing comma if present, and fix unquoted values again (e.g. REM) in case this object wasn't fully fixed
      const cleanedObj = fixUnquotedStrings(trimmed.replace(/,\s*$/, ''));
      const obj = JSON.parse(cleanedObj);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        segments.push(obj);
      }
    } catch {
      // Try to fix trailing comma inside object
      try {
        const fixed = objStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/,\s*$/, '');
        const obj = JSON.parse(fixed);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          segments.push(obj);
        }
      } catch {
        // Skip invalid objects
      }
    }
  }
  
  return segments;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as SleepPayload;

    if (!payload.user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.user_id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user_id format. Must be a valid UUID.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse segments: either from payload.segments array OR from file_content string
    let rawSegments: any[] = [];
    if (Array.isArray(payload.segments)) {
      rawSegments = payload.segments;
    } else if (typeof payload.file_content === 'string' && payload.file_content.trim()) {
      rawSegments = parseFileContent(payload.file_content);
    } else if (typeof (payload as any).segments === 'string') {
      // If segments is a string (file content), parse it
      rawSegments = parseFileContent((payload as any).segments);
    }

    const rows: { user_id: string; started_at: string; ended_at: string; duration_minutes: number; stage: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      if (!seg || typeof seg !== 'object') {
        errors.push(`Segment ${i + 1}: invalid format (not an object)`);
        continue;
      }

      // Case-insensitive key lookup
      const startedRaw = seg.Started || seg.started || seg.STARTED;
      const endedRaw = seg.Ended || seg.ended || seg.ENDED;
      const durationRaw = seg.Duration || seg.duration || seg.DURATION;
      const nameRaw = seg.Name || seg.name || seg.NAME;

      const started = parseIso(startedRaw);
      if (!started) {
        errors.push(`Segment ${i + 1}: invalid Started timestamp "${startedRaw}"`);
        continue;
      }

      const ended = parseIso(endedRaw);
      if (!ended) {
        errors.push(`Segment ${i + 1}: invalid Ended timestamp "${endedRaw}"`);
        continue;
      }

      const duration = parseDuration(durationRaw);
      const stage = normalizeStage(nameRaw || 'Core');

      rows.push({
        user_id: payload.user_id,
        started_at: started,
        ended_at: ended,
        duration_minutes: duration,
        stage: stage,
      });
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid segments to insert',
          details: errors.length > 0 ? errors : ['No segments provided or all segments were invalid'],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert segments (by user_id + started_at)
    const { error: insertError } = await supabase.from('sleep_stages').upsert(rows, {
      onConflict: 'user_id,started_at',
    });

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database error', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: rows.length,
        total: rows.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorPreview = errorMessage.substring(0, 200);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process request',
        details: errorPreview,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
