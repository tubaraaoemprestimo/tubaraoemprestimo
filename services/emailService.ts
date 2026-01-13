/**
 * Serviço de Email
 * Templates e envio de emails via Edge Function
 */

import { supabase } from './supabaseClient';

export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface LoanEmailData {
    clientName: string;
    clientEmail: string;
    amount: number;
    installments: number;
    status: string;
    message?: string;
}

// Templates de Email
const emailTemplates = {
    // Email para ADMIN quando nova solicitação
    newRequest: (data: LoanEmailData) => ({
        subject: `🔔 Nova Solicitação de Empréstimo - ${data.clientName}`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #1a1a1a; color: #fff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #2d2d2d; border-radius: 16px; padding: 30px; }
          .header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .info-box { background: #1a1a1a; padding: 20px; border-radius: 12px; margin: 15px 0; }
          .label { color: #888; font-size: 12px; text-transform: uppercase; }
          .value { color: #fff; font-size: 18px; font-weight: bold; margin-top: 5px; }
          .highlight { color: #D4AF37; }
          .button { display: inline-block; background: #D4AF37; color: #000; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
            <p>Nova Solicitação Recebida</p>
          </div>
          
          <div class="info-box">
            <div class="label">Cliente</div>
            <div class="value">${data.clientName}</div>
          </div>
          
          <div class="info-box">
            <div class="label">Email</div>
            <div class="value">${data.clientEmail}</div>
          </div>
          
          <div class="info-box">
            <div class="label">Valor Solicitado</div>
            <div class="value highlight">R$ ${data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          
          <div class="info-box">
            <div class="label">Parcelas</div>
            <div class="value">${data.installments}x</div>
          </div>
          
          <div style="text-align: center;">
            <a href="https://tubaraoemprestimo.vercel.app/#/admin/requests" class="button">
              Ver Solicitação
            </a>
          </div>
          
          <div class="footer">
            Este é um email automático do sistema Tubarão Empréstimos.
          </div>
        </div>
      </body>
      </html>
    `,
    }),

    // Email para CLIENTE quando solicita
    requestReceived: (data: LoanEmailData) => ({
        subject: `✅ Recebemos sua Solicitação - Tubarão Empréstimos`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .info-box { background: #f9f9f9; padding: 20px; border-radius: 12px; margin: 15px 0; border-left: 4px solid #D4AF37; }
          .label { color: #888; font-size: 12px; text-transform: uppercase; }
          .value { color: #333; font-size: 18px; font-weight: bold; margin-top: 5px; }
          .highlight { color: #D4AF37; }
          .status { background: #FFF3CD; color: #856404; padding: 10px 20px; border-radius: 8px; display: inline-block; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
          .steps { margin: 20px 0; padding: 0; }
          .step { display: flex; align-items: center; margin: 10px 0; }
          .step-number { background: #D4AF37; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          
          <h2>Olá, ${data.clientName}! 👋</h2>
          <p>Recebemos sua solicitação de empréstimo e ela está em análise.</p>
          
          <div class="info-box">
            <div class="label">Valor Solicitado</div>
            <div class="value highlight">R$ ${data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          
          <div class="info-box">
            <div class="label">Parcelas</div>
            <div class="value">${data.installments}x</div>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <span class="status">⏳ EM ANÁLISE</span>
          </div>
          
          <h3>Próximos Passos:</h3>
          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <span>Nossa equipe analisará seus documentos</span>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <span>Você receberá a resposta em até 72 horas</span>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <span>Se aprovado, o valor será depositado via PIX</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Dúvidas? Responda este email ou entre em contato via WhatsApp.</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
    }),

    // Email APROVADO
    approved: (data: LoanEmailData) => ({
        subject: `🎉 PARABÉNS! Seu Empréstimo foi APROVADO - Tubarão Empréstimos`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; background: linear-gradient(135deg, #D4AF37, #B8860B); padding: 30px; border-radius: 16px 16px 0 0; margin: -30px -30px 20px -30px; }
          .logo { font-size: 28px; font-weight: bold; color: #fff; }
          .approved-badge { background: #28A745; color: #fff; padding: 15px 30px; border-radius: 50px; display: inline-block; font-size: 24px; font-weight: bold; margin: 20px 0; }
          .info-box { background: #f9f9f9; padding: 20px; border-radius: 12px; margin: 15px 0; }
          .label { color: #888; font-size: 12px; text-transform: uppercase; }
          .value { color: #333; font-size: 20px; font-weight: bold; margin-top: 5px; }
          .highlight { color: #28A745; }
          .warning { background: #FFF3CD; padding: 15px; border-radius: 8px; margin: 20px 0; color: #856404; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          
          <div style="text-align: center;">
            <div class="approved-badge">✅ APROVADO!</div>
          </div>
          
          <h2 style="text-align: center;">Parabéns, ${data.clientName}!</h2>
          <p style="text-align: center;">Seu empréstimo foi aprovado e será depositado em breve.</p>
          
          <div class="info-box">
            <div class="label">Valor Aprovado</div>
            <div class="value highlight">R$ ${data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          
          <div class="info-box">
            <div class="label">Parcelas</div>
            <div class="value">${data.installments}x</div>
          </div>
          
          <div class="warning">
            <strong>⏱️ Prazo de Liberação:</strong> O valor será depositado via PIX em até 72 horas.
          </div>
          
          ${data.message ? `<p><strong>Mensagem:</strong> ${data.message}</p>` : ''}
          
          <div class="footer">
            <p>Obrigado por escolher a Tubarão Empréstimos!</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
    }),

    // Email REPROVADO
    rejected: (data: LoanEmailData) => ({
        subject: `Atualização sobre sua Solicitação - Tubarão Empréstimos`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #DC3545; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .status { background: #F8D7DA; color: #721C24; padding: 10px 20px; border-radius: 8px; display: inline-block; font-weight: bold; }
          .info-box { background: #f9f9f9; padding: 20px; border-radius: 12px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          
          <h2>Olá, ${data.clientName}</h2>
          
          <div style="text-align: center; margin: 20px 0;">
            <span class="status">Solicitação Não Aprovada</span>
          </div>
          
          <p>Infelizmente, não foi possível aprovar sua solicitação de empréstimo neste momento.</p>
          
          ${data.message ? `
          <div class="info-box">
            <strong>Motivo:</strong>
            <p>${data.message}</p>
          </div>
          ` : ''}
          
          <p>Você pode fazer uma nova solicitação após 30 dias.</p>
          
          <div class="footer">
            <p>Dúvidas? Entre em contato via WhatsApp.</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
    }),

    // Email AGUARDANDO DOCUMENTOS
    waitingDocs: (data: LoanEmailData) => ({
        subject: `📄 Documentos Pendentes - Tubarão Empréstimos`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #FFC107; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .status { background: #FFF3CD; color: #856404; padding: 10px 20px; border-radius: 8px; display: inline-block; font-weight: bold; }
          .info-box { background: #FFF3CD; padding: 20px; border-radius: 12px; margin: 15px 0; border-left: 4px solid #FFC107; }
          .button { display: inline-block; background: #D4AF37; color: #000; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          
          <h2>Olá, ${data.clientName}! 👋</h2>
          
          <div style="text-align: center; margin: 20px 0;">
            <span class="status">📄 Documentos Pendentes</span>
          </div>
          
          <p>Precisamos de documentos adicionais para prosseguir com sua solicitação.</p>
          
          ${data.message ? `
          <div class="info-box">
            <strong>Documentos solicitados:</strong>
            <p>${data.message}</p>
          </div>
          ` : ''}
          
          <div style="text-align: center;">
            <a href="https://tubaraoemprestimo.vercel.app/#/client/dashboard" class="button">
              Enviar Documentos
            </a>
          </div>
          
          <div class="footer">
            <p>Envie os documentos o mais rápido possível para agilizar a análise.</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
    }),
};

export const emailService = {
    /**
     * Envia email via Edge Function
     */
    async sendEmail(data: EmailData): Promise<boolean> {
        try {
            const { data: result, error } = await supabase.functions.invoke('send-email', {
                body: data,
            });

            if (error) {
                console.error('Erro ao enviar email:', error);
                return false;
            }

            return result?.success || false;
        } catch (e) {
            console.error('Erro ao enviar email:', e);
            return false;
        }
    },

    /**
     * Notifica nova solicitação (Admin + Cliente)
     */
    async notifyNewRequest(data: LoanEmailData, adminEmail: string): Promise<void> {
        // Email para Admin
        const adminTemplate = emailTemplates.newRequest(data);
        await this.sendEmail({
            to: adminEmail,
            subject: adminTemplate.subject,
            html: adminTemplate.html,
        });

        // Email para Cliente
        const clientTemplate = emailTemplates.requestReceived(data);
        await this.sendEmail({
            to: data.clientEmail,
            subject: clientTemplate.subject,
            html: clientTemplate.html,
        });
    },

    /**
     * Notifica mudança de status
     */
    async notifyStatusChange(data: LoanEmailData): Promise<void> {
        let template;

        switch (data.status) {
            case 'APPROVED':
                template = emailTemplates.approved(data);
                break;
            case 'REJECTED':
                template = emailTemplates.rejected(data);
                break;
            case 'WAITING_DOCS':
                template = emailTemplates.waitingDocs(data);
                break;
            default:
                return;
        }

        await this.sendEmail({
            to: data.clientEmail,
            subject: template.subject,
            html: template.html,
        });
    },

    /**
     * Envia email personalizado
     */
    async sendCustomEmail(to: string, subject: string, message: string): Promise<boolean> {
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 30px; }
          .header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #D4AF37; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div style="white-space: pre-wrap;">${message}</div>
          <div class="footer">
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;

        return this.sendEmail({ to, subject, html });
    },
};

export default emailService;
