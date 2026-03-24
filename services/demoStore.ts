/**
 * demoStore.ts — Zustand Stores para Modo DEMO
 *
 * 4 stores com persist (localStorage) que substituem o PostgreSQL/Prisma
 * na versão demo da plataforma. Relações mantidas por ID referencial.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DemoLoanRequest {
  id: string;
  clientName: string;
  cpf: string;
  phone: string;
  email: string;
  amount: number;
  approvedAmount?: number;
  interestRate?: number;
  installments?: number;
  profileType: 'CLT' | 'AUTONOMO' | 'MOTO' | 'GARANTIA' | 'LIMPA_NOME' | 'INVESTIDOR';
  status: 'PENDING' | 'WAITING_DOCS' | 'PENDING_ACCEPTANCE' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'PAUSED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  adminNotes?: string;
  pixReceiptUrl?: string;
  supplementalDocRequest?: string;
  // Dados do formulário (Wizard)
  address?: string;
  city?: string;
  state?: string;
  occupation?: string;
  bankName?: string;
  pixKey?: string;
  // Documentos (URLs fake ou base64)
  selfie?: string;
  idCardFront?: string[];
  idCardBack?: string[];
  proofAddress?: string[];
  proofIncome?: string[];
  // Campos de ativação
  dailyInstallmentAmount?: number;
  totalInstallments?: number;
  firstPaymentDate?: string;
  paymentFrequency?: string;
  activatedAt?: string;
  userId?: string;
  customerId?: string;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'CLIENT';
  cpf?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface DemoCourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: DemoCourseLesson[];
}

export interface DemoCourseLesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  videoUrl?: string;
  duration: number; // minutos
  order: number;
  type: 'video' | 'pdf' | 'quiz';
}

// ─── Store 1: LoanRequests ────────────────────────────────────────────────────

interface RequestsState {
  requests: DemoLoanRequest[];
  addRequest: (req: DemoLoanRequest) => void;
  updateRequest: (id: string, changes: Partial<DemoLoanRequest>) => void;
  deleteRequest: (id: string) => void;
  resetRequests: () => void;
}

export const useRequestsStore = create<RequestsState>()(
  persist(
    (set) => ({
      requests: [],
      addRequest: (req) =>
        set((s) => ({ requests: [req, ...s.requests] })),
      updateRequest: (id, changes) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, ...changes, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deleteRequest: (id) =>
        set((s) => ({ requests: s.requests.filter((r) => r.id !== id) })),
      resetRequests: () => set({ requests: [] }),
    }),
    { name: 'demo-requests' }
  )
);

// ─── Store 2: Auth ────────────────────────────────────────────────────────────

interface AuthState {
  user: DemoUser | null;
  token: string | null;
  login: (user: DemoUser, token: string) => void;
  logout: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      reset: () => set({ user: null, token: null }),
    }),
    { name: 'demo-auth' }
  )
);

// ─── Store 3: Settings ────────────────────────────────────────────────────────

const DEFAULT_BRAND = {
  systemName: 'TUBARÃO EMPRÉSTIMO',
  logoUrl: null as string | null,
  primaryColor: '#FF0000',
  secondaryColor: '#D4AF37',
  backgroundColor: '#000000',
  companyName: 'Tubarão Empréstimos LTDA',
  cnpj: '12.345.678/0001-99',
  address: 'Av. Paulista, 1000 - São Paulo, SP',
  phone: '(11) 99999-9999',
};

const DEFAULT_PACKAGES = [
  { id: 'pkg-1', name: 'Empréstimo Pessoal', minAmount: 500, maxAmount: 15000, minInstallments: 2, maxInstallments: 12, interestRate: 8.5, active: true },
  { id: 'pkg-2', name: 'Empréstimo com Garantia', minAmount: 1000, maxAmount: 50000, minInstallments: 3, maxInstallments: 24, interestRate: 3.9, active: true },
  { id: 'pkg-3', name: 'Empréstimo CLT', minAmount: 300, maxAmount: 10000, minInstallments: 2, maxInstallments: 10, interestRate: 6.5, active: true },
];

const DEFAULT_SETTINGS = {
  adminEmail: 'admin@tubarao.com',
  adminPhone: '5511999999999',
  maxLoanNoGuarantee: 5000,
  requireVideoSelfie: true,
  requireVideoHouse: true,
  pix_key: 'financeiro@tubarao.com',
  pix_type: 'email',
  pix_account_name: 'Tubarão Empréstimos LTDA',
};

interface SettingsState {
  brand: typeof DEFAULT_BRAND;
  packages: typeof DEFAULT_PACKAGES;
  settings: typeof DEFAULT_SETTINGS;
  updateBrand: (b: Partial<typeof DEFAULT_BRAND>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      brand: DEFAULT_BRAND,
      packages: DEFAULT_PACKAGES,
      settings: DEFAULT_SETTINGS,
      updateBrand: (b) =>
        set((s) => ({ brand: { ...s.brand, ...b } })),
      resetSettings: () =>
        set({ brand: DEFAULT_BRAND, packages: DEFAULT_PACKAGES, settings: DEFAULT_SETTINGS }),
    }),
    { name: 'demo-settings' }
  )
);

// ─── Store 4: Curso (Método Tubarão) ─────────────────────────────────────────

interface CourseState {
  modules: DemoCourseModule[];
  progress: Record<string, number>; // lessonId → 0-100
  setModules: (modules: DemoCourseModule[]) => void;
  setProgress: (lessonId: string, pct: number) => void;
  resetCourse: () => void;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set) => ({
      modules: [],
      progress: {},
      setModules: (modules) => set({ modules }),
      setProgress: (lessonId, pct) =>
        set((s) => ({ progress: { ...s.progress, [lessonId]: pct } })),
      resetCourse: () => set({ modules: [], progress: {} }),
    }),
    { name: 'demo-course' }
  )
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reseta TODOS os stores demo de uma vez */
export function resetAllDemoStores() {
  useRequestsStore.getState().resetRequests();
  useAuthStore.getState().reset();
  useSettingsStore.getState().resetSettings();
  useCourseStore.getState().resetCourse();

  // Limpa chaves demo-* do localStorage
  Object.keys(localStorage)
    .filter((k) => k.startsWith('demo-'))
    .forEach((k) => localStorage.removeItem(k));
}
