// Send Push Notifications via Firebase Cloud Messaging (API V1)
// Supabase Edge Function - Uses Service Account

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Firebase Service Account - from environment
const FIREBASE_PROJECT_ID = 'tubarao-emprestimo';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || 'firebase-adminsdk-fbsvc@tubarao-emprestimo.iam.gserviceaccount.com';
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';

interface PushRequest {
    to: string | string[]; // email(s) or 'admin' or 'all'
    notification: {
        title: string;
        body: string;
        icon?: string;
    };
    data?: Record<string, string>;
}

// Generate JWT for Firebase API V1
async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour

    // JWT Header
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    // JWT Payload
    const payload = {
        iss: FIREBASE_CLIENT_EMAIL,
        sub: FIREBASE_CLIENT_EMAIL,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: exp,
        scope: 'https://www.googleapis.com/auth/firebase.messaging'
    };

    // Encode header and payload
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Import private key and sign
    const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = privateKey.substring(pemHeader.length, privateKey.indexOf(pemFooter)).replace(/\s/g, '');
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        encoder.encode(unsignedToken)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const jwt = `${unsignedToken}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
        console.error('Token error:', tokenData);
        throw new Error('Failed to get access token');
    }

    return tokenData.access_token;
}

// Send push via FCM V1 API
async function sendFCMv1(accessToken: string, token: string, notification: { title: string; body: string; icon?: string }, data?: Record<string, string>) {
    const message = {
        message: {
            token: token,
            notification: {
                title: notification.title,
                body: notification.body
            },
            webpush: {
                notification: {
                    icon: notification.icon || '/Logo.png',
                    badge: '/Logo.png',
                    requireInteraction: true
                },
                fcm_options: {
                    link: data?.link || '/'
                }
            },
            data: data || {}
        }
    };

    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        }
    );

    return await response.json();
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Check Firebase credentials
        if (!FIREBASE_PRIVATE_KEY) {
            console.error('FIREBASE_PRIVATE_KEY not set');
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Firebase not configured. Set FIREBASE_PRIVATE_KEY in Supabase secrets.'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // Parse request
        const { to, notification, data }: PushRequest = await req.json();

        if (!to || !notification?.title) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing required fields: to, notification.title' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // Create Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get FCM tokens based on "to" parameter
        let tokens: string[] = [];

        if (to === 'admin') {
            // Get all admin tokens
            const { data: adminUsers } = await supabase
                .from('users')
                .select('email')
                .eq('role', 'ADMIN');

            if (adminUsers && adminUsers.length > 0) {
                const emails = adminUsers.map((u: any) => u.email);
                const { data: subscriptions } = await supabase
                    .from('push_subscriptions')
                    .select('fcm_token')
                    .in('user_email', emails)
                    .eq('is_active', true);

                tokens = subscriptions?.map((s: any) => s.fcm_token) || [];
            }
        } else if (to === 'all') {
            // Get all active tokens
            const { data: subscriptions } = await supabase
                .from('push_subscriptions')
                .select('fcm_token')
                .eq('is_active', true);

            tokens = subscriptions?.map((s: any) => s.fcm_token) || [];
        } else {
            // Get tokens for specific email(s)
            const emails = Array.isArray(to) ? to : [to];
            const { data: subscriptions } = await supabase
                .from('push_subscriptions')
                .select('fcm_token')
                .in('user_email', emails)
                .eq('is_active', true);

            tokens = subscriptions?.map((s: any) => s.fcm_token) || [];
        }

        if (tokens.length === 0) {
            console.log('No tokens found for:', to);
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No active subscriptions found',
                    sent: 0,
                    failed: 0
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Sending push to ${tokens.length} device(s)`);

        // Get access token for FCM V1
        const accessToken = await getAccessToken();

        // Send to each token
        let sent = 0;
        let failed = 0;
        const failedTokens: string[] = [];

        for (const token of tokens) {
            try {
                const result = await sendFCMv1(accessToken, token, notification, data);

                if (result.error) {
                    console.error('FCM error for token:', result.error);
                    failed++;
                    if (result.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
                        failedTokens.push(token);
                    }
                } else {
                    sent++;
                }
            } catch (err) {
                console.error('Send error:', err);
                failed++;
            }
        }

        // Clean up invalid tokens
        if (failedTokens.length > 0) {
            await supabase
                .from('push_subscriptions')
                .update({ is_active: false })
                .in('fcm_token', failedTokens);

            console.log(`Deactivated ${failedTokens.length} invalid tokens`);
        }

        // Log notification
        await supabase.from('notification_logs').insert({
            type: 'push',
            recipient: Array.isArray(to) ? to.join(',') : to,
            title: notification.title,
            body: notification.body,
            success: sent > 0,
            sent_count: sent,
            failed_count: failed
        });

        return new Response(
            JSON.stringify({
                success: sent > 0,
                sent,
                failed,
                message: `Push sent to ${sent} device(s)${failed > 0 ? `, ${failed} failed` : ''}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        console.error('Push notification error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
