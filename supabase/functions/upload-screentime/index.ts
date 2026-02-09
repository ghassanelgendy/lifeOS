/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface AppData {
  AppName: string;
  Category: string;
  ProcessPath?: string;
  TotalTime: string;
  SessionCount: number;
  FirstSeen: string;
  LastSeen: string;
  LastActiveTime: string;
}

interface WebsiteData {
  Domain: string;
  TotalTime: string;
  SessionCount: number;
  FirstSeen: string;
  LastSeen: string;
  LastActiveTime: string;
  FaviconUrl?: string;
}

interface DayData {
  Date: string;
  Apps: Record<string, AppData>;
  Websites: Record<string, WebsiteData>;
  TotalSwitches?: number;
  TotalTime?: string;
  TotalApps?: number;
}

interface ScreentimePayload {
  user_id: string;
  device_id?: string;
  platform: string;
  source: string;
  data: {
    Years: Record<string, {
      Months: Record<string, {
        Weeks: Record<string, {
          Days: Record<string, DayData>;
        }>;
      }>;
    }>;
  };
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const secondsParts = parts[2].split('.');
  const seconds = parseInt(secondsParts[0], 10) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseDateToDateString(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr.split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr.split('T')[0];
  }
}

function parseTimestamp(tsStr: string): string | null {
  try {
    const date = new Date(tsStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ScreentimePayload;

    if (!payload.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.data || !payload.data.Years) {
      return new Response(
        JSON.stringify({ error: 'data.Years is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.user_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user_id format. Must be a valid UUID.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const source = payload.source || 'pc';
    const platform = payload.platform || 'windows';
    const deviceId = payload.device_id || '';

    const appRows: any[] = [];
    const websiteRows: any[] = [];
    const summaryRows: any[] = [];

    for (const yearKey in payload.data.Years) {
      const year = payload.data.Years[yearKey];
      if (!year.Months) continue;
      
      for (const monthKey in year.Months) {
        const month = year.Months[monthKey];
        if (!month.Weeks) continue;
        
        for (const weekKey in month.Weeks) {
          const week = month.Weeks[weekKey];
          if (!week.Days) continue;
          
          for (const dayKey in week.Days) {
            const day = week.Days[dayKey];
            if (!day.Date) continue;
            
            const dateStr = parseDateToDateString(day.Date);
            
            // Debug: Log day structure to see what fields are available
            if (Object.keys(day).length > 0 && !day.TotalSwitches && !day.TotalApps) {
              console.log(`[DEBUG] Day ${dateStr} keys:`, Object.keys(day));
              console.log(`[DEBUG] Day ${dateStr} sample:`, JSON.stringify(day).substring(0, 200));
            }

            if (day.Apps) {
              for (const appKey in day.Apps) {
                const app = day.Apps[appKey];
                appRows.push({
                  user_id: payload.user_id,
                  date: dateStr,
                  source,
                  device_id: deviceId,
                  platform,
                  app_name: app.AppName || appKey,
                  category: app.Category || 'Uncategorized',
                  process_path: app.ProcessPath || null,
                  total_time_seconds: parseTimeToSeconds(app.TotalTime),
                  session_count: app.SessionCount || 0,
                  first_seen_at: app.FirstSeen ? parseTimestamp(app.FirstSeen) : null,
                  last_seen_at: app.LastSeen ? parseTimestamp(app.LastSeen) : null,
                  last_active_at: app.LastActiveTime ? parseTimestamp(app.LastActiveTime) : null,
                });
              }
            }

            if (day.Websites) {
              for (const domainKey in day.Websites) {
                const website = day.Websites[domainKey];
                websiteRows.push({
                  user_id: payload.user_id,
                  date: dateStr,
                  source,
                  device_id: deviceId,
                  platform,
                  domain: website.Domain || domainKey,
                  favicon_url: website.FaviconUrl || null,
                  total_time_seconds: parseTimeToSeconds(website.TotalTime),
                  session_count: website.SessionCount || 0,
                  first_seen_at: website.FirstSeen ? parseTimestamp(website.FirstSeen) : null,
                  last_seen_at: website.LastSeen ? parseTimestamp(website.LastSeen) : null,
                  last_active_at: website.LastActiveTime ? parseTimestamp(website.LastActiveTime) : null,
                });
              }
            }

            // Store daily summary (switches, total apps)
            // Always create a summary row for each day, even if switches/apps are 0 or missing
            const switches = day.TotalSwitches ?? 0;
            const apps = day.TotalApps ?? 0;
            
            // Debug logging: Check if TotalSwitches field exists in the day object
            if (day.TotalSwitches === undefined && day.TotalApps === undefined) {
              console.log(`[WARN] Day ${dateStr}: TotalSwitches and TotalApps are both undefined. Available keys:`, Object.keys(day));
            }
            
            // Log for debugging if switches are present
            if (switches > 0) {
              console.log(`[${dateStr}] Adding summary: switches=${switches}, apps=${apps}`);
            }
            
            summaryRows.push({
              user_id: payload.user_id,
              date: dateStr,
              source,
              device_id: deviceId,
              platform,
              total_switches: switches,
              total_apps: apps,
            });
          }
        }
      }
    }

    let appInserted = 0;
    let websiteInserted = 0;
    let summaryInserted = 0;
    const appErrors: string[] = [];
    const websiteErrors: string[] = [];
    const summaryErrors: string[] = [];

    if (appRows.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < appRows.length; i += batchSize) {
        const batch = appRows.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('screentime_daily_app_stats')
          .upsert(batch)
          .select() as { data: any[] | null; error: { message: string } | null };
        
        if (error) {
          console.error(`Error inserting app stats batch ${Math.floor(i / batchSize) + 1}:`, error);
          appErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          appInserted += Array.isArray(data) ? data.length : 0;
        }
      }
    }

    if (websiteRows.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < websiteRows.length; i += batchSize) {
        const batch = websiteRows.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('screentime_daily_website_stats')
          .upsert(batch)
          .select() as { data: any[] | null; error: { message: string } | null };
        
        if (error) {
          console.error(`Error inserting website stats batch ${Math.floor(i / batchSize) + 1}:`, error);
          websiteErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          websiteInserted += Array.isArray(data) ? data.length : 0;
        }
      }
    }

    // Insert daily summaries (switches)
    console.log(`Total summary rows to insert: ${summaryRows.length}`);
    if (summaryRows.length > 0) {
      // Log first few rows for debugging
      if (summaryRows.length > 0) {
        console.log('Sample summary row:', JSON.stringify(summaryRows[0], null, 2));
      }
      
      const batchSize = 500;
      for (let i = 0; i < summaryRows.length; i += batchSize) {
        const batch = summaryRows.slice(i, i + batchSize);
        console.log(`Inserting summary batch ${Math.floor(i / batchSize) + 1}, size: ${batch.length}`);
        
        const { data, error } = await supabase
          .from('screentime_daily_summary')
          .upsert(batch)
          .select() as { data: any[] | null; error: { message: string } | null };
        
        if (error) {
          console.error(`Error inserting summary batch ${Math.floor(i / batchSize) + 1}:`, error);
          console.error('Batch data:', JSON.stringify(batch.slice(0, 2), null, 2)); // Log first 2 rows of failed batch
          summaryErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          const inserted = Array.isArray(data) ? data.length : 0;
          console.log(`Successfully inserted ${inserted} summary rows in batch ${Math.floor(i / batchSize) + 1}`);
          summaryInserted += inserted;
        }
      }
    } else {
      console.warn('No summary rows to insert! Check if TotalSwitches/TotalApps are in the JSON payload.');
    }

    if (appErrors.length > 0 || websiteErrors.length > 0 || summaryErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'Some batches failed',
          inserted: {
            apps: appInserted,
            websites: websiteInserted,
            summaries: summaryInserted,
          },
          total: {
            apps: appRows.length,
            websites: websiteRows.length,
            summaries: summaryRows.length,
          },
          errors: {
            apps: appErrors,
            websites: websiteErrors,
            summaries: summaryErrors,
          },
        }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: {
          apps: appInserted,
          websites: websiteInserted,
          summaries: summaryInserted,
        },
        total: {
          apps: appRows.length,
          websites: websiteRows.length,
          summaries: summaryRows.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: String(err), stack: err instanceof Error ? err.stack : undefined }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
