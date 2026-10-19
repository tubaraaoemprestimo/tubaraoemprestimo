import { createInfinitePayClient, getInfinitePayConfig, InfinitePayClient, isInfinitePayConfigured, InfinitePayError } from '../infinitepay/infinitepayClient';
import { buildRedirectUrl, toInternationalPhone, WebhookBody } from '../infinitepay/infinitepayService';
import { allocatePayment } from './rules';

/**
 * Cobrança InfinitePay de parcelas de CELULAR. Reusa a MESMA conta, cliente
 * HTTP, webhook e payment_check dos empréstimos — não cria integração nova.
 *
 * Separação dos empréstimos:
 *  - Tabela própria (phone_sale_payments); nada grava em payment_charges,
 *    installments ou loans.
 *  - order_nsu = "PH-<id>". O webhook único (/api/webhooks/infinitepay) olha o
 *    prefixo: "PH-" vem para cá; qualquer outro segue no fluxo antigo, intacto.
 *
 * Segurança (mesmas regras do fluxo de empréstimos):
 *  - Webhook sem assinatura: só dá baixa após payment_check oficial.
 *  - Valor pago tem que bater com o que NÓS cobramos.
 *  - Claim atômico + transaction_nsu UNIQUE = idempotente.
 *  - Baixa só na parcela alvo; excedente vai para NEEDS_REVIEW.
 *  - Nenhuma relação com MDM: pagar ou atrasar não dispara comando no aparelho.
 */

export const PHONE_ORDER_PREFIX = 'PH-';
const TTL_MS = 24 * 60 * 60 * 1000;
const RECHECK_MS = 20 * 1000;
const CLAIMABLE = ['PENDING', 'PAYMENT_LINK_CREATED', 'CANCELLED', 'EXPIRED'];
const SETTLED = ['PAID', 'NEEDS_REVIEW', 'CONFIRMING'];

export class PhonePaymentError extends Error {
    constructor(message: string, public readonly code: 'NOT_CONFIGURED' | 'NOT_FOUND' | 'NOTHING_DUE' | 'IN_PROGRESS' | 'PROVIDER_ERROR' | 'DISABLED') {
        super(message);
    }
}

export function isPhoneOrder(orderNsu: unknown): orderNsu is string {
    return typeof orderNsu === 'string' && orderNsu.startsWith(PHONE_ORDER_PREFIX);
}

export interface PhonePaymentDeps {
    prisma: any;
    client: InfinitePayClient;
    config: ReturnType<typeof getInfinitePayConfig>;
    notifyAdmins: (title: string, body: string) => Promise<void>;
    now: () => Date;
}

export function createPhonePaymentService(deps: PhonePaymentDeps) {
    const { prisma, client, config } = deps;

    const audit = (action: string, id: string | null, details: Record<string, any> = {}) =>
        prisma.auditLog.create({
            data: { userId: 'infinitepay', userName: 'InfinitePay', action: `phone_${action}`, entity: 'PhoneSalePayment', entityId: id, details: JSON.stringify(details) },
        }).catch(() => {});

    const view = (p: any) => ({
        id: p.id, status: p.status, amountCents: p.amountCents,
        checkoutUrl: p.status === 'PAYMENT_LINK_CREATED' ? p.checkoutUrl : null,
        paidAt: p.paidAt, receiptUrl: p.receiptUrl, installmentId: p.installmentId,
    });

    /**
     * Aplica baixa já verificada. Transação: aloca na parcela, marca pagamento,
     * quita a venda se tudo pago. Ganha quem fizer o claim; resto é duplicata.
     */
    async function settle(payment: any, info: { transactionNsu?: string; invoiceSlug?: string; receiptUrl?: string; captureMethod?: string; paidAmountCents?: number }, source: string) {
        let claimed;
        try {
            claimed = await prisma.phoneSalePayment.updateMany({
                where: { id: payment.id, status: { in: CLAIMABLE } },
                data: {
                    status: 'CONFIRMING', transactionNsu: info.transactionNsu || null,
                    invoiceSlug: info.invoiceSlug || payment.invoiceSlug || null, receiptUrl: info.receiptUrl || null,
                    paymentMethod: info.captureMethod || null, paidAmountCents: info.paidAmountCents ?? null, paidAt: deps.now(),
                },
            });
        } catch (err: any) {
            if (err?.code === 'P2002') { await audit('duplicate_transaction', payment.id, { source }); return 'DUPLICATE'; }
            throw err;
        }
        if (!claimed || claimed.count !== 1) { await audit('duplicate', payment.id, { source }); return 'DUPLICATE'; }
        return applyAllocation(payment, source);
    }

    async function applyAllocation(payment: any, source: string): Promise<'CONFIRMED' | 'NEEDS_REVIEW'> {
        const review = async (reason: string) => {
            await prisma.phoneSalePayment.update({ where: { id: payment.id }, data: { status: 'NEEDS_REVIEW', errorMessage: reason } });
            await audit('needs_review', payment.id, { reason, source });
            await deps.notifyAdmins('⚠️ Pagamento de celular requer revisão', `Pagamento ${payment.id.slice(0, 8)} de R$ ${(payment.amountCents / 100).toFixed(2)}: ${reason}`);
            return 'NEEDS_REVIEW' as const;
        };
        try {
            return await prisma.$transaction(async (tx: any) => {
                const installments = await tx.phoneSaleInstallment.findMany({ where: { saleId: payment.saleId } });
                const result = allocatePayment(installments, payment.amountCents, payment.installmentId);
                if (result.allocations.length === 0 || result.unallocatedCents > 0) {
                    throw Object.assign(new Error(result.allocations.length === 0
                        ? 'parcela já quitada ou cancelada (possível pagamento em duplicidade)'
                        : 'valor pago maior que o saldo da parcela'), { review: true });
                }
                for (const a of result.allocations) {
                    await tx.phoneSaleInstallment.update({
                        where: { id: a.installmentId },
                        data: { paidCents: a.newPaidCents, status: a.newStatus, paidAt: a.newStatus === 'PAID' ? deps.now() : null },
                    });
                    await tx.phonePaymentAllocation.create({ data: { paymentId: payment.id, installmentId: a.installmentId, amountCents: a.amountCents } });
                }
                await tx.phoneSalePayment.update({ where: { id: payment.id }, data: { status: 'PAID', errorMessage: null } });
                const open = await tx.phoneSaleInstallment.count({ where: { saleId: payment.saleId, status: { in: ['OPEN', 'PARTIAL'] } } });
                if (open === 0) {
                    // Quitação financeira apenas. Transferência de titularidade e
                    // liberação MDM são etapas separadas, feitas pelo admin.
                    await tx.phoneSale.update({ where: { id: payment.saleId }, data: { status: 'paid_off', paidOffAt: deps.now() } });
                }
                await audit('confirmed', payment.id, { source, amountCents: payment.amountCents });
                return 'CONFIRMED' as const;
            });
        } catch (err: any) {
            if (err?.review) return review(err.message);
            console.error('[PhonePayments] erro ao aplicar baixa:', err?.message);
            return review('erro ao aplicar a baixa');
        }
    }

    return {
        isEnabled: () => isInfinitePayConfigured(config),

        async createCharge(customerId: string, installmentId: string) {
            if (!isInfinitePayConfigured(config)) throw new PhonePaymentError('Pagamento online indisponível no momento', 'NOT_CONFIGURED');
            const inst = await prisma.phoneSaleInstallment.findUnique({ where: { id: installmentId }, include: { sale: true } });
            if (!inst || inst.sale.customerId !== customerId) throw new PhonePaymentError('Parcela não encontrada', 'NOT_FOUND');
            if (['PAID', 'CANCELLED'].includes(inst.status) || inst.sale.status === 'cancelled') throw new PhonePaymentError('Esta parcela não está em aberto', 'NOTHING_DUE');
            const amountCents = inst.amountCents - inst.paidCents;
            if (amountCents < 100) throw new PhonePaymentError('Valor abaixo do mínimo da InfinitePay (R$ 1,00). Fale com o atendimento.', 'NOTHING_DUE');

            const now = deps.now();
            if (await prisma.phoneSalePayment.findFirst({ where: { installmentId, status: 'CONFIRMING' } })) {
                throw new PhonePaymentError('Já existe um pagamento sendo confirmado para esta parcela', 'IN_PROGRESS');
            }
            const open = await prisma.phoneSalePayment.findMany({ where: { installmentId, provider: 'INFINITEPAY', status: 'PAYMENT_LINK_CREATED' }, orderBy: { createdAt: 'desc' } });
            const reusable = open.find((p: any) => p.amountCents === amountCents && p.checkoutUrl && (!p.expiresAt || new Date(p.expiresAt) > now));
            if (reusable) return view(reusable);
            if (open.length) {
                await prisma.phoneSalePayment.updateMany({ where: { id: { in: open.map((p: any) => p.id) }, status: 'PAYMENT_LINK_CREATED' }, data: { status: 'CANCELLED' } });
            }

            const customer = await prisma.customer.findUnique({ where: { id: customerId } });
            const created = await prisma.phoneSalePayment.create({
                data: { saleId: inst.saleId, provider: 'INFINITEPAY', installmentId, amountCents, status: 'PENDING', expiresAt: new Date(now.getTime() + TTL_MS) },
            });
            const orderNsu = `${PHONE_ORDER_PREFIX}${created.id}`;
            await prisma.phoneSalePayment.update({ where: { id: created.id }, data: { orderNsu } });
            await audit('charge_created', created.id, { amountCents });
            const label = inst.kind === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${inst.number}`;
            try {
                const { url } = await client.createCheckoutLink({
                    orderNsu, amountCents,
                    description: `Tubarão - Financiamento de Celular - ${label}`,
                    redirectUrl: buildRedirectUrl(config.redirectUrl, orderNsu),
                    customer: { name: customer?.name || undefined, email: customer?.email || undefined, phone_number: toInternationalPhone(customer?.phone) },
                });
                const updated = await prisma.phoneSalePayment.update({ where: { id: created.id }, data: { status: 'PAYMENT_LINK_CREATED', checkoutUrl: url } });
                return view(updated);
            } catch (err: any) {
                const message = err instanceof InfinitePayError ? err.message : 'erro inesperado';
                await prisma.phoneSalePayment.update({ where: { id: created.id }, data: { status: 'FAILED', errorMessage: message } });
                await audit('checkout_error', created.id, { error: message });
                throw new PhonePaymentError(
                    err instanceof InfinitePayError && err.status === 422 ? `InfinitePay: ${err.message}` : 'Não foi possível gerar o pagamento agora. Tente novamente em instantes.',
                    'PROVIDER_ERROR'
                );
            }
        },

        /** Chamado pelo webhook único quando order_nsu começa com "PH-". Nunca lança. */
        async processWebhook(body: WebhookBody): Promise<string> {
            const orderNsu = String(body?.order_nsu || '');
            const transactionNsu = typeof body?.transaction_nsu === 'string' ? body.transaction_nsu : undefined;
            const payment = await prisma.phoneSalePayment.findUnique({ where: { orderNsu } });
            await audit('webhook_received', payment?.id || null, { orderNsu, transactionNsu, amount: body?.amount });
            if (!payment) return 'UNKNOWN_ORDER';
            if (SETTLED.includes(payment.status)) {
                if (!payment.transactionNsu || payment.transactionNsu === transactionNsu) return 'DUPLICATE';
                await deps.notifyAdmins('⚠️ Pagamento de celular em duplicidade', `Pagamento ${payment.id.slice(0, 8)} recebeu uma segunda transação. Verifique estorno.`);
                return 'SECOND_TRANSACTION';
            }
            if (Number(body.amount) !== payment.amountCents) {
                await audit('webhook_amount_mismatch', payment.id, { expected: payment.amountCents, received: body.amount });
                return 'AMOUNT_MISMATCH';
            }
            let check;
            try {
                check = await client.paymentCheck({ orderNsu, transactionNsu, slug: body.invoice_slug });
            } catch (err: any) {
                await audit('payment_check_error', payment.id, { error: err?.message });
                return 'CHECK_FAILED';
            }
            if (!check.paid) return 'NOT_PAID';
            if (check.amount !== undefined && check.amount !== payment.amountCents) return 'AMOUNT_MISMATCH';
            return settle(payment, {
                transactionNsu, invoiceSlug: body.invoice_slug, receiptUrl: body.receipt_url,
                captureMethod: check.capture_method || body.capture_method, paidAmountCents: check.paid_amount ?? body.paid_amount,
            }, 'webhook');
        },

        /** Status para o cliente; reconcilia com payment_check no máximo a cada 20s. */
        async getStatus(customerId: string | null, paymentId: string, hints: { transactionNsu?: string; slug?: string } = {}) {
            let p = await prisma.phoneSalePayment.findUnique({ where: { id: paymentId }, include: { sale: true } });
            if (!p || (customerId && p.sale.customerId !== customerId)) throw new PhonePaymentError('Pagamento não encontrado', 'NOT_FOUND');
            const now = deps.now();
            const canCheck = p.provider === 'INFINITEPAY' && CLAIMABLE.includes(p.status) && p.status !== 'PENDING'
                && (!p.lastCheckedAt || now.getTime() - new Date(p.lastCheckedAt).getTime() >= RECHECK_MS);
            if (canCheck && isInfinitePayConfigured(config)) {
                await prisma.phoneSalePayment.update({ where: { id: p.id }, data: { lastCheckedAt: now } });
                try {
                    const check = await client.paymentCheck({ orderNsu: p.orderNsu, transactionNsu: hints.transactionNsu, slug: hints.slug || p.invoiceSlug || undefined });
                    if (check.paid && (check.amount === undefined || check.amount === p.amountCents)) {
                        await settle(p, { transactionNsu: hints.transactionNsu, invoiceSlug: hints.slug, captureMethod: check.capture_method, paidAmountCents: check.paid_amount }, 'payment_check');
                    }
                } catch (err: any) {
                    await audit('payment_check_error', p.id, { error: err?.message, source: 'status' });
                }
                p = await prisma.phoneSalePayment.findUnique({ where: { id: paymentId }, include: { sale: true } });
            }
            if (p.status === 'PAYMENT_LINK_CREATED' && p.expiresAt && new Date(p.expiresAt) < now) {
                p = await prisma.phoneSalePayment.update({ where: { id: p.id }, data: { status: 'EXPIRED' } });
            }
            return view(p);
        },

        /**
         * Baixa manual. Acima do limite configurado fica AWAITING_SECOND_APPROVAL
         * até OUTRO admin confirmar. Comprovante obrigatório.
         */
        async recordManual(input: { saleId: string; installmentId: string; amountCents: number; receiptUrl: string; note: string; adminId: string; secondApprovalCents: number }) {
            if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new PhonePaymentError('Valor inválido', 'NOTHING_DUE');
            if (!input.receiptUrl) throw new PhonePaymentError('Comprovante obrigatório', 'NOTHING_DUE');
            const inst = await prisma.phoneSaleInstallment.findUnique({ where: { id: input.installmentId } });
            if (!inst || inst.saleId !== input.saleId) throw new PhonePaymentError('Parcela não encontrada', 'NOT_FOUND');
            const needsSecond = input.amountCents >= input.secondApprovalCents;
            const payment = await prisma.phoneSalePayment.create({
                data: {
                    saleId: input.saleId, provider: 'MANUAL', installmentId: input.installmentId, amountCents: input.amountCents,
                    receiptUrl: input.receiptUrl, note: input.note, recordedBy: input.adminId,
                    status: needsSecond ? 'AWAITING_SECOND_APPROVAL' : 'CONFIRMING', paidAt: deps.now(),
                },
            });
            await audit('manual_recorded', payment.id, { amountCents: input.amountCents, by: input.adminId, needsSecond });
            if (needsSecond) return { payment: view(payment), result: 'AWAITING_SECOND_APPROVAL' };
            return { payment: view(payment), result: await applyAllocation(payment, 'manual') };
        },

        async approveManual(paymentId: string, adminId: string) {
            const p = await prisma.phoneSalePayment.findUnique({ where: { id: paymentId } });
            if (!p || p.status !== 'AWAITING_SECOND_APPROVAL') throw new PhonePaymentError('Pagamento não aguarda aprovação', 'NOT_FOUND');
            if (p.recordedBy === adminId) throw new PhonePaymentError('A segunda conferência precisa ser feita por outro administrador', 'NOTHING_DUE');
            const claimed = await prisma.phoneSalePayment.updateMany({ where: { id: p.id, status: 'AWAITING_SECOND_APPROVAL' }, data: { status: 'CONFIRMING', secondApprovedBy: adminId } });
            if (claimed.count !== 1) return 'DUPLICATE';
            return applyAllocation({ ...p, secondApprovedBy: adminId }, 'manual_second_approval');
        },
    };
}

let singleton: ReturnType<typeof createPhonePaymentService> | null = null;
export function getPhonePaymentService() {
    if (!singleton) {
        const { prisma } = require('../prisma');
        const { sendPushToRole } = require('../../routes/push');
        const config = getInfinitePayConfig();
        singleton = createPhonePaymentService({
            prisma, config, client: createInfinitePayClient(config),
            notifyAdmins: (t, b) => sendPushToRole('ADMIN', t, b).catch(() => {}),
            now: () => new Date(),
        });
    }
    return singleton;
}
