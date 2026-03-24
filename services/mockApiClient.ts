/**
 * mockApiClient.ts — Cliente HTTP Mock para Modo DEMO
 *
 * Intercepta todas as chamadas que normalmente iriam para o Express/Prisma
 * e as resolve localmente usando os stores Zustand.
 *
 * Interface idêntica à ApiClient real (apiClient.ts).
 * Ativado quando VITE_DEMO_MODE=true.
 */

import { useRequestsStore, useAuthStore, useSettingsStore, useCourseStore } from './demoStore';
import { DEMO_DASHBOARD_SEED } from './demoSeed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DELAY_MS = 600;

function delay(ms = DELAY_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

/** Toast simulado — dispara toast global sem depender de contexto React */
function toastSimulated(msg: string): void {
  window.dispatchEvent(new CustomEvent('demo-toast', { detail: { message: msg, type: 'success' } }));
}

/** Match regex helper */
function match(url: string, pattern: RegExp): RegExpMatchArray | null {
  return url.match(pattern);
}

/** Remove query string para comparação de rota */
function path(url: string): string {
  return url.split('?')[0];
}

// ─── Curso in-memory state ─────────────────────────────────────────────────
// Mantido localmente para operações de admin que alteram módulos/aulas
let _courseModules: any[] = [];

function getCourseModules(): any[] {
  const stored = useCourseStore.getState().modules;
  if (_courseModules.length === 0 && stored.length > 0) {
    _courseModules = JSON.parse(JSON.stringify(stored));
  }
  return _courseModules;
}

// ─── Quiz in-memory state ──────────────────────────────────────────────────
let _quizQuestions: any[] = [
  { id: 'q-1', question: 'O que analisa a capacidade de pagamento do cliente?', options: ['Score', 'Renda', 'CPF', 'Endereço'], correct: 1, moduleId: 'mod-2' },
  { id: 'q-2', question: 'Qual o prazo máximo recomendado para empréstimo CLT?', options: ['6 meses', '12 meses', '24 meses', '48 meses'], correct: 1, moduleId: 'mod-2' },
  { id: 'q-3', question: 'O que é inadimplência?', options: ['Pagamento em dia', 'Atraso no pagamento', 'Desconto de juros', 'Cancelamento'], correct: 1, moduleId: 'mod-1' },
];

// ─── Leads in-memory state ─────────────────────────────────────────────────
const _leads: any[] = [
  { id: 'lead-1', name: 'João Silva', phone: '5511999990001', email: 'joao@gmail.com', status: 'new', score: 85, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'lead-2', name: 'Maria Santos', phone: '5521999990002', email: 'maria@hotmail.com', status: 'contacted', score: 72, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'lead-3', name: 'José Oliveira', phone: '5531999990003', email: 'jose@outlook.com', status: 'new', score: 91, createdAt: new Date(Date.now() - 1800000).toISOString() },
];

// ─── Payment Receipts in-memory state ──────────────────────────────────────
const _paymentReceipts: any[] = [];

// ─── Scheduled Status in-memory state ─────────────────────────────────────
const _scheduledStatus: any[] = [];

// ─── Templates in-memory state ────────────────────────────────────────────
let _messageTemplates: any[] = [
  { id: 'tmpl-1', name: 'Boas-vindas', message: 'Olá {nome}! Bem-vindo(a) à Tubarão Empréstimos.', type: 'whatsapp' },
  { id: 'tmpl-2', name: 'Aprovação', message: 'Parabéns {nome}! Seu empréstimo de R${valor} foi aprovado.', type: 'whatsapp' },
  { id: 'tmpl-3', name: 'Lembrete', message: 'Olá {nome}, sua parcela de R${valor} vence em 3 dias.', type: 'whatsapp' },
];

// ─── Campaigns in-memory state ─────────────────────────────────────────────
const _campaigns: any[] = [
  { id: 'camp-1', name: 'Campanha Black Friday', status: 'active', audience: 45, sent: 38, clicks: 12, createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'camp-2', name: 'Reativação de Inativos', status: 'draft', audience: 23, sent: 0, clicks: 0, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
];

// ─── Collection Rules in-memory state ─────────────────────────────────────
const _collectionRules: any[] = [
  { id: 'rule-1', name: 'Lembrete D-3', trigger: 'days_before_due', days: 3, action: 'whatsapp', template: 'Lembrete', active: true },
  { id: 'rule-2', name: 'Cobrança D+1', trigger: 'days_after_due', days: 1, action: 'whatsapp', template: 'Cobrança', active: true },
  { id: 'rule-3', name: 'Cobrança D+7', trigger: 'days_after_due', days: 7, action: 'whatsapp', template: 'Cobrança Urgente', active: true },
];

// ─── Blacklist in-memory state ─────────────────────────────────────────────
const _blacklist: any[] = [
  { id: 'bl-1', cpf: '999.888.777-66', name: 'Fraude Demo', reason: 'Documentação falsa', addedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
];

// ─── Comments in-memory state ──────────────────────────────────────────────
const _comments: any[] = [];

// ─── Automation stats ──────────────────────────────────────────────────────
const _automationStats = {
  totalRuns: 142,
  successRate: 94.5,
  pendingTasks: 3,
  lastRun: new Date(Date.now() - 3600000 * 2).toISOString(),
};

// ─── Router ───────────────────────────────────────────────────────────────────

async function handleRequest(method: string, url: string, body?: any): Promise<any> {
  await delay();

  const store = useRequestsStore.getState;
  const auth = useAuthStore.getState;
  const settings = useSettingsStore.getState;
  const course = useCourseStore.getState;

  // ── AUTH ────────────────────────────────────────────────────────────────────

  if (method === 'POST' && path(url) === '/auth/login') {
    console.log('[DEMO Mock] Login interceptado:', body);
    const { identifier = '', email = '', password } = body || {};
    const loginEmail = identifier || email;
    const isAdmin = loginEmail.includes('admin') || loginEmail.includes('gerente');
    const user = {
      id: isAdmin ? 'demo-admin-001' : 'demo-client-001',
      name: isAdmin ? 'Admin Demo' : 'Cliente Demo',
      email: loginEmail,
      role: isAdmin ? 'ADMIN' : 'CLIENT',
      cpf: isAdmin ? '000.000.000-00' : '123.456.789-01',
      phone: '5511999999999',
    };
    const token = 'demo-jwt-token-' + Date.now();
    auth().login(user as any, token);
    localStorage.setItem('tubarao_user', JSON.stringify(user));
    localStorage.setItem('tubarao_auth', JSON.stringify({ accessToken: token, refreshToken: token }));
    console.log('[DEMO Mock] Login bem-sucedido:', user);
    return { user, accessToken: token, refreshToken: token };
  }

  if (method === 'GET' && path(url) === '/auth/me') {
    return auth().user || null;
  }

  if (method === 'POST' && path(url) === '/auth/register') {
    const user = { id: 'demo-client-' + uid(), ...body, role: 'CLIENT' };
    return { user, accessToken: 'demo-jwt-' + Date.now(), refreshToken: 'demo-refresh-' + Date.now() };
  }

  if (method === 'GET' && match(url, /\/auth\/managed-access/)) {
    return { allowed: true }; // Sempre permitido em DEMO
  }

  if (method === 'POST' && path(url) === '/auth/forgot-password') {
    toastSimulated('📧 E-mail de recuperação simulado enviado!');
    return { success: true };
  }

  if (method === 'PUT' && path(url) === '/auth/update-password') {
    return { success: true };
  }

  if (method === 'PUT' && path(url) === '/auth/me') {
    return { ...auth().user, ...body };
  }

  // ── LOAN REQUESTS — Lista ───────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/loan-requests(\?.*)?$/)) {
    const requests = store().requests;
    return requests.map((r) => ({
      ...r,
      clientPhone: r.phone,
      clientEmail: r.email,
      clientCpf: r.cpf,
      requestedAmount: r.amount,
      interestRate: r.interestRate ?? 8.5,
      pendingAcceptance: r.status === 'PENDING_ACCEPTANCE',
    }));
  }

  // ── LOAN REQUESTS — Criar ───────────────────────────────────────────────────

  if (method === 'POST' && path(url) === '/loan-requests') {
    const newReq = {
      ...body,
      id: 'demo-req-' + uid(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store().addRequest(newReq);
    toastSimulated('📱 WhatsApp de confirmação simulado para o cliente!');
    return newReq;
  }

  // ── LOAN REQUESTS — Broadcast ───────────────────────────────────────────────

  if (method === 'POST' && path(url) === '/loan-requests/broadcast') {
    toastSimulated(`📢 Broadcast simulado para ${body?.requestIds?.length || 0} clientes via WhatsApp!`);
    return { success: true, sent: body?.requestIds?.length || 0 };
  }

  // ── LOAN REQUESTS — Pending / Latest ───────────────────────────────────────

  if (method === 'GET' && path(url) === '/loan-requests/pending') {
    const user = auth().user;
    const pending = store().requests.find(
      (r) => r.email === user?.email && ['PENDING', 'WAITING_DOCS', 'PENDING_ACCEPTANCE', 'APPROVED'].includes(r.status)
    );
    return pending || null;
  }

  if (method === 'GET' && path(url) === '/loan-requests/latest') {
    const user = auth().user;
    return store().requests.find((r) => r.email === user?.email) || null;
  }

  // ── LOAN REQUESTS — Ações ───────────────────────────────────────────────────

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/approve$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'APPROVED' });
    toastSimulated('✅ Cliente notificado via WhatsApp: Empréstimo aprovado!');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/(approve-counteroffer|approve-with-counteroffer)$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, {
      status: 'PENDING_ACCEPTANCE',
      approvedAmount: body?.approvedAmount,
      interestRate: body?.interestRate,
    });
    toastSimulated('📱 Contraproposta enviada ao cliente via WhatsApp!');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/accept-counteroffer$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'APPROVED' });
    toastSimulated('🎉 Admin notificado: cliente aceitou a contraproposta!');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/reject$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'REJECTED', adminNotes: body?.reason || 'Reprovado pelo admin.' });
    toastSimulated('📱 Cliente notificado: solicitação não aprovada.');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/activate-contract$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, {
      status: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      dailyInstallmentAmount: body?.dailyInstallmentAmount,
      totalInstallments: body?.totalInstallments,
      firstPaymentDate: body?.firstPaymentDate,
      paymentFrequency: body?.paymentFrequency,
      pixReceiptUrl: body?.pixReceiptUrl,
    });
    toastSimulated('🚀 Contrato ativado! Cliente notificado via WhatsApp e E-mail.');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/(request-docs|supplemental)$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'WAITING_DOCS', supplementalDocRequest: body?.description });
    toastSimulated('📋 Cliente notificado: documentos adicionais solicitados via WhatsApp!');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/(upload-supplemental|supplemental-upload)$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'PENDING' });
    toastSimulated('📁 Documentos recebidos! Admin notificado.');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/pause$/)) {
    const id = url.split('/')[2];
    const req = store().requests.find((r) => r.id === id);
    store().updateRequest(id, { status: 'PAUSED', adminNotes: `Pausado (anterior: ${req?.status}). ${body?.reason || ''}` });
    return { success: true, previousStatus: req?.status };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/resume$/)) {
    const id = url.split('/')[2];
    const req = store().requests.find((r) => r.id === id);
    const prevMatch = req?.adminNotes?.match(/anterior: (\w+)/);
    store().updateRequest(id, { status: (prevMatch ? prevMatch[1] : 'PENDING') as any });
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/loan-requests\/([^/]+)$/)) {
    const id = url.split('/')[2];
    store().deleteRequest(id);
    toastSimulated('🗑️ Solicitação excluída. Cliente notificado.');
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/values$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { amount: body?.amount, installments: body?.installments, approvedAmount: body?.approvedAmount, interestRate: body?.interestRate });
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/(attach-pix-receipt|pix-receipt)$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { pixReceiptUrl: body?.pixReceiptUrl });
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/loan-requests\/([^/]+)\/(contract-pdf|contract)$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { adminNotes: body?.contractPdfUrl });
    return { success: true };
  }

  // ── ADMIN LOANS (Contratos Ativos) ──────────────────────────────────────────

  if (method === 'GET' && match(url, /\/loans\/admin\/all|\/admin\/loans/)) {
    const activeRequests = store().requests.filter((r) => {
      const qStatus = url.includes('status=') ? new URLSearchParams(url.split('?')[1]).get('status') : null;
      return qStatus ? r.status === qStatus : r.status === 'ACTIVE';
    });
    return activeRequests.map((r) => ({
      ...r,
      loanId: r.id,
      principal: r.approvedAmount || r.amount,
      remaining: Math.round((r.approvedAmount || r.amount) * 0.65),
      paidInstallments: 2,
      totalInstallments: r.totalInstallments || 10,
      nextDueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    }));
  }

  if (method === 'GET' && match(url, /\/loans\/([^/]+)\/admin-details$/)) {
    const loanId = url.split('/')[2];
    const req = store().requests.find((r) => r.id === loanId);
    if (!req) return null;
    return {
      ...req,
      loanId: req.id,
      principal: req.approvedAmount || req.amount,
      remaining: Math.round((req.approvedAmount || req.amount) * 0.65),
      installments: Array.from({ length: req.totalInstallments || 6 }, (_, i) => ({
        id: `inst-${i + 1}`,
        number: i + 1,
        dueDate: new Date(Date.now() + (i + 1) * 30 * 86400000).toISOString(),
        amount: req.dailyInstallmentAmount || Math.round((req.approvedAmount || req.amount) / (req.totalInstallments || 6)),
        status: i < 2 ? 'PAID' : 'PENDING',
      })),
    };
  }

  if (method === 'PUT' && match(url, /\/loans\/([^/]+)\/admin-edit$/)) {
    const loanId = url.split('/')[2];
    store().updateRequest(loanId, body || {});
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/loans\/([^/]+)\/manual-payment$/)) {
    toastSimulated('💰 Pagamento manual registrado com sucesso!');
    return { success: true, id: 'pay-' + uid() };
  }

  if (method === 'DELETE' && match(url, /\/loans\/([^/]+)\/cancel$/)) {
    const loanId = url.split('/')[2];
    store().updateRequest(loanId, { status: 'REJECTED', adminNotes: body?.reason || 'Cancelado pelo admin.' });
    return { success: true };
  }

  // ── CLIENT LOANS ────────────────────────────────────────────────────────────

  if (method === 'GET' && path(url) === '/loans') {
    const user = auth().user;
    return store().requests
      .filter((r) => r.email === user?.email && r.status === 'ACTIVE')
      .map((r) => ({
        ...r,
        loanId: r.id,
        principal: r.approvedAmount || r.amount,
        remaining: Math.round((r.approvedAmount || r.amount) * 0.65),
        paidInstallments: 2,
        nextDueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      }));
  }

  if (method === 'GET' && path(url) === '/loans/pre-approval') {
    return null; // Sem pré-aprovação ativa no DEMO
  }

  if (method === 'GET' && path(url) === '/loans/installment-offer') {
    return null;
  }

  if (method === 'PUT' && match(url, /\/loans\/([^/]+)\/installments\/([^/]+)\/proof$/)) {
    toastSimulated('📸 Comprovante enviado! Admin notificado.');
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/loans\/([^/]+)\/generate-payment$/)) {
    return { pixCode: 'demo-pix-code-' + uid(), pixQrCode: null, dueDate: new Date(Date.now() + 3 * 86400000).toISOString() };
  }

  // ── ADMIN SUMMARY / DASHBOARD ───────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/admin\/(summary|today-summary)|\/finance\/today-summary/)) {
    const requests = store().requests;
    return {
      ...DEMO_DASHBOARD_SEED,
      totalRequests: requests.length,
      pendingRequests: requests.filter((r) => r.status === 'PENDING').length,
      activeContracts: requests.filter((r) => r.status === 'ACTIVE').length,
      approvedThisMonth: requests.filter((r) => r.status === 'APPROVED').length,
      // TodayFinancialDashboard fields
      totalDueToday: 2850,
      installmentsDueCount: 3,
      loansInDefaultCount: 2,
      paymentsReceivedToday: 1500,
      paymentsReceivedCount: 1,
      installmentsDueToday: [
        { installmentId: 'inst-1', amount: 1500, nextInstallment: null, customer: { name: 'Pedro Henrique', phone: '5511987650001' } },
        { installmentId: 'inst-2', amount: 850, nextInstallment: null, customer: { name: 'Aline Costa', phone: '5521976540002' } },
        { installmentId: 'inst-3', amount: 500, nextInstallment: null, customer: { name: 'Roberto Alves', phone: '5531965430003' } },
      ],
      loansInDefault: [
        { loanId: 'loan-4', daysOverdue: 5, remainingAmount: 750, customer: { name: 'Juliana Ferreira', phone: '5541954320004' } },
        { loanId: 'loan-5', daysOverdue: 12, remainingAmount: 450, customer: { name: 'Marcos Vinicius', phone: '5551943210005' } },
      ],
    };
  }

  if (method === 'GET' && match(url, /\/admin\/counteroffer-analytics/)) {
    return {
      total: 12,
      accepted: 8,
      rejected: 3,
      pending: 1,
      acceptanceRate: 66.7,
    };
  }

  // ── BRAND SETTINGS — suporta ambos os paths ─────────────────────────────────

  if (method === 'GET' && (path(url) === '/brand-settings' || path(url) === '/settings/brand')) {
    return settings().brand;
  }

  if (method === 'PUT' && (path(url) === '/brand-settings' || path(url) === '/settings/brand')) {
    settings().updateBrand(body);
    return { success: true };
  }

  if (method === 'DELETE' && (path(url) === '/brand-settings' || path(url) === '/settings/brand')) {
    settings().resetSettings();
    return { success: true };
  }

  // ── SYSTEM SETTINGS ─────────────────────────────────────────────────────────

  if (method === 'GET' && path(url) === '/settings') {
    return settings().settings;
  }

  if (method === 'PUT' && path(url) === '/settings') {
    return { success: true };
  }

  // ── PACKAGES — suporta ambos os paths ───────────────────────────────────────

  if (method === 'GET' && (path(url) === '/packages' || path(url) === '/settings/packages')) {
    return settings().packages;
  }

  if (method === 'POST' && (path(url) === '/packages' || path(url) === '/settings/packages')) {
    const newPkg = { ...body, id: 'pkg-' + uid() };
    return newPkg;
  }

  if (method === 'DELETE' && match(url, /\/(packages|settings\/packages)\//)) {
    return { success: true };
  }

  // ── GOALS — suporta ambos os paths ──────────────────────────────────────────

  if (method === 'GET' && (path(url) === '/goals' || path(url) === '/settings/goals')) {
    return { monthlyLoanGoal: 80000, monthlyClientGoal: 20, monthlyApprovalRateGoal: 80 };
  }

  if (method === 'PUT' && (path(url) === '/goals' || path(url) === '/settings/goals')) {
    return { success: true };
  }

  // ── WHATSAPP CONFIG ──────────────────────────────────────────────────────────

  if (method === 'GET' && path(url) === '/settings/whatsapp') {
    return { status: 'connected', phone: '5511999999999', instanceId: 'demo-instance' };
  }

  if (method === 'PUT' && path(url) === '/settings/whatsapp') {
    toastSimulated('⚙️ Configurações WhatsApp salvas no modo DEMO.');
    return { success: true };
  }

  // ── COLLECTION RULES ─────────────────────────────────────────────────────────

  if (method === 'GET' && (match(url, /\/collection-rules/) || match(url, /\/settings\/collection-rules/))) {
    return _collectionRules;
  }

  if (method === 'POST' && match(url, /\/collection-rules|\/settings\/collection-rules/)) {
    const rule = { ...body, id: 'rule-' + uid() };
    _collectionRules.push(rule);
    return rule;
  }

  if (method === 'DELETE' && match(url, /\/(settings\/)?collection-rules\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _collectionRules.findIndex((r) => r.id === id);
    if (idx >= 0) _collectionRules.splice(idx, 1);
    return { success: true };
  }

  // ── COURSE (Método Tubarão) ──────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/course/)) {
    return { modules: course().modules };
  }

  if (method === 'PUT' && match(url, /\/course\/progress\/(.+)$/)) {
    const lessonId = url.split('/').pop()!;
    course().setProgress(lessonId, body?.progress ?? 100);
    return { success: true };
  }

  // ── CURSO ADMIN ───────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/curso\/admin\/course/)) {
    const modules = getCourseModules().length > 0 ? getCourseModules() : course().modules;
    return { modules, id: 'demo-course-1', title: 'Método Tubarão', description: 'Curso completo para operadores de crédito' };
  }

  if (method === 'PUT' && match(url, /\/curso\/admin\/course/)) {
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/curso\/modules$/)) {
    const newMod = { id: 'mod-' + uid(), lessons: [], order: getCourseModules().length + 1, ...body };
    _courseModules.push(newMod);
    course().setModules([...(course().modules), newMod]);
    return newMod;
  }

  if (method === 'PUT' && match(url, /\/curso\/modules\/([^/]+)$/)) {
    const modId = url.split('/').pop()!;
    const mods = course().modules.map((m: any) => m.id === modId ? { ...m, ...body } : m);
    course().setModules(mods);
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/curso\/modules\/([^/]+)$/)) {
    const modId = url.split('/').pop()!;
    course().setModules(course().modules.filter((m: any) => m.id !== modId));
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/curso\/lessons$/)) {
    const newLesson = { id: 'les-' + uid(), ...body };
    const mods = course().modules.map((m: any) => {
      if (m.id === body?.moduleId) {
        return { ...m, lessons: [...(m.lessons || []), newLesson] };
      }
      return m;
    });
    course().setModules(mods);
    return newLesson;
  }

  if (method === 'PUT' && match(url, /\/curso\/lessons\/([^/]+)$/)) {
    const lessonId = url.split('/').pop()!;
    const mods = course().modules.map((m: any) => ({
      ...m,
      lessons: (m.lessons || []).map((l: any) => l.id === lessonId ? { ...l, ...body } : l),
    }));
    course().setModules(mods);
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/curso\/lessons\/([^/]+)$/)) {
    const lessonId = url.split('/').pop()!;
    const mods = course().modules.map((m: any) => ({
      ...m,
      lessons: (m.lessons || []).filter((l: any) => l.id !== lessonId),
    }));
    course().setModules(mods);
    return { success: true };
  }

  if (method === 'GET' && match(url, /\/curso\/lessons\/([^/]+)$/)) {
    const lessonId = url.split('/').pop()!;
    for (const m of course().modules) {
      const lesson = (m as any).lessons?.find((l: any) => l.id === lessonId);
      if (lesson) return lesson;
    }
    return null;
  }

  if (method === 'POST' && match(url, /\/curso\/lessons\/([^/]+)\/complete$/)) {
    const lessonId = url.split('/')[3];
    course().setProgress(lessonId, 100);
    return { success: true };
  }

  // ── NOTIFICAÇÕES ─────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/notifications\/admin/)) {
    return [
      { id: 'notif-1', type: 'NEW_REQUEST', message: 'Nova solicitação de Carlos Eduardo', read: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 'notif-2', type: 'PAYMENT_RECEIVED', message: 'Pagamento recebido de Pedro Henrique', read: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
  }

  if (method === 'GET' && match(url, /\/notifications\/coupons\/all/)) {
    return [];
  }

  if (method === 'GET' && match(url, /\/notifications\/coupons/)) {
    return [];
  }

  if (method === 'GET' && match(url, /^\/notifications/)) {
    return [];
  }

  if (method === 'PUT' && match(url, /\/notifications\/.+\/read$/)) {
    return { success: true };
  }

  if (method === 'POST' && path(url) === '/notifications') {
    return { id: 'notif-' + uid(), ...body };
  }

  if (method === 'POST' && match(url, /\/notifications\/coupons/)) {
    return { id: 'coupon-' + uid(), ...body };
  }

  if (method === 'DELETE' && match(url, /\/notifications\/coupons\//)) {
    return { success: true };
  }

  // ── CLIENTES / CRM ──────────────────────────────────────────────────────────

  if (method === 'GET' && path(url) === '/customers') {
    const requests = store().requests;
    const seen = new Set<string>();
    return requests
      .filter((r) => { const ok = !seen.has(r.email); seen.add(r.email); return ok; })
      .map((r, i) => ({
        id: r.customerId || r.id,
        name: r.clientName,
        email: r.email,
        phone: r.phone,
        cpf: r.cpf,
        status: r.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
        totalLoans: 1,
        activeLoans: r.status === 'ACTIVE' ? 1 : 0,
        createdAt: r.createdAt,
        // Customers.tsx fields
        totalDebt: r.status === 'ACTIVE' ? (r.approvedAmount || r.amount || 0) : 0,
        internalScore: 600 + (i * 37 % 200),
        preApprovedOffer: i % 3 === 0 ? { amount: 3000 + i * 500 } : null,
        riskLevel: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
        lastActivity: r.updatedAt,
      }));
  }

  if (method === 'GET' && match(url, /\/customers\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const req = store().requests.find((r) => r.id === id || r.customerId === id);
    if (!req) return null;
    return {
      id: req.customerId || req.id,
      name: req.clientName,
      email: req.email,
      phone: req.phone,
      cpf: req.cpf,
      status: req.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
      totalLoans: 1,
      activeLoans: req.status === 'ACTIVE' ? 1 : 0,
      createdAt: req.createdAt,
      totalDebt: req.status === 'ACTIVE' ? (req.approvedAmount || req.amount || 0) : 0,
      internalScore: 650,
      preApprovedOffer: null,
      riskLevel: 'LOW',
      lastActivity: req.updatedAt,
    };
  }

  if (method === 'PUT' && match(url, /\/customers\/([^/]+)\/status$/)) {
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/customers\/([^/]+)\/rates$/)) {
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/customers\/([^/]+)$/)) {
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/customers\/([^/]+)\/create-user$/)) {
    toastSimulated('👤 Usuário criado com sucesso para o cliente!');
    return { id: 'user-' + uid(), success: true };
  }

  if (method === 'POST' && match(url, /\/customers\/([^/]+)\/pre-approval$/)) {
    toastSimulated('💌 Pré-aprovação enviada ao cliente via WhatsApp!');
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/customers\/([^/]+)\/installment-offer$/)) {
    toastSimulated('💳 Oferta de parcelamento enviada ao cliente!');
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/customers\/([^/]+)\/installment-offer$/)) {
    return { success: true };
  }

  if (method === 'POST' && (path(url) === '/customers/import' || path(url) === '/customers/bulk-import')) {
    toastSimulated(`📥 ${body?.length || 1} leads importados com sucesso!`);
    return { imported: body?.length || 1, errors: 0 };
  }

  if (method === 'DELETE' && path(url) === '/customers/whatsapp-leads') {
    return { success: true, deleted: 0 };
  }

  if (method === 'DELETE' && path(url) === '/customers/bulk') {
    return { success: true };
  }

  if (method === 'POST' && path(url) === '/whatsapp-onboarding/start') {
    toastSimulated('📱 Onboarding WhatsApp iniciado no modo DEMO.');
    return { sessionId: 'session-' + uid(), status: 'started' };
  }

  if (method === 'GET' && path(url) === '/whatsapp-onboarding/sessions') {
    return [];
  }

  // ── USUÁRIOS ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && path(url) === '/users') {
    return [
      { id: 'demo-admin-001', name: 'Admin Demo', email: 'admin@demo.tubarao.com', role: 'ADMIN', active: true },
    ];
  }

  if (method === 'POST' && match(url, /^\/users/)) {
    return { ...body, id: 'user-' + uid(), active: true };
  }

  if (method === 'PUT' && match(url, /\/users\/([^/]+)\/password$/)) {
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/users\/([^/]+)$/)) {
    return { ...body, success: true };
  }

  if (method === 'DELETE' && match(url, /\/users\/([^/]+)$/)) {
    return { success: true };
  }

  // ── ADMIN OPERATIONS ──────────────────────────────────────────────────────────

  if (method === 'POST' && path(url) === '/admin/send-access') {
    toastSimulated('📧 Acesso enviado por e-mail no modo DEMO!');
    return { success: true };
  }

  // ── PAYMENT RECEIPTS ──────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/payment-receipts/)) {
    return _paymentReceipts;
  }

  if (method === 'POST' && path(url) === '/payment-receipts') {
    const receipt = { id: 'rec-' + uid(), ...body, status: 'PENDING', createdAt: new Date().toISOString() };
    _paymentReceipts.push(receipt);
    toastSimulated('📄 Comprovante enviado! Admin notificado.');
    return receipt;
  }

  if (method === 'PUT' && match(url, /\/payment-receipts\/([^/]+)\/(approve|reject)$/)) {
    const id = url.split('/')[2];
    const action = url.split('/').pop()!;
    const idx = _paymentReceipts.findIndex((r) => r.id === id);
    if (idx >= 0) {
      _paymentReceipts[idx].status = action === 'approve' ? 'APPROVED' : 'REJECTED';
      _paymentReceipts[idx].notes = body?.notes;
    }
    toastSimulated(action === 'approve' ? '✅ Comprovante aprovado!' : '❌ Comprovante rejeitado.');
    return { success: true };
  }

  // ── SCHEDULED STATUS ──────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/scheduled-status/)) {
    return _scheduledStatus;
  }

  if (method === 'POST' && path(url) === '/scheduled-status') {
    const status = { id: 'sched-' + uid(), ...body, status: 'pending', createdAt: new Date().toISOString() };
    _scheduledStatus.push(status);
    toastSimulated('📅 Status agendado com sucesso!');
    return status;
  }

  if (method === 'DELETE' && match(url, /\/scheduled-status\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _scheduledStatus.findIndex((s) => s.id === id);
    if (idx >= 0) _scheduledStatus.splice(idx, 1);
    return { success: true };
  }

  if (method === 'PUT' && match(url, /\/scheduled-status\/([^/]+)\/status$/)) {
    return { success: true };
  }

  if (method === 'POST' && path(url) === '/scheduled-status/generate-caption') {
    await delay(300);
    return { caption: '🦈 Empréstimo rápido e sem burocracia! Consulte agora mesmo. #tubaraoemprestimos #creditorapido' };
  }

  // ── MESSAGE TEMPLATES ──────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/message-templates/)) {
    return _messageTemplates;
  }

  if (method === 'POST' && match(url, /\/message-templates/)) {
    const tmpl = { id: 'tmpl-' + uid(), ...body };
    _messageTemplates.push(tmpl);
    return tmpl;
  }

  if (method === 'PUT' && match(url, /\/message-templates\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _messageTemplates.findIndex((t) => t.id === id);
    if (idx >= 0) _messageTemplates[idx] = { ..._messageTemplates[idx], ...body };
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/message-templates\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _messageTemplates.findIndex((t) => t.id === id);
    if (idx >= 0) _messageTemplates.splice(idx, 1);
    return { success: true };
  }

  // ── CAMPAIGNS ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/campaigns\/active/)) {
    return _campaigns.filter((c) => c.status === 'active');
  }

  if (method === 'GET' && match(url, /^\/campaigns/)) {
    return _campaigns;
  }

  if (method === 'POST' && match(url, /\/campaigns\/send/)) {
    toastSimulated('📣 Campanha disparada no modo DEMO! (simulada)');
    return { success: true, sent: 45 };
  }

  if (method === 'POST' && path(url) === '/campaigns') {
    const camp = { id: 'camp-' + uid(), ...body, status: 'draft', sent: 0, clicks: 0, createdAt: new Date().toISOString() };
    _campaigns.push(camp);
    return camp;
  }

  if (method === 'DELETE' && match(url, /\/campaigns\/([^/]+)$/)) {
    return { success: true };
  }

  // ── BLACKLIST ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/blacklist/)) {
    return _blacklist;
  }

  if (method === 'POST' && path(url) === '/blacklist') {
    const entry = { id: 'bl-' + uid(), ...body, addedAt: new Date().toISOString() };
    _blacklist.push(entry);
    toastSimulated('🚫 CPF adicionado à blacklist.');
    return entry;
  }

  if (method === 'DELETE' && match(url, /\/blacklist\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _blacklist.findIndex((b) => b.id === id);
    if (idx >= 0) _blacklist.splice(idx, 1);
    return { success: true };
  }

  // ── RISK LOGS ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/risk-logs/)) {
    return [
      { id: 'risk-1', event: 'LOGIN_SUCCESS', userId: 'demo-client-001', ip: '192.168.1.100', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'risk-2', event: 'BIOMETRIC_SKIPPED_DESKTOP', userId: 'demo-client-001', ip: '192.168.1.100', createdAt: new Date(Date.now() - 7200000).toISOString() },
    ];
  }

  // ── PARCEIROS ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/partners\/([^/]+)\/commissions$/)) {
    return { commissions: [] };
  }

  if (method === 'GET' && match(url, /^\/partners/)) {
    return {
      partners: [
        { id: 'part-1', name: 'Luiz Parceiro', phone: '5511988880001', email: 'luiz@parceiro.com', cpf: '111.222.333-44', isPartner: true, partnerScore: 85, referralCode: 'LUIZ2024', createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), totalEarned: 450, totalPending: 150, _count: { commissions: 3, referrals: 5 } },
      ],
      stats: {
        total: 1,
        active: 1,
        pendingCommissions: 150,
        paidCommissions: 450,
      }
    };
  }

  if (method === 'POST' && match(url, /\/partners\/([^/]+)\/(toggle|commissions\/([^/]+)\/pay)$/)) {
    return { success: true };
  }

  // ── REFERRALS ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/referrals/)) {
    return [];
  }

  // ── FINANCIAL SUMMARY / TRANSACTIONS ────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/financial-summary|\/finance\/transactions/)) {
    return DEMO_DASHBOARD_SEED;
  }

  if (method === 'GET' && match(url, /\/finance\/interactions|\/interaction-logs/)) {
    return [];
  }

  if (method === 'GET' && match(url, /\/transactions/)) {
    return [];
  }

  if (method === 'GET' && match(url, /\/audit/)) {
    return [];
  }

  if (method === 'GET' && match(url, /\/payments/)) {
    return [];
  }

  // ── FINANCE AUDIT LOG ─────────────────────────────────────────────────────────

  if (method === 'POST' && path(url) === '/finance/audit-log') {
    return { success: true };
  }

  if (method === 'GET' && match(url, /\/finance\/audit-log/)) {
    return [];
  }

  if (method === 'DELETE' && path(url) === '/finance/audit-log/clear') {
    return { success: true };
  }

  if (method === 'GET' && match(url, /\/finance\/interactions/)) {
    return [];
  }

  // ── AI CHATBOT ────────────────────────────────────────────────────────────────

  if (method === 'GET' && path(url) === '/chatbot/config') {
    return {
      id: 'demo-chatbot-config',
      enabled: false,
      provider: 'gemini',
      apiKey: '',
      geminiApiKey: '',
      perplexityApiKey: '',
      openaiApiKey: '',
      openrouterApiKey: '',
      nvidiaApiKey: '',
      zaiApiKey: '',
      anthropicApiKey: '',
      groqApiKey: '',
      grokApiKey: '',
      system_prompt: 'Você é um assistente de empréstimos da Tubarão Empréstimos.',
      welcome_message: 'Olá! Como posso ajudar?',
      fallback_message: 'Desculpe, não entendi. Pode reformular?',
      transfer_keywords: 'humano,atendente,pessoa',
      auto_reply_enabled: false,
      working_hours_only: false,
      working_hours_start: '08:00',
      working_hours_end: '18:00',
      max_messages_per_chat: 50,
    };
  }

  if (method === 'PUT' && path(url) === '/chatbot/config') {
    toastSimulated('⚙️ Configurações do Chatbot salvas (DEMO)');
    return { success: true };
  }

  if (method === 'GET' && match(url, /\/chatbot\/history-all/)) {
    return [];
  }

  if (method === 'GET' && match(url, /\/chatbot\/history\//)) {
    return [];
  }

  if (method === 'POST' && path(url) === '/chatbot/history') {
    return { success: true };
  }

  if (method === 'POST' && path(url) === '/chatbot/message') {
    await delay(1000);
    return { response: '🦈 Olá! Em modo DEMO, o chatbot não está conectado a uma IA real. Configure as chaves de API na aba Configurar.', success: true };
  }

  if (method === 'DELETE' && match(url, /\/chatbot\/history/)) {
    return { success: true };
  }

  // ── TRACKFLOW (Investigação/DataSearch) ───────────────────────────────────────

  if (method === 'POST' && path(url) === '/trackflow/query') {
    const { apiType, queryParams } = body || {};
    toastSimulated('🔍 Consulta realizada no modo DEMO (dados fictícios)');
    const demoData: any = {
      cpf: {
        cpf: queryParams?.cpf || '00000000000',
        nome: 'Carlos Eduardo Demo Silva',
        nascimento: '15/05/1990',
        sexo: 'Masculino',
        situacao_receita: 'Regular',
        emails: ['carlos.demo@gmail.com'],
        telefones: ['(11) 98765-4321'],
        enderecos: [{ logradouro: 'Rua Demo', numero: '100', bairro: 'Centro', municipio: 'São Paulo', uf: 'SP', cep: '01310-100' }],
      },
      cnpj: {
        cnpj: queryParams?.cnpj || '00000000000191',
        razao_social: 'Empresa Demo LTDA',
        nome_fantasia: 'Demo Corp',
        situacao_cadastral: 'Ativa',
        data_abertura: '01/01/2010',
        porte: 'ME',
        socios: [{ nome: 'Carlos Eduardo Demo', qualificacao: 'Sócio-Administrador' }],
      },
    };
    return { success: true, data: demoData[apiType] || { demo: true, message: 'Dados demo para ' + apiType }, cached: false };
  }

  if (method === 'GET' && match(url, /\/trackflow\/history/)) {
    return { success: true, queries: [] };
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/quiz\/questions/)) {
    return _quizQuestions;
  }

  if (method === 'POST' && path(url) === '/quiz/questions') {
    const q = { id: 'q-' + uid(), ...body };
    _quizQuestions.push(q);
    return q;
  }

  if (method === 'PUT' && match(url, /\/quiz\/questions\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _quizQuestions.findIndex((q) => q.id === id);
    if (idx >= 0) _quizQuestions[idx] = { ..._quizQuestions[idx], ...body };
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/quiz\/questions\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _quizQuestions.findIndex((q) => q.id === id);
    if (idx >= 0) _quizQuestions.splice(idx, 1);
    return { success: true };
  }

  if (method === 'GET' && match(url, /\/quiz\/scoring-rules/)) {
    return [
      { id: 'sr-1', minScore: 80, maxScore: 100, verdict: 'APROVADO', color: 'green' },
      { id: 'sr-2', minScore: 60, maxScore: 79, verdict: 'ANÁLISE', color: 'yellow' },
      { id: 'sr-3', minScore: 0, maxScore: 59, verdict: 'NEGADO', color: 'red' },
    ];
  }

  if (method === 'POST' && path(url) === '/quiz/scoring-rules') {
    return { id: 'sr-' + uid(), ...body };
  }

  if (method === 'PUT' && match(url, /\/quiz\/scoring-rules\//)) {
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/quiz\/scoring-rules\//)) {
    return { success: true };
  }

  if (method === 'POST' && path(url) === '/quiz/submit') {
    return { score: 78, verdict: 'ANÁLISE', leadId: 'lead-' + uid() };
  }

  if (method === 'GET' && match(url, /\/quiz\/check\//)) {
    return null;
  }

  if (method === 'GET' && match(url, /\/quiz\/leads/)) {
    return _leads;
  }

  if (method === 'PUT' && match(url, /\/quiz\/leads\/([^/]+)\/contact$/)) {
    const id = url.split('/')[3];
    const lead = _leads.find((l) => l.id === id);
    if (lead) lead.status = 'contacted';
    return { success: true };
  }

  // ── COMMENTS ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/comments\/lesson\//)) {
    return _comments.filter((c) => c.lessonId === url.split('/').pop());
  }

  if (method === 'GET' && match(url, /\/comments\/pending/)) {
    return _comments.filter((c) => !c.approved);
  }

  if (method === 'POST' && match(url, /\/comments\/lesson\//)) {
    const comment = { id: 'cmt-' + uid(), lessonId: url.split('/').pop(), ...body, createdAt: new Date().toISOString() };
    _comments.push(comment);
    return comment;
  }

  if (method === 'PUT' && match(url, /\/comments\//)) {
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/comments\//)) {
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/comments\/([^/]+)\/(rate|priority|pin|admin-notes)$/)) {
    return { success: true };
  }

  // ── AUTOMATION ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/automation\/stats/)) {
    return _automationStats;
  }

  if (method === 'GET' && match(url, /\/automation\/logs/)) {
    return [
      { id: 'log-1', type: 'WHATSAPP', status: 'SUCCESS', client: 'Carlos Eduardo', action: 'Boas-vindas enviado', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'log-2', type: 'WHATSAPP', status: 'SUCCESS', client: 'Fernanda Lima', action: 'Lembrete de documentos', createdAt: new Date(Date.now() - 7200000).toISOString() },
    ];
  }

  if (method === 'GET' && match(url, /\/automation\/templates/)) {
    return _messageTemplates;
  }

  if (method === 'PUT' && match(url, /\/automation\/templates/)) {
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/automation\/(retry|test)/)) {
    toastSimulated('🤖 Automação simulada executada com sucesso!');
    return { success: true };
  }

  // ── COLLECTION AUTOMATION ────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/collection-automation\/stats/)) {
    return {
      totalRuns: 28,
      successRate: 96.4,
      pendingCases: 2,
      recoveredAmount: 4500,
      lastRun: new Date(Date.now() - 3600000).toISOString(),
    };
  }

  if (method === 'GET' && match(url, /\/collection-automation\/history/)) {
    return [
      { id: 'ca-1', rule: 'Lembrete D-3', status: 'SUCCESS', sent: 12, failed: 0, createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
  }

  if (method === 'POST' && match(url, /\/collection-automation\/run/)) {
    toastSimulated('🔄 Régua de cobrança executada manualmente no modo DEMO!');
    return { success: true, processed: 3, sent: 3 };
  }

  // ── RETURNING CLIENTS / MIGRAÇÃO ─────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/api\/returning-clients|\/returning-clients/)) {
    return [];
  }

  if (method === 'PATCH' && match(url, /\/returning-clients\/([^/]+)\/(validate|reject)$/)) {
    return { success: true };
  }

  // ── CPF CONSULTATION ──────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/cpf\/trackflow\//)) {
    const cpf = url.split('/').pop()?.replace(/\D/g, '');
    return {
      cpf,
      name: 'Nome Demo (CPF Simulado)',
      birthDate: '1990-01-01',
      score: Math.floor(Math.random() * 400) + 400,
      status: 'REGULAR',
      debts: [],
      _demo: true,
    };
  }

  // ── DOCUMENTS ────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/documents\/([^/]+)$/)) {
    return { id: url.split('/').pop(), type: 'CPF', url: null };
  }

  if (method === 'GET' && path(url) === '/documents') {
    return [];
  }

  // ── UPLOAD ───────────────────────────────────────────────────────────────────

  if (method === 'POST' && match(url, /^\/upload/)) {
    if (body?.base64) {
      return { url: body.base64, path: 'demo-base64' };
    }
    return { url: `https://demo-storage.tubarao.app/${Date.now()}-demo.jpg`, path: 'demo-file' };
  }

  // ── COUPONS ──────────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/coupons/)) {
    return [];
  }

  // ── FINANCIAL SUMMARY / PAYMENTS ─────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/payment-receipts/)) {
    return [];
  }

  // ── OPEN FINANCE ──────────────────────────────────────────────────────────────

  if (method === 'POST' && match(url, /\/open-finance\/score\//)) {
    const customerId = url.split('/open-finance/score/')[1]?.split('?')[0];
    return { id: 'score-demo-' + uid(), customerId, score: 720, classification: 'B', source: 'INTERNAL', consultedAt: new Date().toISOString() };
  }

  if (method === 'GET' && match(url, /\/open-finance\/scores\//)) {
    return [];
  }

  if (method === 'POST' && match(url, /\/open-finance\/income-analysis\//)) {
    return { id: 'income-demo-' + uid(), monthlyIncome: 5000, confirmedIncome: 4800, recommendation: 'APPROVE', score: 78, analyzedAt: new Date().toISOString() };
  }

  if (method === 'GET' && match(url, /\/open-finance\/analyses\//)) {
    return [];
  }

  if (method === 'POST' && match(url, /\/open-finance\/full-analysis\//)) {
    return {
      internalScore: { id: 'si', score: 720, classification: 'B', source: 'INTERNAL', consultedAt: new Date().toISOString() },
      serasaScore: { id: 'ss', score: 680, classification: 'B', source: 'SERASA', consultedAt: new Date().toISOString() },
      incomeAnalysis: { id: 'ia', monthlyIncome: 5000, confirmedIncome: 4800, recommendation: 'APPROVE', score: 78 },
      overallRecommendation: 'APPROVE',
      suggestedLimit: 8000
    };
  }

  if (method === 'GET' && match(url, /\/open-finance\/consents\//)) {
    return [];
  }

  // ── ADMIN TEMPLATES ───────────────────────────────────────────────────────────

  if (method === 'GET' && path(url) === '/admin/templates') {
    return _messageTemplates;
  }

  if (method === 'POST' && path(url) === '/admin/templates') {
    const tmpl = { id: 'tmpl-' + uid(), ...body, is_active: body?.is_active ?? true, created_at: new Date().toISOString() };
    _messageTemplates.push(tmpl);
    return tmpl;
  }

  if (method === 'PUT' && match(url, /\/admin\/templates\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _messageTemplates.findIndex((t) => t.id === id);
    if (idx >= 0) _messageTemplates[idx] = { ..._messageTemplates[idx], ...body };
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/admin\/templates\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _messageTemplates.findIndex((t) => t.id === id);
    if (idx >= 0) _messageTemplates.splice(idx, 1);
    return { success: true };
  }

  // ── ADMIN BLACKLIST (alias /admin/blacklist → _blacklist) ─────────────────────

  if (method === 'GET' && match(url, /\/admin\/blacklist\/check/)) {
    const cpf = new URLSearchParams(url.split('?')[1] || '').get('cpf') || '';
    const found = _blacklist.find((b) => b.cpf?.replace(/\D/g, '') === cpf.replace(/\D/g, ''));
    return { blocked: !!found, entry: found || null };
  }

  if (method === 'GET' && match(url, /\/admin\/blacklist/)) {
    return _blacklist;
  }

  if (method === 'POST' && path(url) === '/admin/blacklist') {
    const entry = { id: 'bl-' + uid(), ...body, added_at: new Date().toISOString(), active: true };
    _blacklist.push(entry);
    toastSimulated('🚫 CPF adicionado à blacklist.');
    return entry;
  }

  if (method === 'PUT' && match(url, /\/admin\/blacklist\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _blacklist.findIndex((b) => b.id === id);
    if (idx >= 0) _blacklist[idx] = { ..._blacklist[idx], ...body };
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/admin\/blacklist\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _blacklist.findIndex((b) => b.id === id);
    if (idx >= 0) _blacklist.splice(idx, 1);
    return { success: true };
  }

  // ── COMMUNICATION HUB ─────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/communication\/templates/)) {
    return _messageTemplates;
  }

  if (method === 'POST' && match(url, /\/communication\/templates/)) {
    const tmpl = { id: 'tmpl-' + uid(), ...body };
    _messageTemplates.push(tmpl);
    return tmpl;
  }

  if (method === 'PUT' && match(url, /\/communication\/templates\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _messageTemplates.findIndex((t) => t.id === id);
    if (idx >= 0) _messageTemplates[idx] = { ..._messageTemplates[idx], ...body };
    return { success: true };
  }

  if (method === 'DELETE' && match(url, /\/communication\/templates\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _messageTemplates.findIndex((t) => t.id === id);
    if (idx >= 0) _messageTemplates.splice(idx, 1);
    return { success: true };
  }

  if (method === 'GET' && match(url, /\/communication\/scheduled-status/)) {
    return _scheduledStatus;
  }

  if (method === 'POST' && path(url) === '/communication/scheduled-status') {
    const s = { id: 'sched-' + uid(), ...body, status: 'PENDING', created_at: new Date().toISOString() };
    _scheduledStatus.push(s);
    toastSimulated('📅 Status agendado com sucesso!');
    return s;
  }

  if (method === 'DELETE' && match(url, /\/communication\/scheduled-status\/([^/]+)$/)) {
    const id = url.split('/').pop()!;
    const idx = _scheduledStatus.findIndex((s) => s.id === id);
    if (idx >= 0) _scheduledStatus.splice(idx, 1);
    return { success: true };
  }

  if (method === 'GET' && match(url, /\/communication\/coupons/)) {
    return [];
  }

  if (method === 'POST' && match(url, /\/communication\/coupons/)) {
    return { id: 'coupon-' + uid(), ...body };
  }

  if (method === 'GET' && match(url, /\/communication\/referral-bonus/)) {
    return { value: '50', currency: 'BRL' };
  }

  if (method === 'PUT' && match(url, /\/communication\/referral-bonus/)) {
    return { success: true };
  }

  if (method === 'POST' && match(url, /\/whatsapp\/post-now\//)) {
    toastSimulated('📸 Status postado no WhatsApp (simulado)!');
    return { success: true };
  }

  // ── FINANCE SECURITY MAPS ─────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/finance\/risk-logs/)) {
    return [
      { id: 'risk-1', event: 'LOGIN_SUCCESS', user_id: 'demo-client-001', ip: '192.168.1.100', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', platform: 'Windows', screen_resolution: '1920x1080', latitude: null, longitude: null, action: 'LOGIN', risk_score: 10, risk_factors: [], created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 'risk-2', event: 'BIOMETRIC_SKIPPED', user_id: 'demo-client-001', ip: '192.168.1.100', user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', platform: 'Windows', screen_resolution: '1920x1080', latitude: null, longitude: null, action: 'BIOMETRIC_SKIPPED_DESKTOP', risk_score: 25, risk_factors: ['desktop_skip'], created_at: new Date(Date.now() - 7200000).toISOString() },
    ];
  }

  if (method === 'GET' && match(url, /\/finance\/biometrics/)) {
    return {};
  }

  if (method === 'GET' && match(url, /\/finance\/customers-map/)) {
    return {};
  }

  if (method === 'GET' && match(url, /\/finance\/requests-map/)) {
    return {};
  }

  // ── ANTIFRAUD ──────────────────────────────────────────────────────────────────

  if (match(url, /\/antifraud\//)) {
    if (method === 'GET') return [];
    return { success: true };
  }

  // ── WHATSAPP CONFIG ────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /\/whatsapp\/config/)) {
    return { apiUrl: '', apiKey: '', instanceName: 'demo', isConnected: true, phone: '5511999999999' };
  }

  // ── CATCH-ALL POST/PUT/DELETE → success ──────────────────────────────────────

  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    return { success: true };
  }

  // ── CATCH-ALL GET → empty array (evita crash em .map() ou .length) ────────────

  if (method === 'GET') {
    console.warn('[DEMO Mock] Rota GET não mapeada, retornando []:', url);
    return [];
  }

  console.warn('[DEMO Mock] Rota não mapeada:', method, url);
  return null;
}

// ─── Classe MockApiClient ──────────────────────────────────────────────────────

class MockApiClient {
  async get<T>(url: string): Promise<{ data: T | null; error: any }> {
    try {
      const data = await handleRequest('GET', url);
      return { data: data as T, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  async post<T>(url: string, body?: any): Promise<{ data: T | null; error: any }> {
    try {
      const data = await handleRequest('POST', url, body);
      return { data: data as T, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  async put<T>(url: string, body?: any): Promise<{ data: T | null; error: any }> {
    try {
      const data = await handleRequest('PUT', url, body);
      return { data: data as T, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  async patch<T>(url: string, body?: any): Promise<{ data: T | null; error: any }> {
    try {
      const data = await handleRequest('PATCH', url, body);
      return { data: data as T, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  async delete<T>(url: string, config?: any): Promise<{ data: T | null; error: any }> {
    try {
      const body = config?.data;
      const data = await handleRequest('DELETE', url, body);
      return { data: data as T, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  /** Upload simulado com progress bar */
  async upload(file: File | Blob, filename?: string): Promise<{ data: any; error: any }> {
    return this.simulateUpload(file, filename);
  }

  async uploadBase64(base64: string, filename?: string): Promise<{ data: any; error: any }> {
    await delay(600);
    return { data: { url: base64, path: 'demo-base64' }, error: null };
  }

  private async simulateUpload(file: File | Blob, filename?: string): Promise<{ data: any; error: any }> {
    await delay(1200);
    if (file instanceof File && file.type.startsWith('image/') && file.size < 2_000_000) {
      const base64 = await fileToBase64(file);
      return { data: { url: base64, path: filename || file.name }, error: null };
    }
    const url = `https://demo-storage.tubarao.app/${Date.now()}-${filename || 'arquivo'}`;
    return { data: { url, path: filename || 'demo-file' }, error: null };
  }

  setSession(_accessToken: string, _refreshToken: string) {}

  clearSession() {
    localStorage.removeItem('tubarao_auth');
    localStorage.removeItem('tubarao_user');
    useAuthStore.getState().logout();
  }

  get auth() {
    return {
      signIn: async (creds: any) => {
        const { data, error } = await this.post('/auth/login', creds);
        return { data, error };
      },
      signUp: async (creds: any) => this.post('/auth/register', creds),
      signOut: async () => {
        this.clearSession();
        return { error: null };
      },
      resetPassword: async (email: string) => this.post('/auth/forgot-password', { email }),
      updateUser: async (data: any) => this.put('/auth/me', data),
      getSession: () => {
        const auth = localStorage.getItem('tubarao_auth');
        if (!auth) return { access_token: null, refresh_token: null };
        const { accessToken, refreshToken } = JSON.parse(auth);
        return { access_token: accessToken, refresh_token: refreshToken };
      },
      getUser: async () => this.get('/auth/me'),
    };
  }
}

// ─── Helper: File → Base64 ────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const api = new MockApiClient();

console.log('[DEMO] MockApiClient v2 carregado — ~200 rotas cobertas, zero chamadas HTTP reais');
