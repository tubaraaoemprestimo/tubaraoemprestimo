// Supabase Edge Function - Disparo Imediato de Campanha ou Cupom
// Chamado quando admin cria uma nova campanha ou cupom
// Endpoint: POST /functions/v1/send-campaign
// Body: { type: "campaign" | "coupon", id: "uuid" }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(
    waConfig: { api_url: string; api_key: string; instance_name: string },
    phone: string,
    text: string
): Promise<boolean> {
    try {
        let number = phone.replace(/\D/g, '');
        if (!number.startsWith('55') && number.length >= 10) {
            number = '55' + number;
        }

        const apiUrl = waConfig.api_url.replace(/\/$/, '');
        const response = await fetch(`${apiUrl}/message/sendText/${waConfig.instance_name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': waConfig.api_key,
            },
            body: JSON.stringify({
                number: number,
                text: text,
                options: {
                    delay: 1500,
                    presence: 'composing'
                }
            })
        });

        if (!response.ok) {
            console.error('[SendCampaign] Error:', await response.text());
            return false;
        }
        return true;
    } catch (err) {
        console.error('[SendCampaign] Exception:', err);
        return false;
    }
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { type, id } = await req.json();

        if (!type || !id) {
            return new Response(JSON.stringify({ error: 'type and id are required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[SendCampaign] Processing ${type}: ${id}`);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('[SendCampaign] Fetching WhatsApp config...');

        // Get WhatsApp config - usando limit(1) sem single() para evitar erro
        const { data: waConfigArray, error: waError } = await supabase
            .from('whatsapp_config')
            .select('*')
            .limit(1);

        console.log('[SendCampaign] WhatsApp config result:', {
            found: waConfigArray?.length || 0,
            error: waError?.message || null
        });

        const waConfig = waConfigArray?.[0];

        if (waError || !waConfig?.api_url || !waConfig?.api_key) {
            console.error('[SendCampaign] WhatsApp not configured:', {
                error: waError,
                hasUrl: !!waConfig?.api_url,
                hasKey: !!waConfig?.api_key
            });
            return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('[SendCampaign] WhatsApp configured:', {
            url: waConfig.api_url,
            instance: waConfig.instance_name
        });

        // Get customers
        const { data: customers } = await supabase
            .from('customers')
            .select('id, name, phone, email, status')
            .eq('status', 'ACTIVE')
            .not('phone', 'is', null);

        if (!customers || customers.length === 0) {
            return new Response(JSON.stringify({ message: 'No customers to notify' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let message = '';
        let targetCustomers = customers;
        let sent = 0, failed = 0;

        // ============================================
        // 📢 CAMPAIGN
        // ============================================
        if (type === 'campaign') {
            const { data: campaign } = await supabase
                .from('campaigns')
                .select('*')
                .eq('id', id)
                .single();

            if (!campaign) {
                return new Response(JSON.stringify({ error: 'Campaign not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            message = `🎯 *${campaign.title}*\n\n` +
                `${campaign.description || ''}\n\n` +
                `${campaign.link ? `👉 Acesse: ${campaign.link}` : ''}\n\n` +
                `📱 *Baixe o App:*\nhttps://tubaraoemprestimo.vercel.app/\n\n` +
                `_Tubarão Empréstimos 🦈_`;
        }

        // ============================================
        // 🎟️ COUPON
        // ============================================
        if (type === 'coupon') {
            const { data: coupon } = await supabase
                .from('coupons')
                .select('*')
                .eq('id', id)
                .single();

            if (!coupon) {
                return new Response(JSON.stringify({ error: 'Coupon not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const expiresText = coupon.expires_at
                ? `\n⏰ Válido até: ${new Date(coupon.expires_at).toLocaleDateString('pt-BR')}`
                : '';

            message = `🎉 *CUPOM EXCLUSIVO!*\n\n` +
                `Use o código *${coupon.code}* e ganhe *${coupon.discount}% de desconto*!\n` +
                `${coupon.description || ''}\n` +
                `${expiresText}\n\n` +
                `📱 *Acesse o App:*\nhttps://tubaraoemprestimo.vercel.app/\n\n` +
                `_Tubarão Empréstimos 🦈_`;

            // If coupon is for specific customer email
            if (coupon.customer_email) {
                // Tentar encontrar na lista já carregada (case insensitive)
                targetCustomers = customers.filter(c => c.email.toLowerCase() === coupon.customer_email.toLowerCase());

                // Se não encontrou na lista (pode não ser ACTIVE ou não ter phone na query inicial), tentar buscar específico
                if (targetCustomers.length === 0) {
                    const { data: specificCustomer } = await supabase
                        .from('customers')
                        .select('id, name, phone, email, status')
                        .ilike('email', coupon.customer_email)
                        .single();

                    if (specificCustomer && specificCustomer.phone) {
                        targetCustomers = [specificCustomer];
                    } else {
                        console.log(`[SendCampaign] Cliente alvo não encontrado ou sem telefone: ${coupon.customer_email}`);
                    }
                }
            }
        }

        // ============================================
        // 📨 SEND MESSAGES
        // ============================================
        for (const customer of targetCustomers) {
            if (!customer.phone) continue;

            // Add delay to avoid spam detection
            await new Promise(r => setTimeout(r, 2000));

            const success = await sendWhatsAppMessage(waConfig, customer.phone, message);

            if (success) {
                sent++;
            } else {
                failed++;
            }
        }

        // Log the send
        await supabase.from('notification_logs').insert({
            type: type.toUpperCase(),
            reference_id: id,
            recipients_count: targetCustomers.length,
            sent_count: sent,
            failed_count: failed,
            message: message.substring(0, 500)
        });

        console.log(`[SendCampaign] Complete: ${sent} sent, ${failed} failed`);

        return new Response(JSON.stringify({
            status: 'success',
            sent,
            failed,
            total: targetCustomers.length,
            message: `${type === 'campaign' ? 'Campanha' : 'Cupom'} enviado para ${sent} clientes!`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[SendCampaign] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
