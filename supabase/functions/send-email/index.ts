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

        // Configurações do Gmail
        const GMAIL_USER = Deno.env.get("GMAIL_USER") || "";
        const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") || "";

        if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
            console.error("Gmail credentials not configured");
            return new Response(
                JSON.stringify({ success: false, error: "Email not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Usar Resend API para maior compatibilidade (alternativa ao SMTP)
        // Para Gmail SMTP, precisa do Deno SMTP client

        // Alternativa simples: usar fetch para API de email (Resend, SendGrid, etc)
        // Aqui vamos usar a abordagem SMTP do Deno

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        // Conectar ao servidor SMTP do Gmail
        const connection = await Deno.connect({
            hostname: "smtp.gmail.com",
            port: 587,
        });

        // Ler resposta inicial
        const buffer = new Uint8Array(1024);
        await connection.read(buffer);

        // EHLO
        await connection.write(encoder.encode("EHLO localhost\r\n"));
        await connection.read(buffer);

        // STARTTLS
        await connection.write(encoder.encode("STARTTLS\r\n"));
        await connection.read(buffer);

        // Upgrade para TLS
        const tlsConnection = await Deno.startTls(connection, {
            hostname: "smtp.gmail.com",
        });

        // EHLO novamente após TLS
        await tlsConnection.write(encoder.encode("EHLO localhost\r\n"));
        await tlsConnection.read(buffer);

        // AUTH LOGIN
        await tlsConnection.write(encoder.encode("AUTH LOGIN\r\n"));
        await tlsConnection.read(buffer);

        // Username (base64)
        const userBase64 = btoa(GMAIL_USER);
        await tlsConnection.write(encoder.encode(`${userBase64}\r\n`));
        await tlsConnection.read(buffer);

        // Password (base64)
        const passBase64 = btoa(GMAIL_APP_PASSWORD);
        await tlsConnection.write(encoder.encode(`${passBase64}\r\n`));
        await tlsConnection.read(buffer);

        // MAIL FROM
        await tlsConnection.write(encoder.encode(`MAIL FROM:<${GMAIL_USER}>\r\n`));
        await tlsConnection.read(buffer);

        // RCPT TO
        await tlsConnection.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
        await tlsConnection.read(buffer);

        // DATA
        await tlsConnection.write(encoder.encode("DATA\r\n"));
        await tlsConnection.read(buffer);

        // Headers e corpo do email
        const emailContent = [
            `From: Tubarão Empréstimos <${GMAIL_USER}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            ``,
            html,
            `.`,
        ].join("\r\n");

        await tlsConnection.write(encoder.encode(emailContent + "\r\n"));
        await tlsConnection.read(buffer);

        // QUIT
        await tlsConnection.write(encoder.encode("QUIT\r\n"));
        await tlsConnection.read(buffer);

        tlsConnection.close();

        console.log(`Email enviado para: ${to}`);

        return new Response(
            JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Erro ao enviar email:", error);

        // Fallback: tentar via Resend se configurado
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

        if (RESEND_API_KEY) {
            try {
                const { to, subject, html } = await req.json();

                const response = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${RESEND_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from: "Tubarão Empréstimos <noreply@tubaraoemprestimo.com>",
                        to: [to],
                        subject,
                        html,
                    }),
                });

                if (response.ok) {
                    return new Response(
                        JSON.stringify({ success: true, message: "Email enviado via Resend" }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            } catch (e) {
                console.error("Resend fallback failed:", e);
            }
        }

        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
