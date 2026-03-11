import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTemplates() {
    console.log('Iniciando criação de templates de comunicação...');

    // Templates para aprovação de empréstimo
    const approvalTemplates = [
        {
            name: 'Aprovação de Empréstimo - Email',
            category: 'loan_approval',
            triggerEvent: 'LOAN_APPROVED',
            channel: 'email',
            subject: '✅ Empréstimo Aprovado — Tubarão Empréstimos',
            content: 'Olá, {nome}!\n\nParabéns! Seu empréstimo de {valor} foi aprovado!\n\nAcesse o aplicativo para mais detalhes.\n\nChave PIX para pagamento: {pix_key}\n\nTubarão Empréstimos 🦈',
            variables: ['nome', 'valor', 'pix_key'],
            isActive: true
        },
        {
            name: 'Aprovação de Empréstimo - WhatsApp',
            category: 'loan_approval',
            triggerEvent: 'LOAN_APPROVED',
            channel: 'whatsapp',
            subject: null,
            content: '✅ *EMPRÉSTIMO APROVADO!*\n\nOlá, {nome}!\n\nParabéns! Seu empréstimo de *{valor}* foi *APROVADO*!\n\nAcesse o app para mais detalhes: https://www.tubaraoemprestimo.com.br\n\nChave PIX: {pix_key}\n\n_Tubarão Empréstimos 🦈_',
            variables: ['nome', 'valor', 'pix_key'],
            isActive: true
        },
        {
            name: 'Aprovação de Empréstimo - Notificação',
            category: 'loan_approval',
            triggerEvent: 'LOAN_APPROVED',
            channel: 'notification',
            subject: '✅ Empréstimo Aprovado',
            content: 'Parabéns {nome}! Seu empréstimo de {valor} foi aprovado!',
            variables: ['nome', 'valor'],
            isActive: true
        }
    ];

    // Templates para vencimento de parcelas
    const dueDateTemplates = [
        {
            name: 'Vencimento em 3 Dias - Email',
            category: 'due_soon',
            triggerEvent: 'INSTALLMENT_DUE_SOON',
            channel: 'email',
            subject: '⏰ Parcela vence em 3 dias — {valor}',
            content: 'Olá, {nome}!\n\nSua parcela de {valor} vence em 3 dias ({data_vencimento}).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\nTubarão Empréstimos 🦈',
            variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
            isActive: true
        },
        {
            name: 'Vencimento em 3 Dias - WhatsApp',
            category: 'due_soon',
            triggerEvent: 'INSTALLMENT_DUE_SOON',
            channel: 'whatsapp',
            subject: null,
            content: '⏰ *LEMBRETE DE VENCIMENTO*\n\nOlá, {nome}!\n\nSua parcela de *{valor}* vence em *{data_vencimento}* (3 dias).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
            variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
            isActive: true
        },
        {
            name: 'Vencimento Hoje - Email',
            category: 'due_today',
            triggerEvent: 'INSTALLMENT_DUE_TODAY',
            channel: 'email',
            subject: '⚠️ Parcela vence HOJE — {valor}',
            content: 'Olá, {nome}!\n\nSua parcela de {valor} vence HOJE ({data_vencimento}).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\nTubarão Empréstimos 🦈',
            variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
            isActive: true
        },
        {
            name: 'Vencimento Hoje - WhatsApp',
            category: 'due_today',
            triggerEvent: 'INSTALLMENT_DUE_TODAY',
            channel: 'whatsapp',
            subject: null,
            content: '⚠️ *PARCELA VENCE HOJE!*\n\nOlá, {nome}!\n\nSua parcela de *{valor}* vence *HOJE* ({data_vencimento}).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
            variables: ['nome', 'valor', 'data_vencimento', 'pix_key'],
            isActive: true
        },
        {
            name: 'Atraso de Parcela - Email',
            category: 'overdue',
            triggerEvent: 'INSTALLMENT_OVERDUE',
            channel: 'email',
            subject: '🚨 Parcela ATRASADA ({dias_atraso} dias) — {valor}',
            content: 'Olá, {nome}!\n\nSua parcela de {valor} venceu em {data_vencimento} e está com {dias_atraso} dia(s) de atraso.\n\nJuros e multas estão sendo aplicados diariamente.\n\nChave PIX: {pix_key}\n\nTubarão Empréstimos 🦈',
            variables: ['nome', 'valor', 'data_vencimento', 'dias_atraso', 'pix_key'],
            isActive: true
        },
        {
            name: 'Atraso de Parcela - WhatsApp',
            category: 'overdue',
            triggerEvent: 'INSTALLMENT_OVERDUE',
            channel: 'whatsapp',
            subject: null,
            content: '🚨 *PARCELA EM ATRASO*\n\nOlá, {nome}!\n\nSua parcela de *{valor}* venceu em *{data_vencimento}* e está com *{dias_atraso}* dia(s) de atraso.\n\n⚠️ Juros e multas estão sendo aplicados diariamente.\n\nChave PIX: {pix_key}\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
            variables: ['nome', 'valor', 'data_vencimento', 'dias_atraso', 'pix_key'],
            isActive: true
        }
    ];

    // Templates para cadastro e onboarding
    const onboardingTemplates = [
        {
            name: 'Bem-vindo - Email',
            category: 'onboarding',
            triggerEvent: 'WELCOME',
            channel: 'email',
            subject: ' sharks! Bem-vindo ao Tubarão Empréstimos',
            content: 'Olá, {nome}!\n\nSeja bem-vindo ao Tubarão Empréstimos! Seu cadastro foi realizado com sucesso.\n\nAgora você pode solicitar seu empréstimo de forma rápida e segura.\n\nTubarão Empréstimos 🦈',
            variables: ['nome'],
            isActive: true
        },
        {
            name: 'Bem-vindo - WhatsApp',
            category: 'onboarding',
            triggerEvent: 'WELCOME',
            channel: 'whatsapp',
            subject: null,
            content: '👋 *BEM-VINDO(A) AO TUBARÃO EMPRÉSTIMOS!*\n\nOlá, {nome}!\n\nSeu cadastro foi realizado com sucesso! 🎉\n\nAgora você pode solicitar seu empréstimo de forma rápida e segura.\n\n✅ *Vantagens:*\n• Processo 100% digital\n• Aprovação em até 24h\n• Taxas competitivas\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
            variables: ['nome'],
            isActive: true
        }
    ];

    // Templates para rejeição
    const rejectionTemplates = [
        {
            name: 'Empréstimo Rejeitado - Email',
            category: 'loan_rejection',
            triggerEvent: 'LOAN_REJECTED',
            channel: 'email',
            subject: 'Solicitação Não Aprovada — Tubarão Empréstimos',
            content: 'Olá, {nome}.\n\nInfelizmente sua solicitação de empréstimo não foi aprovada neste momento.\n\nMotivo: {motivo}\n\nVocê pode tentar novamente após 30 dias ou entrar em contato conosco para mais informações.\n\nTubarão Empréstimos 🦈',
            variables: ['nome', 'motivo'],
            isActive: true
        },
        {
            name: 'Empréstimo Rejeitado - WhatsApp',
            category: 'loan_rejection',
            triggerEvent: 'LOAN_REJECTED',
            channel: 'whatsapp',
            subject: null,
            content: 'Olá, {nome}.\n\nInfelizmente sua solicitação de empréstimo não foi aprovada neste momento.\n\nMotivo: {motivo}\n\nVocê pode fazer uma nova solicitação em 30 dias.\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
            variables: ['nome', 'motivo'],
            isActive: true
        }
    ];

    // Combina todos os templates
    const allTemplates = [
        ...approvalTemplates,
        ...dueDateTemplates,
        ...onboardingTemplates,
        ...rejectionTemplates
    ];

    for (const template of allTemplates) {
        try {
            // Busca um template existente com os mesmos critérios
            const existingTemplate = await prisma.messageTemplate.findFirst({
                where: {
                    category: template.category,
                    channel: template.channel,
                    triggerEvent: template.triggerEvent
                }
            });

            if (existingTemplate) {
                await prisma.messageTemplate.update({
                    where: { id: existingTemplate.id },
                    data: {
                        name: template.name,
                        subject: template.subject,
                        content: template.content,
                        variables: template.variables,
                        isActive: template.isActive
                    }
                });
            } else {
                await prisma.messageTemplate.create({
                    data: {
                        name: template.name,
                        category: template.category,
                        triggerEvent: template.triggerEvent,
                        channel: template.channel,
                        subject: template.subject,
                        content: template.content,
                        variables: template.variables,
                        isActive: template.isActive
                    }
                });
            }
            console.log(`✅ Template criado/atualizado: ${template.name}`);
        } catch (error) {
            console.error(`❌ Erro ao criar template ${template.name}:`, error);
        }
    }

    console.log('Templates de comunicação criados com sucesso!');
    await prisma.$disconnect();
}

seedTemplates().catch(e => {
    console.error(e);
    process.exit(1);
});