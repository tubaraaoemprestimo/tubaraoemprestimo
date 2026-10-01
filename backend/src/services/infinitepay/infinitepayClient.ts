import axios, { AxiosInstance } from 'axios';

/**
 * Cliente HTTP da InfinitePay — Checkout Integrado.
 *
 * Único ponto do sistema que fala com a API da InfinitePay; o resto do código
 * chama estas funções. A API do checkout se identifica pelo `handle` (a
 * InfiniteTag da conta, sem "$"), não por token — por isso não há segredo
 * aqui, só configuração vinda do .env.
 *
 * ATENÇÃO: formato de request/response implementado conforme o contrato
 * especificado para a integração (POST /links, POST /payment_check, valores em
 * centavos). A documentação oficial não pôde ser consultada no momento da
 * implementação — validar contra ela antes de ativar em produção.
 */

export class InfinitePayError extends Error {
    constructor(
        message: string,
        public readonly kind: 'CONFIG' | 'HTTP' | 'TIMEOUT' | 'NETWORK' | 'INVALID_RESPONSE',
        public readonly status?: number
    ) {
        super(message);
        this.name = 'InfinitePayError';
    }
}

export interface InfinitePayConfig {
    handle: string;
    apiUrl: string;
    webhookUrl: string;
    redirectUrl: string;
    timeoutMs: number;
}

export function getInfinitePayConfig(): InfinitePayConfig {
    return {
        handle: (process.env.INFINITEPAY_HANDLE || '').replace(/^\$/, '').trim(),
        apiUrl: (process.env.INFINITEPAY_API_URL || 'https://api.checkout.infinitepay.io').replace(/\/$/, ''),
        webhookUrl: process.env.INFINITEPAY_WEBHOOK_URL || '',
        redirectUrl: process.env.INFINITEPAY_REDIRECT_URL || '',
        timeoutMs: Number(process.env.INFINITEPAY_TIMEOUT_MS) || 15000,
    };
}

export function isInfinitePayConfigured(config = getInfinitePayConfig()): boolean {
    return Boolean(config.handle && config.webhookUrl && config.redirectUrl);
}

export interface CreateLinkInput {
    orderNsu: string;
    amountCents: number;
    description: string;
    redirectUrl: string;
    customer?: { name?: string; email?: string; phone_number?: string };
}

export interface PaymentCheckInput {
    orderNsu: string;
    transactionNsu?: string;
    slug?: string;
}

export interface PaymentCheckResult {
    success: boolean;
    paid: boolean;
    amount?: number;
    paid_amount?: number;
    installments?: number;
    capture_method?: string;
}

/** Converte a resposta de erro do axios em InfinitePayError, sem vazar corpo/segredos. */
function toInfinitePayError(err: any, op: string): InfinitePayError {
    if (err instanceof InfinitePayError) return err;
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message))) {
        return new InfinitePayError(`${op}: timeout`, 'TIMEOUT');
    }
    const status: number | undefined = err?.response?.status;
    const errorData = err?.response?.data;
    if (status) {
        let reason =
            status === 400 ? 'requisição inválida' :
            status === 401 || status === 403 ? 'acesso negado (verifique INFINITEPAY_HANDLE)' :
            status === 404 ? 'recurso não encontrado' :
            status === 409 ? 'conflito' :
            status === 422 ? (errorData?.errors?.items?.[0] || errorData?.message || 'valor abaixo do mínimo permitido pela InfinitePay (mínimo R$ 1,00)') :
            status === 429 ? 'limite de requisições' :
            status >= 500 ? 'indisponibilidade da InfinitePay' : 'erro HTTP';
        return new InfinitePayError(`${op}: ${reason} (HTTP ${status})`, 'HTTP', status);
    }
    return new InfinitePayError(`${op}: falha de rede`, 'NETWORK');
}

export function createInfinitePayClient(config = getInfinitePayConfig(), http?: AxiosInstance) {
    const client = http || axios.create({
        baseURL: config.apiUrl,
        timeout: config.timeoutMs,
        headers: { 'Content-Type': 'application/json' },
    });

    return {
        /** POST /links — cria o checkout e devolve a URL onde o cliente paga. */
        async createCheckoutLink(input: CreateLinkInput): Promise<{ url: string }> {
            if (!isInfinitePayConfigured(config)) {
                throw new InfinitePayError('InfinitePay não configurada', 'CONFIG');
            }
            if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
                throw new InfinitePayError('Valor da cobrança inválido', 'CONFIG');
            }

            const customer = Object.fromEntries(
                Object.entries(input.customer || {}).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
            );

            const payload: Record<string, any> = {
                handle: config.handle,
                order_nsu: input.orderNsu,
                redirect_url: input.redirectUrl,
                webhook_url: config.webhookUrl,
                items: [{ quantity: 1, price: input.amountCents, description: input.description.slice(0, 120) }],
            };
            if (Object.keys(customer).length > 0) payload.customer = customer;

            try {
                const { data } = await client.post('/links', payload);
                const url = typeof data === 'string' ? data : data?.url || data?.link || data?.checkout_url;
                if (typeof url !== 'string' || !/^https:\/\//.test(url)) {
                    throw new InfinitePayError('Resposta sem URL de checkout', 'INVALID_RESPONSE');
                }
                return { url };
            } catch (err) {
                throw toInfinitePayError(err, 'createCheckoutLink');
            }
        },

        /** POST /payment_check — consulta oficial do status (reconciliação). */
        async paymentCheck(input: PaymentCheckInput): Promise<PaymentCheckResult> {
            if (!config.handle) throw new InfinitePayError('InfinitePay não configurada', 'CONFIG');

            const payload: Record<string, any> = { handle: config.handle, order_nsu: input.orderNsu };
            if (input.transactionNsu) payload.transaction_nsu = input.transactionNsu;
            if (input.slug) payload.slug = input.slug;

            try {
                const { data } = await client.post('/payment_check', payload);
                if (!data || typeof data !== 'object') {
                    throw new InfinitePayError('Resposta inválida do payment_check', 'INVALID_RESPONSE');
                }
                return {
                    success: data.success !== false,
                    paid: data.paid === true,
                    amount: Number.isFinite(Number(data.amount)) ? Number(data.amount) : undefined,
                    paid_amount: Number.isFinite(Number(data.paid_amount)) ? Number(data.paid_amount) : undefined,
                    installments: Number.isFinite(Number(data.installments)) ? Number(data.installments) : undefined,
                    capture_method: typeof data.capture_method === 'string' ? data.capture_method : undefined,
                };
            } catch (err) {
                throw toInfinitePayError(err, 'paymentCheck');
            }
        },
    };
}

export type InfinitePayClient = ReturnType<typeof createInfinitePayClient>;
