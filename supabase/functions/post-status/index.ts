// Supabase Edge Function - Post Status no WhatsApp
// Verifica status agendados e posta automaticamente
// Deve ser chamado por CRON a cada 5 minutos

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledStatus {
    id: string;
    image_url: string;
    caption: string | null;
    scheduled_at: string;
    status: string;
}

interface WhatsAppConfig {
    api_url: string;
    api_key: string;
    instance_name: string;
}

// Função para postar status via Evolution API
async function postWhatsAppStatus(
    waConfig: WhatsAppConfig,
    imageUrl: string,
    caption?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        let apiUrl = waConfig.api_url.replace(/\/$/, '');
        // Garantir que não duplique /message/message ?? Não, a config geralmente é a base.
        // Se a config terminar em /message, remover.
        apiUrl = apiUrl.replace(/\/message$/, '');

        // Construir endpoint
        const endpoint = `${apiUrl}/message/sendStatus/${waConfig.instance_name}`;

        console.log(`[PostStatus] Sending to: ${endpoint}`);
        console.log(`[PostStatus] Image URL: ${imageUrl}`);

        // Evolution API v2 requer statusJidList ou allContacts
        // Usando allContacts: true para enviar para todos os contatos
        const payload = {
            type: 'image',
            content: imageUrl,
            caption: caption || '',
            allContacts: true
        };

        console.log('[PostStatus] Payload:', JSON.stringify(payload));

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': waConfig.api_key,
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[PostStatus] API Error (${response.status}):`, errorText);
            return { success: false, error: `${response.status} - ${errorText}` };
        }

        const result = await response.json();
        console.log('[PostStatus] Success:', JSON.stringify(result));
        return { success: true };
    } catch (err: any) {
        console.error('[PostStatus] Exception:', err);
        return { success: false, error: err.message };
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('[PostStatus] Starting scheduled status check...');

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Buscar configuração do WhatsApp
        console.log('[PostStatus] Fetching WhatsApp config...');

        const { data: waConfigArray, error: waError } = await supabase
            .from('whatsapp_config')
            .select('*')
            .limit(1);

        console.log('[PostStatus] Config query result:', {
            found: waConfigArray?.length || 0,
            error: waError?.message || null
        });

        const waConfig = waConfigArray?.[0];

        if (waError || !waConfig?.api_url || !waConfig?.api_key) {
            console.error('[PostStatus] WhatsApp not configured');
            if (waError) console.error('[PostStatus] DB Error:', JSON.stringify(waError));
            if (!waConfig) console.error('[PostStatus] Config object is null/empty');
            if (waConfig && (!waConfig.api_url || !waConfig.api_key)) {
                console.error('[PostStatus] Missing fields:', {
                    hasUrl: !!waConfig?.api_url,
                    hasKey: !!waConfig?.api_key,
                    instance: waConfig?.instance_name
                });
            }

            return new Response(JSON.stringify({
                error: 'WhatsApp não configurado',
                details: waError || 'Missing URL/Key'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('[PostStatus] WhatsApp configured:', {
            url: waConfig.api_url,
            instance: waConfig.instance_name
        });

        // Buscar status pendentes que já passaram do horário agendado
        const now = new Date().toISOString();
        const { data: pendingStatus, error: fetchError } = await supabase
            .from('scheduled_status')
            .select('*')
            .eq('status', 'PENDING')
            .lte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(10); // Processar até 10 por vez

        if (fetchError) {
            console.error('[PostStatus] Fetch error:', fetchError);
            return new Response(JSON.stringify({ error: fetchError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!pendingStatus || pendingStatus.length === 0) {
            console.log('[PostStatus] No pending status to post');
            return new Response(JSON.stringify({ message: 'Nenhum status pendente', posted: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[PostStatus] Found ${pendingStatus.length} pending status`);

        let posted = 0;
        let failed = 0;

        for (const status of pendingStatus as ScheduledStatus[]) {
            console.log(`[PostStatus] Posting status ${status.id}...`);

            // Pequena pausa entre posts (evitar spam)
            if (posted > 0) {
                await new Promise(r => setTimeout(r, 3000));
            }

            const result = await postWhatsAppStatus(waConfig, status.image_url, status.caption || undefined);

            if (result.success) {
                // Atualizar para POSTED
                await supabase
                    .from('scheduled_status')
                    .update({
                        status: 'POSTED',
                        posted_at: new Date().toISOString()
                    })
                    .eq('id', status.id);

                posted++;
                console.log(`[PostStatus] Status ${status.id} posted successfully`);
            } else {
                // Atualizar para FAILED
                await supabase
                    .from('scheduled_status')
                    .update({
                        status: 'FAILED',
                        error_message: result.error || 'Erro desconhecido'
                    })
                    .eq('id', status.id);

                failed++;
                console.log(`[PostStatus] Status ${status.id} failed: ${result.error}`);
            }
        }

        console.log(`[PostStatus] Complete: ${posted} posted, ${failed} failed`);

        return new Response(JSON.stringify({
            status: 'success',
            posted,
            failed,
            message: `Postados: ${posted}, Falhas: ${failed}`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[PostStatus] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
