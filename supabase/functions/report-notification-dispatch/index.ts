/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

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
    'Access-Control-Allow-Origin': isAllowed ? origin! : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

if (!vapidPublic || !vapidPrivate) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}

webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic!, vapidPrivate!);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function getLocalComponents(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(date);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const year = Number(map.get('year'));
  const month = Number(map.get('month')); // 1-12
  const day = Number(map.get('day'));
  const weekdayStr = map.get('weekday'); // "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"

  const lastDay = new Date(year, month, 0).getDate();

  return {
    year,
    month,
    day,
    weekdayStr,
    lastDay,
    isSaturday: weekdayStr === 'Sat',
    isMonthlyDay: day === lastDay || day === 30,
    formattedDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    yearMonth: `${year}-${String(month).padStart(2, '0')}`,
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Cron-only endpoint: require shared secret when configured.
  const configuredSecrets = [
    Deno.env.get('CRON_SECRET')?.trim(),
    Deno.env.get('REPORTS_CRON_SECRET')?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  if (configuredSecrets.length > 0) {
    const headerSecret = req.headers.get('x-cron-secret')?.trim();
    const bearerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const apiKeySecret = req.headers.get('apikey')?.trim();
    const providedSecret = headerSecret ?? bearerSecret ?? apiKeySecret;
    const isAuthorized = !!providedSecret && configuredSecrets.some((s) => s === providedSecret);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const { data: subscriptionRows, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, timezone, user_id')
      .not('user_id', 'is', null);

    if (subscriptionError) throw subscriptionError;

    const subscriptions = ((subscriptionRows ?? []) as any[])
      .filter((sub) => sub.user_id && sub.endpoint && sub.p256dh && sub.auth);

    if (!subscriptions.length) {
      return new Response(JSON.stringify({ ok: true, results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriptionsByTimezone = new Map<string, any[]>();
    for (const sub of subscriptions) {
      const timezone = sub.timezone?.trim() || 'UTC';
      if (!subscriptionsByTimezone.has(timezone)) subscriptionsByTimezone.set(timezone, []);
      subscriptionsByTimezone.get(timezone)!.push(sub);
    }

    const results: any[] = [];
    const now = new Date();

    for (const [tz, timezoneSubscriptions] of subscriptionsByTimezone.entries()) {
      try {
        const local = getLocalComponents(now, tz);
        
        // Group subscriptions by user_id
        const subsByUser = new Map<string, any[]>();
        for (const sub of timezoneSubscriptions) {
          if (sub.user_id) {
            const list = subsByUser.get(sub.user_id) || [];
            list.push(sub);
            subsByUser.set(sub.user_id, list);
          }
        }

        let weeklySent = 0;
        let monthlySent = 0;

        for (const userId of subsByUser.keys()) {
          const userSubs = subsByUser.get(userId) || [];
          if (!userSubs.length) continue;

          // 1. Weekly Report (on Saturdays)
          if (local.isSaturday) {
            const idempotencyKey = `report:weekly:${userId}:${local.formattedDate}`;
            
            // Check if already sent
            const { data: existingLog } = await (supabase
              .from('notification_delivery_logs')
              .select('id, status')
              .eq('idempotency_key', idempotencyKey) as any).maybeSingle();

            if (!existingLog?.id) {
              // Register delivery start
              const { error: insertError } = await supabase.from('notification_delivery_logs').insert({
                user_id: userId,
                source_type: 'report',
                source_id: null,
                scheduled_for: now.toISOString(),
                status: 'pending',
                idempotency_key: idempotencyKey,
              });

              if (!insertError || (insertError as any).code === '23505') {
                if (!insertError) {
                  const payload = JSON.stringify({
                    reportType: 'weekly',
                    title: 'Your Weekly Wrap is Ready',
                    body: 'See how your week went and plan for next week!',
                  });
                  let anySuccess = false;
                  for (const sub of userSubs) {
                    try {
                      await webpush.sendNotification(
                        {
                          endpoint: sub.endpoint,
                          keys: { p256dh: sub.p256dh, auth: sub.auth },
                        },
                        payload
                      );
                      anySuccess = true;
                      weeklySent++;
                    } catch (e) {
                      console.error('Weekly Push failed', sub.endpoint.slice(0, 50), e);
                      if ((e as any).statusCode === 410 || (e as any).statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                      }
                    }
                  }

                  await supabase
                    .from('notification_delivery_logs')
                    .update({
                      status: anySuccess ? 'sent' : 'failed',
                      sent_at: anySuccess ? new Date().toISOString() : null,
                      error: anySuccess ? null : 'No valid subscriptions',
                    })
                    .eq('idempotency_key', idempotencyKey);
                }
              }
            }
          }

          // 2. Monthly Report (on last day of month or 30th)
          if (local.isMonthlyDay) {
            const idempotencyKey = `report:monthly:${userId}:${local.yearMonth}`;

            // Check if already sent
            const { data: existingLog } = await (supabase
              .from('notification_delivery_logs')
              .select('id, status')
              .eq('idempotency_key', idempotencyKey) as any).maybeSingle();

            if (!existingLog?.id) {
              // Register delivery start
              const { error: insertError } = await supabase.from('notification_delivery_logs').insert({
                user_id: userId,
                source_type: 'report',
                source_id: null,
                scheduled_for: now.toISOString(),
                status: 'pending',
                idempotency_key: idempotencyKey,
              });

              if (!insertError || (insertError as any).code === '23505') {
                if (!insertError) {
                  const payload = JSON.stringify({
                    reportType: 'monthly',
                    title: 'Your Monthly Wrap is Ready',
                    body: 'Discover your top trends and stats for this month!',
                  });
                  let anySuccess = false;
                  for (const sub of userSubs) {
                    try {
                      await webpush.sendNotification(
                        {
                          endpoint: sub.endpoint,
                          keys: { p256dh: sub.p256dh, auth: sub.auth },
                        },
                        payload
                      );
                      anySuccess = true;
                      monthlySent++;
                    } catch (e) {
                      console.error('Monthly Push failed', sub.endpoint.slice(0, 50), e);
                      if ((e as any).statusCode === 410 || (e as any).statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                      }
                    }
                  }

                  await supabase
                    .from('notification_delivery_logs')
                    .update({
                      status: anySuccess ? 'sent' : 'failed',
                      sent_at: anySuccess ? new Date().toISOString() : null,
                      error: anySuccess ? null : 'No valid subscriptions',
                    })
                    .eq('idempotency_key', idempotencyKey);
                }
              }
            }
          }
        }

        results.push({ timezone: tz, users: subsByUser.size, weeklySent, monthlySent });
      } catch (tzProcError) {
        console.error(`Failed to process timezone ${tz}`, tzProcError);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
