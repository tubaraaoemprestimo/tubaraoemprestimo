import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendWelcomeEmailParams {
    email: string;
    name: string;
    password: string;
    isNewUser: boolean;
}

/**
 * Template de e-mail premium para boas-vindas ao Método Tubarão
 */
function getWelcomeEmailHTML(name: string, email: string, password: string, isNewUser: boolean): string {
    const accessUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.tubaraoemprestimo.com.br'}/#/acesso`;

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bem-vindo ao Método Tubarão</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
        <tr>
            <td align="center">
                <!-- Container Principal -->
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(212, 175, 55, 0.15);">

                    <!-- Header com Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #000000; font-size: 32px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
                                🦈 TUBARÃO
                            </h1>
                            <p style="margin: 10px 0 0 0; color: #1a1a1a; font-size: 14px; font-weight: 600; letter-spacing: 1px;">
                                MÉTODO EXCLUSIVO
                            </p>
                        </td>
                    </tr>

                    <!-- Conteúdo Principal -->
                    <tr>
                        <td style="padding: 50px 40px;">

                            <!-- Título de Boas-Vindas -->
                            <h2 style="margin: 0 0 20px 0; color: #D4AF37; font-size: 28px; font-weight: bold; text-align: center;">
                                ${isNewUser ? 'Parabéns por se tornar um Tubarão!' : 'Bem-vindo de volta, Tubarão!'}
                            </h2>

                            <!-- Mensagem Personalizada -->
                            <p style="margin: 0 0 30px 0; color: #e0e0e0; font-size: 16px; line-height: 1.6; text-align: center;">
                                Olá <strong style="color: #D4AF37;">${name}</strong>,
                            </p>

                            <p style="margin: 0 0 30px 0; color: #c0c0c0; font-size: 15px; line-height: 1.8;">
                                ${isNewUser
                                    ? 'Seu pagamento foi confirmado com sucesso! 🎉 Você agora tem acesso completo ao <strong style="color: #D4AF37;">Método Tubarão</strong>, o curso mais completo sobre empréstimos e gestão financeira.'
                                    : 'Seu acesso ao <strong style="color: #D4AF37;">Método Tubarão</strong> foi renovado com sucesso! Continue sua jornada de aprendizado.'
                                }
                            </p>

                            <!-- Box de Credenciais -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border: 2px solid #D4AF37; border-radius: 12px; margin: 30px 0;">
                                <tr>
                                    <td style="padding: 30px;">
                                        <h3 style="margin: 0 0 20px 0; color: #D4AF37; font-size: 18px; font-weight: bold; text-align: center;">
                                            🔑 SUAS CREDENCIAIS DE ACESSO
                                        </h3>

                                        <table width="100%" cellpadding="8" cellspacing="0">
                                            <tr>
                                                <td style="color: #999; font-size: 14px; padding: 8px 0;">
                                                    <strong>E-mail:</strong>
                                                </td>
                                                <td style="color: #fff; font-size: 14px; text-align: right; padding: 8px 0;">
                                                    ${email}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #999; font-size: 14px; padding: 8px 0;">
                                                    <strong>Senha:</strong>
                                                </td>
                                                <td style="color: #D4AF37; font-size: 16px; font-weight: bold; text-align: right; padding: 8px 0; font-family: 'Courier New', monospace;">
                                                    ${password}
                                                </td>
                                            </tr>
                                        </table>

                                        ${isNewUser ? `
                                        <p style="margin: 20px 0 0 0; color: #999; font-size: 13px; line-height: 1.5; text-align: center;">
                                            ⚠️ <strong>Importante:</strong> Guarde esta senha em local seguro. Você pode alterá-la após o primeiro acesso.
                                        </p>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>

                            <!-- Botão de Acesso -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${accessUrl}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%); color: #000000; text-decoration: none; padding: 18px 50px; border-radius: 8px; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);">
                                            🚀 ACESSAR ÁREA DE MEMBROS
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Instruções -->
                            <div style="background-color: #1a1a1a; border-left: 4px solid #D4AF37; padding: 20px; margin: 30px 0; border-radius: 8px;">
                                <h4 style="margin: 0 0 15px 0; color: #D4AF37; font-size: 16px;">
                                    📚 Como começar:
                                </h4>
                                <ol style="margin: 0; padding-left: 20px; color: #c0c0c0; font-size: 14px; line-height: 1.8;">
                                    <li>Clique no botão acima ou acesse: <a href="${accessUrl}" style="color: #D4AF37; text-decoration: none;">${accessUrl}</a></li>
                                    <li>Faça login com seu e-mail e senha</li>
                                    <li>Explore o conteúdo exclusivo do Método Tubarão</li>
                                    <li>Assista às aulas na ordem recomendada</li>
                                    <li>Aplique o conhecimento e transforme sua vida financeira!</li>
                                </ol>
                            </div>

                            <!-- Mensagem de Suporte -->
                            <p style="margin: 30px 0 0 0; color: #999; font-size: 14px; line-height: 1.6; text-align: center;">
                                Dúvidas? Entre em contato conosco pelo WhatsApp ou e-mail de suporte.
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0d0d0d; padding: 30px; text-align: center; border-top: 1px solid #333;">
                            <p style="margin: 0 0 10px 0; color: #D4AF37; font-size: 18px; font-weight: bold;">
                                🦈 Tubarão Empréstimos
                            </p>
                            <p style="margin: 0; color: #666; font-size: 12px; line-height: 1.6;">
                                © ${new Date().getFullYear()} Tubarão Empréstimos LTDA. Todos os direitos reservados.<br>
                                Este é um e-mail automático, por favor não responda.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Envia e-mail de boas-vindas com credenciais de acesso
 */
export async function sendWelcomeEmail({ email, name, password, isNewUser }: SendWelcomeEmailParams): Promise<boolean> {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.error('[Resend] RESEND_API_KEY não configurada');
            return false;
        }

        const { data, error } = await resend.emails.send({
            from: 'Tubarão Empréstimos <noreply@tubaraoemprestimo.com.br>',
            to: [email],
            subject: isNewUser
                ? '🦈 Bem-vindo ao Método Tubarão - Suas Credenciais de Acesso'
                : '🦈 Acesso Renovado - Método Tubarão',
            html: getWelcomeEmailHTML(name, email, password, isNewUser),
        });

        if (error) {
            console.error('[Resend] Erro ao enviar e-mail:', error);
            return false;
        }

        console.log(`[Resend] ✅ E-mail enviado para ${email} (ID: ${data?.id})`);
        return true;
    } catch (error: any) {
        console.error('[Resend] Erro ao enviar e-mail:', error.message);
        return false;
    }
}

// ============================================================
// EMAIL ESPECÍFICO PARA CLIENTES DE EMPRÉSTIMO (onboarding WhatsApp)
// ============================================================

interface SendLoanWelcomeEmailParams {
    email: string;
    name: string;
    password: string;
    loanAmount?: number;
    dueDate?: string;
}

function getLoanWelcomeEmailHTML(name: string, email: string, password: string, loanAmount?: number, dueDate?: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.tubaraoemprestimo.com.br';
    const loginUrl = `${appUrl}/#/acesso`;

    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seu acesso ao sistema Tubarão Empréstimos</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#0a0a0a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a1a 0%,#0d0d0d 100%);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(212,175,55,0.15);">

    <!-- Header -->
    <tr>
        <td style="background:linear-gradient(135deg,#D4AF37 0%,#C5A028 100%);padding:36px 30px;text-align:center;">
            <h1 style="margin:0;color:#000;font-size:30px;font-weight:bold;letter-spacing:2px;">🦈 TUBARÃO EMPRÉSTIMOS</h1>
            <p style="margin:8px 0 0 0;color:#1a1a1a;font-size:13px;font-weight:600;letter-spacing:1px;">SISTEMA DE GESTÃO DO SEU EMPRÉSTIMO</p>
        </td>
    </tr>

    <!-- Saudação -->
    <tr>
        <td style="padding:40px 40px 20px 40px;">
            <h2 style="margin:0 0 16px 0;color:#D4AF37;font-size:24px;text-align:center;">Olá, ${name}! 👋</h2>
            <p style="margin:0 0 20px 0;color:#c0c0c0;font-size:15px;line-height:1.8;text-align:center;">
                Seu contrato foi registrado no nosso sistema. A partir de agora você pode acompanhar e gerenciar tudo pelo aplicativo.
            </p>

            ${loanAmount ? `
            <div style="background-color:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;margin:0 0 30px 0;text-align:center;">
                <p style="margin:0 0 6px 0;color:#999;font-size:13px;">Valor registrado do seu contrato</p>
                <p style="margin:0;color:#D4AF37;font-size:28px;font-weight:bold;">${formatBRL(loanAmount)}</p>
                ${dueDate ? `<p style="margin:8px 0 0 0;color:#aaa;font-size:13px;">📅 Próximo vencimento: <strong style="color:#fff;">${dueDate}</strong></p>` : ''}
            </div>
            ` : ''}

            <!-- Credenciais -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border:2px solid #D4AF37;border-radius:12px;margin:0 0 30px 0;">
                <tr><td style="padding:24px 30px;">
                    <h3 style="margin:0 0 18px 0;color:#D4AF37;font-size:16px;text-align:center;">🔑 SEU ACESSO AO SISTEMA</h3>
                    <table width="100%" cellpadding="6" cellspacing="0">
                        <tr>
                            <td style="color:#999;font-size:14px;"><strong>E-mail:</strong></td>
                            <td style="color:#fff;font-size:14px;text-align:right;">${email}</td>
                        </tr>
                        <tr>
                            <td style="color:#999;font-size:14px;"><strong>Senha:</strong></td>
                            <td style="color:#D4AF37;font-size:16px;font-weight:bold;text-align:right;font-family:'Courier New',monospace;">${password}</td>
                        </tr>
                        <tr>
                            <td style="color:#999;font-size:14px;"><strong>Link de acesso:</strong></td>
                            <td style="text-align:right;"><a href="${loginUrl}" style="color:#D4AF37;font-size:13px;">${loginUrl}</a></td>
                        </tr>
                    </table>
                    <p style="margin:16px 0 0 0;color:#888;font-size:12px;text-align:center;">⚠️ Guarde sua senha em local seguro. Você pode alterá-la após o primeiro acesso.</p>
                </td></tr>
            </table>

            <!-- Botão -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 36px 0;">
                <tr><td align="center">
                    <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4AF37 0%,#C5A028 100%);color:#000;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">
                        🚀 ACESSAR MEU PAINEL
                    </a>
                </td></tr>
            </table>

            <!-- O que você pode fazer -->
            <div style="background-color:#111;border-left:4px solid #D4AF37;padding:22px 24px;border-radius:8px;margin:0 0 28px 0;">
                <h4 style="margin:0 0 14px 0;color:#D4AF37;font-size:15px;">📱 O que você pode fazer no sistema:</h4>
                <ul style="margin:0;padding-left:18px;color:#c0c0c0;font-size:14px;line-height:2;">
                    <li><strong style="color:#fff;">Ver seu saldo devedor</strong> — acompanhe quanto falta pagar em tempo real</li>
                    <li><strong style="color:#fff;">Ver datas de vencimento</strong> — nunca mais perca uma data</li>
                    <li><strong style="color:#fff;">Enviar comprovante de pagamento</strong> — foto do comprovante diretamente pelo app</li>
                    <li><strong style="color:#fff;">Pagar somente os juros</strong> — solicite a opção de pagar só os juros do mês</li>
                    <li><strong style="color:#fff;">Quitar seu empréstimo</strong> — veja o valor para quitação antecipada</li>
                    <li><strong style="color:#fff;">Solicitar novo empréstimo</strong> — após quitar, solicite um novo direto pelo app</li>
                    <li><strong style="color:#fff;">Receber lembretes automáticos</strong> — avisos 3 dias antes do vencimento via WhatsApp</li>
                </ul>
            </div>

            <!-- Como enviar comprovante -->
            <div style="background-color:#0f1a0f;border:1px solid #2a4a2a;border-radius:10px;padding:20px 24px;margin:0 0 28px 0;">
                <h4 style="margin:0 0 12px 0;color:#4caf50;font-size:15px;">✅ Como enviar seu comprovante de pagamento:</h4>
                <ol style="margin:0;padding-left:18px;color:#c0c0c0;font-size:14px;line-height:2;">
                    <li>Faça o pagamento via PIX ou outro método combinado</li>
                    <li>Entre no sistema com seu e-mail e senha</li>
                    <li>Clique em <strong style="color:#fff;">"Meus Empréstimos"</strong></li>
                    <li>Selecione o contrato e clique em <strong style="color:#fff;">"Enviar Comprovante"</strong></li>
                    <li>Tire uma foto do comprovante e envie — pronto! ✅</li>
                </ol>
            </div>

            <!-- Dúvidas -->
            <p style="margin:0;color:#888;font-size:13px;line-height:1.7;text-align:center;">
                Dúvidas? Responda esta mensagem ou fale conosco pelo WhatsApp.<br>
                Estamos aqui para ajudar! 🦈
            </p>
        </td>
    </tr>

    <!-- Footer -->
    <tr>
        <td style="background-color:#0d0d0d;padding:24px 30px;text-align:center;border-top:1px solid #333;">
            <p style="margin:0 0 6px 0;color:#D4AF37;font-size:16px;font-weight:bold;">🦈 Tubarão Empréstimos LTDA</p>
            <p style="margin:0;color:#555;font-size:12px;">© ${new Date().getFullYear()} Todos os direitos reservados. Este é um e-mail automático.</p>
        </td>
    </tr>

</table>
</td></tr>
</table>
</body>
</html>
    `.trim();
}

export async function sendLoanWelcomeEmail({ email, name, password, loanAmount, dueDate }: SendLoanWelcomeEmailParams): Promise<boolean> {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.error('[Resend] RESEND_API_KEY não configurada');
            return false;
        }

        const { data, error } = await resend.emails.send({
            from: 'Tubarão Empréstimos <noreply@tubaraoemprestimo.com.br>',
            to: [email],
            subject: '🦈 Seu acesso ao sistema Tubarão Empréstimos - Credenciais e Instruções',
            html: getLoanWelcomeEmailHTML(name, email, password, loanAmount, dueDate),
        });

        if (error) {
            console.error('[Resend] Erro ao enviar e-mail de empréstimo:', error);
            return false;
        }

        console.log(`[Resend] ✅ E-mail de empréstimo enviado para ${email} (ID: ${data?.id})`);
        return true;
    } catch (error: any) {
        console.error('[Resend] Erro ao enviar e-mail de empréstimo:', error.message);
        return false;
    }
}
