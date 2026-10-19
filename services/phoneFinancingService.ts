// Financiamento de Celulares + Apple MDM — cliente HTTP tipado.
// Fonte de verdade: docs/financiamento-celulares/API_CONTRATO.md
// Valores monetários sempre em centavos (inteiro). Datas em ISO 8601.

import { api } from './apiClient';

// ---------- Erros ----------

export interface PhoneApiError extends Error {
    code?: string;
}

const toError = (error: any): PhoneApiError => {
    const message = typeof error === 'string' ? error : error?.error || error?.message || 'Erro inesperado. Tente novamente.';
    return Object.assign(new Error(message), { code: typeof error === 'object' ? error?.code : undefined });
};

async function call<T>(req: Promise<{ data: any; error: any }>): Promise<T> {
    const { data, error } = await req;
    if (error) throw toError(error);
    if (data == null) throw toError('Resposta vazia do servidor.');
    return data as T;
}

export const isFeatureDisabled = (err: unknown) => (err as PhoneApiError)?.code === 'FEATURE_DISABLED';

// ---------- Helpers ----------

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatCents = (c: number | null | undefined) => brl.format((c ?? 0) / 100);

/** "1.234,56" | "1234.56" | "1234" → centavos. Retorna null se inválido. */
export const parseReaisToCents = (v: string): number | null => {
    const clean = v.replace(/[^\d,.-]/g, '');
    if (!clean) return null;
    const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
    const n = Number(normalized);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export const formatBps = (bps: number | null | undefined) =>
    bps == null ? '—' : `${(bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
export const formatDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

export type ApplicationStatus =
    | 'draft' | 'submitted' | 'under_review' | 'awaiting_documents' | 'approved' | 'rejected'
    | 'contract_pending' | 'awaiting_down_payment' | 'ready_for_handover' | 'active' | 'cancelled' | 'closed';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
    draft: 'Rascunho',
    submitted: 'Recebida',
    under_review: 'Em análise',
    awaiting_documents: 'Documentação pendente',
    approved: 'Aprovada',
    rejected: 'Recusada',
    contract_pending: 'Contrato pendente',
    awaiting_down_payment: 'Aguardando entrada',
    ready_for_handover: 'Aguardando entrega',
    active: 'Ativa',
    cancelled: 'Cancelada',
    closed: 'Encerrada',
};

export const statusLabel = (s: string | null | undefined) => (s && (STATUS_LABELS as Record<string, string>)[s]) || s || '—';

export const TERMS_VERSION = 'phone-v0-draft';

// ---------- Tipos: catálogo / cliente ----------

export interface CatalogService {
    code: string;
    label: string;
    description: string;
    icon: string;
    sortOrder: number;
    applicationRoute: string;
    isNew: boolean;
    available: boolean;
    visible?: boolean;
}

export interface PhoneOffer {
    enabled: boolean;
    commercialTerms: string | null;
    maxInstallments: number | null;
    minDownPaymentBps: number | null;
    monthlyInterestBps: number | null;
    legalTemplateStatus: string | null;
}

export interface PhoneSku {
    id: string;
    sku: string;
    storage?: string | null;
    color?: string | null;
    condition: string;
    cashPriceCents: number;
    financedPriceCents?: number | null;
    availableUnits: number;
}

export interface PhoneProduct {
    id: string;
    brand: string;
    line?: string | null;
    model: string;
    description?: string | null;
    imageUrl?: string | null;
    skus: PhoneSku[];
    active?: boolean;
}

export interface Simulation {
    cashPriceCents: number;
    downPaymentCents: number;
    financedCents: number;
    installmentCents: number;
    totalCents: number;
    monthlyInterestBps: number;
    schedule: { number: number; dueDate: string; amountCents: number }[];
}

export type DocumentKind = 'ID_FRONT' | 'ID_BACK' | 'PROOF_OF_ADDRESS' | 'PROOF_OF_INCOME';
export interface ApplicationDocument { kind: string; url: string }

export interface CreateApplicationBody {
    skuId?: string;
    wantsQuote?: boolean;
    requestedInstallments?: number;
    requestedDownPaymentCents?: number;
    monthlyIncomeCents?: number;
    occupation?: string;
    notes?: string;
    documents?: ApplicationDocument[];
    lgpdConsent: true;
    termsVersion: string;
}

export interface MyApplication {
    id: string;
    protocol: string;
    status: ApplicationStatus;
    createdAt: string;
    sku: (Partial<PhoneSku> & { model?: string; brand?: string }) | null;
    statusLabel?: string;
}

export interface PhoneInstallment {
    id: string;
    saleId: string;
    number: number;
    kind: string;
    dueDate: string;
    amountCents: number;
    paidCents: number;
    status: string;
    collectionPaused?: boolean;
}

export interface MySale {
    id: string;
    status: string;
    device: { model: string; storage?: string | null; color?: string | null; serialMasked?: string | null; imeiMasked?: string | null };
    cashPriceCents: number;
    downPaymentCents: number;
    financedCents: number;
    totalCents: number;
    installmentsCount: number;
    paidCents: number;
    balanceCents: number;
    nextInstallment: Partial<PhoneInstallment> | null;
    contract: { status: string; pdfUrl?: string | null } | null;
    physicalDeliveryDate: string | null;
    paidOffAt: string | null;
    legalTitleTransferDate: string | null;
}

export interface PhoneCharge {
    id: string;
    status: string;
    amountCents: number;
    checkoutUrl?: string | null;
    paidAt?: string | null;
    receiptUrl?: string | null;
}

// ---------- Tipos: admin ----------

export interface PhoneDashboard {
    applications: { submitted: number; under_review: number; approved: number; rejected: number };
    inventory: { available: number; reserved: number; sold: number; delivered: number; returned: number };
    sales: { active: number; paid_off: number; in_collection: number };
    receivableCents: number;
    receivedCents: number;
    overdueCents: number;
    mdm: { managed: number; unmanaged: number; releasePending: number };
}

export interface PhoneFinancingSettings {
    offerEnabled: boolean;
    commercialTerms?: string | null;
    monthlyInterestBps: number | null;
    maxInstallments: number | null;
    minDownPaymentBps: number | null;
    legalTemplateStatus?: string | null;
    reminderDaysBefore?: number | null;
    graceDaysAfterDue?: number | null;
    contactHour?: number | null;
    [key: string]: unknown;
}

export interface CollectionPolicy {
    reminderDaysBefore: number | null;
    graceDaysAfterDue: number | null;
    contactHour: number | null;
}

export interface AdminApplication {
    id: string;
    protocol: string;
    status: ApplicationStatus;
    createdAt: string;
    customer: { id: string; name: string; cpfMasked: string; phone?: string | null };
    sku: (Partial<PhoneSku> & { model?: string; brand?: string }) | null;
    requestedInstallments?: number | null;
    requestedDownPaymentCents?: number | null;
    documents?: ApplicationDocument[];
    wantsQuote?: boolean;
    monthlyIncomeCents?: number | null;
    occupation?: string | null;
    notes?: string | null;
}

export interface InventoryUnit {
    id: string;
    skuId: string;
    sku?: Partial<PhoneSku> & { model?: string };
    serialMasked: string;
    imeiMasked?: string | null;
    commercialStatus: string;
    mdmStatus?: string | null;
    mdmStatusSource?: string | null;
    assetTag?: string | null;
    storageLocation?: string | null;
}

export interface CreateUnitBody {
    skuId: string;
    serialNumber: string;
    imei?: string;
    imei2?: string;
    assetTag?: string;
    supplier?: string;
    invoiceNumber?: string;
    invoiceUrl?: string;
    purchasedAt?: string;
    storageLocation?: string;
    physicalCondition?: string;
    legalOwner?: string;
    custodian?: string;
}

export interface ImportResult { valid: number; errors: { line: number; message: string }[]; created: number }

export interface SalePayment {
    id: string;
    installmentId?: string | null;
    method?: string;
    amountCents: number;
    status: string;
    receiptUrl?: string | null;
    note?: string | null;
    createdAt?: string;
    needsSecondApproval?: boolean;
}

export interface ReleaseStep { step: string; label?: string; status: string; evidence?: string | null }

export interface AdminSale {
    id: string;
    status: string;
    applicationId?: string;
    customer?: { id: string; name: string; cpfMasked?: string };
    device?: MySale['device'];
    unitId?: string;
    cashPriceCents?: number;
    downPaymentCents?: number;
    financedCents?: number;
    totalCents?: number;
    balanceCents?: number;
    installmentsCount?: number;
    createdAt?: string;
    installments?: PhoneInstallment[];
    payments?: SalePayment[];
    contract?: { status: string; templateVersion?: string; pdfUrl?: string | null } | null;
    deliveries?: { id: string; deliveredAt: string; receivedBy: string; receiptUrl?: string | null; notes?: string | null }[];
    releaseCase?: { id: string; status?: string; steps?: ReleaseStep[] } | null;
}

export interface CreateSaleBody { applicationId: string; unitId: string; downPaymentCents: number; installments: number; firstDueDate: string }

// ---------- Tipos: MDM ----------

export interface MdmStatus {
    enabled: boolean;
    adapter: 'mock' | 'nanohub';
    realCommandsEnabled: boolean;
    labMode: boolean;
    server: { reachable: boolean; version?: string | null; error?: string };
    pushCert: { topic: string; notAfter: string } | null;
}

export interface MdmDevice {
    id: string;
    unitId: string;
    serialMasked: string;
    enrollmentId?: string | null;
    supervised: boolean;
    osVersion?: string | null;
    lastSeenAt?: string | null;
    ownership: string;
    stateSource?: string | null;
    abmAssigned?: boolean;
}

export interface MdmCapability { requestType: string; allowed: boolean; reason?: string }

export type MdmCommandStatus = 'requested' | 'authorized' | 'queued' | 'dispatched' | 'acknowledged' | 'failed' | 'expired' | 'unknown';

export interface MdmCommand {
    id: string;
    status: MdmCommandStatus;
    commandUuid?: string | null;
    requestType?: string;
    purpose?: string;
    requestedBy?: string | null;
    approvedBy?: string | null;
    createdAt?: string;
    error?: string | null;
}

// ---------- Rotas ----------

const qs = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return s ? `?${s}` : '';
};

const ADMIN = '/admin/phone-financing';
const MDM = '/admin/mdm';

export const phoneFinancingService = {
    // Catálogo
    getCatalog: (channel: 'client' | 'whatsapp' = 'client') =>
        call<{ services: CatalogService[] }>(api.get(`/services/catalog${qs({ channel })}`)).then(r => r.services ?? []),

    // Cliente
    getOffer: () => call<PhoneOffer>(api.get('/phone-financing/offer')),
    getProducts: () => call<{ products: PhoneProduct[] }>(api.get('/phone-products')).then(r => r.products ?? []),
    simulate: (body: { skuId: string; downPaymentCents: number; installments: number }) =>
        call<Simulation>(api.post('/phone-financing/simulate', body)),
    createApplication: (body: CreateApplicationBody) =>
        call<{ application: { id: string; protocol: string; status: ApplicationStatus } }>(api.post('/phone-financing/applications', body)).then(r => r.application),
    getMyApplications: () => call<{ applications: MyApplication[] }>(api.get('/phone-financing/my-applications')).then(r => r.applications ?? []),
    getMyContracts: () => call<{ sales: MySale[] }>(api.get('/phone-financing/my-contracts')).then(r => r.sales ?? []),
    getMyInstallments: () => call<{ installments: PhoneInstallment[] }>(api.get('/phone-financing/my-installments')).then(r => r.installments ?? []),
    payInstallment: (id: string) => call<{ charge: PhoneCharge }>(api.post(`/phone-financing/installments/${id}/pay`, {})).then(r => r.charge),
    getPayment: (id: string) => call<{ charge: PhoneCharge }>(api.get(`/phone-financing/payments/${id}`)).then(r => r.charge),

    /** Upload via POST /upload existente. Só aceita URL http(s). */
    uploadDocument: async (file: File): Promise<string> => {
        const { data, error } = await api.upload(file);
        if (error) throw toError(error);
        const url: unknown = data?.url;
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw toError('Falha no envio do arquivo. Tente novamente.');
        return url;
    },

    // Admin
    admin: {
        getDashboard: () => call<PhoneDashboard>(api.get(`${ADMIN}/dashboard`)),
        getSettings: () => call<PhoneFinancingSettings>(api.get(`${ADMIN}/settings`)),
        updateSettings: (body: Partial<PhoneFinancingSettings>) => call<PhoneFinancingSettings>(api.put(`${ADMIN}/settings`, body)),
        listApplications: (status?: string, q?: string) =>
            call<{ applications: AdminApplication[] }>(api.get(`${ADMIN}/applications${qs({ status, q })}`)).then(r => r.applications ?? []),
        updateApplicationStatus: (id: string, status: ApplicationStatus, reason?: string) =>
            call<unknown>(api.patch(`${ADMIN}/applications/${id}/status`, { status, reason })),
        reserveUnit: (applicationId: string, unitId: string) => call<unknown>(api.post(`${ADMIN}/applications/${applicationId}/reserve`, { unitId })),
        listProducts: () => call<{ products: PhoneProduct[] } | PhoneProduct[]>(api.get(`${ADMIN}/products`)).then(r => (Array.isArray(r) ? r : r.products ?? [])),
        createProduct: (body: { brand: string; line?: string; model: string; description?: string; imageUrl?: string }) =>
            call<unknown>(api.post(`${ADMIN}/products`, body)),
        updateProduct: (id: string, body: Partial<PhoneProduct>) => call<unknown>(api.patch(`${ADMIN}/products/${id}`, body)),
        createSku: (productId: string, body: { sku: string; storage?: string; color?: string; condition: string; costCents: number; cashPriceCents: number; financedPriceCents?: number }) =>
            call<unknown>(api.post(`${ADMIN}/products/${productId}/skus`, body)),
        updateSku: (id: string, body: Record<string, unknown>) => call<unknown>(api.patch(`${ADMIN}/skus/${id}`, body)),
        listInventory: (status?: string) =>
            call<{ units: InventoryUnit[] } | InventoryUnit[]>(api.get(`${ADMIN}/inventory${qs({ status })}`)).then(r => (Array.isArray(r) ? r : r.units ?? [])),
        createUnit: (body: CreateUnitBody) => call<unknown>(api.post(`${ADMIN}/inventory`, body)),
        importInventory: (csv: string, dryRun: boolean) => call<ImportResult>(api.post(`${ADMIN}/inventory/import`, { csv, dryRun })),
        createSale: (body: CreateSaleBody) => call<{ sale?: AdminSale }>(api.post(`${ADMIN}/sales`, body)),
        listSales: (status?: string) =>
            call<{ sales: AdminSale[] } | AdminSale[]>(api.get(`${ADMIN}/sales${qs({ status })}`)).then(r => (Array.isArray(r) ? r : r.sales ?? [])),
        getSale: (id: string) => call<{ sale: AdminSale } | AdminSale>(api.get(`${ADMIN}/sales/${id}`)).then(r => ('sale' in r ? r.sale : r) as AdminSale),
        generateContract: (saleId: string) =>
            call<{ contract: { status: 'legal_template_pending' | 'generated'; templateVersion?: string } }>(api.post(`${ADMIN}/sales/${saleId}/contract/generate`, {})).then(r => r.contract),
        registerDelivery: (saleId: string, body: { deliveredAt: string; receivedBy: string; receiptUrl?: string; notes?: string }) =>
            call<unknown>(api.post(`${ADMIN}/sales/${saleId}/delivery`, body)),
        manualPayment: (saleId: string, body: { installmentId: string; amountCents: number; receiptUrl: string; note: string }) =>
            call<unknown>(api.post(`${ADMIN}/sales/${saleId}/manual-payment`, body)),
        secondApprovePayment: (paymentId: string) => call<unknown>(api.post(`${ADMIN}/payments/${paymentId}/second-approval`, {})),
        titleTransfer: (saleId: string, legalTitleTransferDate: string) =>
            call<unknown>(api.post(`${ADMIN}/sales/${saleId}/title-transfer`, { legalTitleTransferDate })),
        updateReleaseStep: (caseId: string, step: string, body: { status: string; evidence: string }) =>
            call<unknown>(api.patch(`${ADMIN}/release-cases/${caseId}/steps/${encodeURIComponent(step)}`, body)),
        getCollectionPolicy: () => call<CollectionPolicy>(api.get(`${ADMIN}/collection-policy`)),
        updateCollectionPolicy: (body: CollectionPolicy) => call<CollectionPolicy>(api.put(`${ADMIN}/collection-policy`, body)),
        pauseInstallmentCollection: (installmentId: string, paused: boolean) =>
            call<unknown>(api.post(`${ADMIN}/installments/${installmentId}/collection-pause`, { paused })),
    },

    // Apple MDM
    mdm: {
        getStatus: () => call<MdmStatus>(api.get(`${MDM}/status`)),
        listDevices: () => call<{ devices: MdmDevice[] } | MdmDevice[]>(api.get(`${MDM}/devices`)).then(r => (Array.isArray(r) ? r : r.devices ?? [])),
        getDevice: (id: string) => call<{ device: MdmDevice }>(api.get(`${MDM}/devices/${id}`)).then(r => r.device),
        linkDevice: (unitId: string, enrollmentId?: string) => call<unknown>(api.post(`${MDM}/devices`, { unitId, enrollmentId })),
        syncDevice: (id: string) => call<unknown>(api.post(`${MDM}/devices/${id}/sync`, {})),
        getCapabilities: (id: string) => call<{ commands: MdmCapability[] }>(api.get(`${MDM}/devices/${id}/capabilities`)).then(r => r.commands ?? []),
        sendCommand: (id: string, body: { requestType: string; purpose: string; idempotencyKey: string }) =>
            call<{ command: MdmCommand }>(api.post(`${MDM}/devices/${id}/commands`, body)).then(r => r.command),
        listCommands: (id: string) =>
            call<{ commands: MdmCommand[] } | MdmCommand[]>(api.get(`${MDM}/devices/${id}/commands`)).then(r => (Array.isArray(r) ? r : r.commands ?? [])),
        approveCommand: (commandId: string) => call<unknown>(api.post(`${MDM}/commands/${commandId}/approve`, {})),
        releaseReview: (id: string) => call<unknown>(api.post(`${MDM}/devices/${id}/release-review`, {})),
    },
};

export const SENSITIVE_MDM_COMMANDS = ['EnableLostMode', 'DisableLostMode', 'DeviceLock', 'EraseDevice'];
