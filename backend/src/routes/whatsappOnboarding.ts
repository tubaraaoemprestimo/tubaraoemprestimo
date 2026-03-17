import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { sendWhatsAppMessage, normalizePhoneBR } from '../services/whatsapp';
import { sendPushToRole } from './push';
import bcrypt from 'bcryptjs';

export const whatsappOnboardingRouter = Router();

// ============================================================
// HELPERS
// ============================================================

function generatePassword(length = 10): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
    let pass = '';
    for (let i = 0; i < length; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    return pass;
}

function parseBRL(value: string): number {
    const clean = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ============================================================
// MENSAGENS DE CADA ETAPA
// ============================================================

const MSG = {
    BOAS_VINDAS: (nome?: string) => nome
        ? `Olá ${nome}! 👋\n\nIdentificamos que você já tem um empréstimo conosco.\n\nPara ter acesso ao sistema e acompanhar seu contrato pelo app, preciso de algumas informações. Pode me ajudar? (Responda *SIM* para continuar ou *NAO* para outra hora)`
        : `Olá! 👋 Aqui é o *Tubarão Empréstimos*.\n\nVocê já tem algum empréstimo ativo conosco? Responda *SIM* ou *NAO*.`,

    NOME: `Ótimo! 😊\n\n*Qual é o seu nome completo?*`,

    EMAIL: `*Qual é o seu e-mail?*\n_(Você receberá login e senha por aqui para acessar o app)_`,

    CPF: `*Qual é o seu CPF?*\n_(somente números ou formato 000.000.000-00)_`,

    VALOR: `💰 *Qual foi o valor total que você pegou emprestado?*\n_(Ex: 2000 ou 2.000,00)_`,

    TAXA: `📊 *Qual é a taxa de juros combinada?*\n_(Ex: 10 para 10% ao mês)_`,

    PAGO: `💸 *Quanto você já pagou até agora?*\n_(Se não pagou nada ainda, responda 0)_`,

    DEVEDOR: `💼 *Qual é o saldo devedor atual?*\n_(Quanto ainda falta pagar)_`,

    VENCIMENTO: `📅 *Qual é a data do seu próximo pagamento?*\n_(Ex: 25/03/2026 ou só o dia: 25)_`,

    CONFIRMAR: (d: any) =>
        `✅ *Confirme os dados do seu contrato:*\n\n` +
        `👤 Nome: ${d.nome}\n` +
        `📧 E-mail: ${d.email}\n` +
        `📋 CPF: ${String(d.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}\n` +
        `💰 Empréstimo: ${formatBRL(d.valor_emprestimo)}\n` +
        `📊 Taxa: ${d.taxa_juros}% a.m.\n` +
        `💸 Já pago: ${formatBRL(d.saldo_pago)}\n` +
        `💼 Saldo devedor: ${formatBRL(d.saldo_devedor)}\n` +
        `📅 Próximo venc.: ${d.vencimento}\n\n` +
        `Responda *SIM* para confirmar ou *NAO* para corrigir.`,

    // Mensagem após confirmação — informa que aguarda validação do admin
    AGUARDANDO: (email: string, url: string) =>
        `✅ *Dados recebidos com sucesso!*\n\n` +
        `Seu cadastro foi enviado para nossa equipe validar. ⏳\n\n` +
        `Nossa equipe irá verificar os dados do seu contrato e, após confirmação, você receberá seu acesso por aqui.\n\n` +
        `📧 E-mail cadastrado: ${email}\n` +
        `🔗 Sistema: ${url}\n\n` +
        `_Assim que a equipe confirmar, você receberá login e senha para acompanhar seu saldo e vencimentos pelo app._`,

    RECUSAR: `Ok! Qualquer coisa pode me chamar. 😊`,

    CANCELAR: `Cadastro cancelado. Se precisar de ajuda, é só mandar mensagem!`,

    ERRO: `Tivemos um problema ao receber seus dados. Nossa equipe será avisada. Tente novamente mais tarde ou entre em contato.`,

    // Mensagem enviada ao cliente quando admin ATIVA o contrato
    CONTRATO_ATIVADO: (nome: string, email: string, password: string, url: string, valor: number, saldo: number) =>
        `🎉 *Olá ${nome}! Seu contrato foi confirmado!*\n\n` +
        `Nossa equipe validou seus dados e seu acesso está pronto.\n\n` +
        `🔗 Acesse: ${url}\n` +
        `📧 Login: ${email}\n` +
        `🔑 Senha: *${password}*\n\n` +
        `📊 *Resumo do seu contrato:*\n` +
        `💰 Valor emprestado: ${formatBRL(valor)}\n` +
        `💼 Saldo devedor: ${formatBRL(saldo)}\n\n` +
        `No app você acompanha:\n✅ Saldo devedor\n📅 Vencimentos\n💰 Histórico de pagamentos\n📲 Lembretes automáticos\n\n` +
        `_Tubarão Empréstimos 🦈_`,

    // Mensagem ao cliente quando admin RECUSA o contrato
    CONTRATO_RECUSADO: (nome: string, motivo?: string) =>
        `Olá ${nome}! Infelizmente não conseguimos confirmar os dados do seu contrato no sistema.\n\n` +
        (motivo ? `Motivo: ${motivo}\n\n` : '') +
        `Por favor, entre em contato com nossa equipe para mais informações.\n\n_Tubarão Empréstimos 🦈_`,
};

// ============================================================
// BANCO — sessão de onboarding
// ============================================================

async function getSession(phone: string): Promise<any> {
    const rows = await prisma.$queryRaw`
        SELECT * FROM whatsapp_onboarding_sessions
        WHERE phone = ${phone} AND status = 'ACTIVE' LIMIT 1
    ` as any[];
    return rows?.[0] || null;
}

async function createSession(phone: string, step: string, data: any, initiatedBy?: string): Promise<void> {
    await prisma.$executeRaw`
        INSERT INTO whatsapp_onboarding_sessions (id, phone, step, data, initiated_by, status)
        VALUES (gen_random_uuid()::text, ${phone}, ${step}, ${JSON.stringify(data)}::jsonb, ${initiatedBy || null}, 'ACTIVE')
        ON CONFLICT (phone) DO UPDATE SET step=${step}, data=${JSON.stringify(data)}::jsonb, status='ACTIVE', updated_at=NOW()
    `;
}

async function updateSession(phone: string, step: string, data: any): Promise<void> {
    await prisma.$executeRaw`
        UPDATE whatsapp_onboarding_sessions
        SET step=${step}, data=${JSON.stringify(data)}::jsonb, updated_at=NOW()
        WHERE phone=${phone} AND status='ACTIVE'
    `;
}

async function cancelSession(phone: string): Promise<void> {
    await prisma.$executeRaw`
        UPDATE whatsapp_onboarding_sessions SET status='CANCELLED', updated_at=NOW()
        WHERE phone=${phone} AND status='ACTIVE'
    `;
}

// ============================================================
// FINALIZAR ONBOARDING — cria APENAS login, SEM contrato
// O admin confirma e ativa o contrato manualmente depois
// ============================================================

async function completeOnboarding(session: any): Promise<{ email: string }> {
    const d = session.data;
    const cpfClean = String(d.cpf).replace(/\D/g, '');
    const phoneClean = session.phone.replace(/^55/, '');

    // 1. User — cria ou encontra, mas NÃO define senha ainda
    // A senha só será enviada quando o admin confirmar o contrato
    let user = await prisma.user.findFirst({ where: { email: d.email } });
    if (!user) {
        // Gera senha temporária placeholder — será redefinida na ativação
        const tempHash = await bcrypt.hash('PENDING_ACTIVATION_' + Date.now(), 12);
        user = await prisma.user.create({
            data: { name: d.nome, email: d.email, phone: phoneClean, password: tempHash, role: 'CLIENT' }
        });
    } else {
        // Atualiza nome/telefone mas mantém senha existente
        user = await prisma.user.update({
            where: { id: user.id },
            data: { name: d.nome, phone: phoneClean }
        });
    }

    // 2. Customer — cria ou encontra pelo CPF
    let customer = await prisma.customer.findFirst({ where: { cpf: cpfClean } });
    if (!customer) {
        customer = await prisma.customer.create({
            data: {
                userId: user.id,
                name: d.nome,
                cpf: cpfClean,
                email: d.email,
                phone: phoneClean,
                status: 'ACTIVE',
            }
        });
    } else {
        await prisma.customer.update({
            where: { id: customer.id },
            data: { userId: user.id, name: d.nome }
        });
    }

    // 3. Marcar source como WHATSAPP_ONBOARDING
    await prisma.$executeRaw`
        UPDATE customers SET source='WHATSAPP_ONBOARDING', source_detail='Aguardando confirmacao do admin via WhatsApp'
        WHERE id=${customer.id}
    `;

    // 4. Marcar sessão como PENDING_ADMIN (aguardando confirmação)
    await prisma.$executeRaw`
        UPDATE whatsapp_onboarding_sessions
        SET status='PENDING_ADMIN', updated_at=NOW(),
            data=data || jsonb_build_object('userId', ${user.id}, 'customerId', ${customer.id})
        WHERE phone=${session.phone} AND status='ACTIVE'
    `;

    // 5. Notificar admin para confirmar
    const cpfFormatado = cpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const adminMsg =
        `📱 *Novo cadastro via WhatsApp — Aguardando confirmação*\n\n` +
        `👤 Nome: ${d.nome}\n` +
        `📋 CPF: ${cpfFormatado}\n` +
        `📧 E-mail: ${d.email}\n` +
        `📞 Telefone: ${phoneClean}\n\n` +
        `📊 *Dados informados pelo cliente:*\n` +
        `💰 Valor emprestado: ${formatBRL(d.valor_emprestimo)}\n` +
        `📊 Taxa: ${d.taxa_juros}% a.m.\n` +
        `💸 Já pago: ${formatBRL(d.saldo_pago)}\n` +
        `💼 Saldo devedor: ${formatBRL(d.saldo_devedor)}\n` +
        `📅 Próximo venc.: ${d.vencimento}\n\n` +
        `⚠️ *Ação necessária:* Verifique os dados e confirme ou recuse no painel admin.\n` +
        `🔗 Acesse: Painel Admin > WhatsApp Onboarding`;

    // Notificação push para admins
    sendPushToRole('ADMIN',
        '📱 WhatsApp Onboarding — Confirmação Pendente',
        `${d.nome} (${cpfFormatado}) aguarda confirmação de contrato`
    ).catch(() => { });

    // Notificação no banco para admins
    await prisma.notification.create({
        data: {
            title: '📱 Cadastro WhatsApp — Confirmação Pendente',
            message: `${d.nome} (CPF: ${cpfFormatado}) informou ter empréstimo ativo. Verifique os dados e confirme no painel.`,
            type: 'ALERT'
        }
    }).catch(() => { });

    // WhatsApp para admins com os dados
    try {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        const { sendWhatsAppMessage: sendWA } = await import('../services/whatsapp');
        for (const admin of admins) {
            if (admin.phone) {
                sendWA(admin.phone, adminMsg).catch(() => { });
            }
        }
    } catch { }

    return { email: d.email };
}

// ============================================================
// PROCESSAR MENSAGEM INCOMING — chamado pelo webhook
// ============================================================

export async function processOnboardingMessage(phone: string, message: string): Promise<boolean> {
    try {
        const phoneNorm = normalizePhoneBR(phone);
        const session = await getSession(phoneNorm);
        const text = message.trim();
        const tl = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Se não tem sessão ativa, verificar se é mensagem de opt-in automático
        if (!session) {
            // Palavras-chave que indicam cliente antigo entrando em contato
            const triggerWords = ['emprestimo', 'empréstimo', 'meu emprestimo', 'tenho emprestimo',
                'quero cadastrar', 'quero me cadastrar', 'acesso', 'sistema', 'app',
                'minha divida', 'meu saldo', 'meu contrato'];
            const hasTrigger = triggerWords.some(w => tl.includes(w));

            if (hasTrigger) {
                await createSession(phoneNorm, 'PERGUNTA_CLIENTE', {});
                await sendWhatsAppMessage(phoneNorm, MSG.BOAS_VINDAS());
                return true;
            }
            return false; // Deixar para o chatbot normal
        }

        const data = session.data || {};

        // Cancelar a qualquer momento
        if (tl === 'cancelar' || tl === 'sair') {
            await cancelSession(phoneNorm);
            await sendWhatsAppMessage(phoneNorm, MSG.CANCELAR);
            return true;
        }

        const step: string = session.step;

        if (step === 'PERGUNTA_CLIENTE' || step === 'BOAS_VINDAS') {
            if (tl === 'sim' || tl === 's') {
                await updateSession(phoneNorm, 'NOME', data);
                await sendWhatsAppMessage(phoneNorm, MSG.NOME);
            } else {
                await cancelSession(phoneNorm);
                await sendWhatsAppMessage(phoneNorm, MSG.RECUSAR);
            }
        }

        else if (step === 'NOME') {
            // Rejeitar frases inválidas como nomes
            const nomesInvalidos = ['falar com atendente', 'atendente', 'suporte', 'ajuda', 'help',
                'oi', 'ola', 'sim', 'nao', 'nao sei', 'ok', 'boa tarde', 'bom dia', 'boa noite'];
            const nomeLower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (text.length < 5 || nomesInvalidos.some(n => nomeLower === n || nomeLower.includes(n))) {
                await sendWhatsAppMessage(phoneNorm, 'Por favor, informe seu *nome completo* (ex: João Silva).');
                return true;
            }
            // Nome deve ter pelo menos duas palavras
            if (text.trim().split(/\s+/).length < 2) {
                await sendWhatsAppMessage(phoneNorm, 'Por favor, informe seu *nome completo* com nome e sobrenome.');
                return true;
            }
            data.nome = text.trim();
            await updateSession(phoneNorm, 'EMAIL', data);
            await sendWhatsAppMessage(phoneNorm, MSG.EMAIL);
        }

        else if (step === 'EMAIL') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
                await sendWhatsAppMessage(phoneNorm, 'E-mail invalido. Ex: joao@gmail.com');
                return true;
            }
            data.email = text.toLowerCase();
            await updateSession(phoneNorm, 'CPF', data);
            await sendWhatsAppMessage(phoneNorm, MSG.CPF);
        }

        else if (step === 'CPF') {
            const cpfClean = text.replace(/\D/g, '');
            if (cpfClean.length !== 11) {
                await sendWhatsAppMessage(phoneNorm, 'CPF invalido. Informe os 11 digitos.\nEx: 123.456.789-00');
                return true;
            }
            data.cpf = cpfClean;
            await updateSession(phoneNorm, 'VALOR_EMPRESTIMO', data);
            await sendWhatsAppMessage(phoneNorm, MSG.VALOR);
        }

        else if (step === 'VALOR_EMPRESTIMO') {
            const valor = parseBRL(text);
            if (valor <= 0) {
                await sendWhatsAppMessage(phoneNorm, 'Valor invalido. Ex: 2000 ou 2.000,00');
                return true;
            }
            data.valor_emprestimo = valor;
            await updateSession(phoneNorm, 'TAXA_JUROS', data);
            await sendWhatsAppMessage(phoneNorm, MSG.TAXA);
        }

        else if (step === 'TAXA_JUROS') {
            const taxa = parseFloat(text.replace(',', '.').replace('%', '').trim());
            if (isNaN(taxa) || taxa < 0 || taxa > 100) {
                await sendWhatsAppMessage(phoneNorm, 'Taxa invalida. Ex: 10 para 10% ao mes');
                return true;
            }
            data.taxa_juros = taxa;
            await updateSession(phoneNorm, 'SALDO_PAGO', data);
            await sendWhatsAppMessage(phoneNorm, MSG.PAGO);
        }

        else if (step === 'SALDO_PAGO') {
            const v = parseBRL(text);
            if (v < 0) {
                await sendWhatsAppMessage(phoneNorm, 'Valor invalido. Se nao pagou nada, responda 0.');
                return true;
            }
            data.saldo_pago = v;
            await updateSession(phoneNorm, 'SALDO_DEVEDOR', data);
            await sendWhatsAppMessage(phoneNorm, MSG.DEVEDOR);
        }

        else if (step === 'SALDO_DEVEDOR') {
            const v = parseBRL(text);
            if (v <= 0) {
                await sendWhatsAppMessage(phoneNorm, 'Saldo invalido. Informe quanto falta pagar.');
                return true;
            }
            data.saldo_devedor = v;
            await updateSession(phoneNorm, 'VENCIMENTO', data);
            await sendWhatsAppMessage(phoneNorm, MSG.VENCIMENTO);
        }

        else if (step === 'VENCIMENTO') {
            if (text.length < 1) {
                await sendWhatsAppMessage(phoneNorm, 'Data invalida. Ex: 25/03/2026 ou so o dia: 25');
                return true;
            }
            data.vencimento = text;
            await updateSession(phoneNorm, 'CONFIRMAR', data);
            await sendWhatsAppMessage(phoneNorm, MSG.CONFIRMAR(data));
        }

        else if (step === 'CONFIRMAR') {
            if (tl === 'sim' || tl === 's') {
                await sendWhatsAppMessage(phoneNorm, 'Aguarde, enviando seus dados...');
                try {
                    await completeOnboarding(session);
                    const url = process.env.NEXT_PUBLIC_APP_URL || 'https://www.tubaraoemprestimo.com.br';
                    // Informa que aguarda confirmação do admin — NÃO envia senha ainda
                    await sendWhatsAppMessage(phoneNorm, MSG.AGUARDANDO(data.email, url));
                } catch (err) {
                    console.error('[Onboarding] complete error:', err);
                    await sendWhatsAppMessage(phoneNorm, MSG.ERRO);
                }
            } else if (tl === 'nao' || tl === 'n' || tl === 'não') {
                await updateSession(phoneNorm, 'NOME', {});
                await sendWhatsAppMessage(phoneNorm, `Ok, vamos corrigir.\n\n${MSG.NOME}`);
            } else {
                await sendWhatsAppMessage(phoneNorm, 'Responda *SIM* para confirmar ou *NAO* para corrigir.');
            }
        }

        return true;
    } catch (err) {
        console.error('[Onboarding] processMessage error:', err);
        return false;
    }
}

// ============================================================
// ROTAS ADMIN
// ============================================================

// POST /api/whatsapp-onboarding/start — admin inicia para um número específico
whatsappOnboardingRouter.post('/start', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { phone, customerName } = req.body;
        if (!phone) { res.status(400).json({ error: 'Telefone obrigatorio' }); return; }

        const phoneNorm = normalizePhoneBR(phone);
        if (phoneNorm.length < 12) { res.status(400).json({ error: 'Telefone invalido' }); return; }

        await prisma.$executeRaw`UPDATE whatsapp_onboarding_sessions SET status='CANCELLED', updated_at=NOW() WHERE phone=${phoneNorm} AND status='ACTIVE'`;

        await prisma.$executeRaw`
            INSERT INTO whatsapp_onboarding_sessions (id, phone, step, data, initiated_by, status)
            VALUES (gen_random_uuid()::text, ${phoneNorm}, 'BOAS_VINDAS', '{}', ${req.user!.id}, 'ACTIVE')
        `;

        const sent = await sendWhatsAppMessage(phoneNorm, MSG.BOAS_VINDAS(customerName));
        if (!sent) { res.status(500).json({ error: 'Erro ao enviar WhatsApp. Verifique a conexao.' }); return; }

        res.json({ success: true, message: `Onboarding iniciado para ${phone}` });
    } catch (err: any) {
        console.error('[Onboarding] start error:', err);
        res.status(500).json({ error: 'Erro ao iniciar onboarding' });
    }
});

// POST /api/whatsapp-onboarding/confirm/:phone — Admin CONFIRMA e ATIVA o contrato
whatsappOnboardingRouter.post('/confirm/:phone', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const phoneNorm = normalizePhoneBR(String(req.params.phone));

        // Buscar sessão pendente
        const rows = await prisma.$queryRaw`
            SELECT * FROM whatsapp_onboarding_sessions
            WHERE phone = ${phoneNorm} AND status = 'PENDING_ADMIN' LIMIT 1
        ` as any[];

        const session = rows?.[0];
        if (!session) {
            res.status(404).json({ error: 'Sessao pendente nao encontrada para este numero' });
            return;
        }

        const d = session.data;

        // Buscar customer e user criados no onboarding
        const customer = await prisma.customer.findUnique({ where: { id: d.customerId } });
        const user = await prisma.user.findUnique({ where: { id: d.userId } });

        if (!customer || !user) {
            res.status(404).json({ error: 'Customer ou User nao encontrado' });
            return;
        }

        // Gerar senha definitiva agora que o admin confirmou
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        // Calcular data de vencimento
        let nextPaymentDate = new Date();
        const parts = String(d.vencimento).replace(/[\/\-\.]/g, '/').split('/');
        const day = parseInt(parts[0]);
        if (parts.length >= 3) {
            nextPaymentDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, day);
        } else if (day >= 1 && day <= 31) {
            nextPaymentDate.setDate(day);
            if (nextPaymentDate < new Date()) nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        }

        // Criar LoanRequest com status APPROVED (contrato confirmado pelo admin)
        const loanRequest = await prisma.loanRequest.create({
            data: {
                customerId: customer.id,
                userId: user.id,
                clientName: d.nome,
                cpf: String(d.cpf).replace(/\D/g, ''),
                email: d.email,
                phone: session.phone.replace(/^55/, ''),
                amount: d.valor_emprestimo,
                installments: 1,
                status: 'APPROVED',
                profileType: 'CLT',
                isLoan: true,
                isService: false,
                isInvestment: false,
                approvedAmount: d.valor_emprestimo,
                approvedAt: new Date(),
                approvedById: req.user!.id,
                monthlyRate: d.taxa_juros,
            }
        });

        // Criar Loan (ACTIVE)
        const loan = await prisma.loan.create({
            data: {
                customerId: customer.id,
                requestId: loanRequest.id,
                amount: d.valor_emprestimo,
                principalAmount: d.valor_emprestimo,
                remainingAmount: d.saldo_devedor,
                installmentsCount: 1,
                totalInstallments: 1,
                status: 'ACTIVE',
                startDate: new Date(),
                nextPaymentDate,
                isLoan: true,
                isService: false,
                isInvestment: false,
                paymentFrequency: 'MONTHLY',
                interestRate: d.taxa_juros,
                adminNotes: `[WHATSAPP_ONBOARDING] Confirmado pelo admin ${req.user!.name || req.user!.id}. Pago ate agora: ${formatBRL(d.saldo_pago)}`,
            }
        });

        // Criar parcela
        await prisma.installment.create({
            data: { loanId: loan.id, dueDate: nextPaymentDate, amount: d.saldo_devedor, status: 'OPEN' }
        });

        // Atualizar customer
        await prisma.customer.update({
            where: { id: customer.id },
            data: {
                totalDebt: d.saldo_devedor,
                activeLoansCount: { increment: 1 }
            }
        });

        // Atualizar source da sessão para COMPLETED
        await prisma.$executeRaw`
            UPDATE whatsapp_onboarding_sessions
            SET status='COMPLETED', completed_at=NOW(), updated_at=NOW()
            WHERE phone=${phoneNorm}
        `;

        // Enviar WhatsApp ao cliente com login e senha
        const url = process.env.NEXT_PUBLIC_APP_URL || 'https://www.tubaraoemprestimo.com.br';
        await sendWhatsAppMessage(phoneNorm, MSG.CONTRATO_ATIVADO(
            d.nome, d.email, password, url, d.valor_emprestimo, d.saldo_devedor
        ));

        res.json({
            success: true,
            message: `Contrato ativado e senha enviada para ${session.phone}`,
            customerId: customer.id,
            loanId: loan.id
        });
    } catch (err: any) {
        console.error('[Onboarding] confirm error:', err);
        res.status(500).json({ error: 'Erro ao confirmar onboarding: ' + err.message });
    }
});

// POST /api/whatsapp-onboarding/reject/:phone — Admin RECUSA o cadastro
whatsappOnboardingRouter.post('/reject/:phone', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const phoneNorm = normalizePhoneBR(String(req.params.phone));
        const { motivo } = req.body;

        const rows = await prisma.$queryRaw`
            SELECT * FROM whatsapp_onboarding_sessions
            WHERE phone = ${phoneNorm} AND status = 'PENDING_ADMIN' LIMIT 1
        ` as any[];

        const session = rows?.[0];
        if (!session) {
            res.status(404).json({ error: 'Sessao pendente nao encontrada' });
            return;
        }

        const d = session.data;

        // Marcar sessão como recusada
        await prisma.$executeRaw`
            UPDATE whatsapp_onboarding_sessions
            SET status='REJECTED', updated_at=NOW()
            WHERE phone=${phoneNorm}
        `;

        // Avisar cliente que dados não foram confirmados
        await sendWhatsAppMessage(phoneNorm, MSG.CONTRATO_RECUSADO(d.nome, motivo));

        res.json({ success: true, message: `Cadastro recusado. Cliente notificado via WhatsApp.` });
    } catch (err: any) {
        console.error('[Onboarding] reject error:', err);
        res.status(500).json({ error: 'Erro ao recusar onboarding' });
    }
});

// GET /api/whatsapp-onboarding/pending — Listar pendentes de confirmação
whatsappOnboardingRouter.get('/pending', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const sessions = await prisma.$queryRaw`
            SELECT * FROM whatsapp_onboarding_sessions
            WHERE status = 'PENDING_ADMIN'
            ORDER BY created_at DESC
        `;
        res.json({ sessions });
    } catch {
        res.status(500).json({ error: 'Erro ao listar pendentes' });
    }
});

// GET /api/whatsapp-onboarding/sessions
whatsappOnboardingRouter.get('/sessions', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const sessions = await prisma.$queryRaw`
            SELECT * FROM whatsapp_onboarding_sessions ORDER BY created_at DESC LIMIT 200
        `;
        res.json({ sessions });
    } catch {
        res.status(500).json({ error: 'Erro ao listar sessoes' });
    }
});

// GET /api/whatsapp-onboarding/stats
whatsappOnboardingRouter.get('/stats', authenticate, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const stats = await prisma.$queryRaw`
            SELECT
                COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
                COUNT(*) FILTER (WHERE status = 'PENDING_ADMIN') as pending_admin,
                COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
                COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected,
                COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled,
                COUNT(*) FILTER (WHERE status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '30 days') as completed_30d
            FROM whatsapp_onboarding_sessions
        ` as any[];
        res.json(stats[0]);
    } catch {
        res.status(500).json({ error: 'Erro' });
    }
});

// DELETE /api/whatsapp-onboarding/sessions/:phone
whatsappOnboardingRouter.delete('/sessions/:phone', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const phoneNorm = normalizePhoneBR(String(req.params.phone));
        await prisma.$executeRaw`UPDATE whatsapp_onboarding_sessions SET status='CANCELLED', updated_at=NOW() WHERE phone=${phoneNorm} AND status IN ('ACTIVE', 'PENDING_ADMIN')`;
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao cancelar sessao' });
    }
});

export default whatsappOnboardingRouter;
