// Supabase Edge Function - Webhook para Evolution API
// Este arquivo recebe mensagens do WhatsApp e responde automaticamente com IA

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EvolutionWebhookPayload {
    event: string;
    instance: string;
    data: {
        key: {
            remoteJid: string;
            fromMe: boolean;
            id: string;
        };
        message: {
            conversation?: string;
            extendedTextMessage?: {
                text: string;
            };
        };
        messageTimestamp: number;
        pushName?: string;
    };
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload: EvolutionWebhookPayload = await req.json()
        console.log('[Webhook] Received:', JSON.stringify(payload, null, 2))

        // Only process incoming messages (not from me)
        if (payload.event !== 'messages.upsert' || payload.data?.key?.fromMe) {
            return new Response(JSON.stringify({ status: 'ignored' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Extract message text
        const messageText = payload.data?.message?.conversation
            || payload.data?.message?.extendedTextMessage?.text
            || ''

        if (!messageText) {
            return new Response(JSON.stringify({ status: 'no_text' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Extract phone number
        const phone = payload.data.key.remoteJid.replace('@s.whatsapp.net', '')
        const senderName = payload.data.pushName || 'Cliente'

        console.log(`[Webhook] Message from ${phone}: ${messageText}`)

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get chatbot config
        const { data: config } = await supabase
            .from('ai_chatbot_config')
            .select('*')
            .limit(1)
            .single()

        if (!config || !config.enabled || !config.auto_reply_enabled) {
            console.log('[Webhook] Chatbot disabled')
            return new Response(JSON.stringify({ status: 'chatbot_disabled' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Check working hours
        if (config.working_hours_only) {
            const now = new Date()
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
            if (currentTime < config.working_hours_start || currentTime > config.working_hours_end) {
                console.log('[Webhook] Outside working hours')
                return new Response(JSON.stringify({ status: 'outside_hours' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        // Check transfer keywords
        const transferWords = (config.transfer_keywords || '').split(',').map((w: string) => w.trim().toLowerCase())
        if (transferWords.some((word: string) => messageText.toLowerCase().includes(word))) {
            console.log('[Webhook] Transfer keyword detected')
            await sendWhatsAppMessage(supabase, config, phone, 'Entendido! Vou transferir você para um de nossos atendentes. Aguarde um momento. 🙏')
            return new Response(JSON.stringify({ status: 'transferred' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Get customer context
        const cleanPhone = phone.replace(/^55/, '')
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${phone}%`)
            .limit(1)
            .single()

        let customerContext = ''
        if (customer) {
            customerContext = `
Nome do Cliente: ${customer.name}
CPF: ${customer.cpf}
Status: ${customer.status}
Dívida Total: R$ ${customer.total_debt?.toLocaleString('pt-BR') || '0'}
Empréstimos Ativos: ${customer.active_loans_count || 0}`
        }

        // Save user message to history
        await supabase.from('ai_chat_history').insert({
            phone,
            customer_id: customer?.id || null,
            role: 'user',
            message: messageText
        })

        // Get chat history
        const { data: history } = await supabase
            .from('ai_chat_history')
            .select('role, message')
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(10)

        const messages = (history || []).reverse().map((m: { role: string; message: string }) => ({
            role: m.role,
            content: m.message
        }))

        // Generate AI response
        let aiResponse = ''
        const apiKey = config.provider === 'gemini' ? config.gemini_api_key : config.perplexity_api_key

        if (!apiKey) {
            aiResponse = config.fallback_message || 'Desculpe, não posso responder no momento.'
        } else if (config.provider === 'gemini') {
            aiResponse = await generateGeminiResponse(messages, config.system_prompt, apiKey, customerContext)
        } else if (config.provider === 'perplexity') {
            aiResponse = await generatePerplexityResponse(messages, config.system_prompt, apiKey, customerContext)
        }

        if (!aiResponse) {
            aiResponse = config.fallback_message || 'Desculpe, não entendi sua mensagem.'
        }

        // Save AI response to history
        await supabase.from('ai_chat_history').insert({
            phone,
            customer_id: customer?.id || null,
            role: 'assistant',
            message: aiResponse
        })

        // Send response via WhatsApp
        await sendWhatsAppMessage(supabase, config, phone, aiResponse)

        return new Response(JSON.stringify({ status: 'success', response: aiResponse }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('[Webhook] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

async function generateGeminiResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    apiKey: string,
    customerContext: string
): Promise<string> {
    try {
        const fullPrompt = customerContext
            ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}`
            : systemPrompt

        const contents = [
            { role: 'user', parts: [{ text: fullPrompt }] },
            ...messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
        ]

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500
                    }
                })
            }
        )

        if (!response.ok) {
            console.error('[Gemini] API error:', await response.text())
            return ''
        }

        const data = await response.json()
        return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (err) {
        console.error('[Gemini] Exception:', err)
        return ''
    }
}

async function generatePerplexityResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    apiKey: string,
    customerContext: string
): Promise<string> {
    try {
        const fullPrompt = customerContext
            ? `${systemPrompt}\n\nContexto do cliente:\n${customerContext}`
            : systemPrompt

        const formattedMessages = [
            { role: 'system', content: fullPrompt },
            ...messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        ]

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-sonar-small-128k-online',
                messages: formattedMessages,
                max_tokens: 500,
                temperature: 0.7
            })
        })

        if (!response.ok) {
            console.error('[Perplexity] API error:', await response.text())
            return ''
        }

        const data = await response.json()
        return data.choices?.[0]?.message?.content || ''
    } catch (err) {
        console.error('[Perplexity] Exception:', err)
        return ''
    }
}

async function sendWhatsAppMessage(
    supabase: any,
    config: any,
    phone: string,
    text: string
): Promise<void> {
    try {
        // Get WhatsApp config
        const { data: waConfig } = await supabase
            .from('whatsapp_config')
            .select('*')
            .limit(1)
            .single()

        if (!waConfig) {
            console.error('[WhatsApp] No config found')
            return
        }

        const apiUrl = waConfig.api_url.replace(/\/$/, '')
        const response = await fetch(`${apiUrl}/message/sendText/${waConfig.instance_name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': waConfig.api_key,
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                number: phone,
                text: text,
                options: {
                    delay: 1000,
                    presence: 'composing'
                }
            })
        })

        if (!response.ok) {
            console.error('[WhatsApp] Send error:', await response.text())
        } else {
            console.log('[WhatsApp] Message sent successfully')
        }
    } catch (err) {
        console.error('[WhatsApp] Exception:', err)
    }
}
