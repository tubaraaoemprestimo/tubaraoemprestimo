
// Supabase Edge Function - Automação de Notificações WhatsApp + Email + Push
// Envia campanhas, cupons e cobranças automáticas para clientes
// Deve ser chamado por um CRON job (ex: Supabase pg_cron ou serviço externo)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppConfig {
    api_url: string;
    api_key: string;
    instance_name: string;
}

interface Customer {
    id: string;
    name: string;
    phone: string;
    email: string;
    status: string;
}

interface Campaign {
    id: string;
    title: string;
    description: string;
    link?: string;
    start_date: string;
    end_date: string;
    active: boolean;
    frequency?: string;
}

interface Coupon {
    id: string;
    code: string;
    discount: number;
    description: string;
    expires_at: string;
    active: boolean;
    customer_email?: string;
}

interface CollectionRule {
    id: string;
    days_offset: number;
    message_template: string;
    active: boolean;
}

interface Installment {
    id: string;
    loan_id: string;
    due_date: string;
    amount: number;
    status: string;
}

// Process template with variables
function processTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(regex, String(value));
    }
    return result;
}

// Get days difference between two dates
function daysDiff(date1: Date, date2: Date): number {
    const diffTime = date1.getTime() - date2.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(
    waConfig: WhatsAppConfig,
    phone: string,
    text: string
): Promise<boolean> {
    try {
        // Format phone number
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
            console.error('[AutoNotify] WhatsApp send error:', await response.text());
            return false;
        }

        console.log(`[AutoNotify] Message sent to ${number}`);
        return true;
    } catch (err) {
        console.error('[AutoNotify] Exception sending message:', err);
        return false;
    }
}

// Send Email via send-email Edge Function
async function sendEmailNotification(
    supabaseUrl: string,
    supabaseKey: string,
    to: string,
    subject: string,
    bodyHtml: string
): Promise<void> {
    try {
        // Simple HTML Wrapper
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h2 style="color: #D4AF37; text-align: center;">🦈 TUBARÃO EMPRÉSTIMOS</h2>
                    <div style="color: #333; line-height: 1.6;">
                        ${bodyHtml}
                    </div>
                    <p style="text-align: center; font-size: 12px; color: #888; margin-top: 30px;">
                        © Tubarão Empréstimos - Enviado automaticamente.
                    </p>
                </div>
            </body>
            </html>
        `;

        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: to,
                subject: subject,
                html: html
            })
        });

    } catch (err) {
        console.error('[AutoNotify] Exception sending email:', err);
    }
}

// Send Push Notification via send-push Edge Function
async function sendPushNotification(
    supabaseUrl: string,
    supabaseKey: string,
    to: string,
    title: string,
    body: string
): Promise<void> {
    try {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: to,
                notification: {
                    title: title,
                    body: body
                }
            })
        });

    } catch (err) {
        console.error('[AutoNotify] Exception sending push:', err);
    }
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Parse request body for specific actions
        let action = 'all'; // default: process all automations
        let campaignId: string | null = null;
        let couponId: string | null = null;

        try {
            const body = await req.json();
            action = body.action || 'all';
            campaignId = body.campaignId || null;
            couponId = body.couponId || null;
        } catch {
            // No body or invalid JSON, use defaults
        }

        console.log(`[AutoNotify] Starting with action: ${action}`);

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!.replace(/\/$/, '');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get WhatsApp config
        const { data: waConfig } = await supabase
            .from('whatsapp_config')
            .select('*')
            .limit(1)
            .single();

        if (!waConfig || !waConfig.api_url || !waConfig.api_key) {
            console.warn('[AutoNotify] WhatsApp not fully configured. Skipping WhatsApp messages.');
        }

        // Get all active customers with phone
        const { data: customers } = await supabase
            .from('customers')
            .select('id, name, phone, email, status')
            .eq('status', 'ACTIVE')
            .or('phone.neq.null,email.neq.null');

        if (!customers || customers.length === 0) {
            return new Response(JSON.stringify({ message: 'No customers to notify' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const results = {
            campaigns: { sent: 0, failed: 0 },
            coupons: { sent: 0, failed: 0 },
            collections: { sent: 0, failed: 0 }
        };

        // ============================================
        // 📢 PROCESS CAMPAIGNS
        // ============================================
        if (action === 'all' || action === 'campaigns' || action === 'campaign') {
            let campaignQuery = supabase
                .from('campaigns')
                .select('*')
                .eq('active', true)
                .lte('start_date', new Date().toISOString().split('T')[0])
                .gte('end_date', new Date().toISOString().split('T')[0]);

            if (campaignId) {
                // Manual Trigger: Fetch specific campaign regardless of dates
                campaignQuery = supabase
                    .from('campaigns')
                    .select('*')
                    .eq('id', campaignId);
            }

            const { data: campaigns } = await campaignQuery;

            if (campaigns && campaigns.length > 0) {
                for (const campaign of campaigns) {
                    console.log(`[AutoNotify] Processing campaign: ${campaign.title}`);

                    // Check if already sent today (avoid duplicates)
                    const today = new Date().toISOString().split('T')[0];
                    const { data: existingLog } = await supabase
                        .from('notification_logs')
                        .select('id')
                        .eq('type', 'CAMPAIGN')
                        .eq('reference_id', campaign.id)
                        .gte('created_at', today)
                        .limit(1);

                    // Skip if already sent today (unless it's frequency ALWAYS or MANUAL trigger)
                    if (!campaignId && existingLog && existingLog.length > 0 && campaign.frequency !== 'ALWAYS') {
                        console.log(`[AutoNotify] Campaign ${campaign.title} already sent today`);
                        continue;
                    }

                    const message = `🎯 *${campaign.title}*\n\n${campaign.description || ''}\n\n${campaign.link ? `👉 Acesse: ${campaign.link}` : ''}\n\n📱 *Baixe o App:*\nhttps://www.tubaraoemprestimo.com.br/#/login\n\n_Tubarão Empréstimos 🦈_`;

                    for (const customer of customers) {
                        if (waConfig && customer.phone) {
                            // Add small delay
                            await new Promise(r => setTimeout(r, 500));
                            const success = await sendWhatsAppMessage(waConfig, customer.phone, message);
                            if (success) results.campaigns.sent++; else results.campaigns.failed++;
                        }

                        // 📧 Send Email and Push in parallel
                        if (customer.email) {
                            // Email
                            const emailBody = `
                                <h3>${campaign.title}</h3>
                                <p>${campaign.description || ''}</p>
                                ${(campaign.link) ? `<div style="text-align: center; margin: 20px 0;"><a href="${campaign.link}" style="background: #D4AF37; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Agora</a></div>` : ''}
                            `;
                            await sendEmailNotification(supabaseUrl, supabaseKey, customer.email, `📢 ${campaign.title}`, emailBody);

                            // Push
                            await sendPushNotification(supabaseUrl, supabaseKey, customer.email, campaign.title, campaign.description || 'Nova oferta disponível!');
                        }
                    }

                    // Log campaign send
                    await supabase.from('notification_logs').insert({
                        type: 'CAMPAIGN',
                        reference_id: campaign.id,
                        recipients_count: customers.length,
                        sent_count: results.campaigns.sent,
                        failed_count: results.campaigns.failed
                    });
                }
            }
        }

        // ============================================
        // 🎟️ PROCESS COUPONS
        // ============================================
        if (action === 'all' || action === 'coupons' || action === 'coupon') {
            let couponQuery = supabase
                .from('coupons')
                .select('*')
                .eq('active', true)
                .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

            if (couponId) {
                couponQuery = couponQuery.eq('id', couponId);
            }

            const { data: coupons } = await couponQuery;

            if (coupons && coupons.length > 0) {
                for (const coupon of coupons) {
                    console.log(`[AutoNotify] Processing coupon: ${coupon.code}`);

                    // Check if already sent (avoid duplicates)
                    const { data: existingLog } = await supabase
                        .from('notification_logs')
                        .select('id')
                        .eq('type', 'COUPON')
                        .eq('reference_id', coupon.id)
                        .limit(1);

                    if (existingLog && existingLog.length > 0) {
                        console.log(`[AutoNotify] Coupon ${coupon.code} already sent`);
                        continue;
                    }

                    const expiresText = coupon.expires_at
                        ? `\n⏰ Válido até: ${new Date(coupon.expires_at).toLocaleDateString('pt-BR')}`
                        : '';

                    const message = `🎉 *CUPOM EXCLUSIVO!*\n\n` +
                        `Use o código *${coupon.code}* e ganhe *${coupon.discount}% de desconto*!\n` +
                        `${coupon.description || ''}\n` +
                        `${expiresText}\n\n` +
                        `📱 *Acesse o App:*\nhttps://www.tubaraoemprestimo.com.br/#/login\n\n` +
                        `_Tubarão Empréstimos 🦈_`;

                    // If coupon is for specific customer
                    const targetCustomers = coupon.customer_email
                        ? customers.filter(c => c.email === coupon.customer_email)
                        : customers;

                    for (const customer of targetCustomers) {
                        if (waConfig && customer.phone) {
                            await new Promise(r => setTimeout(r, 500));
                            const success = await sendWhatsAppMessage(waConfig, customer.phone, message);
                            if (success) results.coupons.sent++; else results.coupons.failed++;
                        }

                        // 📧 Send Email and Push in parallel
                        if (customer.email) {
                            // Email
                            const emailBody = `
                                <div style="text-align: center;">
                                    <h1 style="color: #28a745; font-size: 32px; margin: 10px 0;">${coupon.discount}% OFF</h1>
                                    <p style="font-size: 18px;">Use o código: <strong style="background: #eee; padding: 5px 10px; border-radius: 4px;">${coupon.code}</strong></p>
                                    <p>${coupon.description || ''}</p>
                                    ${expiresText ? `<p style="color: #d9534f;">${expiresText}</p>` : ''}
                                    <br>
                                    <a href="https://www.tubaraoemprestimo.com.br/#/login" style="background: #28a745; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Usar Cupom</a>
                                </div>
                            `;
                            await sendEmailNotification(supabaseUrl, supabaseKey, customer.email, `🎁 Cupom Especial: ${coupon.code}`, emailBody);

                            // Push
                            await sendPushNotification(supabaseUrl, supabaseKey, customer.email, `🎁 Cupom: ${coupon.code}`, `Desconto de ${coupon.discount}% para você!`);
                        }
                    }

                    // Log coupon send
                    await supabase.from('notification_logs').insert({
                        type: 'COUPON',
                        reference_id: coupon.id,
                        recipients_count: targetCustomers.length,
                        sent_count: results.coupons.sent,
                        failed_count: results.coupons.failed
                    });
                }
            }
        }

        // ============================================
        // 💰 PROCESS COLLECTION RULES (Cobranças)
        // ============================================
        if (action === 'all' || action === 'collections') {
            const { data: rules } = await supabase
                .from('collection_rules')
                .select('*')
                .eq('active', true);

            if (rules && rules.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Get all open/late installments with customer info
                const { data: installments } = await supabase
                    .from('installments')
                    .select(`
                        id,
                        loan_id,
                        due_date,
                        amount,
                        status,
                        loans!inner (
                            customer_id,
                            customers!inner (
                                id,
                                name,
                                phone,
                                email
                            )
                        )
                    `)
                    .in('status', ['OPEN', 'LATE']);

                if (installments) {
                    for (const inst of installments) {
                        const dueDate = new Date(inst.due_date);
                        dueDate.setHours(0, 0, 0, 0);
                        const diff = daysDiff(today, dueDate);

                        // Find matching rule for this day offset
                        const matchingRule = rules.find(r => r.days_offset === diff);

                        if (matchingRule) {
                            // @ts-ignore - nested query structure
                            const customer = inst.loans?.customers;
                            if (!customer || !customer.phone) continue;

                            // Check if already sent today for this installment
                            // ... (mantido igual, sem alteração na lógica de verificação)
                            const { data: existingLog } = await supabase
                                .from('notification_logs')
                                .select('id')
                                .eq('type', 'COLLECTION')
                                .eq('reference_id', inst.id)
                                .eq('rule_id', matchingRule.id)
                                .gte('created_at', today.toISOString().split('T')[0])
                                .limit(1);

                            if (existingLog && existingLog.length > 0) {
                                continue; // Already sent today
                            }

                            // Process template with variables
                            const message = processTemplate(matchingRule.message_template, {
                                nome: customer.name.split(' ')[0],
                                valor: inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                                data_vencimento: new Date(inst.due_date).toLocaleDateString('pt-BR'),
                                dias_atraso: diff > 0 ? diff : 0
                            });

                            if (waConfig && customer.phone) {
                                await new Promise(r => setTimeout(r, 500));
                                await sendWhatsAppMessage(waConfig, customer.phone, message);
                            }

                            // Log collection send (always log attempt)
                            await supabase.from('notification_logs').insert({
                                type: 'COLLECTION',
                                reference_id: inst.id,
                                rule_id: matchingRule.id,
                                customer_id: customer.id,
                                recipients_count: 1,
                                sent_count: 1,
                                failed_count: 0
                            });

                            results.collections.sent++;

                            // 📧 Send Email and Push in parallel (Cobrança)
                            if (customer.email) {
                                const emailBody = `
                                    <h3>Olá, ${customer.name.split(' ')[0]}</h3>
                                    <div style="background: #fff3cd; color: #856404; padding: 15px; border-left: 5px solid #ffc107; margin: 20px 0;">
                                        <p>${message.replace(/\n/g, '<br>')}</p>
                                    </div>
                                    <p>Para regularizar, acesse o aplicativo ou entre em contato.</p>
                                    <div style="text-align: center; margin-top: 20px;">
                                        <a href="https://www.tubaraoemprestimo.com.br/#/login" style="background: #007bff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar Fatura</a>
                                    </div>
                                `;

                                const subject = diff > 0
                                    ? `🚨 Aviso de Atraso: ${diff} dias`
                                    : (diff < 0 ? `⏰ Lembrete de Vencimento` : `⚠️ Sua Fatura Vence Hoje`);

                                await sendEmailNotification(supabaseUrl, supabaseKey, customer.email, subject, emailBody);
                                await sendPushNotification(supabaseUrl, supabaseKey, customer.email, subject, `Acesse o app para detalhes da sua fatura.`);
                            }
                        }
                    }
                }
            }
        }

        console.log('[AutoNotify] Completed:', JSON.stringify(results));

        return new Response(JSON.stringify({
            status: 'success',
            results,
            message: `Enviados: Campanhas=${results.campaigns.sent}, Cupons=${results.coupons.sent}, Cobranças=${results.collections.sent}`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[AutoNotify] Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
