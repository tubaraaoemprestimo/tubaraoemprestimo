import {
    createInfinitePayClient,
    getInfinitePayConfig,
    InfinitePayClient,
    InfinitePayError,
    isInfinitePayConfigured,
} from './infinitepayClient';

/**
 * Cobrança online via InfinitePay (Checkout Integrado).
 *
 * Fluxo: o cliente pede para pagar (só juros ou quitação) → o valor vem de
 * computeLoanPaymentQuote, a mesma fonte de verdade do botão "Gerar cobrança"
 * existente → cria PaymentCharge (id = order_nsu) → InfinitePay devolve a URL
 * do checkout (Pix/cartão) → webhook avisa → confirmamos com payment_check →
 * a baixa passa por applyApprovedPayment, exatamente como uma aprovação manual
 * de comprovante pelo admin.
 *
 * Regras de segurança:
 *  - Nada é marcado como pago por chamada do frontend nem pelo redirect.
 *    O webhook não tem assinatura, então TODA confirmação passa por
 *    payment_check na API oficial antes de dar baixa.
 *  - O valor pago precisa bater com o valor que NÓS enviamos (amountCents).
 *  - Idempotência: a baixa só acontece para quem vencer o "claim" atômico
 *    (updateMany condicionado ao status) e transactionNsu é UNIQUE no banco.
 */

export const CHARGE_STATUS = {
    PENDING: 'PENDING',
    LINK_CREATED: 'PAYMENT_LINK_CREATED',
    CONFIRMING: 'CONFIRMING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
    // Dinheiro recebido mas a baixa automática não foi aplicada (parcela já
    // quitada por outro meio, erro ao aplicar). Exige ação do admin.
    NEEDS_REVIEW: 'NEEDS_REVIEW',
} as const;

// Um pagamento pode chegar mesmo para cobrança substituída/expirada (o cliente
// pagou um link antigo): o dinheiro entrou, então ela ainda pode ser confirmada.
const CLAIMABLE = [CHARGE_STATUS.PENDING, CHARGE_STATUS.LINK_CREATED, CHARGE_STATUS.CANCELLED, CHARGE_STATUS.EXPIRED];
const SETTLED = [CHARGE_STATUS.PAID, CHARGE_STATUS.NEEDS_REVIEW, CHARGE_STATUS.CONFIRMING];

// ponytail: link reaproveitado por 24h; se a InfinitePay expirar antes, trocar
// para a validade oficial do link.
const CHARGE_TTL_MS = 24 * 60 * 60 * 1000;
// Intervalo mínimo entre payment_check da mesma cobrança (tela de retorno).
const RECHECK_INTERVAL_MS = 20 * 1000;

export type ChargeType = 'interest_only' | 'full';

export class ChargeError extends Error {
    constructor(
        message: string,
        public readonly code:
            | 'NOT_CONFIGURED'
            | 'NOT_FOUND'
            | 'FORBIDDEN'
            | 'NOTHING_DUE'
            | 'IN_PROGRESS'
            | 'ALREADY_PAID'
            | 'PROVIDER_ERROR'
    ) {
        super(message);
        this.name = 'ChargeError';
    }
}

/** Reais (Float, 2 casas — padrão do sistema) → centavos inteiros. */
export function reaisToCents(value: number): number {
    if (!Number.isFinite(value)) throw new Error('Valor monetário inválido');
    // Os valores do sistema já chegam arredondados em 2 casas; Math.round
    // absorve o erro binário (ex.: 1.15 * 100 = 114.99999999999999).
    return Math.round(value * 100);
}

/** Telefone BR para o formato internacional; omite se não for um número válido. */
export function toInternationalPhone(phone?: string | null): string | undefined {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return `+${digits}`;
    return undefined;
}

export function buildRedirectUrl(baseRedirectUrl: string, chargeId: string): string {
    const sep = baseRedirectUrl.includes('?') ? '&' : '?';
    return `${baseRedirectUrl}${sep}charge=${encodeURIComponent(chargeId)}`;
}

export interface WebhookBody {
    invoice_slug?: string;
    amount?: number;
    paid_amount?: number;
    installments?: number;
    capture_method?: string;
    transaction_nsu?: string;
    order_nsu?: string;
    receipt_url?: string;
}

export interface InfinitePayDeps {
    prisma: any;
    client: InfinitePayClient;
    config: ReturnType<typeof getInfinitePayConfig>;
    computeQuote: (loan: any, customer: any, type: ChargeType) => Promise<{ paymentAmount: number; paymentDescription: string; targetInstallment?: any }>;
    applyApprovedPayment: (receipt: any, opts: { isDischarge?: boolean; isInterestOnly?: boolean }) => Promise<'OK' | 'INSTALLMENT_NOT_FOUND'>;
    notifyAdmins: (title: string, body: string) => Promise<void>;
    now: () => Date;
}

function defaultDeps(): InfinitePayDeps {
    // require tardio: evita carregar rotas/serviços pesados só por importar
    // este módulo (e permite testar com dependências falsas).
    const { prisma } = require('../prisma');
    const { computeLoanPaymentQuote } = require('../../routes/loans');
    const { applyApprovedPayment } = require('../paymentConfirmationService');
    const { sendPushToRole } = require('../../routes/push');
    const config = getInfinitePayConfig();
    return {
        prisma,
        client: createInfinitePayClient(config),
        config,
        computeQuote: computeLoanPaymentQuote,
        applyApprovedPayment,
        notifyAdmins: (title, body) => sendPushToRole('ADMIN', title, body).catch(() => {}),
        now: () => new Date(),
    };
}

export function createInfinitePayService(deps: InfinitePayDeps) {
    const { prisma, client, config } = deps;

    /** Trilha de auditoria. Nunca grava segredo nem dado pessoal. */
    const audit = (action: string, chargeId: string | null, details: Record<string, any> = {}) =>
        prisma.auditLog
            .create({
                data: {
                    userId: 'infinitepay',
                    userName: 'InfinitePay',
                    action,
                    entity: 'PaymentCharge',
                    entityId: chargeId,
                    details: JSON.stringify(details),
                },
            })
            .catch(() => {});

    const publicView = (charge: any) => ({
        id: charge.id,
        status: charge.status,
        chargeType: charge.chargeType,
        description: charge.description,
        amount: charge.amountCents / 100,
        checkoutUrl: [CHARGE_STATUS.LINK_CREATED].includes(charge.status) ? charge.checkoutUrl : null,
        paymentMethod: charge.paymentMethod,
        receiptUrl: charge.receiptUrl,
        paidAt: charge.paidAt,
        loanId: charge.loanId,
    });

    /**
     * Dá a baixa de uma cobrança já verificada como paga. Seguro contra
     * concorrência: só um chamador vence o claim; os demais viram duplicata.
     */
    async function confirmPaid(
        charge: any,
        info: { transactionNsu?: string; invoiceSlug?: string; receiptUrl?: string; captureMethod?: string; installments?: number; paidAmountCents?: number; payload?: any },
        source: 'webhook' | 'payment_check'
    ): Promise<'CONFIRMED' | 'DUPLICATE' | 'NEEDS_REVIEW'> {
        let claimed;
        try {
            claimed = await prisma.paymentCharge.updateMany({
                where: { id: charge.id, status: { in: CLAIMABLE } },
                data: {
                    status: CHARGE_STATUS.CONFIRMING,
                    transactionNsu: info.transactionNsu || null,
                    invoiceSlug: info.invoiceSlug || charge.invoiceSlug || null,
                    receiptUrl: info.receiptUrl || null,
                    paymentMethod: info.captureMethod || null,
                    installments: info.installments ?? null,
                    paidAmountCents: info.paidAmountCents ?? null,
                    paidAt: deps.now(),
                    ...(info.payload !== undefined && { webhookPayload: info.payload }),
                },
            });
        } catch (err: any) {
            // P2002: transaction_nsu já usado por outra cobrança.
            if (err?.code === 'P2002') {
                await audit('payment_duplicate_transaction', charge.id, { transactionNsu: info.transactionNsu, source });
                return 'DUPLICATE';
            }
            throw err;
        }

        if (!claimed || claimed.count !== 1) {
            await audit('payment_duplicate', charge.id, { transactionNsu: info.transactionNsu, source });
            return 'DUPLICATE';
        }

        const markReview = async (reason: string) => {
            await prisma.paymentCharge.update({
                where: { id: charge.id },
                data: { status: CHARGE_STATUS.NEEDS_REVIEW, errorMessage: reason },
            });
            await audit('payment_needs_review', charge.id, { reason, source });
            await deps.notifyAdmins(
                '⚠️ Pagamento online requer revisão',
                `Cobrança ${charge.id.slice(0, 8)} de R$ ${(charge.amountCents / 100).toFixed(2)} foi paga, mas não teve baixa automática: ${reason}`
            );
            return 'NEEDS_REVIEW' as const;
        };

        try {
            const installment = charge.installmentId
                ? await prisma.installment.findUnique({ where: { id: charge.installmentId } })
                : null;
            if (!installment) return await markReview('parcela da cobrança não encontrada');
            // Ex.: admin já aprovou um comprovante manual para a mesma parcela.
            // Aplicar de novo duplicaria juros/baixa — o dinheiro precisa de estorno ou realocação.
            if (installment.status === 'PAID') return await markReview('parcela já estava quitada (possível pagamento em duplicidade)');

            const receipt = await prisma.paymentReceipt.create({
                data: {
                    installmentId: charge.installmentId,
                    customerId: charge.customerId,
                    receiptUrl: info.receiptUrl || charge.checkoutUrl || 'infinitepay',
                    amount: charge.amountCents / 100,
                    status: 'APPROVED',
                    reviewedBy: 'INFINITEPAY',
                    reviewedAt: deps.now(),
                    notes: `InfinitePay ${info.captureMethod || ''} | order_nsu ${charge.id} | transaction_nsu ${info.transactionNsu || '-'}`,
                },
            });

            const result = await deps.applyApprovedPayment(receipt, { isDischarge: charge.chargeType === 'FULL' });
            if (result !== 'OK') return await markReview('parcela não encontrada ao aplicar a baixa');

            await prisma.paymentCharge.update({
                where: { id: charge.id },
                data: { status: CHARGE_STATUS.PAID, errorMessage: null },
            });
            await audit('payment_confirmed', charge.id, {
                source,
                method: info.captureMethod,
                amountCents: charge.amountCents,
                paidAmountCents: info.paidAmountCents,
                transactionNsu: info.transactionNsu,
            });
            await deps.notifyAdmins(
                '💳 Pagamento online confirmado',
                `R$ ${(charge.amountCents / 100).toFixed(2)} via ${info.captureMethod === 'pix' ? 'Pix' : info.captureMethod === 'credit_card' ? 'cartão' : 'InfinitePay'}`
            );
            return 'CONFIRMED';
        } catch (err: any) {
            console.error('[InfinitePay] Erro ao aplicar baixa:', err?.message);
            return await markReview('erro ao aplicar a baixa automática');
        }
    }

    return {
        isEnabled: () => isInfinitePayConfigured(config),

        /** Cria (ou reaproveita) a cobrança e devolve a URL do checkout. */
        async createCharge(userId: string, loanId: string, type: ChargeType) {
            const customer = await prisma.customer.findFirst({ where: { userId } });
            return this.createChargeForCustomer(customer, loanId, type);
        },

        /**
         * Mesmo que createCharge, mas para quem já tem o cliente em mãos — a
         * régua de cobrança (cron) usa isto para mandar o link de pagamento
         * real no WhatsApp/e-mail/push. As mesmas regras valem: valor
         * recalculado pelo servidor, link reaproveitado se nada mudou.
         */
        async createChargeForCustomer(customer: any, loanId: string, type: ChargeType) {
            if (!isInfinitePayConfigured(config)) {
                throw new ChargeError('Pagamento online indisponível no momento', 'NOT_CONFIGURED');
            }

            const loan = await prisma.loan.findUnique({
                where: { id: loanId },
                include: { installments: true, loanRequest: { select: { profileType: true } } },
            });
            if (!loan) throw new ChargeError('Empréstimo não encontrado', 'NOT_FOUND');
            if (!customer || customer.id !== loan.customerId) throw new ChargeError('Sem permissão', 'FORBIDDEN');

            const quote = await deps.computeQuote(loan, customer, type);
            const target = quote.targetInstallment;
            let amountCents = reaisToCents(quote.paymentAmount);
            if (!target || amountCents <= 0) throw new ChargeError('Não há valor em aberto para este contrato', 'NOTHING_DUE');

            // Piso mínimo da InfinitePay: R$ 1,00 (100 centavos).
            // Em testes ou centavos residuais, eleva para o piso mínimo aceito pelo checkout.
            if (amountCents < 100) {
                amountCents = 100;
            }

            const chargeType = type === 'full' ? 'FULL' : 'INTEREST_ONLY';
            const now = deps.now();

            const inFlight = await prisma.paymentCharge.findFirst({
                where: { loanId, status: CHARGE_STATUS.CONFIRMING },
            });
            if (inFlight) throw new ChargeError('Já existe um pagamento sendo confirmado para este contrato', 'IN_PROGRESS');

            // Reaproveita o link se nada mudou (mesmo tipo, parcela e valor) e
            // ainda está no prazo — múltiplos cliques não geram vários links.
            const open = await prisma.paymentCharge.findMany({
                where: { loanId, chargeType, status: CHARGE_STATUS.LINK_CREATED },
                orderBy: { createdAt: 'desc' },
            });
            const reusable = open.find(
                (c: any) =>
                    c.amountCents === amountCents &&
                    c.installmentId === target.id &&
                    c.checkoutUrl &&
                    (!c.expiresAt || new Date(c.expiresAt).getTime() > now.getTime())
            );
            if (reusable) {
                await audit('checkout_reused', reusable.id, { amountCents });
                return publicView(reusable);
            }
            // Valor/parcela mudou (multa diária, pagamento parcial) ou expirou:
            // os links antigos saem de uso. Se o cliente ainda pagar um deles,
            // o webhook é aceito normalmente (ver CLAIMABLE).
            if (open.length > 0) {
                await prisma.paymentCharge.updateMany({
                    where: { id: { in: open.map((c: any) => c.id) }, status: CHARGE_STATUS.LINK_CREATED },
                    data: { status: CHARGE_STATUS.CANCELLED },
                });
            }

            const charge = await prisma.paymentCharge.create({
                data: {
                    provider: 'INFINITEPAY',
                    customerId: customer.id,
                    loanId,
                    installmentId: target.id,
                    chargeType,
                    description: quote.paymentDescription,
                    amountCents,
                    status: CHARGE_STATUS.PENDING,
                    expiresAt: new Date(now.getTime() + CHARGE_TTL_MS),
                },
            });
            await audit('charge_created', charge.id, { loanId, chargeType, amountCents });

            try {
                const { url } = await client.createCheckoutLink({
                    orderNsu: charge.id,
                    amountCents,
                    description: `Tubarão Empréstimos - ${quote.paymentDescription}`,
                    redirectUrl: buildRedirectUrl(config.redirectUrl, charge.id),
                    customer: {
                        name: customer.name || undefined,
                        email: customer.email || undefined,
                        phone_number: toInternationalPhone(customer.phone),
                    },
                });

                const updated = await prisma.paymentCharge.update({
                    where: { id: charge.id },
                    data: { status: CHARGE_STATUS.LINK_CREATED, checkoutUrl: url },
                });
                await audit('checkout_created', charge.id, { amountCents });
                return publicView(updated);
            } catch (err: any) {
                const message = err instanceof InfinitePayError ? err.message : 'erro inesperado';
                await prisma.paymentCharge.update({
                    where: { id: charge.id },
                    data: { status: CHARGE_STATUS.FAILED, errorMessage: message },
                });
                await audit('checkout_error', charge.id, { error: message });
                console.error('[InfinitePay] Falha ao criar checkout:', message);
                let userMsg = 'Não foi possível gerar o pagamento agora. Tente novamente em instantes.';
                if (err instanceof InfinitePayError && err.status === 422) {
                    userMsg = `InfinitePay: ${err.message}`;
                }
                throw new ChargeError(userMsg, 'PROVIDER_ERROR');
            }
        },

        /**
         * Processa o webhook. Só dá baixa depois de confirmar na API oficial
         * (payment_check). Sempre resolve sem lançar: o chamador responde 200.
         */
        async processWebhook(body: WebhookBody): Promise<string> {
            const orderNsu = typeof body?.order_nsu === 'string' ? body.order_nsu : '';
            const transactionNsu = typeof body?.transaction_nsu === 'string' ? body.transaction_nsu : undefined;

            const charge = orderNsu ? await prisma.paymentCharge.findUnique({ where: { id: orderNsu } }) : null;
            await audit('webhook_received', charge ? charge.id : null, {
                orderNsu,
                transactionNsu,
                method: body?.capture_method,
                amount: body?.amount,
            });
            if (!charge) return 'UNKNOWN_ORDER';

            if (SETTLED.includes(charge.status)) {
                // Reenvio do mesmo pagamento (ou webhook atrasado de uma
                // cobrança já confirmada pelo payment_check): nada a fazer.
                if (!charge.transactionNsu || charge.transactionNsu === transactionNsu) {
                    if (!charge.transactionNsu && transactionNsu) {
                        await prisma.paymentCharge
                            .update({ where: { id: charge.id }, data: { transactionNsu } })
                            .catch(() => {});
                    }
                    await audit('webhook_duplicate', charge.id, { transactionNsu });
                    return 'DUPLICATE';
                }
                await audit('webhook_second_transaction', charge.id, { transactionNsu, existing: charge.transactionNsu });
                await deps.notifyAdmins(
                    '⚠️ Pagamento em duplicidade',
                    `A cobrança ${charge.id.slice(0, 8)} recebeu uma segunda transação. Verifique estorno.`
                );
                return 'SECOND_TRANSACTION';
            }

            if (Number(body.amount) !== charge.amountCents) {
                await audit('webhook_amount_mismatch', charge.id, { expected: charge.amountCents, received: body.amount });
                return 'AMOUNT_MISMATCH';
            }

            let check;
            try {
                check = await client.paymentCheck({ orderNsu: charge.id, transactionNsu, slug: body.invoice_slug });
            } catch (err: any) {
                // A cobrança fica pendente; a tela de retorno reconcilia depois.
                await audit('payment_check_error', charge.id, { error: err?.message });
                return 'CHECK_FAILED';
            }
            await audit('payment_check', charge.id, { paid: check.paid, amount: check.amount });

            if (!check.paid) return 'NOT_PAID';
            if (check.amount !== undefined && check.amount !== charge.amountCents) {
                await audit('payment_check_amount_mismatch', charge.id, { expected: charge.amountCents, received: check.amount });
                return 'AMOUNT_MISMATCH';
            }

            return confirmPaid(
                charge,
                {
                    transactionNsu,
                    invoiceSlug: body.invoice_slug,
                    receiptUrl: body.receipt_url,
                    captureMethod: check.capture_method || body.capture_method,
                    installments: check.installments ?? body.installments,
                    paidAmountCents: check.paid_amount ?? body.paid_amount,
                    payload: body,
                },
                'webhook'
            );
        },

        /**
         * Status para o app do cliente. Se ainda pendente, reconcilia com
         * payment_check (no máximo a cada 20s) — cobre webhook perdido. Os
         * parâmetros vindos do redirect são só dicas para a consulta oficial;
         * nunca são tratados como prova de pagamento.
         */
        async getChargeStatus(userId: string, isAdmin: boolean, chargeId: string, hints: { transactionNsu?: string; slug?: string } = {}) {
            let charge = await prisma.paymentCharge.findUnique({ where: { id: chargeId } });
            if (!charge) throw new ChargeError('Cobrança não encontrada', 'NOT_FOUND');

            if (!isAdmin) {
                const customer = await prisma.customer.findFirst({ where: { userId } });
                if (!customer || customer.id !== charge.customerId) throw new ChargeError('Cobrança não encontrada', 'NOT_FOUND');
            }

            const now = deps.now();
            const canCheck =
                CLAIMABLE.includes(charge.status) &&
                charge.status !== CHARGE_STATUS.PENDING &&
                (!charge.lastCheckedAt || now.getTime() - new Date(charge.lastCheckedAt).getTime() >= RECHECK_INTERVAL_MS);

            if (canCheck && isInfinitePayConfigured(config)) {
                await prisma.paymentCharge.update({ where: { id: charge.id }, data: { lastCheckedAt: now } });
                try {
                    const check = await client.paymentCheck({
                        orderNsu: charge.id,
                        transactionNsu: hints.transactionNsu,
                        slug: hints.slug || charge.invoiceSlug || undefined,
                    });
                    await audit('payment_check', charge.id, { paid: check.paid, amount: check.amount, source: 'status' });
                    if (check.paid && (check.amount === undefined || check.amount === charge.amountCents)) {
                        await confirmPaid(
                            charge,
                            {
                                transactionNsu: hints.transactionNsu,
                                invoiceSlug: hints.slug,
                                captureMethod: check.capture_method,
                                installments: check.installments,
                                paidAmountCents: check.paid_amount,
                            },
                            'payment_check'
                        );
                    }
                } catch (err: any) {
                    await audit('payment_check_error', charge.id, { error: err?.message, source: 'status' });
                }
                charge = await prisma.paymentCharge.findUnique({ where: { id: chargeId } });
            }

            if (
                charge.status === CHARGE_STATUS.LINK_CREATED &&
                charge.expiresAt &&
                new Date(charge.expiresAt).getTime() < now.getTime()
            ) {
                charge = await prisma.paymentCharge.update({
                    where: { id: charge.id },
                    data: { status: CHARGE_STATUS.EXPIRED },
                });
            }

            return publicView(charge);
        },
    };
}

let singleton: ReturnType<typeof createInfinitePayService> | null = null;
export function getInfinitePayService() {
    if (!singleton) singleton = createInfinitePayService(defaultDeps());
    return singleton;
}
