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

const DELAY_MS = 800;

function delay(ms = DELAY_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

/** Toast simulado — dispara toast global sem depender de contexto React */
function toastSimulated(msg: string): void {
  // Despacha evento customizado que o componente Toast escuta
  window.dispatchEvent(new CustomEvent('demo-toast', { detail: { message: msg, type: 'success' } }));
}

/** Extrai ID de uma URL como /loan-requests/abc123/approve */
function extractId(url: string, after: string): string | null {
  const parts = url.split('/');
  const idx = parts.indexOf(after.replace('/', ''));
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
}

/** Match regex helper */
function match(url: string, pattern: RegExp): RegExpMatchArray | null {
  return url.match(pattern);
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function handleRequest(method: string, url: string, body?: any): Promise<any> {
  await delay();

  const store = useRequestsStore.getState;
  const auth = useAuthStore.getState;
  const settings = useSettingsStore.getState;
  const course = useCourseStore.getState;

  // ── AUTH ──────────────────────────────────────────────────────────────────

  if (method === 'POST' && url === '/auth/login') {
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
    // Salva no localStorage no formato esperado pelo apiService
    localStorage.setItem('tubarao_user', JSON.stringify(user));
    localStorage.setItem('tubarao_auth', JSON.stringify({ accessToken: token, refreshToken: token }));
    return { user, accessToken: token, refreshToken: token };
  }

  if (method === 'GET' && url === '/auth/me') {
    const user = auth().user;
    if (!user) return null;
    return user;
  }

  if (method === 'POST' && url === '/auth/forgot-password') {
    return { success: true };
  }

  if (method === 'PUT' && url === '/auth/update-password') {
    return { success: true };
  }

  if (method === 'PUT' && url === '/auth/me') {
    return { ...auth().user, ...body };
  }

  // ── LOAN REQUESTS — Lista ─────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/loan-requests(\?.*)?$/)) {
    const requests = store().requests;
    // Formatar datas e campos esperados pelo Requests.tsx
    return requests.map((r) => ({
      ...r,
      // Campos adicionais que o admin espera
      clientPhone: r.phone,
      clientEmail: r.email,
      clientCpf: r.cpf,
      requestedAmount: r.amount,
      interestRate: r.interestRate ?? 8.5,
      pendingAcceptance: r.status === 'PENDING_ACCEPTANCE',
    }));
  }

  // ── LOAN REQUESTS — Criar (Cliente envia solicitação) ────────────────────

  if (method === 'POST' && url === '/loan-requests') {
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

  // ── LOAN REQUESTS — Aprovar ───────────────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/approve$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'APPROVED' });
    toastSimulated('✅ Cliente notificado via WhatsApp: Empréstimo aprovado!');
    return { success: true };
  }

  // ── LOAN REQUESTS — Aprovar com Contraproposta ────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/approve-counteroffer$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, {
      status: 'PENDING_ACCEPTANCE',
      approvedAmount: body?.approvedAmount,
      interestRate: body?.interestRate,
    });
    toastSimulated('📱 Contraproposta enviada ao cliente via WhatsApp!');
    return { success: true };
  }

  // ── LOAN REQUESTS — Aceitar Contraproposta (cliente) ─────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/accept-counteroffer$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'APPROVED' });
    toastSimulated('🎉 Admin notificado: cliente aceitou a contraproposta!');
    return { success: true };
  }

  // ── LOAN REQUESTS — Rejeitar ──────────────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/reject$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'REJECTED', adminNotes: body?.reason || 'Reprovado pelo admin.' });
    toastSimulated('📱 Cliente notificado: solicitação não aprovada.');
    return { success: true };
  }

  // ── LOAN REQUESTS — Ativar Contrato ──────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/activate-contract$/)) {
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

  // ── LOAN REQUESTS — Solicitar Docs Adicionais ─────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/request-docs$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, {
      status: 'WAITING_DOCS',
      supplementalDocRequest: body?.description,
    });
    toastSimulated('📋 Cliente notificado: documentos adicionais solicitados via WhatsApp!');
    return { success: true };
  }

  // ── LOAN REQUESTS — Upload Doc Adicional (cliente) ───────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/upload-supplemental$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { status: 'PENDING' });
    toastSimulated('📁 Documentos recebidos! Admin notificado.');
    return { success: true };
  }

  // ── LOAN REQUESTS — Pausar ────────────────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/pause$/)) {
    const id = url.split('/')[2];
    const req = store().requests.find((r) => r.id === id);
    store().updateRequest(id, {
      status: 'PAUSED',
      adminNotes: `Pausado (anterior: ${req?.status}). ${body?.reason || ''}`,
    });
    return { success: true, previousStatus: req?.status };
  }

  // ── LOAN REQUESTS — Retomar ────────────────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/resume$/)) {
    const id = url.split('/')[2];
    const req = store().requests.find((r) => r.id === id);
    const prevMatch = req?.adminNotes?.match(/anterior: (\w+)/);
    const prev = prevMatch ? prevMatch[1] : 'PENDING';
    store().updateRequest(id, { status: prev as any });
    return { success: true };
  }

  // ── LOAN REQUESTS — Excluir ────────────────────────────────────────────────

  if (method === 'DELETE' && match(url, /^\/loan-requests\/([^/]+)$/)) {
    const id = url.split('/')[2];
    store().deleteRequest(id);
    toastSimulated('🗑️ Solicitação excluída. Cliente notificado.');
    return { success: true };
  }

  // ── LOAN REQUESTS — Atualizar Valores ────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/values$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, {
      amount: body?.amount,
      installments: body?.installments,
    });
    return { success: true };
  }

  // ── LOAN REQUESTS — Anexar PIX ────────────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/attach-pix-receipt$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { pixReceiptUrl: body?.pixReceiptUrl });
    return { success: true };
  }

  // ── LOAN REQUESTS — Atualizar PDF ─────────────────────────────────────────

  if (method === 'PUT' && match(url, /^\/loan-requests\/([^/]+)\/contract-pdf$/)) {
    const id = url.split('/')[2];
    store().updateRequest(id, { adminNotes: body?.contractPdfUrl });
    return { success: true };
  }

  // ── LOAN REQUESTS — Solicitação Pendente do Cliente ──────────────────────

  if (method === 'GET' && url === '/loan-requests/pending') {
    const user = auth().user;
    const pending = store().requests.find(
      (r) => r.email === user?.email && ['PENDING', 'WAITING_DOCS', 'PENDING_ACCEPTANCE', 'APPROVED'].includes(r.status)
    );
    return pending || null;
  }

  // ── LOAN REQUESTS — Última Solicitação do Cliente ─────────────────────────

  if (method === 'GET' && url === '/loan-requests/latest') {
    const user = auth().user;
    const req = store().requests.find((r) => r.email === user?.email);
    return req || null;
  }

  // ── ADMIN SUMMARY / DASHBOARD ─────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/admin\/summary|^\/admin\/today-summary/)) {
    return DEMO_DASHBOARD_SEED;
  }

  // ── BRAND SETTINGS ────────────────────────────────────────────────────────

  if (method === 'GET' && url === '/brand-settings') {
    return settings().brand;
  }

  if (method === 'PUT' && url === '/brand-settings') {
    settings().updateBrand(body);
    return { success: true };
  }

  if (method === 'DELETE' && url === '/brand-settings') {
    settings().resetSettings();
    return { success: true };
  }

  // ── SYSTEM SETTINGS ───────────────────────────────────────────────────────

  if (method === 'GET' && url === '/settings') {
    return settings().settings;
  }

  if (method === 'PUT' && url === '/settings') {
    return { success: true };
  }

  // ── PACKAGES ──────────────────────────────────────────────────────────────

  if (method === 'GET' && url === '/packages') {
    return settings().packages;
  }

  if (method === 'POST' && url === '/packages') {
    return { ...body, id: 'pkg-' + uid() };
  }

  if (method === 'DELETE' && match(url, /^\/packages\//)) {
    return { success: true };
  }

  // ── CURSO (Método Tubarão) ────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/course/)) {
    return { modules: course().modules };
  }

  if (method === 'PUT' && match(url, /^\/course\/progress\/(.+)$/)) {
    const lessonId = url.split('/').pop()!;
    course().setProgress(lessonId, body?.progress ?? 100);
    return { success: true };
  }

  // ── NOTIFICAÇÕES ──────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/notifications/)) {
    return [];
  }

  if (method === 'PUT' && match(url, /^\/notifications\/.+\/read$/)) {
    return { success: true };
  }

  // ── CLIENTES / CRM (leitura básica) ──────────────────────────────────────

  if (method === 'GET' && url === '/customers') {
    // Derivar clientes a partir das solicitações
    const requests = store().requests;
    const seen = new Set<string>();
    return requests
      .filter((r) => { const ok = !seen.has(r.email); seen.add(r.email); return ok; })
      .map((r) => ({
        id: r.customerId || r.id,
        name: r.clientName,
        email: r.email,
        phone: r.phone,
        cpf: r.cpf,
        status: r.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
        createdAt: r.createdAt,
      }));
  }

  // ── UPLOAD ────────────────────────────────────────────────────────────────

  if (method === 'POST' && match(url, /^\/upload/)) {
    // Para upload/base64: retorna a própria URL base64 se for imagem
    if (body?.base64) {
      return { url: body.base64, path: 'demo-base64' };
    }
    return { url: `https://demo-storage.tubarao.app/${Date.now()}-demo.jpg`, path: 'demo-file' };
  }

  // ── USUÁRIOS ──────────────────────────────────────────────────────────────

  if (method === 'GET' && url === '/users') {
    return [
      { id: 'demo-admin-001', name: 'Admin Demo', email: 'admin@demo.tubarao.com', role: 'ADMIN' },
    ];
  }

  if (method === 'POST' && match(url, /^\/users/)) {
    return { ...body, id: 'user-' + uid() };
  }

  // ── CONTRATOS ADMIN ───────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/admin\/loans/)) {
    return store().requests.filter((r) => r.status === 'ACTIVE').map((r) => ({
      ...r,
      principal: r.approvedAmount || r.amount,
      remaining: Math.round((r.approvedAmount || r.amount) * 0.7),
    }));
  }

  // ── TRANSAÇÕES / LOGS ────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/transactions|^\/interaction-logs|^\/audit/)) {
    return [];
  }

  // ── RELATÓRIOS ────────────────────────────────────────────────────────────

  if (method === 'GET' && match(url, /^\/financial-summary/)) {
    return DEMO_DASHBOARD_SEED;
  }

  // ── METAS ─────────────────────────────────────────────────────────────────

  if (method === 'GET' && url === '/goals') {
    return { monthlyLoanGoal: 80000, monthlyClientGoal: 20, monthlyApprovalRateGoal: 80 };
  }

  if (method === 'PUT' && url === '/goals') {
    return { success: true };
  }

  // ── BLACKLIST / PARCEIROS / REFERRALS (stubs) ─────────────────────────────

  if (method === 'GET' && match(url, /^\/blacklist|^\/partners|^\/referrals|^\/campaigns|^\/coupons|^\/collection-rules/)) {
    return [];
  }

  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return { success: true };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  console.warn('[DEMO Mock] Rota não mapeada:', method, url);
  return null;
}

// ─── Classe MockApiClient ─────────────────────────────────────────────────────

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
    return this.put<T>(url, body);
  }

  async delete<T>(url: string, config?: any): Promise<{ data: T | null; error: any }> {
    try {
      // Axios passa body via config.data no delete
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
    // Preview real para imagens pequenas
    if (file instanceof File && file.type.startsWith('image/') && file.size < 2_000_000) {
      const base64 = await fileToBase64(file);
      return { data: { url: base64, path: filename || file.name }, error: null };
    }
    const url = `https://demo-storage.tubarao.app/${Date.now()}-${filename || 'arquivo'}`;
    return { data: { url, path: filename || 'demo-file' }, error: null };
  }

  /** Compatibilidade com a session atual */
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

// ─── Helper: File → Base64 ───────────────────────────────────────────────────

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
