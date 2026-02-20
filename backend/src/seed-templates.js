const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const templates = [
  // ============ COBRANÇA (5 templates) ============
  {
    name: 'Lembrete 7 dias antes do vencimento',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_DUE_7_DAYS',
    channel: 'whatsapp',
    subject: null,
    content: `Olá {nome}! 👋

📅 Lembrete: Sua parcela de *R$ {valor}* vence em *7 dias* ({data_vencimento}).

💳 Pague via PIX:
Chave: {pix_key}

Evite juros e mantenha seu crédito em dia! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Lembrete 3 dias antes do vencimento',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_DUE_3_DAYS',
    channel: 'whatsapp',
    subject: null,
    content: `⚠️ {nome}, atenção!

Sua parcela de *R$ {valor}* vence em *3 dias* ({data_vencimento}).

💰 Pague agora via PIX:
Chave: {pix_key}

Não deixe para a última hora! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Vencimento hoje',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_DUE_TODAY',
    channel: 'whatsapp',
    subject: null,
    content: `🚨 {nome}, HOJE é o vencimento!

Parcela: *R$ {valor}*
Vencimento: *HOJE* ({data_vencimento})

💳 PIX para pagamento:
{pix_key}

Pague agora e evite juros! ⏰

_Tubarão Empréstimos_`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Atraso 1 dia',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_1_DAY',
    channel: 'whatsapp',
    subject: null,
    content: `⚠️ {nome}, sua parcela está em atraso!

Valor: *R$ {valor}*
Venceu em: {data_vencimento}
Atraso: *1 dia*

💰 Regularize agora via PIX:
{pix_key}

Evite juros maiores e negativação! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Atraso 7+ dias - URGENTE',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_7_DAYS',
    channel: 'whatsapp',
    subject: null,
    content: `🚨 URGENTE - {nome}

Sua parcela está *{dias_atraso} dias* em atraso!

Valor original: R$ {valor}
Valor com juros: *R$ {valor_com_juros}*

⚠️ Regularize HOJE para evitar:
• Negativação no SPC/Serasa
• Bloqueio de novos empréstimos
• Ação judicial

💳 PIX: {pix_key}

Entre em contato: {telefone_suporte}

_Tubarão Empréstimos_`,
    variables: ['nome', 'dias_atraso', 'valor', 'valor_com_juros', 'pix_key', 'telefone_suporte'],
    isActive: true
  },
  {
    name: 'Atraso 3 dias',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_3_DAYS',
    channel: 'whatsapp',
    subject: null,
    content: `⚠️ {nome}, sua parcela está 3 dias em atraso!

Valor: *R$ {valor}*
Venceu em: {data_vencimento}
Atraso: *3 dias*

💰 Regularize agora via PIX:
{pix_key}

Evite juros maiores e negativação! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Atraso 15 dias - CRÍTICO',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_15_DAYS',
    channel: 'whatsapp',
    subject: null,
    content: `🚨 CRÍTICO - {nome}

Sua parcela está *15 dias* em atraso!

Valor original: R$ {valor}
Valor com juros: *R$ {valor_com_juros}*

⚠️ ATENÇÃO:
• Negativação será realizada em 48h
• Bloqueio permanente de crédito
• Cobrança judicial iniciada

💳 REGULARIZE URGENTE:
PIX: {pix_key}

Suporte: {telefone_suporte}

_Tubarão Empréstimos_`,
    variables: ['nome', 'valor', 'valor_com_juros', 'pix_key', 'telefone_suporte'],
    isActive: true
  },
  {
    name: 'Atraso 30 dias - ÚLTIMA NOTIFICAÇÃO',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_30_DAYS',
    channel: 'whatsapp',
    subject: null,
    content: `🚨 ÚLTIMA NOTIFICAÇÃO - {nome}

Sua parcela está *30 dias* em atraso!

Valor original: R$ {valor}
Valor com juros e multa: *R$ {valor_com_juros}*

⚠️ AÇÕES TOMADAS:
✓ Negativação no SPC/Serasa
✓ Bloqueio de crédito
✓ Processo judicial iniciado

Esta é a ÚLTIMA oportunidade de regularização antes da execução judicial.

💳 PIX: {pix_key}
📞 Suporte: {telefone_suporte}

_Tubarão Empréstimos - Departamento Jurídico_`,
    variables: ['nome', 'valor', 'valor_com_juros', 'pix_key', 'telefone_suporte'],
    isActive: true
  },

  // ============ COBRANÇA - TEMPLATES DE EMAIL ============
  {
    name: 'Email - Lembrete 7 dias antes',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_DUE_7_DAYS',
    channel: 'email',
    subject: '📅 Lembrete: Parcela vence em 7 dias',
    content: `Olá {nome}!

Lembramos que sua parcela de R$ {valor} vence em 7 dias ({data_vencimento}).

💳 Pague via PIX:
Chave: {pix_key}

Evite juros e mantenha seu crédito em dia!

Atenciosamente,
Equipe Tubarão Empréstimos`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Email - Lembrete 3 dias antes',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_DUE_3_DAYS',
    channel: 'email',
    subject: '⚠️ Atenção: Parcela vence em 3 dias',
    content: `{nome}, atenção!

Sua parcela de R$ {valor} vence em 3 dias ({data_vencimento}).

💰 Pague agora via PIX:
Chave: {pix_key}

Não deixe para a última hora!

Atenciosamente,
Equipe Tubarão Empréstimos`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Email - Vencimento hoje',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_DUE_TODAY',
    channel: 'email',
    subject: '🚨 HOJE é o vencimento da sua parcela',
    content: `{nome}, HOJE é o vencimento!

Parcela: R$ {valor}
Vencimento: HOJE ({data_vencimento})

💳 PIX para pagamento:
{pix_key}

Pague agora e evite juros!

Atenciosamente,
Equipe Tubarão Empréstimos`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Email - Atraso 1 dia',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_1_DAY',
    channel: 'email',
    subject: '⚠️ Parcela em atraso - 1 dia',
    content: `{nome}, sua parcela está em atraso!

Valor: R$ {valor}
Venceu em: {data_vencimento}
Atraso: 1 dia

💰 Regularize agora via PIX:
{pix_key}

Evite juros maiores e negativação!

Atenciosamente,
Equipe Tubarão Empréstimos`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Email - Atraso 3 dias',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_3_DAYS',
    channel: 'email',
    subject: '⚠️ Parcela em atraso - 3 dias',
    content: `{nome}, sua parcela está 3 dias em atraso!

Valor: R$ {valor}
Venceu em: {data_vencimento}
Atraso: 3 dias

💰 Regularize agora via PIX:
{pix_key}

Evite juros maiores e negativação!

Atenciosamente,
Equipe Tubarão Empréstimos`,
    variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
    isActive: true
  },
  {
    name: 'Email - Atraso 7+ dias URGENTE',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_7_DAYS',
    channel: 'email',
    subject: '🚨 URGENTE: Parcela em atraso - {dias_atraso} dias',
    content: `URGENTE - {nome}

Sua parcela está {dias_atraso} dias em atraso!

Valor original: R$ {valor}
Valor com juros: R$ {valor_com_juros}

⚠️ Regularize HOJE para evitar:
• Negativação no SPC/Serasa
• Bloqueio de novos empréstimos
• Ação judicial

💳 PIX: {pix_key}

Entre em contato: {telefone_suporte}

Atenciosamente,
Equipe Tubarão Empréstimos`,
    variables: ['nome', 'dias_atraso', 'valor', 'valor_com_juros', 'pix_key', 'telefone_suporte'],
    isActive: true
  },
  {
    name: 'Email - Atraso 15 dias CRÍTICO',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_15_DAYS',
    channel: 'email',
    subject: '🚨 CRÍTICO: Parcela 15 dias em atraso',
    content: `CRÍTICO - {nome}

Sua parcela está 15 dias em atraso!

Valor original: R$ {valor}
Valor com juros: R$ {valor_com_juros}

⚠️ ATENÇÃO:
• Negativação será realizada em 48h
• Bloqueio permanente de crédito
• Cobrança judicial iniciada

💳 REGULARIZE URGENTE:
PIX: {pix_key}

Suporte: {telefone_suporte}

Atenciosamente,
Departamento de Cobrança
Tubarão Empréstimos`,
    variables: ['nome', 'valor', 'valor_com_juros', 'pix_key', 'telefone_suporte'],
    isActive: true
  },
  {
    name: 'Email - Atraso 30 dias ÚLTIMA NOTIFICAÇÃO',
    category: 'COBRANCA',
    triggerEvent: 'INSTALLMENT_OVERDUE_30_DAYS',
    channel: 'email',
    subject: '🚨 ÚLTIMA NOTIFICAÇÃO: Parcela 30 dias em atraso',
    content: `ÚLTIMA NOTIFICAÇÃO - {nome}

Sua parcela está 30 dias em atraso!

Valor original: R$ {valor}
Valor com juros e multa: R$ {valor_com_juros}

⚠️ AÇÕES TOMADAS:
✓ Negativação no SPC/Serasa
✓ Bloqueio de crédito
✓ Processo judicial iniciado

Esta é a ÚLTIMA oportunidade de regularização antes da execução judicial.

💳 PIX: {pix_key}
📞 Suporte: {telefone_suporte}

Atenciosamente,
Departamento Jurídico
Tubarão Empréstimos`,
    variables: ['nome', 'valor', 'valor_com_juros', 'pix_key', 'telefone_suporte'],
    isActive: true
  },

  // ============ MARKETING (5 templates) ============
  {
    name: 'Campanha de desconto',
    category: 'MARKETING',
    triggerEvent: 'CAMPAIGN_DISCOUNT',
    channel: 'whatsapp',
    subject: null,
    content: `🎉 {nome}, PROMOÇÃO ESPECIAL!

*{desconto}% de desconto* no seu próximo empréstimo!

✨ Válido até: {data_validade}
💰 Solicite agora: {link_app}

Aproveite essa oportunidade exclusiva! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'desconto', 'data_validade', 'link_app'],
    isActive: true
  },
  {
    name: 'Cupom de parceiro',
    category: 'MARKETING',
    triggerEvent: 'PARTNER_COUPON',
    channel: 'whatsapp',
    subject: null,
    content: `🎁 {nome}, CUPOM EXCLUSIVO!

*{partner_name}*
Código: *{code}*
Desconto: *{discount}% OFF*

{description}

⏰ Válido até: {expires_at}

Aproveite! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'partner_name', 'code', 'discount', 'description', 'expires_at'],
    isActive: true
  },
  {
    name: 'Programa de indicação',
    category: 'MARKETING',
    triggerEvent: 'REFERRAL_PROGRAM',
    channel: 'whatsapp',
    subject: null,
    content: `💰 {nome}, GANHE R$ {bonus_valor}!

Indique amigos e ganhe *R$ {bonus_valor}* por cada indicação aprovada!

🔗 Seu código: *{referral_code}*
📱 Compartilhe: {link_indicacao}

Quanto mais indicar, mais você ganha! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'bonus_valor', 'referral_code', 'link_indicacao'],
    isActive: true
  },
  {
    name: 'Oferta especial - Pré-aprovado',
    category: 'MARKETING',
    triggerEvent: 'PRE_APPROVED_OFFER',
    channel: 'whatsapp',
    subject: null,
    content: `🎯 {nome}, você foi PRÉ-APROVADO!

Valor disponível: *R$ {valor_pre_aprovado}*
Taxa especial: *{taxa}% ao mês*
Parcelas: até {max_parcelas}x

✨ Oferta válida até: {data_validade}
💰 Solicite agora: {link_app}

Não perca essa oportunidade! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'valor_pre_aprovado', 'taxa', 'max_parcelas', 'data_validade', 'link_app'],
    isActive: true
  },
  {
    name: 'Novidades do sistema',
    category: 'MARKETING',
    triggerEvent: 'SYSTEM_NEWS',
    channel: 'whatsapp',
    subject: null,
    content: `🆕 {nome}, NOVIDADES!

{titulo_novidade}

{descricao_novidade}

📱 Acesse o app e confira: {link_app}

Estamos sempre melhorando para você! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'titulo_novidade', 'descricao_novidade', 'link_app'],
    isActive: true
  },

  // ============ ATENDIMENTO (5 templates) ============
  {
    name: 'Resposta automática fora do horário',
    category: 'ATENDIMENTO',
    triggerEvent: 'AUTO_REPLY_OFF_HOURS',
    channel: 'whatsapp',
    subject: null,
    content: `Olá! 👋

No momento estamos fora do horário de atendimento.

⏰ Horário de funcionamento:
Segunda a Sexta: 8h às 18h
Sábado: 8h às 12h

Retornaremos em breve! 🦈

_Tubarão Empréstimos_`,
    variables: [],
    isActive: true
  },
  {
    name: 'Ticket de suporte aberto',
    category: 'ATENDIMENTO',
    triggerEvent: 'SUPPORT_TICKET_OPENED',
    channel: 'whatsapp',
    subject: null,
    content: `✅ {nome}, seu ticket foi aberto!

Protocolo: *{ticket_id}*
Assunto: {assunto}

Nossa equipe irá analisar e responder em até 24 horas.

Acompanhe pelo app: {link_app}

_Tubarão Empréstimos_ 🦈`,
    variables: ['nome', 'ticket_id', 'assunto', 'link_app'],
    isActive: true
  },
  {
    name: 'Ticket de suporte resolvido',
    category: 'ATENDIMENTO',
    triggerEvent: 'SUPPORT_TICKET_RESOLVED',
    channel: 'whatsapp',
    subject: null,
    content: `✅ {nome}, seu ticket foi resolvido!

Protocolo: {ticket_id}
Solução: {solucao}

Ficou satisfeito com o atendimento?
Avalie: {link_avaliacao}

Estamos sempre à disposição! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'ticket_id', 'solucao', 'link_avaliacao'],
    isActive: true
  },
  {
    name: 'Solicitação de documentos',
    category: 'ATENDIMENTO',
    triggerEvent: 'DOCUMENTS_REQUESTED',
    channel: 'whatsapp',
    subject: null,
    content: `📄 {nome}, precisamos de documentos!

Para análise do seu empréstimo, envie:

{lista_documentos}

📱 Envie pelo app: {link_app}
⏰ Prazo: {prazo_dias} dias

Quanto antes enviar, mais rápido aprovamos! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'lista_documentos', 'link_app', 'prazo_dias'],
    isActive: true
  },
  {
    name: 'Confirmação de recebimento',
    category: 'ATENDIMENTO',
    triggerEvent: 'DOCUMENTS_RECEIVED',
    channel: 'whatsapp',
    subject: null,
    content: `✅ {nome}, documentos recebidos!

Recebemos seus documentos e já estamos analisando.

⏰ Prazo de análise: até {prazo_analise} horas

Você receberá uma notificação assim que concluirmos.

Obrigado pela confiança! 🦈

_Tubarão Empréstimos_`,
    variables: ['nome', 'prazo_analise'],
    isActive: true
  },

  // ============ SISTEMA (5 templates) ============
  {
    name: 'Boas-vindas',
    category: 'SISTEMA',
    triggerEvent: 'USER_REGISTERED',
    channel: 'email',
    subject: '🦈 Bem-vindo ao Tubarão Empréstimos!',
    content: `Olá {nome}! 👋

Seja bem-vindo ao Tubarão Empréstimos!

Sua conta foi criada com sucesso. Agora você pode:

✅ Solicitar empréstimos
✅ Acompanhar parcelas
✅ Receber ofertas exclusivas
✅ Indicar amigos e ganhar bônus

📱 Acesse o app: {link_app}
🔐 Seu email: {email}

Qualquer dúvida, estamos à disposição!

Atenciosamente,
Equipe Tubarão Empréstimos 🦈`,
    variables: ['nome', 'email', 'link_app'],
    isActive: true
  },
  {
    name: 'Verificação de email',
    category: 'SISTEMA',
    triggerEvent: 'EMAIL_VERIFICATION',
    channel: 'email',
    subject: '🔐 Verifique seu email - Tubarão Empréstimos',
    content: `Olá {nome}!

Para ativar sua conta, clique no link abaixo:

{link_verificacao}

⏰ Este link expira em 24 horas.

Se você não solicitou este cadastro, ignore este email.

Atenciosamente,
Equipe Tubarão Empréstimos 🦈`,
    variables: ['nome', 'link_verificacao'],
    isActive: true
  },
  {
    name: 'Redefinição de senha',
    category: 'SISTEMA',
    triggerEvent: 'PASSWORD_RESET',
    channel: 'email',
    subject: '🔑 Redefinir senha - Tubarão Empréstimos',
    content: `Olá {nome}!

Recebemos uma solicitação para redefinir sua senha.

Clique no link abaixo para criar uma nova senha:

{link_reset}

⏰ Este link expira em 1 hora.

Se você não solicitou esta alteração, ignore este email e sua senha permanecerá a mesma.

Atenciosamente,
Equipe Tubarão Empréstimos 🦈`,
    variables: ['nome', 'link_reset'],
    isActive: true
  },
  {
    name: 'Atualização de cadastro',
    category: 'SISTEMA',
    triggerEvent: 'PROFILE_UPDATED',
    channel: 'email',
    subject: '✅ Cadastro atualizado - Tubarão Empréstimos',
    content: `Olá {nome}!

Seus dados cadastrais foram atualizados com sucesso.

📝 Dados alterados:
{campos_alterados}

🕐 Data: {data_atualizacao}

Se você não realizou esta alteração, entre em contato imediatamente:
📞 {telefone_suporte}
📧 {email_suporte}

Atenciosamente,
Equipe Tubarão Empréstimos 🦈`,
    variables: ['nome', 'campos_alterados', 'data_atualizacao', 'telefone_suporte', 'email_suporte'],
    isActive: true
  },
  {
    name: 'Manutenção programada',
    category: 'SISTEMA',
    triggerEvent: 'SCHEDULED_MAINTENANCE',
    channel: 'notification',
    subject: null,
    content: `⚠️ Manutenção Programada

Nosso sistema estará em manutenção:

📅 Data: {data_manutencao}
⏰ Horário: {horario_inicio} às {horario_fim}

Durante este período, o app pode ficar indisponível.

Pedimos desculpas pelo inconveniente.

Tubarão Empréstimos 🦈`,
    variables: ['data_manutencao', 'horario_inicio', 'horario_fim'],
    isActive: true
  }
];

async function seedTemplates() {
  try {
    console.log('🌱 Iniciando seed de templates...\n');

    let created = 0;
    let skipped = 0;

    for (const template of templates) {
      // Verificar se já existe
      const existing = await prisma.messageTemplate.findFirst({
        where: {
          name: template.name,
          category: template.category
        }
      });

      if (existing) {
        console.log(`⏭️  Template já existe: ${template.name}`);
        skipped++;
        continue;
      }

      // Criar template
      await prisma.messageTemplate.create({
        data: template
      });

      console.log(`✅ Criado: ${template.name} (${template.category})`);
      created++;
    }

    console.log(`\n📊 Resumo:`);
    console.log(`✅ Criados: ${created}`);
    console.log(`⏭️  Ignorados: ${skipped}`);
    console.log(`📝 Total: ${templates.length}`);

    console.log(`\n🎉 Seed concluído com sucesso!`);

  } catch (error) {
    console.error('❌ Erro ao criar templates:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTemplates();
