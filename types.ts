

export enum UserRole {
  CLIENT = 'CLIENT',
  ADMIN = 'ADMIN'
}

export enum LoanStatus {
  PENDING = 'PENDING',
  WAITING_DOCS = 'WAITING_DOCS', // New Status
  RETURNING_PENDING = 'RETURNING_PENDING', // Cliente antigo aguardando aprovação
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  DEFAULTED = 'DEFAULTED'
}

export interface UserAccess {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  createdAt: string;
}

export interface LoanPackage {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  minInstallments: number;
  maxInstallments: number;
  interestRate: number;
}

export interface LoanRequest {
  id: string;
  clientName: string;
  cpf: string;
  email: string;
  phone: string;
  amount: number;
  installments: number;
  status: LoanStatus;
  date: string;

  // Tipo de Perfil/Serviço - Multi Sistema
  profileType?: 'CLT' | 'AUTONOMO' | 'MOTO' | 'GARANTIA' | 'LIMPA_NOME' | 'GARANTIA_VEICULO' | 'INVESTIDOR' | 'LOCACAO';

  // Campos GARANTIA
  guaranteeType?: 'veiculo' | 'eletronico';
  guaranteeSubtype?: string;
  guaranteeDescription?: string;
  guaranteeEstimatedValue?: number;
  guaranteePhotos?: string[];
  guaranteeVideo?: string;
  guaranteeDocument?: string;
  guaranteeInPossession?: boolean;

  // Campos LIMPA_NOME
  limpaNomeContractSigned?: boolean;
  limpaNomeContractDate?: string;

  // Campos MOTO
  motoEntryPaid?: boolean;
  motoModel?: string;

  // Campos AUTONOMO
  autonomoCnpj?: string;
  autonomoBusinessAddress?: string;

  // Localização GPS
  locationLatitude?: number;
  locationLongitude?: number;
  locationCapturedAt?: string;

  // New References
  references: {
    fatherPhone: string;
    motherPhone: string;
    spousePhone: string;
  };

  documents: {
    selfieUrl?: string;
    idCardUrl?: string | string[];
    idCardBackUrl?: string | string[];
    proofOfAddressUrl?: string | string[];
    proofIncomeUrl?: string | string[];
    vehicleUrl?: string | string[];

    // New Videos
    videoSelfieUrl?: string;
    videoHouseUrl?: string;
    videoVehicleUrl?: string;
  };

  // Supplemental Document Request
  supplementalInfo?: {
    requestedAt?: string;
    description?: string; // What the admin asked for
    docUrl?: string; // What the client uploaded
    uploadedAt?: string;
  };

  signatureUrl?: string;
  supplementalDescription?: string;
  contractPdfUrl?: string;
}

export interface DashboardStats {
  totalLent: number;
  activeLoans: number;
  defaultRate: number;
  revenue: number;
}

export interface SystemSettings {
  monthlyInterestRate: number;
  lateFeeRate: number;

  // Juros de atraso - com tipo (% ou R$)
  lateInterestDaily?: number;       // Valor
  lateInterestDailyType?: 'PERCENT' | 'FIXED';  // Tipo: % ou R$

  lateInterestMonthly?: number;     // Valor
  lateInterestMonthlyType?: 'PERCENT' | 'FIXED'; // Tipo: % ou R$

  lateInterestYearly?: number;      // Valor
  lateInterestYearlyType?: 'PERCENT' | 'FIXED';  // Tipo: % ou R$

  lateFixedFee?: number;            // Multa fixa - Valor
  lateFixedFeeType?: 'PERCENT' | 'FIXED'; // Tipo: % ou R$ (antes era só R$)

  // PIX
  pixKey?: string;
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
  pixReceiverName?: string;
}

// --- BRANDING / WHITE LABEL ---
export interface BrandSettings {
  systemName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;

  // Company Info
  companyName: string;
  cnpj: string;
  address: string;
  phone: string;
}

export interface Customer {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'BLOCKED';
  internalScore: number;
  totalDebt: number;
  activeLoansCount: number;
  joinedAt: string;

  // Geolocation fields
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;

  // Monthly income for credit analysis
  monthlyIncome?: number;

  // New Pre-approval field
  preApprovedOffer?: {
    amount: number;
    createdAt: string;
  };

  // Taxas personalizadas do cliente (sobrescrevem as globais se definidas)
  customRates?: {
    monthlyInterestRate?: number;     // Taxa mensal de juros do empréstimo
    lateFixedFee?: number;            // Multa fixa por atraso
    lateInterestDaily?: number;       // Juros diário por atraso
    lateInterestMonthly?: number;     // Juros mensal por atraso
  };

  // Código de indicação único do cliente
  referralCode?: string;

  // Oferta de parcelamento enviada pelo admin
  installmentOffer?: {
    amount: number;
    installments: number;
    interest_rate?: number;
    interestRate?: number;
    installment_value?: number;
    installmentValue?: number;
    total_amount?: number;
    totalAmount?: number;
    expires_at?: string;
    created_at?: string;
  };
}

// ==================== NOTIFICATION TYPES ====================

export interface Notification {
  id: string;
  customerId: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  read: boolean;
  link?: string;
  createdAt: string;
}

// ==================== REFERRAL (INDIQUE E GANHE) TYPES ====================

export interface Referral {
  id: string;
  referrerCustomerId: string;
  referrerCode: string;
  referrerName?: string;
  referredCustomerId?: string;
  referredName: string;
  referredCpf: string;
  referredPhone: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'BONUS_PAID';
  rejectionReason?: string;
  bonusAmount: number;
  bonusPaidAt?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

// ==================== PAYMENT RECEIPT TYPES ====================

export interface PaymentReceipt {
  id: string;
  installmentId: string;
  loanId: string;
  customerId: string;
  customerName: string;
  amount: number;
  receiptUrl: string;
  receiptType: 'IMAGE' | 'PDF';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

// ==================== GEOLOCATION TYPES ====================

export interface GeoCluster {
  id: string;
  neighborhood: string;
  city: string;
  center: { lat: number; lng: number };
  customerCount: number;
  defaultRate: number; // % of defaulted customers in this cluster
  totalDebt: number;
  customers: Customer[];
}

export interface RouteStop {
  order: number;
  customer: Customer;
  distance: number; // km from previous stop
  estimatedTime: number; // minutes
}

export interface CollectionRoute {
  id: string;
  name: string;
  date: string;
  stops: RouteStop[];
  totalDistance: number;
  totalTime: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}

// ==================== OPEN FINANCE TYPES ====================

export interface CreditScore {
  id: string;
  customerId: string;
  score: number; // 0-1000
  classification: 'A' | 'B' | 'C' | 'D' | 'E';
  source: 'INTERNAL' | 'SERASA' | 'SPC';
  consultedAt: string;
  factors: {
    paymentHistory: number; // 0-100
    debtRatio: number; // 0-100
    creditAge: number; // 0-100
    recentInquiries: number; // 0-100
  };
  restrictions?: {
    hasRestriction: boolean;
    type?: string;
    value?: number;
    origin?: string;
  };
}

export interface IncomeAnalysis {
  id: string;
  customerId: string;
  analyzedAt: string;
  monthlyIncome: number;
  averageBalance: number;
  incomeSource: 'SALARY' | 'BUSINESS' | 'FREELANCE' | 'OTHER';
  stability: 'HIGH' | 'MEDIUM' | 'LOW';
  currentCommitment: number; // % of income already committed
  availableCommitment: number; // % available for new loans
  maxLoanAmount: number;
  recommendation: 'APPROVE' | 'REVIEW' | 'DENY';
}

export interface OpenFinanceConsent {
  id: string;
  customerId: string;
  grantedAt: string;
  expiresAt: string;
  scope: ('ACCOUNTS' | 'TRANSACTIONS' | 'CREDIT')[];
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

export type CollectionRuleType = 'WHATSAPP' | 'EMAIL' | 'SMS';

export interface CollectionRule {
  id: string;
  daysOffset: number;
  type: CollectionRuleType;
  messageTemplate: string;
  active: boolean;
}

export interface Installment {
  id: string;
  dueDate: string;
  amount: number;
  status: 'OPEN' | 'PAID' | 'LATE';
  pixCode?: string;
  proofUrl?: string;
  paidAt?: string;
}

export interface Loan {
  id: string;
  amount: number;
  installmentsCount: number;
  remainingAmount: number;
  status: LoanStatus;
  startDate: string;
  installments: Installment[];
}

export interface Transaction {
  id: string;
  type: 'IN' | 'OUT';
  description: string;
  amount: number;
  date: string;
  category: 'LOAN' | 'PAYMENT' | 'FEE';
}

export interface InteractionLog {
  id: string;
  userName: string;
  userRole: string;
  message: string;
  intent: 'PAYMENT_PROMISE' | 'REQUEST_BOLETO' | 'SUPPORT' | 'UNKNOWN';
  reply: string;
  timestamp: string;
}

export interface WhatsappConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  isConnected: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  link?: string;
  startDate: string;
  endDate: string;
  frequency: 'ONCE' | 'DAILY' | 'ALWAYS';
  active: boolean;
  priority: number; // Higher shows first
}

// --- GOALS & PROJECTIONS ---
export interface GoalsSettings {
  // Metas do mês atual
  monthlyLoanGoal: number;           // Meta de volume emprestado
  monthlyClientGoal: number;         // Meta de novos clientes
  monthlyApprovalRateGoal: number;   // Meta de taxa de aprovação (%)

  // Projeções anuais (por mês)
  projections: {
    month: string;   // Ex: "Jan", "Fev", etc
    target: number;  // Valor projetado
  }[];

  // Crescimento esperado
  expectedGrowthRate: number;  // % de crescimento mensal esperado

  // Período da meta
  goalPeriod: string;  // Ex: "12/2024"
}

// --- BLACKLIST ---
export interface BlacklistEntry {
  id: string;
  cpf: string;
  name: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  active: boolean;
}

// --- AUDIT LOG ---
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'SEND_MESSAGE';
  entity: string;  // Ex: 'LOAN_REQUEST', 'CUSTOMER', 'SETTINGS'
  entityId?: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

// --- USER PERMISSIONS ---
export type PermissionLevel = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export interface UserPermission {
  userId: string;
  level: PermissionLevel;
  permissions: {
    canApproveLoans: boolean;
    canRejectLoans: boolean;
    canViewReports: boolean;
    canExportData: boolean;
    canManageUsers: boolean;
    canManageSettings: boolean;
    canSendMessages: boolean;
    canViewCustomers: boolean;
    canEditCustomers: boolean;
    canViewFinancials: boolean;
  };
}

// --- CLIENT SCORE ---
export interface ClientScore {
  customerId: string;
  score: number;  // 0-1000
  level: 'EXCELLENT' | 'GOOD' | 'REGULAR' | 'BAD' | 'CRITICAL';
  factors: {
    paymentHistory: number;      // Histórico de pagamentos
    onTimePayments: number;      // Pagamentos em dia
    latePayments: number;        // Pagamentos atrasados
    averageDelayDays: number;    // Média de dias de atraso
    totalLoans: number;          // Total de empréstimos
    activeLoans: number;         // Empréstimos ativos
    defaultedLoans: number;      // Empréstimos inadimplentes
    relationshipMonths: number;  // Tempo de relacionamento
  };
  suggestedLimit: number;
  lastUpdate: string;
}

// --- RENEGOTIATION ---
export interface RenegotiationProposal {
  id: string;
  customerId: string;
  customerName: string;
  originalLoanId: string;
  originalAmount: number;
  remainingAmount: number;
  daysOverdue: number;
  proposal: {
    newAmount: number;
    discount: number;
    discountPercent: number;
    newInstallments: number;
    newInstallmentValue: number;
    interestRate: number;
  };
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

// --- MESSAGE TEMPLATES ---
export interface MessageTemplate {
  id: string;
  name: string;
  category: 'REMINDER' | 'COLLECTION' | 'WELCOME' | 'APPROVAL' | 'REJECTION' | 'PAYMENT' | 'CUSTOM';
  content: string;
  variables: string[];  // Ex: ['{nome}', '{valor}', '{vencimento}']
  isActive: boolean;
  createdAt: string;
}

// --- MASS MESSAGE ---
export interface MassMessage {
  id: string;
  templateId?: string;
  message: string;
  recipients: string[];  // Customer IDs
  sentCount: number;
  failedCount: number;
  status: 'PENDING' | 'SENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  completedAt?: string;
}

// --- CONVERSATION HISTORY ---
export interface ConversationMessage {
  id: string;
  customerId: string;
  direction: 'IN' | 'OUT';
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'APP';
  content: string;
  sentBy?: string;
  timestamp: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
}

// --- CONTRACT TEMPLATE ---
export interface ContractTemplate {
  id: string;
  name: string;
  content: string;  // HTML template
  variables: string[];
  isDefault: boolean;
  createdAt: string;
}

// --- RECEIPT ---
export interface Receipt {
  id: string;
  customerId: string;
  customerName: string;
  loanId: string;
  installmentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'PIX' | 'BOLETO' | 'CASH' | 'TRANSFER';
  generatedAt: string;
}

// --- DISCHARGE DECLARATION ---
export interface DischargeDeclaration {
  id: string;
  customerId: string;
  customerName: string;
  cpf: string;
  loanId: string;
  originalAmount: number;
  totalPaid: number;
  startDate: string;
  endDate: string;
  generatedAt: string;
}

// --- FINANCIAL SUMMARY ---
export interface FinancialSummary {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  loansDisbursed: number;
  paymentsReceived: number;
  defaultedAmount: number;
  cashFlow: {
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
  }[];
}

// --- CALENDAR EVENT ---
export interface CalendarEvent {
  id: string;
  type: 'INSTALLMENT' | 'LOAN_START' | 'LOAN_END' | 'REMINDER';
  title: string;
  date: string;
  customerId?: string;
  customerName?: string;
  amount?: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  loanId?: string;
}

export interface ReferralCode {
  id: string;
  userId: string;
  userName: string;
  code: string; // Ex: IND-JOAO-123
  createdAt: string;
  status: 'ACTIVE' | 'BLOCKED';
  usageCount: number;
}

export interface ReferralUsage {
  id: string;
  referralCode: string;
  referrerId: string; // Quem indicou
  referredId: string; // Quem usou o código (novo usuário)
  referredName: string;
  status: 'PENDING' | 'VALIDATED' | 'FRAUD_SUSPECTED' | 'REJECTED';
  rewardAmount: number;
  createdAt: string;
  validatedAt?: string;
  fraudReason?: string;
}

// ==================== INVESTOR TYPES ====================

export type InvestorStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type InvestorPayoutMode = 'MONTHLY' | 'ANNUAL';
export type InvestorTier = 'STANDARD' | 'PREMIUM';

export interface InvestorRequest {
  id: string;
  customerId?: string;

  // Dados pessoais
  fullName: string;
  cpfCnpj: string;
  rgCnh?: string;
  birthDate?: string;
  email: string;
  phone: string;

  // Endereço
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  // Dados bancários
  bankName?: string;
  pixKey?: string;
  pixKeyType?: string;
  accountHolderName?: string;

  // Investimento
  investmentAmount: number;
  investmentTier: InvestorTier;
  payoutMode: InvestorPayoutMode;
  monthlyRate: number;
  contractMonths: number;
  autoRenew: boolean;
  withdrawalNoticeMonths: number;

  // Aceite
  termsAccepted: boolean;
  termsAcceptedAt?: string;
  signatureUrl?: string;

  // Status
  status: InvestorStatus;
  adminNotes?: string;
  approvedAt?: string;

  // Documentos
  idCardUrl?: string;
  idCardBackUrl?: string;
  proofOfAddressUrl?: string;
  selfieUrl?: string;

  // Metadata
  profileType: 'INVESTIDOR';
  createdAt: string;
  updatedAt?: string;
}

// Taxas de remuneração do investidor
export const INVESTOR_RATES = {
  STANDARD: {
    min: 10000,
    max: 49999.99,
    MONTHLY: 2.5,   // 2,5% ao mês
    ANNUAL: 3.5,     // 3,5% ao mês (acumulado anual)
  },
  PREMIUM: {
    min: 50000,
    max: Infinity,
    MONTHLY: 5.0,   // 5% ao mês
    ANNUAL: 6.0,     // 6% ao mês (acumulado anual)
  },
} as const;

// ==================== FLEET RENTAL TYPES ====================

export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'VAN' | 'TRUCK';
export type VehicleStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'BLOCKED' | 'RETIRED';
export type RentalStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'CANCELLED';
export type RentalPaymentStatus = 'PENDING' | 'PAID' | 'LATE' | 'CANCELLED';
export type VideoCheckStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type MaintenanceTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export type FleetAlertType = 'NO_ACCESS' | 'NO_VIDEO' | 'LATE_PAYMENT' | 'LOCATION_CHANGE' | 'VEHICLE_BLOCKED';

export interface FleetVehicle {
    id: string;
    type: VehicleType;
    brand: string;
    model: string;
    year: number;
    licensePlate: string;
    color?: string;
    chassis?: string;
    renavam?: string;
    weeklyRate: number;
    depositAmount: number;
    mileage: number;
    fuelType?: string;
    status: VehicleStatus;
    photoUrls: string[];
    notes?: string;
    insurancePolicy?: string;
    insuranceExpiresAt?: string;
    nextInspectionAt?: string;
    blockable: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface FleetRental {
    id: string;
    vehicleId: string;
    customerId: string;
    contractNumber?: string;
    status: RentalStatus;
    startDate: string;
    endDate?: string;
    weeklyRate: number;
    depositAmount: number;
    depositPaid: boolean;
    lateFixedFee: number;
    lateDailyInterest: number;
    contractPdfUrl?: string;
    signatureUrl?: string;
    signedAt?: string;
    signIp?: string;
    signLatitude?: number;
    signLongitude?: number;
    termsAccepted: boolean;
    termsAcceptedAt?: string;
    adminNotes?: string;
    cancelledReason?: string;
    createdAt: string;
    updatedAt?: string;
    // Joined
    vehicle?: FleetVehicle;
    customerName?: string;
    customerCpf?: string;
    customerPhone?: string;
    customerEmail?: string;
}

export interface FleetWeeklyPayment {
    id: string;
    rentalId: string;
    customerId: string;
    weekNumber: number;
    periodStart: string;
    periodEnd: string;
    amount: number;
    lateFee: number;
    lateInterest: number;
    totalDue: number;
    status: RentalPaymentStatus;
    pixCode?: string;
    proofUrl?: string;
    paidAt?: string;
    confirmedBy?: string;
    confirmedAt?: string;
    dueDate: string;
    createdAt: string;
}

export interface FleetVideoCheck {
    id: string;
    rentalId: string;
    customerId: string;
    weekNumber: number;
    dueDate: string;
    videoExteriorUrl?: string;
    videoDashboardUrl?: string;
    videoResidenceUrl?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    address?: string;
    capturedAt?: string;
    status: VideoCheckStatus;
    adminNotes?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    createdAt: string;
}

export interface FleetLocationLog {
    id: string;
    rentalId: string;
    customerId: string;
    eventType: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
    deviceInfo?: string;
    ipAddress?: string;
    createdAt: string;
}

export interface FleetMaintenanceTicket {
    id: string;
    vehicleId: string;
    rentalId?: string;
    customerId?: string;
    type: 'MAINTENANCE' | 'INCIDENT' | 'INSPECTION';
    title: string;
    description: string;
    photoUrls: string[];
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    status: MaintenanceTicketStatus;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: string;
    scheduledAt?: string;
    cost?: number;
    createdAt: string;
    updatedAt?: string;
}

export interface FleetAlert {
    id: string;
    rentalId?: string;
    customerId?: string;
    vehicleId?: string;
    type: FleetAlertType;
    title: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
    metadata?: Record<string, any>;
    createdAt: string;
}

export interface FleetSettings {
    id: string;
    defaultLateFixedFee: number;
    defaultLateDailyInterest: number;
    videoCheckRequired: boolean;
    videoCheckDayOfWeek: number;
    autoGeneratePix: boolean;
    autoSendWhatsappReminders: boolean;
    autoSendEmailReminders: boolean;
    daysBeforeDueReminder: number;
    maxDaysLateBeforeBlock: number;
    pixKey?: string;
    pixKeyType?: string;
    pixReceiverName?: string;
    updatedAt: string;
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
    CAR: 'Carro',
    MOTORCYCLE: 'Moto',
    VAN: 'Van',
    TRUCK: 'Caminhao',
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
    AVAILABLE: 'Disponivel',
    RENTED: 'Alugado',
    MAINTENANCE: 'Manutencao',
    BLOCKED: 'Bloqueado',
    RETIRED: 'Inativo',
};
