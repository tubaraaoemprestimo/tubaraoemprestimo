/**
 * Serviço de Email - Sistema Completo de Notificações
 * Templates e envio de emails via API REST
 */

import { api } from './apiClient';

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
  installments?: number;
  profileType?: string;
  status?: string;
  message?: string;
  dueDate?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  paymentAmount?: number;
  campaignTitle?: string;
  campaignDescription?: string;
  campaignLink?: string;
}

// Base de estilos compartilhada
const baseStyles = `
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%); padding: 30px; text-align: center; }
  .logo { font-size: 28px; font-weight: bold; color: #D4AF37; }
  .content { padding: 30px; }
  .info-box { background: #f9f9f9; padding: 20px; border-radius: 12px; margin: 15px 0; border-left: 4px solid #D4AF37; }
  .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .value { color: #333; font-size: 20px; font-weight: bold; margin-top: 5px; }
  .highlight { color: #D4AF37; }
  .success { color: #28A745; }
  .danger { color: #DC3545; }
  .warning { color: #FFC107; }
  .button { display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); color: #000; padding: 15px 35px; border-radius: 50px; text-decoration: none; font-weight: bold; margin-top: 20px; }
  .footer { background: #1a1a2e; padding: 20px; text-align: center; color: #888; font-size: 12px; }
  .badge { display: inline-block; padding: 10px 25px; border-radius: 50px; font-weight: bold; font-size: 16px; }
  .badge-success { background: #D4EDDA; color: #155724; }
  .badge-danger { background: #F8D7DA; color: #721C24; }
  .badge-warning { background: #FFF3CD; color: #856404; }
  .badge-info { background: #D1ECF1; color: #0C5460; }
  .steps { margin: 20px 0; }
  .step { display: flex; align-items: center; margin: 10px 0; }
  .step-number { background: #D4AF37; color: #000; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; }
`;

// Templates de Email
const emailTemplates = {
  // ==========================================
  // ADMIN: Nova Solicitação
  // ==========================================
  adminNewRequest: (data: LoanEmailData) => {
    const isMoto = data.profileType === 'MOTO';
    const isLimpaNome = data.profileType === 'LIMPA_NOME';
    const isInvestidor = data.profileType === 'INVESTIDOR';
    const profileLabels: Record<string, string> = {
      CLT: 'Empréstimo Pessoal (CLT)',
      AUTONOMO: 'Capital de Giro (Comércio)',
      MOTO: 'Financiamento de Motocicleta',
      GARANTIA: 'Empréstimo com Garantia',
      LIMPA_NOME: 'Serviço Limpa Nome',
      INVESTIDOR: 'Cadastro de Investidor',
    };
    const typeLabel = profileLabels[data.profileType || ''] || 'Empréstimo';
    const subjectLabel = isLimpaNome
      ? `🔔 Nova Solicitação - ${data.clientName} - Serviço Limpa Nome`
      : isInvestidor
        ? `🔔 Nova Solicitação - ${data.clientName} - Investidor`
        : isMoto
          ? `🔔 Nova Solicitação - ${data.clientName} - Financiamento Moto`
          : `🔔 Nova Solicitação - ${data.clientName} - R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    return {
      subject: subjectLabel,
      html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
            <p style="color: #fff; margin-top: 10px;">Nova Solicitação Recebida</p>
          </div>
          <div class="content">
            <div class="info-box">
              <div class="label">Cliente</div>
              <div class="value">${data.clientName}</div>
            </div>
            <div class="info-box">
              <div class="label">Email</div>
              <div class="value">${data.clientEmail}</div>
            </div>
            <div class="info-box">
              <div class="label">Tipo</div>
              <div class="value">${typeLabel}</div>
            </div>
            ${isLimpaNome ? `
            <div class="info-box" style="border-left-color: #7C3AED;">
              <div class="label">Serviço</div>
              <div class="value" style="color: #7C3AED;">Contestação Administrativa de Negativação</div>
              <p style="color: #888; font-size: 13px; margin-top: 5px;">Limpa Nome - Contrato assinado digitalmente</p>
            </div>
            ` : isInvestidor ? `
            <div class="info-box" style="border-left-color: #06B6D4;">
              <div class="label">Investimento</div>
              <div class="value" style="color: #06B6D4;">R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <p style="color: #888; font-size: 13px; margin-top: 5px;">Novo investidor cadastrado</p>
            </div>
            ` : isMoto ? `
            <div class="info-box">
              <div class="label">Produto</div>
              <div class="value highlight">Honda Pop 110i 2026</div>
              <p style="color: #888; font-size: 13px; margin-top: 5px;">Entrada: R$ 2.000,00 | 36x R$ 611,00 + Seguro R$ 150,00/mês</p>
            </div>
            ` : `
            <div class="info-box">
              <div class="label">Valor Solicitado</div>
              <div class="value highlight">R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            `}

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br/#/admin/requests" class="button">Ver Solicitação</a>
            </div>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema Tubarão Empréstimos.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    };
  },

  // ==========================================
  // CLIENTE: Solicitação Recebida
  // ==========================================
  clientRequestReceived: (data: LoanEmailData) => {
    const isMoto = data.profileType === 'MOTO';
    const isLimpaNome = data.profileType === 'LIMPA_NOME';
    const isInvestidor = data.profileType === 'INVESTIDOR';
    const profileLabels: Record<string, string> = {
      CLT: 'empréstimo pessoal',
      AUTONOMO: 'capital de giro',
      MOTO: 'financiamento de motocicleta',
      GARANTIA: 'empréstimo com garantia',
      LIMPA_NOME: 'serviço Limpa Nome',
      INVESTIDOR: 'cadastro como investidor',
    };
    const typeLabel = profileLabels[data.profileType || ''] || 'empréstimo';
    return {
      subject: isMoto
        ? `✅ Recebemos sua Solicitação de Financiamento - Tubarão Empréstimos`
        : `✅ Recebemos sua Solicitação - Tubarão Empréstimos`,
      html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <h2>Olá, ${data.clientName}! 👋</h2>
            <p>Recebemos sua solicitação de ${typeLabel} e ela está em análise.</p>

            ${isLimpaNome ? `
            <div class="info-box" style="border-left-color: #7C3AED;">
              <div class="label">Serviço Solicitado</div>
              <div class="value" style="color: #7C3AED;">Limpa Nome</div>
              <p style="color: #888; font-size: 13px; margin-top: 5px;">Contestação administrativa de negativação</p>
            </div>
            ` : isInvestidor ? `
            <div class="info-box" style="border-left-color: #06B6D4;">
              <div class="label">Investimento</div>
              <div class="value" style="color: #06B6D4;">R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            ` : isMoto ? `
            <div class="info-box">
              <div class="label">Financiamento</div>
              <div class="value highlight">Honda Pop 110i 2026</div>
              <p style="color: #888; font-size: 13px; margin-top: 5px;">Entrada: R$ 2.000,00 | 36x R$ 611,00 + Seguro R$ 150,00/mês</p>
            </div>
            ` : `
            <div class="info-box">
              <div class="label">Valor Solicitado</div>
              <div class="value highlight">R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            `}



            <div style="text-align: center; margin: 25px 0;">
              <span class="badge badge-info">⏳ EM ANÁLISE</span>
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
                <span>${data.profileType === 'MOTO' ? 'Se aprovado, entraremos em contato para entrega da moto' : 'Se aprovado, o valor será depositado via PIX'}</span>
              </div>
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
    };
  },

  // ==========================================
  // CLIENTE: Empréstimo APROVADO
  // ==========================================
  clientApproved: (data: LoanEmailData) => ({
    subject: `🎉 PARABÉNS! Seu Empréstimo foi APROVADO!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #28A745 0%, #20963A 100%);">
            <div class="logo" style="color: #fff;">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="badge badge-success" style="font-size: 24px; padding: 15px 40px;">✅ APROVADO!</span>
            </div>

            <h2 style="text-align: center; margin-top: 20px;">Parabéns, ${data.clientName}!</h2>
            <p style="text-align: center;">Seu empréstimo foi aprovado e será depositado em breve.</p>

            <div class="info-box" style="border-left-color: #28A745;">
              <div class="label">Valor Aprovado</div>
              <div class="value success">R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>



            <div style="background: #D4EDDA; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
              <strong>⏱️ Prazo de Liberação:</strong><br>
              O valor será depositado via PIX em até 72 horas.
            </div>

            ${data.message ? `<div class="info-box"><strong>Mensagem:</strong><p>${data.message}</p></div>` : ''}
          </div>
          <div class="footer">
            <p>Obrigado por escolher a Tubarão Empréstimos!</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // CLIENTE: Empréstimo REPROVADO
  // ==========================================
  clientRejected: (data: LoanEmailData) => ({
    subject: `Atualização sobre sua Solicitação - Tubarão Empréstimos`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <h2>Olá, ${data.clientName}</h2>

            <div style="text-align: center; margin: 25px 0;">
              <span class="badge badge-danger">Solicitação Não Aprovada</span>
            </div>

            <p>Infelizmente, não foi possível aprovar sua solicitação de empréstimo neste momento.</p>

            ${data.message ? `
            <div class="info-box" style="border-left-color: #DC3545;">
              <strong>Motivo:</strong>
              <p>${data.message}</p>
            </div>
            ` : ''}

            <p>Você pode fazer uma nova solicitação após 30 dias.</p>

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br" class="button">Tentar Novamente</a>
            </div>
          </div>
          <div class="footer">
            <p>Dúvidas? Entre em contato via WhatsApp.</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // CLIENTE: Documentos Pendentes
  // ==========================================
  clientWaitingDocs: (data: LoanEmailData) => ({
    subject: `📄 Documentos Pendentes - Tubarão Empréstimos`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <h2>Olá, ${data.clientName}! 👋</h2>

            <div style="text-align: center; margin: 25px 0;">
              <span class="badge badge-warning">📄 Documentos Pendentes</span>
            </div>

            <p>Precisamos de documentos adicionais para prosseguir com sua solicitação de <strong>R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.</p>

            ${data.message ? `
            <div class="info-box" style="border-left-color: #FFC107; background: #FFF3CD;">
              <strong>📋 Documentos Solicitados:</strong>
              <p style="white-space: pre-line;">${data.message}</p>
            </div>
            ` : ''}

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br/#/client/dashboard" class="button">Enviar Documentos</a>
            </div>

            <p style="text-align: center; margin-top: 20px; color: #856404;">
              ⚠️ Envie os documentos o mais rápido possível para agilizar a análise.
            </p>
          </div>
          <div class="footer">
            <p>Dúvidas? Entre em contato via WhatsApp.</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // CLIENTE: Parcela Vencendo (Lembrete)
  // ==========================================
  clientInstallmentReminder: (data: LoanEmailData) => ({
    subject: `⏰ Lembrete: Parcela ${data.installmentNumber}/${data.totalInstallments} vence em breve`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <h2>Olá, ${data.clientName}! 👋</h2>

            <div style="text-align: center; margin: 25px 0;">
              <span class="badge badge-info">⏰ Lembrete de Pagamento</span>
            </div>

            <p>Sua parcela está próxima do vencimento. Não esqueça de realizar o pagamento!</p>

            <div class="info-box">
              <div class="label">Parcela</div>
              <div class="value">${data.installmentNumber}/${data.totalInstallments}</div>
            </div>

            <div class="info-box">
              <div class="label">Valor</div>
              <div class="value highlight">R$ ${data.paymentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            <div class="info-box" style="border-left-color: #17A2B8;">
              <div class="label">Vencimento</div>
              <div class="value">${data.dueDate}</div>
            </div>

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br/#/client/contracts" class="button">Ver Parcelas</a>
            </div>
          </div>
          <div class="footer">
            <p>Pague em dia e mantenha seu nome limpo!</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // CLIENTE: Parcela Atrasada
  // ==========================================
  clientInstallmentLate: (data: LoanEmailData) => ({
    subject: `🚨 URGENTE: Parcela ${data.installmentNumber}/${data.totalInstallments} em ATRASO`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #DC3545 0%, #C82333 100%);">
            <div class="logo" style="color: #fff;">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <h2>Olá, ${data.clientName}</h2>

            <div style="text-align: center; margin: 25px 0;">
              <span class="badge badge-danger" style="font-size: 18px;">🚨 PARCELA EM ATRASO</span>
            </div>

            <p>Identificamos que sua parcela está em atraso. Regularize sua situação o mais rápido possível para evitar juros e multas.</p>

            <div class="info-box" style="border-left-color: #DC3545;">
              <div class="label">Parcela</div>
              <div class="value">${data.installmentNumber}/${data.totalInstallments}</div>
            </div>

            <div class="info-box" style="border-left-color: #DC3545;">
              <div class="label">Valor (com juros)</div>
              <div class="value danger">R$ ${data.paymentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            <div class="info-box" style="border-left-color: #DC3545;">
              <div class="label">Vencimento Original</div>
              <div class="value">${data.dueDate}</div>
            </div>

            <div style="background: #F8D7DA; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; color: #721C24;">
              <strong>⚠️ Atenção:</strong> O atraso pode gerar juros diários e afetar seu score de crédito.
            </div>

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br/#/client/contracts" class="button" style="background: linear-gradient(135deg, #DC3545 0%, #C82333 100%); color: #fff;">Pagar Agora</a>
            </div>
          </div>
          <div class="footer">
            <p>Entre em contato via WhatsApp para negociar.</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // CLIENTE: Pagamento Confirmado
  // ==========================================
  clientPaymentConfirmed: (data: LoanEmailData) => ({
    subject: `✅ Pagamento Confirmado - Parcela ${data.installmentNumber}/${data.totalInstallments}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #28A745 0%, #20963A 100%);">
            <div class="logo" style="color: #fff;">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="badge badge-success" style="font-size: 20px;">✅ Pagamento Confirmado!</span>
            </div>

            <h2 style="text-align: center; margin-top: 20px;">Obrigado, ${data.clientName}!</h2>

            <p style="text-align: center;">Seu pagamento foi recebido e processado com sucesso.</p>

            <div class="info-box" style="border-left-color: #28A745;">
              <div class="label">Parcela Paga</div>
              <div class="value">${data.installmentNumber}/${data.totalInstallments}</div>
            </div>

            <div class="info-box" style="border-left-color: #28A745;">
              <div class="label">Valor Pago</div>
              <div class="value success">R$ ${data.paymentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            <div style="background: #D4EDDA; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; color: #155724;">
              <strong>🎯 Continue assim!</strong><br>
              Pagando em dia, você mantém seu histórico positivo e garante acesso a melhores condições no futuro.
            </div>
          </div>
          <div class="footer">
            <p>Obrigado por confiar na Tubarão Empréstimos!</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // CLIENTE: Empréstimo Quitado
  // ==========================================
  clientLoanCompleted: (data: LoanEmailData) => ({
    subject: `🎉 Parabéns! Seu Empréstimo foi QUITADO!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%);">
            <div class="logo" style="color: #fff;">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="badge badge-success" style="font-size: 24px; padding: 20px 40px;">🎉 QUITADO!</span>
            </div>

            <h2 style="text-align: center; margin-top: 20px;">Parabéns, ${data.clientName}!</h2>

            <p style="text-align: center; font-size: 18px;">Você quitou seu empréstimo! Todas as parcelas foram pagas.</p>

            <div class="info-box" style="border-left-color: #D4AF37; background: linear-gradient(135deg, #FFF8E1 0%, #FFF3CD 100%);">
              <div class="label">Valor Total Pago</div>
              <div class="value highlight">R$ ${data.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            <div style="background: #D4EDDA; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: center;">
              <strong style="font-size: 18px;">🌟 Cliente Especial!</strong><br><br>
              Por ser um bom pagador, você tem acesso a condições especiais para novos empréstimos.<br>
              Entre em contato para saber mais!
            </div>

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br" class="button">Fazer Novo Empréstimo</a>
            </div>
          </div>
          <div class="footer">
            <p>Obrigado por confiar na Tubarão Empréstimos!</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // MARKETING: Campanha/Promoção
  // ==========================================
  marketingCampaign: (data: LoanEmailData) => ({
    subject: `🔥 ${data.campaignTitle} - Tubarão Empréstimos`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%);">
            <div class="logo" style="color: #fff;">🦈 TUBARÃO EMPRÉSTIMOS</div>
            <p style="color: #fff; font-size: 14px; margin-top: 10px;">Oferta Especial para Você!</p>
          </div>
          <div class="content">
            <h2 style="text-align: center; color: #D4AF37;">${data.campaignTitle}</h2>

            <p style="text-align: center; font-size: 16px;">${data.campaignDescription}</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.campaignLink || 'https://tubaraoemprestimo.com.br'}" class="button" style="font-size: 18px; padding: 20px 50px;">
                Aproveitar Oferta
              </a>
            </div>

            <p style="text-align: center; color: #888; font-size: 12px;">
              Oferta por tempo limitado. Condições sujeitas a análise de crédito.
            </p>
          </div>
          <div class="footer">
            <p>Você recebeu este email porque é cliente da Tubarão Empréstimos.</p>
            <p>© Tubarão Empréstimos - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // ADMIN: Nova Solicitação LIMPA NOME
  // ==========================================
  adminLimpaNomeRequest: (data: LoanEmailData) => ({
    subject: `🔔 Nova Solicitação LIMPA NOME - ${data.clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
            <p style="color: #fff; margin-top: 10px;">Nova Solicitação - Limpa Nome</p>
          </div>
          <div class="content">
            <div style="text-align: center; margin-bottom: 20px;">
              <span class="badge" style="background: #E8D5F5; color: #6B21A8;">🔒 SERVIÇO LIMPA NOME</span>
            </div>
            <div class="info-box">
              <div class="label">Cliente</div>
              <div class="value">${data.clientName}</div>
            </div>
            <div class="info-box">
              <div class="label">Email</div>
              <div class="value">${data.clientEmail}</div>
            </div>
            <div class="info-box" style="border-left-color: #7C3AED;">
              <div class="label">Serviço</div>
              <div class="value" style="color: #7C3AED;">Contestação Administrativa de Negativação</div>
            </div>

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br/#/admin/requests" class="button">Ver Solicitação</a>
            </div>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema Tubarão Empréstimos.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // CLIENTE: Solicitação LIMPA NOME Recebida
  // ==========================================
  clientLimpaNomeReceived: (data: LoanEmailData) => ({
    subject: `✅ Recebemos sua Solicitação - Limpa Nome - Tubarão Empréstimos`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <h2>Olá, ${data.clientName}! 👋</h2>
            <p>Recebemos sua solicitação do serviço <strong>Limpa Nome</strong> e ela está em análise.</p>

            <div class="info-box" style="border-left-color: #7C3AED;">
              <div class="label">Serviço Solicitado</div>
              <div class="value" style="color: #7C3AED;">Limpa Nome</div>
              <p style="color: #888; font-size: 13px; margin-top: 5px;">Contestação administrativa de negativação</p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <span class="badge badge-info">⏳ EM ANÁLISE</span>
            </div>

            <h3>Próximos Passos:</h3>
            <div class="steps">
              <div class="step">
                <div class="step-number">1</div>
                <span>Nossa equipe analisará seus dados e contrato assinado</span>
              </div>
              <div class="step">
                <div class="step-number">2</div>
                <span>Você receberá a confirmação de início do processo</span>
              </div>
              <div class="step">
                <div class="step-number">3</div>
                <span>Acompanhe o andamento pelo painel do cliente</span>
              </div>
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

  // ==========================================
  // ADMIN: Novo Pagamento Recebido
  // ==========================================
  adminPaymentReceived: (data: LoanEmailData) => ({
    subject: `💰 Pagamento Recebido - ${data.clientName} - R$ ${data.paymentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles} .container { background: #2d2d2d; } .content { color: #fff; } .info-box { background: #1a1a1a; } .label { color: #888; } .value { color: #fff; }</style></head>
      <body style="background: #1a1a1a;">
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
            <p style="color: #28A745;">💰 Pagamento Recebido</p>
          </div>
          <div class="content">
            <div class="info-box">
              <div class="label">Cliente</div>
              <div class="value">${data.clientName}</div>
            </div>

            <div class="info-box">
              <div class="label">Email</div>
              <div class="value">${data.clientEmail}</div>
            </div>

            <div class="info-box">
              <div class="label">Parcela</div>
              <div class="value">${data.installmentNumber}/${data.totalInstallments}</div>
            </div>

            <div class="info-box">
              <div class="label">Valor Recebido</div>
              <div class="value success">R$ ${data.paymentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br/#/admin/dashboard" class="button">Ver Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>Email automático do sistema Tubarão Empréstimos</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // ==========================================
  // ADMIN: Parcela Atrasada (Alerta)
  // ==========================================
  adminLatePayment: (data: LoanEmailData) => ({
    subject: `🚨 ALERTA: Parcela Atrasada - ${data.clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles} .container { background: #2d2d2d; } .content { color: #fff; } .info-box { background: #1a1a1a; border-left-color: #DC3545; } .label { color: #888; } .value { color: #fff; }</style></head>
      <body style="background: #1a1a1a;">
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #DC3545 0%, #C82333 100%);">
            <div class="logo" style="color: #fff;">🦈 TUBARÃO EMPRÉSTIMOS</div>
            <p style="color: #fff;">🚨 Alerta de Inadimplência</p>
          </div>
          <div class="content">
            <div class="info-box">
              <div class="label">Cliente</div>
              <div class="value">${data.clientName}</div>
            </div>

            <div class="info-box">
              <div class="label">Email</div>
              <div class="value">${data.clientEmail}</div>
            </div>

            <div class="info-box">
              <div class="label">Parcela Atrasada</div>
              <div class="value">${data.installmentNumber}/${data.totalInstallments}</div>
            </div>

            <div class="info-box">
              <div class="label">Valor Pendente</div>
              <div class="value danger">R$ ${data.paymentAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            <div class="info-box">
              <div class="label">Vencimento</div>
              <div class="value">${data.dueDate}</div>
            </div>

            <div style="text-align: center;">
              <a href="https://tubaraoemprestimo.com.br/#/admin/customers" class="button" style="background: linear-gradient(135deg, #DC3545 0%, #C82333 100%); color: #fff;">Ver Cliente</a>
            </div>
          </div>
          <div class="footer">
            <p>Email automático do sistema Tubarão Empréstimos</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Serviço de Email
export const emailService = {
  /**
   * Envia email via API REST
   */
  async sendEmail(data: EmailData): Promise<boolean> {
    try {
      const { data: result, error } = await api.post<any>('/email/send', data);

      if (error) {
        console.error('Erro ao enviar email:', error);
        return false;
      }

      console.log('Email enviado:', result);
      return (result as any)?.success || false;
    } catch (e) {
      console.error('Erro ao enviar email:', e);
      return false;
    }
  },

  /**
   * Busca email do admin nas configurações
   */
  async getAdminEmail(): Promise<string> {
    try {
      const { data } = await api.get<any>('/settings?key=admin_email');
      return (data as any)?.value || 'tubaraao.emprestimo@gmail.com';
    } catch {
      return 'tubaraao.emprestimo@gmail.com';
    }
  },

  // ==========================================
  // NOTIFICAÇÕES DE SOLICITAÇÃO
  // ==========================================

  async notifyNewRequest(data: LoanEmailData): Promise<void> {
    const adminEmail = await this.getAdminEmail();

    if (data.profileType === 'LIMPA_NOME') {
      // Templates específicos para Limpa Nome
      const adminTemplate = emailTemplates.adminLimpaNomeRequest(data);
      await this.sendEmail({ to: adminEmail, ...adminTemplate });

      const clientTemplate = emailTemplates.clientLimpaNomeReceived(data);
      await this.sendEmail({ to: data.clientEmail, ...clientTemplate });
    } else {
      // Templates padrão para empréstimos
      const adminTemplate = emailTemplates.adminNewRequest(data);
      await this.sendEmail({ to: adminEmail, ...adminTemplate });

      const clientTemplate = emailTemplates.clientRequestReceived(data);
      await this.sendEmail({ to: data.clientEmail, ...clientTemplate });
    }
  },

  async notifyApproved(data: LoanEmailData): Promise<void> {
    const template = emailTemplates.clientApproved(data);
    await this.sendEmail({ to: data.clientEmail, ...template });
  },

  async notifyRejected(data: LoanEmailData): Promise<void> {
    const template = emailTemplates.clientRejected(data);
    await this.sendEmail({ to: data.clientEmail, ...template });
  },

  async notifyWaitingDocs(data: LoanEmailData): Promise<void> {
    const template = emailTemplates.clientWaitingDocs(data);
    await this.sendEmail({ to: data.clientEmail, ...template });
  },

  // ==========================================
  // NOTIFICAÇÕES DE PAGAMENTO
  // ==========================================

  async notifyInstallmentReminder(data: LoanEmailData): Promise<void> {
    const template = emailTemplates.clientInstallmentReminder(data);
    await this.sendEmail({ to: data.clientEmail, ...template });
  },

  async notifyInstallmentLate(data: LoanEmailData): Promise<void> {
    const adminEmail = await this.getAdminEmail();

    // Email para Cliente
    const clientTemplate = emailTemplates.clientInstallmentLate(data);
    await this.sendEmail({ to: data.clientEmail, ...clientTemplate });

    // Email para Admin
    const adminTemplate = emailTemplates.adminLatePayment(data);
    await this.sendEmail({ to: adminEmail, ...adminTemplate });
  },

  async notifyPaymentConfirmed(data: LoanEmailData): Promise<void> {
    const adminEmail = await this.getAdminEmail();

    // Email para Cliente
    const clientTemplate = emailTemplates.clientPaymentConfirmed(data);
    await this.sendEmail({ to: data.clientEmail, ...clientTemplate });

    // Email para Admin
    const adminTemplate = emailTemplates.adminPaymentReceived(data);
    await this.sendEmail({ to: adminEmail, ...adminTemplate });
  },

  async notifyLoanCompleted(data: LoanEmailData): Promise<void> {
    const template = emailTemplates.clientLoanCompleted(data);
    await this.sendEmail({ to: data.clientEmail, ...template });
  },

  // ==========================================
  // MARKETING
  // ==========================================

  async sendMarketingCampaign(data: LoanEmailData): Promise<boolean> {
    const template = emailTemplates.marketingCampaign(data);
    return this.sendEmail({ to: data.clientEmail, ...template });
  },

  // ==========================================
  // EMAIL PERSONALIZADO
  // ==========================================

  async sendCustomEmail(to: string, subject: string, message: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><style>${baseStyles}</style></head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🦈 TUBARÃO EMPRÉSTIMOS</div>
          </div>
          <div class="content">
            <div style="white-space: pre-wrap;">${message}</div>
          </div>
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
