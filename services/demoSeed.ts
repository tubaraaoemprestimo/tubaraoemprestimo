/**
 * demoSeed.ts — Dados Fictícios Realistas para a DEMO
 *
 * Popula os stores Zustand com dados pré-fabricados que fazem a plataforma
 * parecer em uso real para apresentações comerciais.
 * Idempotente: não re-semeia se já tiver dados.
 */

import { useRequestsStore, useCourseStore, DemoLoanRequest, DemoCourseModule } from './demoStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function subHours(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function subDays(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

// CPF fictício formatado (não válido, apenas visual)
const CPFs = [
  '123.456.789-01', '234.567.890-12', '345.678.901-23',
  '456.789.012-34', '567.890.123-45', '678.901.234-56',
  '789.012.345-67', '890.123.456-78',
];

// ─── Solicitações (8 registros diversificados) ───────────────────────────────

const SEED_REQUESTS: DemoLoanRequest[] = [
  // ── PENDING (novas aguardando análise) ─────────────────────────────────────
  {
    id: 'demo-req-001',
    clientName: 'Carlos Eduardo Mendes',
    cpf: CPFs[0],
    phone: '5511987654321',
    email: 'carlos.mendes@gmail.com',
    amount: 5000,
    installments: 6,
    profileType: 'CLT',
    status: 'PENDING',
    occupation: 'Auxiliar Administrativo',
    address: 'Rua das Flores, 123 - São Paulo, SP',
    city: 'São Paulo',
    state: 'SP',
    bankName: 'Nubank',
    pixKey: 'carlos.mendes@gmail.com',
    createdAt: subHours(2),
    updatedAt: subHours(2),
  },
  {
    id: 'demo-req-002',
    clientName: 'Fernanda Rocha Lima',
    cpf: CPFs[1],
    phone: '5521976543210',
    email: 'fernanda.lima@hotmail.com',
    amount: 8000,
    installments: 10,
    profileType: 'AUTONOMO',
    status: 'PENDING',
    occupation: 'Comerciante',
    address: 'Av. Brasil, 456 - Rio de Janeiro, RJ',
    city: 'Rio de Janeiro',
    state: 'RJ',
    bankName: 'Itaú',
    pixKey: '21976543210',
    createdAt: subHours(5),
    updatedAt: subHours(5),
  },
  {
    id: 'demo-req-003',
    clientName: 'Marcos Vinicius Souza',
    cpf: CPFs[2],
    phone: '5531965432109',
    email: 'marcos.v.souza@outlook.com',
    amount: 3500,
    installments: 4,
    profileType: 'CLT',
    status: 'PENDING',
    occupation: 'Vendedor',
    address: 'Rua Pernambuco, 789 - Belo Horizonte, MG',
    city: 'Belo Horizonte',
    state: 'MG',
    bankName: 'Bradesco',
    pixKey: '01234567890',
    createdAt: subHours(8),
    updatedAt: subHours(8),
  },

  // ── WAITING_DOCS (aguardando documentos) ───────────────────────────────────
  {
    id: 'demo-req-004',
    clientName: 'Juliana Ferreira Barbosa',
    cpf: CPFs[3],
    phone: '5541954321098',
    email: 'juliana.barbosa@gmail.com',
    amount: 12000,
    installments: 12,
    profileType: 'GARANTIA',
    status: 'WAITING_DOCS',
    supplementalDocRequest: 'Por favor, envie o CRLV do veículo dado como garantia e fotos do interior do carro.',
    occupation: 'Empresária',
    address: 'Rua XV de Novembro, 321 - Curitiba, PR',
    city: 'Curitiba',
    state: 'PR',
    bankName: 'Banco do Brasil',
    pixKey: 'juliana@empresa.com',
    createdAt: subDays(1),
    updatedAt: subHours(3),
  },
  {
    id: 'demo-req-005',
    clientName: 'Roberto Alves Pereira',
    cpf: CPFs[4],
    phone: '5511943210987',
    email: 'roberto.pereira@yahoo.com.br',
    amount: 6500,
    installments: 8,
    profileType: 'AUTONOMO',
    status: 'WAITING_DOCS',
    supplementalDocRequest: 'Precisamos de comprovante de renda dos últimos 3 meses (extrato bancário).',
    occupation: 'Eletricista',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    city: 'São Paulo',
    state: 'SP',
    bankName: 'Inter',
    pixKey: '11943210987',
    createdAt: subDays(2),
    updatedAt: subHours(6),
  },

  // ── APPROVED (aguardando ativação) ─────────────────────────────────────────
  {
    id: 'demo-req-006',
    clientName: 'Aline Costa Rodrigues',
    cpf: CPFs[5],
    phone: '5521932109876',
    email: 'aline.rodrigues@gmail.com',
    amount: 4000,
    approvedAmount: 3500,
    interestRate: 7.5,
    installments: 6,
    profileType: 'CLT',
    status: 'APPROVED',
    occupation: 'Professora',
    address: 'Rua Visconde de Pirajá, 550 - Rio de Janeiro, RJ',
    city: 'Rio de Janeiro',
    state: 'RJ',
    bankName: 'Caixa Econômica',
    pixKey: '21932109876',
    createdAt: subDays(3),
    updatedAt: subDays(1),
    adminNotes: 'Documentação verificada. Aprovado com valor ajustado. Aguardando envio do PIX.',
  },

  // ── ACTIVE (contrato ativo) ────────────────────────────────────────────────
  {
    id: 'demo-req-007',
    clientName: 'Pedro Henrique Martins',
    cpf: CPFs[6],
    phone: '5541921098765',
    email: 'pedro.martins@hotmail.com',
    amount: 9000,
    approvedAmount: 9000,
    interestRate: 6.0,
    installments: 10,
    dailyInstallmentAmount: 180,
    totalInstallments: 10,
    firstPaymentDate: subDays(15),
    paymentFrequency: 'monthly',
    profileType: 'CLT',
    status: 'ACTIVE',
    occupation: 'Engenheiro Civil',
    address: 'Rua Marechal Deodoro, 200 - Curitiba, PR',
    city: 'Curitiba',
    state: 'PR',
    bankName: 'Sicoob',
    pixKey: '41921098765',
    pixReceiptUrl: 'https://demo-storage.tubarao.app/comprovante-pix-demo.jpg',
    activatedAt: subDays(15),
    createdAt: subDays(20),
    updatedAt: subDays(15),
    adminNotes: 'Contrato ativo. 2 parcelas pagas, 8 restantes.',
  },

  // ── REJECTED ───────────────────────────────────────────────────────────────
  {
    id: 'demo-req-008',
    clientName: 'Silvia Teixeira Gomes',
    cpf: CPFs[7],
    phone: '5511910987654',
    email: 'silvia.gomes@gmail.com',
    amount: 15000,
    installments: 12,
    profileType: 'GARANTIA',
    status: 'REJECTED',
    occupation: 'Autônoma',
    address: 'Rua Augusta, 888 - São Paulo, SP',
    city: 'São Paulo',
    state: 'SP',
    bankName: 'Santander',
    pixKey: 'silvia.gomes@gmail.com',
    createdAt: subDays(5),
    updatedAt: subDays(4),
    adminNotes: 'Reprovado: documentação da garantia incompleta e score de crédito abaixo do mínimo.',
  },
];

// ─── Módulos do Método Tubarão ────────────────────────────────────────────────

const SEED_MODULES: DemoCourseModule[] = [
  {
    id: 'mod-1',
    title: 'Fundamentos do Crédito',
    description: 'Aprenda os conceitos básicos do mercado de crédito e como estruturar uma financeira do zero.',
    order: 1,
    lessons: [
      {
        id: 'les-1-1',
        moduleId: 'mod-1',
        title: 'Introdução ao Mercado de Crédito',
        description: 'Visão geral do mercado de crédito no Brasil e as oportunidades para financeiras independentes.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 18,
        order: 1,
        type: 'video',
      },
      {
        id: 'les-1-2',
        moduleId: 'mod-1',
        title: 'Tipos de Empréstimo e Perfis de Cliente',
        description: 'CLT, Autônomo, Garantia — como identificar o produto certo para cada perfil.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 24,
        order: 2,
        type: 'video',
      },
      {
        id: 'les-1-3',
        moduleId: 'mod-1',
        title: 'Regulamentação e Compliance',
        description: 'O que você precisa saber sobre as regulamentações do Banco Central para operar com crédito.',
        duration: 12,
        order: 3,
        type: 'pdf',
      },
    ],
  },
  {
    id: 'mod-2',
    title: 'Análise de Risco e Aprovação',
    description: 'Técnicas avançadas de análise de risco para aprovar com segurança e minimizar inadimplência.',
    order: 2,
    lessons: [
      {
        id: 'les-2-1',
        moduleId: 'mod-2',
        title: 'Como Analisar um CPF em 5 Minutos',
        description: 'Protocolo de análise: score, histórico, comprometimento de renda.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 31,
        order: 1,
        type: 'video',
      },
      {
        id: 'les-2-2',
        moduleId: 'mod-2',
        title: 'Sinais de Alerta de Fraude',
        description: 'Os 10 principais sinais de fraude documental e como identificá-los.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 27,
        order: 2,
        type: 'video',
      },
      {
        id: 'les-2-3',
        moduleId: 'mod-2',
        title: 'Avaliação de Garantias',
        description: 'Como precificar e avaliar bens como garantia: veículos, eletrônicos e imóveis.',
        duration: 20,
        order: 3,
        type: 'video',
      },
      {
        id: 'les-2-4',
        moduleId: 'mod-2',
        title: 'Quiz — Análise de Risco',
        description: 'Teste seus conhecimentos sobre análise de crédito e risco.',
        duration: 10,
        order: 4,
        type: 'quiz',
      },
    ],
  },
  {
    id: 'mod-3',
    title: 'Captação de Clientes e Escala',
    description: 'Estratégias digitais e presenciais para atrair, converter e fidelizar clientes de crédito.',
    order: 3,
    lessons: [
      {
        id: 'les-3-1',
        moduleId: 'mod-3',
        title: 'Funil de Vendas para Financeiras',
        description: 'Como estruturar um funil digital completo: anúncio → simulação → aprovação.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 35,
        order: 1,
        type: 'video',
      },
      {
        id: 'les-3-2',
        moduleId: 'mod-3',
        title: 'WhatsApp como Canal de Vendas',
        description: 'Scripts e automações para WhatsApp que convertem leads em clientes aprovados.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 22,
        order: 2,
        type: 'video',
      },
      {
        id: 'les-3-3',
        moduleId: 'mod-3',
        title: 'Fidelização e Carteira de Clientes',
        description: 'Como criar uma carteira de clientes recorrentes e aumentar o LTV.',
        duration: 19,
        order: 3,
        type: 'video',
      },
    ],
  },
];

// ─── Função Principal de Seed ─────────────────────────────────────────────────

/**
 * Semeia os dados ficticios nos stores.
 * Idempotente: não executa se já houver dados nas requests.
 */
export function seedDemoData(): void {
  const { requests, addRequest } = useRequestsStore.getState();

  // Já tem dados — não re-semeia
  if (requests.length > 0) return;

  // Injetar solicitações
  // Invertido para que o mais recente (índice 0) fique no topo
  [...SEED_REQUESTS].reverse().forEach(addRequest);

  // Injetar módulos do curso
  useCourseStore.getState().setModules(SEED_MODULES);

  console.log('[DEMO] Seed executado com sucesso:', SEED_REQUESTS.length, 'solicitações,', SEED_MODULES.length, 'módulos');
}

/**
 * Forçar re-seed (usado pelo Reset Demo)
 */
export function forceSeedDemoData(): void {
  useRequestsStore.getState().resetRequests();
  useCourseStore.getState().resetCourse();

  [...SEED_REQUESTS].reverse().forEach(useRequestsStore.getState().addRequest);
  useCourseStore.getState().setModules(SEED_MODULES);

  console.log('[DEMO] Re-seed forçado com sucesso');
}

// ─── Dados de Dashboard (calculados a partir das requests + histórico fixo) ──

export const DEMO_DASHBOARD_SEED = {
  // Métricas do mês atual
  monthlyLent: 50000,
  monthlyClients: 8,
  activeContracts: 1,
  approvalRate: 85,
  totalLent: 127000,
  totalClients: 23,

  // Gráfico histórico (6 meses, crescimento ~15% ao mês)
  monthlyChart: [
    { month: 'Out', value: 21000 },
    { month: 'Nov', value: 26000 },
    { month: 'Dez', value: 30000 },
    { month: 'Jan', value: 35000 },
    { month: 'Fev', value: 43000 },
    { month: 'Mar', value: 50000 },
  ],

  // Feed de atividade recente
  recentActivity: [
    { type: 'APPROVED', client: 'Aline Costa', amount: 3500, time: subDays(1) },
    { type: 'ACTIVE', client: 'Pedro Henrique', amount: 9000, time: subDays(15) },
    { type: 'NEW', client: 'Carlos Eduardo', amount: 5000, time: subHours(2) },
    { type: 'WAITING_DOCS', client: 'Juliana Ferreira', amount: 12000, time: subHours(3) },
    { type: 'REJECTED', client: 'Silvia Teixeira', amount: 15000, time: subDays(4) },
  ],
};
