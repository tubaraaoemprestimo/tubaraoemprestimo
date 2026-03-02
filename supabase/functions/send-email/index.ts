// Supabase Edge Function: send-email
// Envia emails via Gmail SMTP usando Nodemailer

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { to, subject, html, text } = (await req.json()) as EmailRequest;

        if (!to || !subject || !html) {
            return new Response(
                JSON.stringify({ success: false, error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Configurações
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

        // Domínio configurado
        const FROM_EMAIL = "Tubarão Empréstimos <contato@tubaraoemprestimo.com.br>";

        if (!RESEND_API_KEY) {
            console.error("RESEND_API_KEY não encontrada nas variáveis de ambiente");
            throw new Error("Serviço de email não configurado corretamente (API Key ausente)");
        }

        console.log(`[SendEmail] Enviando via Resend para: ${to}`);

        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [to],
                subject: subject,
                html: html,
            }),
        });

        const data = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error("[SendEmail] Erro Resend:", data);

            // Fallback para domínio de teste se falhar por domínio não verificado (erro 403/422 comum)
            if (data.name === 'validation_error' || data.message?.includes('domain')) {
                console.log("[SendEmail] Tentando fallback para onboarding@resend.dev...");
                const fallbackResponse = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${RESEND_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from: "onboarding@resend.dev",
                        to: [to],
                        subject: subject,
                        html: html
                    }),
                });

                if (fallbackResponse.ok) {
                    return new Response(
                        JSON.stringify({ success: true, message: "Email enviado (Fallback Mode)", id: await fallbackResponse.json() }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            return new Response(
                JSON.stringify({ success: false, error: data.message || "Erro no envio Resend" }),
                { status: resendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[SendEmail] Sucesso! ID: ${data.id}`);

        return new Response(
            JSON.stringify({ success: true, message: "Email enviado com sucesso", id: data.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Erro ao enviar email:", error);
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
