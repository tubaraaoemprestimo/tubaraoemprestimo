import { COMMERCIAL_SERVICE_CODES, PHONE_SERVICE_CODE } from './rules';
import { getFlags, PhoneFlags } from './flags';

/**
 * Fonte única do catálogo de serviços para o app e para a IA (chatbot interno
 * e webhook Evolution). Lê service_catalog_entries; se a tabela ainda não
 * existir (migração não aplicada), usa o padrão abaixo — nada quebra.
 *
 * INVESTIDOR não é serviço comercial: continua no Wizard como hoje.
 */
const DEFAULTS = [
    { code: 'CLT', label: 'Empréstimo CLT', description: 'Empréstimo pessoal para quem tem carteira assinada.', icon: 'Briefcase', sortOrder: 1, applicationRoute: '/wizard?profile=CLT', active: true, visibleInClient: true, visibleInWhatsApp: true },
    { code: 'AUTONOMO', label: 'Capital de giro para comércio', description: 'Capital de giro com pagamento em diárias.', icon: 'Store', sortOrder: 2, applicationRoute: '/wizard?profile=AUTONOMO', active: true, visibleInClient: true, visibleInWhatsApp: true },
    { code: 'GARANTIA', label: 'Empréstimo com garantia', description: 'Deixe um bem como garantia.', icon: 'Car', sortOrder: 3, applicationRoute: '/wizard?profile=GARANTIA', active: true, visibleInClient: true, visibleInWhatsApp: true },
    { code: 'MOTO', label: 'Financiamento de moto', description: 'Compre sua moto parcelada.', icon: 'Bike', sortOrder: 4, applicationRoute: '/wizard?profile=MOTO', active: true, visibleInClient: true, visibleInWhatsApp: true },
    { code: 'LIMPA_NOME', label: 'Limpar nome', description: 'Contestação administrativa de negativação.', icon: 'CreditCard', sortOrder: 5, applicationRoute: '/wizard?profile=LIMPA_NOME', active: true, visibleInClient: true, visibleInWhatsApp: true },
    { code: PHONE_SERVICE_CODE, label: 'Financiamento de Celulares', description: 'Compre seu celular em parcelas, com análise da Tubarão.', icon: 'Smartphone', sortOrder: 6, applicationRoute: '/client/financiamento-celulares/solicitar', active: false, visibleInClient: true, visibleInWhatsApp: true },
];

export interface CatalogService {
    code: string; label: string; description: string; icon: string; sortOrder: number;
    applicationRoute: string; isNew: boolean; available: boolean;
}

export async function getServiceCatalog(prisma: any, channel: 'client' | 'whatsapp' = 'client', flags: PhoneFlags = getFlags()): Promise<CatalogService[]> {
    let rows: any[] = DEFAULTS;
    let offerEnabled = false;
    try {
        const db = await prisma.serviceCatalogEntry.findMany({ orderBy: { sortOrder: 'asc' } });
        if (db.length) rows = db;
        const s = await prisma.phoneFinancingSettings.findUnique({ where: { id: 'default' } });
        offerEnabled = Boolean(s?.offerEnabled);
    } catch {
        // tabela ainda não criada: catálogo padrão, celulares indisponível
    }
    const byCode = new Map(rows.map(r => [r.code, r]));
    return COMMERCIAL_SERVICE_CODES
        .map(code => byCode.get(code) || DEFAULTS.find(d => d.code === code)!)
        .filter(r => (channel === 'client' ? r.visibleInClient : r.visibleInWhatsApp))
        .map(r => {
            const isPhone = r.code === PHONE_SERVICE_CODE;
            const available = isPhone
                ? offerEnabled && flags.phoneFinancing && (channel === 'client' || flags.phoneWhatsapp)
                : r.active !== false;
            return { code: r.code, label: r.label, description: r.description, icon: r.icon, sortOrder: r.sortOrder, applicationRoute: r.applicationRoute, isNew: isPhone, available };
        });
}

/**
 * Bloco de contexto CONFIÁVEL para a IA. Vai depois do prompt do admin (que
 * continua com prioridade) e antes das mensagens do cliente. Sem dados pessoais.
 */
export async function buildServiceKnowledgeBlock(prisma: any, appBaseUrl: string, flags: PhoneFlags = getFlags()): Promise<string> {
    const services = await getServiceCatalog(prisma, 'whatsapp', flags);
    const base = appBaseUrl.replace(/\/$/, '');
    const lines = services.map((s, i) => {
        const link = s.available ? ` Contratação: ${base}/#${s.applicationRoute.split('?')[0]}` : '';
        const tag = s.code === PHONE_SERVICE_CODE ? (s.available ? ' (NOVIDADE)' : ' (em breve, ainda não disponível para contratação)') : '';
        return `${i + 1}. ${s.label}${tag}: ${s.description}${link}`;
    });
    let phoneRules = '';
    const phone = services.find(s => s.code === PHONE_SERVICE_CODE);
    if (phone) {
        let products = '';
        if (phone.available) {
            try {
                const skus = await prisma.phoneSku.findMany({
                    where: { active: true, product: { active: true }, units: { some: { commercialStatus: 'AVAILABLE' } } },
                    include: { product: true }, take: 15,
                });
                products = skus.length
                    ? 'Modelos com estoque agora: ' + skus.map((s: any) => `${s.product.brand} ${s.product.model} ${s.storage || ''} ${s.color || ''} (à vista R$ ${(s.cashPriceCents / 100).toFixed(2)})`.replace(/\s+/g, ' ').trim()).join('; ') + '.'
                    : 'No momento não há modelos em estoque cadastrados: ofereça registrar a solicitação para cotação.';
            } catch { products = ''; }
        }
        phoneRules = `
REGRAS SOBRE FINANCIAMENTO DE CELULARES:
- Só informe modelos, preços, entrada, juros e prazos que estiverem nesta lista. Se não estiver aqui, diga que depende de cotação e análise. Nunca prometa aprovação.
- ${phone.available ? products : 'O serviço ainda não está aberto para contratação. Diga que é uma novidade em breve e ofereça avisar quando abrir.'}
- Financiamento em parcelas com a Tubarão é diferente de parcelar no cartão.
- Android: não prometa disponibilidade; diga que depende de cotação.
- Nunca fale de bloqueio, rastreamento ou desativação do aparelho por atraso: isso não existe.
- Status de proposta, parcelas e segunda via: oriente o cliente a entrar no app (área "Meus financiamentos de celulares"), onde ele está autenticado.
- Se o cliente tiver empréstimo e financiamento de celular, trate cada contrato separadamente; nunca some os valores.`;
    }
    return `===== SERVIÇOS OFICIAIS DA TUBARÃO (fonte do sistema; use esta lista ao responder "quais serviços vocês oferecem?") =====
${lines.join('\n')}
Programa de investimento: também existe a área "Seja um Investidor" (não é empréstimo); fale dela se o cliente perguntar sobre investir.${phoneRules}
===== FIM DOS SERVIÇOS =====`;
}

/** Resumo mínimo de celulares do cliente para a IA. Sem CPF, IMEI ou endereço. */
export async function buildPhoneCustomerSummary(prisma: any, customerId: string): Promise<string> {
    try {
        const [apps, sales] = await Promise.all([
            prisma.phoneFinancingApplication.findMany({ where: { customerId, status: { notIn: ['closed', 'cancelled'] } }, select: { protocol: true, status: true } }),
            prisma.phoneSale.findMany({
                where: { customerId, status: { in: ['active', 'in_collection', 'pending_contract'] } },
                include: { installments: { where: { status: { in: ['OPEN', 'PARTIAL'] } }, orderBy: { dueDate: 'asc' }, take: 1 }, unit: { include: { sku: { include: { product: true } } } } },
            }),
        ]);
        if (!apps.length && !sales.length) return '';
        const parts = ['\n--- FINANCIAMENTO DE CELULAR (contrato separado dos empréstimos) ---'];
        for (const a of apps) parts.push(`Proposta ${a.protocol}: status ${a.status}`);
        for (const s of sales) {
            const next = s.installments[0];
            const model = s.unit?.sku?.product?.model || 'celular';
            parts.push(`Contrato de ${model}: status ${s.status}${next ? `; próxima parcela R$ ${((next.amountCents - next.paidCents) / 100).toFixed(2)} vence ${new Date(next.dueDate).toLocaleDateString('pt-BR')}` : ''}`);
        }
        return parts.join('\n');
    } catch {
        return '';
    }
}
