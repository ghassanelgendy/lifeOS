/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Format local date and time in user's timezone (defaults to Africa/Cairo or UTC)
 */
function getLocalTimeInfo(timeZone = 'Africa/Cairo') {
  try {
    const now = new Date();
    const formatterDate = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = formatterDate.format(now); // YYYY-MM-DD

    const formatterTime = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const timeStr = formatterTime.format(now); // e.g. "04:20 PM"

    const parts = dateStr.split('-');
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);
    const shortTitle = `${day}/${month}`;

    return { dateStr, timeStr, shortTitle };
  } catch {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const shortTitle = `${now.getDate()}/${now.getMonth() + 1}`;
    return { dateStr, timeStr, shortTitle };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let text = '';
    let userId: string | null = null;
    let userEmail: string | null = null;
    let timeZone = 'Africa/Cairo';

    const url = new URL(req.url);

    // 1. Check URL query parameters
    if (url.searchParams.has('text')) {
      text = url.searchParams.get('text') || '';
    }
    if (url.searchParams.has('user_id')) {
      userId = url.searchParams.get('user_id');
    }
    if (url.searchParams.has('email')) {
      userEmail = url.searchParams.get('email');
    }
    if (url.searchParams.has('timezone')) {
      timeZone = url.searchParams.get('timezone') || timeZone;
    }

    // 2. Check Request Body (JSON or Plain Text)
    if (!text && (req.method === 'POST' || req.method === 'PUT')) {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}));
        text = body.text || body.content || body.thought || body.body || body.note || '';
        if (body.user_id) userId = body.user_id;
        if (body.email) userEmail = body.email;
        if (body.timezone) timeZone = body.timezone;
      } else {
        text = await req.text().catch(() => '');
      }
    }

    // 3. Check Authorization header for User JWT if user_id is not yet provided
    const authHeader = req.headers.get('authorization') || '';
    if (!userId && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      // If not the anon key, try resolving auth user from JWT
      if (token && !token.includes('eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYmd4Ynp3YXNncGJmemZhYm5sIiwicm9sZSI6ImFub24i')) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user?.id) {
            userId = user.id;
          }
        } catch {}
      }
    }

    // 4. If email is provided, resolve to user_id
    if (!userId && userEmail) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const found = (userData?.users || []).find((u: any) => u.email?.toLowerCase() === userEmail!.toLowerCase());
      if (found) {
        userId = found.id;
      }
    }

    // 5. Default fallback to primary user if still unresolved
    if (!userId) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      if (userData?.users?.length) {
        // Match ghassanelgendyy or take the first user
        const primary = userData.users.find((u: any) => u.email?.includes('ghassan')) || userData.users[0];
        if (primary) userId = primary.id;
      }
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return new Response(
        JSON.stringify({
          error: 'Missing text parameter. Please provide the thought/note text to append.',
          usage: {
            method: 'POST',
            body: { text: 'My thought to append...', user_id: 'your-user-uuid' },
            orQuery: '?text=My+thought&user_id=...',
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { dateStr, timeStr, shortTitle } = getLocalTimeInfo(timeZone);

    // 6. Ensure 'Unorganized Brain Dumps' note folder exists for this specific user
    let folderId: string | null = null;
    try {
      let folderQuery = supabase
        .from('note_folders')
        .select('*')
        .or('name.ilike.Unorganized Brain Dumps,name.ilike.Unorganized');
      if (userId) folderQuery = folderQuery.eq('user_id', userId);

      const { data: existingFolders } = await folderQuery.limit(1);
      if (existingFolders && existingFolders.length > 0) {
        folderId = existingFolders[0].id;
      } else {
        const insertPayload: any = { name: 'Unorganized Brain Dumps', sort_order: 2 };
        if (userId) insertPayload.user_id = userId;
        const { data: createdFolder } = await supabase
          .from('note_folders')
          .insert(insertPayload)
          .select()
          .single();
        if (createdFolder) folderId = createdFolder.id;
      }
    } catch (e) {
      console.warn('Folder resolution warning:', e);
    }

    // 7. Query for Today's Brain Dump note for this specific user
    let noteQuery = supabase
      .from('notes')
      .select('*')
      .eq('is_brain_dump', true)
      .eq('note_date', dateStr);
    if (userId) noteQuery = noteQuery.eq('user_id', userId);

    const { data: existingNotes, error: fetchError } = await noteQuery.order('created_at', { ascending: false }).limit(1);
    if (fetchError) {
      throw fetchError;
    }

    const targetNote = existingNotes?.[0];
    let noteId: string;
    let action: 'appended' | 'created';

    if (targetNote) {
      // 5A. Append to today's existing brain dump note
      const currentBody = (targetNote.body || '').trim();
      const updatedBody = currentBody
        ? `${currentBody}\n\n---\n**🕒 ${timeStr}:**\n${trimmedText}`
        : `**🕒 ${timeStr}:**\n${trimmedText}`;

      const { error: updateError } = await supabase
        .from('notes')
        .update({
          body: updatedBody,
          ai_analysis: null, // Reset analysis to mark as pending fresh organization
          folder_id: targetNote.folder_id || folderId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetNote.id);

      if (updateError) throw updateError;
      noteId = targetNote.id;
      action = 'appended';
    } else {
      // 5B. Create new unified daily note titled D/M
      const insertPayload: any = {
        title: shortTitle,
        body: `**🕒 ${timeStr}:**\n${trimmedText}`,
        note_date: dateStr,
        is_brain_dump: true,
        ai_analysis: null,
        folder_id: folderId || null,
        tags: ['brain_dump', 'inbox'],
      };
      if (userId) insertPayload.user_id = userId;

      const { data: newNote, error: insertError } = await supabase
        .from('notes')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;
      noteId = newNote.id;
      action = 'created';
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: action === 'appended'
          ? `Successfully appended thought to Today's Brain Dump (${dateStr} @ ${timeStr})`
          : `Created new Brain Dump note for today (${shortTitle} @ ${timeStr})`,
        action,
        note_id: noteId,
        note_date: dateStr,
        timestamp: timeStr,
        appended_text: trimmedText,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('append-braindump error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal server error while appending thought',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
