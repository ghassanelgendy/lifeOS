// Send a test push notification to a specific subscription.
// Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY in Supabase secrets.
/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// We will check for keys inside the handler to return a proper 500 response
if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails('mailto:lifeos@example.com', vapidPublic, vapidPrivate);
} else {
    console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (!vapidPublic || !vapidPrivate) {
        return new Response(JSON.stringify({ error: 'Server Misconfiguration: Missing VAPID Keys in Supabase Secrets' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await req.json();
        const endpoint = (body as any).endpoint;

        if (!endpoint) {
            return new Response(JSON.stringify({ error: 'Missing endpoint' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Get subscription from DB
        const { data: sub, error } = await supabase
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('endpoint', endpoint)
            .single();

        if (error || !sub) {
            return new Response(JSON.stringify({ error: 'Subscription not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const subscription = sub as any;

        const payload = JSON.stringify({
            title: 'Test Notification',
            taskId: 'test-notification', // Special ID
        });

        try {
            await webpush.sendNotification(
                {
                    endpoint: subscription.endpoint,
                    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
                },
                payload
            );
        } catch (pushError: any) {
            console.error('Web Push Error:', pushError);
            return new Response(JSON.stringify({ error: `Web Push Failed: ${pushError.message || pushError}` }), {
                status: 502, // Bad Gateway
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
