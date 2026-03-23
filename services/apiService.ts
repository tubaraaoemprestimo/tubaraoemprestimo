// apiService.ts — Substitui supabaseService.ts
// Todas as funções têm a MESMA interface do supabaseService
// mas usam a API REST (apiClient) ao invés do Supabase direto

import { api as realApi } from './apiClient';
import { api as mockApi } from './mockApiClient';

// Tree-shaking: o Vite vai remover o branch não usado no build
export const api = import.meta.env.VITE_DEMO_MODE === 'true' ? mockApi : realApi;

if (import.meta.env.VITE_DEMO_MODE === 'true') {
  console.log('[apiService] 🎭 MODO DEMO ATIVO — Mock API carregado');
}

// ============= CONSTANTES =============

const STORAGE_KEYS = {
    USER: 'tubarao_user',
    SESSION: 'tubarao_session'
};

const DEFAULT_BRAND_SETTINGS = {
    systemName: 'TUBARÃO EMPRÉSTIMO',
    logoUrl: null,
    primaryColor: '#FF0000',
    secondaryColor: '#D4AF37',
    backgroundColor: '#000000',
    companyName: '',
    cnpj: '',
    address: '',
    phone: ''
};

const DEFAULT_GOALS = {
    monthlyLoanGoal: 0,
    monthlyClientGoal: 0,
    monthlyApprovalRateGoal: 0,
    projections: null,
    expectedGrowthRate: 0,
    goalPeriod: ''
};

// ============= HELPERS =============

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch {
        return defaultValue;
    }
};

const saveToStorage = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error saving ${key}`, e);
    }
};

export function toCamelCase(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(toCamelCase);
    if (typeof obj !== 'object') return obj;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        result[camelKey] = toCamelCase(value);
    }
    return result;
}

export function toSnakeCase(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(toSnakeCase);
    if (typeof obj !== 'object') return obj;

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        result[snakeKey] = toSnakeCase(value);
    }
    return result;
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

// ============= API SERVICE =============

export const apiService = {

    // ============= SYSTEM =============

    async resetSystem() {
        localStorage.clear();
        await api.auth.signOut();
        window.location.reload();
    },

    // ============= AUTH & USERS =============

    async changePassword(newPassword: string) {
        const { data, error } = await api.put('/auth/update-password', { password: newPassword });
        return { data, error };
    },

    async resetPassword(email: string) {
        const { data, error } = await api.post('/auth/forgot-password', { email: normalizeEmail(email) });
        return { data, error };
    },

    async updateUserAvatar(avatarUrl: string) {
        // Atualiza localStorage
        const user = loadFromStorage(STORAGE_KEYS.USER, null);
        if (user) {
            user.avatarUrl = avatarUrl;
            saveToStorage(STORAGE_KEYS.USER, user);
        }
        const { data, error } = await api.put('/auth/me', { avatarUrl });
        return { data, error };
    },

    async getUsers() {
        const { data, error } = await api.get('/users');
        if (error) return [];
        return data || [];
    },

    async createUser(userData: any) {
        const { data, error } = await api.post('/users', userData);
        if (error) throw new Error(error.error || 'Erro ao criar usuário');
        return data;
    },

    async deleteUser(id: string) {
        const { data, error } = await api.delete(`/users/${id}`);
        if (error) throw new Error(error.error || 'Erro ao deletar usuário');
        return data;
    },

    async updateUser(id: string, userData: any) {
        const { data, error } = await api.put(`/users/${id}`, userData);
        if (error) throw new Error(error.error || 'Erro ao atualizar usuário');
        return data;
    },

    async resetUserPassword(id: string, password: string) {
        // Fix: Use correct endpoint and payload key (newPassword)
        const { data, error } = await api.put(`/users/${id}/password`, { newPassword: password });
        if (error) throw new Error(error.error || 'Erro ao resetar senha');
        return data;
    },

    // ============= AUTH NAMESPACE =============

    auth: {
        async signIn(creds: { identifier?: string; email?: string; password: string }) {
            const identifier = normalizeEmail(creds.identifier || creds.email || '');
            const { data, error } = await api.auth.signIn({ identifier, password: creds.password });

            if (error || !data) {
                return { user: null, accessToken: null, refreshToken: null, error };
            }

            const authData = data as any;
            if (authData.user) {
                saveToStorage(STORAGE_KEYS.USER, authData.user);
            }

            return {
                user: authData.user || null,
                accessToken: authData.accessToken || null,
                refreshToken: authData.refreshToken || null,
                error: null
            };
        },

        async signUp(creds: { email: string; password: string; name?: string; phone?: string; referralCode?: string }) {
            const payload = {
                ...creds,
                email: normalizeEmail(creds.email)
            };
            const { data, error } = await api.post('/auth/register', payload);
            if (error) return { data: null, error: error };
            return { data, error: null };
        },

        async signOut() {
            localStorage.removeItem(STORAGE_KEYS.USER);
            localStorage.removeItem(STORAGE_KEYS.SESSION);
            await api.auth.signOut();
            return { error: null };
        },

        getUser() {
            return loadFromStorage(STORAGE_KEYS.USER, null);
        },

        getSession() {
            return api.auth.getSession();
        },

        async hasManagedAccess(email: string) {
            const { data } = await api.get(`/auth/managed-access?email=${normalizeEmail(email)}`);
            return data ? true : false;
        }
    },

    // ============= BRAND SETTINGS =============

    async getBrandSettings() {
        const { data, error } = await api.get('/settings/brand');
        if (error) return DEFAULT_BRAND_SETTINGS;
        return data || DEFAULT_BRAND_SETTINGS;
    },

    async updateBrandSettings(settings: any) {
        const { data, error } = await api.put('/settings/brand', settings);
        if (error) throw new Error(error.error || 'Erro ao salvar marca');
        return data;
    },

    async resetBrandSettings() {
        const { data, error } = await api.put('/settings/brand', DEFAULT_BRAND_SETTINGS);
        if (error) throw new Error(error.error || 'Erro ao resetar marca');
        return data;
    },

    // ============= PACKAGES =============

    async getPackages() {
        const { data, error } = await api.get('/settings/packages');
        if (error) return [];
        return data || [];
    },

    async savePackage(pkg: any) {
        const { data, error } = await api.post('/settings/packages', pkg);
        if (error) throw new Error(error.error || 'Erro ao salvar pacote');
        return data;
    },

    async deletePackage(id: string) {
        const { data, error } = await api.delete(`/settings/packages/${id}`);
        if (error) throw new Error(error.error || 'Erro ao deletar pacote');
        return data;
    },

    // ============= SYSTEM SETTINGS =============

    async getSettings() {
        const { data, error } = await api.get('/settings');
        if (error) return {};
        return data || {};
    },

    async updateSettings(settings: any) {
        const { data, error } = await api.put('/settings', settings);
        if (error) throw new Error(error.error || 'Erro ao salvar configurações');
        return data;
    },

    // ============= LOAN REQUESTS =============

    async getRequests() {
        const { data, error } = await api.get('/loan-requests');
        if (error) return [];
        // Transformar dados flat do backend em estrutura nested que o admin espera
        return ((data || []) as any[]).map((req: any) => ({
            ...req,
            date: req.date || req.createdAt,
            documents: req.documents || {
                selfieUrl: req.selfieUrl,
                idCardUrl: req.idCardUrl,
                idCardBackUrl: req.idCardBackUrl,
                proofOfAddressUrl: req.proofOfAddressUrl,
                proofIncomeUrl: req.proofIncomeUrl,
                vehicleUrl: req.vehicleUrl,
                videoSelfieUrl: req.videoSelfieUrl,
                videoHouseUrl: req.videoHouseUrl,
                videoVehicleUrl: req.videoVehicleUrl,
                workCardUrl: req.workCardUrl,
            },
            references: req.references || {
                fatherPhone: req.fatherPhone || '',
                motherPhone: req.motherPhone || '',
                spousePhone: req.spousePhone || '',
            },
            signatureUrl: req.signatureUrl,
            workCardUrl: req.workCardUrl,
            bankName: req.bankName,
            bankAgency: req.bankAgency,
            bankAccount: req.bankAccount,
            bankAccountType: req.bankAccountType,
            pixKey: req.pixKey,
            pixKeyType: req.pixKeyType,
            accountHolderName: req.accountHolderName,
            companyName: req.companyName,
            companyProfession: req.companyProfession,
            companyWorkSince: req.companyWorkSince,
            companyIncome: req.companyIncome,
            companyPaymentDay: req.companyPaymentDay,
            // Montar supplementalInfo que o admin usa para exibir docs solicitados/enviados
            // Só existe se admin solicitou doc (supplementalRequestedAt é setado pelo endpoint /supplemental)
            supplementalInfo: req.supplementalRequestedAt
                ? {
                    description: req.supplementalDescription || '',
                    docUrl: req.supplementalDocUrl || null,
                    requestedAt: req.supplementalRequestedAt || null,
                    uploadedAt: req.supplementalUploadedAt || null,
                }
                : (req.supplementalInfo || null),
        }));
    },

    async submitRequest(requestData: any) {
        const uploadedData = { ...requestData };

        // ======= MAPEAMENTO COMPLETO: wizard → backend =======

        // 1. Campos de dados pessoais
        if (uploadedData.name && !uploadedData.clientName) {
            uploadedData.clientName = uploadedData.name;
        }
        if (uploadedData.contactTrust1 && !uploadedData.fatherPhone) {
            uploadedData.fatherPhone = uploadedData.contactTrust1;
        }
        if (uploadedData.contactTrust2 && !uploadedData.motherPhone) {
            uploadedData.motherPhone = uploadedData.contactTrust2;
        }
        if (uploadedData.cep && !uploadedData.zipCode) {
            uploadedData.zipCode = uploadedData.cep;
        }
        if (uploadedData.income && !uploadedData.monthlyIncome) {
            const incomeStr = String(uploadedData.income).replace(/[^\d.,]/g, '').replace(',', '.');
            uploadedData.monthlyIncome = parseFloat(incomeStr) || 0;
        }
        if (uploadedData.accountHolderName && !uploadedData.accountHolder) {
            uploadedData.accountHolder = uploadedData.accountHolderName;
        }

        // 2. Campos de documentos (arquivo)
        const docFieldMap: Record<string, string> = {
            selfie: 'selfieUrl',
            idCardFront: 'idCardUrl',
            idCardBack: 'idCardBackUrl',
            proofAddress: 'proofOfAddressUrl',
            proofIncome: 'proofIncomeUrl',
            vehicleFront: 'vehicleUrl',
            videoSelfie: 'videoSelfieUrl',
            videoHouse: 'videoHouseUrl',
            signature: 'signatureUrl',
            workCard: 'workCardUrl',
        };

        for (const [wizardName, backendName] of Object.entries(docFieldMap)) {
            if (uploadedData[wizardName] !== undefined && uploadedData[backendName] === undefined) {
                uploadedData[backendName] = uploadedData[wizardName];
                delete uploadedData[wizardName];
            }
        }

        // 3. Montar supplementalDescription com dados extras (location, fotos, garantia)
        const extraData: Record<string, any> = {};
        if (uploadedData.housePhotos && Array.isArray(uploadedData.housePhotos) && uploadedData.housePhotos.length > 0) {
            extraData.housePhotos = uploadedData.housePhotos;
        }
        if (uploadedData.latitude || uploadedData.longitude) {
            extraData.location = {
                latitude: uploadedData.latitude,
                longitude: uploadedData.longitude,
                accuracy: uploadedData.accuracy,
            };
        }
        if (uploadedData.guarantee) {
            extraData.guarantee = uploadedData.guarantee;
        }
        if (uploadedData.address || uploadedData.cep) {
            extraData.address = uploadedData.address;
            extraData.number = uploadedData.number;
            extraData.cep = uploadedData.cep || uploadedData.zipCode;
            extraData.neighborhood = uploadedData.neighborhood;
            extraData.city = uploadedData.city;
            extraData.state = uploadedData.state;
        }
        if (uploadedData.billInName && Array.isArray(uploadedData.billInName) && uploadedData.billInName.length > 0) {
            extraData.billInName = uploadedData.billInName;
        }
        if (uploadedData.contactTrust1Name) {
            extraData.contactTrust1Name = uploadedData.contactTrust1Name;
        }
        if (uploadedData.contactTrust1Relationship) {
            extraData.contactTrust1Relationship = uploadedData.contactTrust1Relationship;
        }
        if (uploadedData.contactTrust2Name) {
            extraData.contactTrust2Name = uploadedData.contactTrust2Name;
        }
        if (uploadedData.contactTrust2Relationship) {
            extraData.contactTrust2Relationship = uploadedData.contactTrust2Relationship;
        }
        if (uploadedData.instagram) {
            extraData.instagram = uploadedData.instagram;
        }
        if (uploadedData.occupation) {
            extraData.occupation = uploadedData.occupation;
        }
        // AUTONOMO: CNPJ e endereço do negócio
        if (uploadedData.cnpj) {
            extraData.cnpj = uploadedData.cnpj;
        }
        if (uploadedData.businessAddress) {
            extraData.businessAddress = uploadedData.businessAddress;
        }
        // MOTO: Cor escolhida
        if (uploadedData.motoColor) {
            extraData.motoColor = uploadedData.motoColor;
        }
        // Dados bancários adicionais
        if (uploadedData.accountHolderCpf) {
            extraData.accountHolderCpf = uploadedData.accountHolderCpf;
        }
        // Endereço da empresa
        if (uploadedData.companyCep || uploadedData.companyStreet) {
            extraData.companyAddress = {
                cep: uploadedData.companyCep,
                street: uploadedData.companyStreet,
                number: uploadedData.companyNumber,
                neighborhood: uploadedData.companyNeighborhood,
                city: uploadedData.companyCity,
                state: uploadedData.companyState,
            };
        }
        // WhatsApp pessoal (segundo número)
        if (uploadedData.whatsappPersonal) {
            extraData.whatsappPersonal = uploadedData.whatsappPersonal;
        }
        if (Object.keys(extraData).length > 0 && !uploadedData.supplementalDescription) {
            uploadedData.supplementalDescription = JSON.stringify(extraData);
        }

        // 4. Upload de documentos base64 (caso ainda existam)
        const docFields = [
            'selfieUrl', 'idCardUrl', 'idCardBackUrl', 'proofOfAddressUrl',
            'proofIncomeUrl', 'vehicleUrl', 'videoSelfieUrl', 'videoHouseUrl',
            'videoVehicleUrl', 'signatureUrl', 'workCardUrl'
        ];

        for (const field of docFields) {
            const value = uploadedData[field];
            if (value && typeof value === 'string' && value.startsWith('data:')) {
                try {
                    const { data: uploadResult } = await api.uploadBase64(value, `${field}_${Date.now()}`);
                    if (uploadResult?.url) {
                        uploadedData[field] = uploadResult.url;
                    }
                } catch (e) {
                    console.warn(`Falha ao fazer upload de ${field}, mantendo base64`);
                }
            }
            // Arrays: pegar primeiro item ou converter para JSON string
            if (Array.isArray(uploadedData[field])) {
                const arr = uploadedData[field] as string[];
                uploadedData[field] = arr.length === 1 ? arr[0] : arr.length > 0 ? JSON.stringify(arr) : null;
            }
        }

        const { data, error } = await api.post('/loan-requests', uploadedData);
        if (error) throw new Error(error.error || 'Erro ao enviar solicitação');
        return data;
    },

    async approveLoan(id: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/approve`, {});
        if (error) throw new Error(error.error || 'Erro ao aprovar');
        return data;
    },

    async approveWithCounteroffer(id: string, approvedAmount: number, interestRate?: number) {
        const { data, error } = await api.put(`/loan-requests/${id}/approve-with-counteroffer`, { approvedAmount, interestRate });
        if (error) throw new Error(error.error || 'Erro ao aprovar com contraproposta');
        return data;
    },

    async getCounterOfferAnalytics() {
        const { data, error } = await api.get('/admin/counteroffer-analytics');
        if (error) throw new Error(error.error || 'Erro ao buscar analytics');
        return data;
    },

    async acceptCounteroffer(id: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/accept-counteroffer`, {});
        if (error) throw new Error(error.error || 'Erro ao aceitar contraproposta');
        return data;
    },

    async rejectLoan(id: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/reject`, {});
        if (error) throw new Error(error.error || 'Erro ao rejeitar');
        return data;
    },

    async requestSupplementalDoc(id: string, description: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/supplemental`, { description });
        if (error) throw new Error(error.error || 'Erro ao solicitar documento');
        return data;
    },

    async updateLoanRequestValues(id: string, amount: number, installments: number) {
        const { data, error } = await api.put(`/loan-requests/${id}/values`, { amount, installments });
        if (error) throw new Error(error.error || 'Erro ao atualizar valores');
        return data;
    },

    async updateContractPdfUrl(id: string, contractPdfUrl: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/contract`, { contractPdfUrl });
        if (error) throw new Error(error.error || 'Erro ao atualizar contrato');
        return data;
    },

    async uploadSupplementalDoc(id: string, docFiles: string | string[]) {
        // Upload each base64 to storage, collect URLs
        const base64Array = Array.isArray(docFiles) ? docFiles : [docFiles];
        const uploadedUrls: string[] = [];

        for (const base64 of base64Array) {
            if (base64.startsWith('data:')) {
                const { data: uploadResult } = await api.uploadBase64(base64, `supp_doc_${Date.now()}`);
                if (uploadResult?.url) {
                    uploadedUrls.push(uploadResult.url);
                }
            } else {
                uploadedUrls.push(base64); // already a URL
            }
        }

        const docUrl = uploadedUrls.length === 1 ? uploadedUrls[0] : JSON.stringify(uploadedUrls);
        const { data, error } = await api.put(`/loan-requests/${id}/supplemental-upload`, { docUrl });
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    // ============= INVESTOR REQUESTS =============

    async submitInvestorRequest(requestData: any) {
        const { data, error } = await api.post('/loan-requests', {
            ...requestData,
            profileType: 'INVESTIDOR'
        });
        if (error) throw new Error(error.error || 'Erro ao enviar solicitação de investimento');
        return data;
    },

    async getInvestorRequests() {
        const { data, error } = await api.get('/loan-requests?profileType=INVESTIDOR');
        if (error) return [];
        return data || [];
    },

    async updateInvestorStatus(id: string, status: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/values`, { status });
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    // ============= RETURNING CLIENT =============

    async submitReturningClientRequest(requestData: any) {
        const { data, error } = await api.post('/loan-requests', {
            ...requestData,
            isReturning: true
        });
        if (error) throw new Error(error.error || 'Erro ao enviar solicitação');
        return data;
    },

    // ============= ADMIN CONTRACTS =============

    async getAdminLoans(params?: { status?: string; type?: string; search?: string }) {
        const qs = new URLSearchParams();
        if (params?.status) qs.set('status', params.status);
        if (params?.type) qs.set('type', params.type);
        if (params?.search) qs.set('search', params.search);
        const { data, error } = await api.get(`/loans/admin/all?${qs.toString()}`);
        if (error) return [];
        return data || [];
    },

    async getAdminLoanDetails(loanId: string) {
        const { data, error } = await api.get(`/loans/${loanId}/admin-details`);
        if (error) return null;
        return data;
    },

    async editAdminLoan(loanId: string, payload: any) {
        const { data, error } = await api.put(`/loans/${loanId}/admin-edit`, payload);
        if (error) throw new Error(error.error || 'Erro ao editar contrato');
        return data;
    },

    async registerManualPayment(loanId: string, payload: any) {
        const { data, error } = await api.post(`/loans/${loanId}/manual-payment`, payload);
        if (error) throw new Error(error.error || 'Erro ao registrar pagamento');
        return data;
    },

    async getTodaySummary() {
        const { data, error } = await api.get('/finance/today-summary');
        if (error) return null;
        return data;
    },

    // ============= CLIENT LOANS =============

    async getClientLoans() {
        const { data, error } = await api.get('/loans');
        if (error) return [];
        return data || [];
    },

    async getClientPendingRequest() {
        const { data, error } = await api.get('/loan-requests/pending');
        if (error) return null;
        return data as any;
    },

    async getClientLatestRequest() {
        const { data, error } = await api.get('/loan-requests/latest');
        if (error) return null;
        return data as any;
    },

    async uploadPaymentProof(loanId: string, installmentId: string, proofUrl: string) {
        const { data, error } = await api.put(`/loans/${loanId}/installments/${installmentId}/proof`, { proofUrl });
        if (error) throw new Error(error.error || 'Erro ao enviar comprovante');
        return data;
    },

    async generatePayment(loanId: string, type: 'interest_only' | 'full') {
        const { data, error } = await api.post(`/loans/${loanId}/generate-payment`, { type });
        if (error) throw new Error(error.error || 'Erro ao gerar cobrança');
        return data as {
            success: boolean; payment: {
                type: string; amount: number; description: string;
                originalAmount: number; remainingAmount: number; interestAmount: number;
                interestRate: number; pixKey: string; pixKeyType: string; pixReceiver: string;
                contractId: string;
            }
        };
    },

    // ============= CUSTOMERS / CRM =============

    async getCustomers() {
        const { data, error } = await api.get('/customers');
        if (error) return [];
        return data || [];
    },

    async getCustomer(id: string) {
        const { data, error } = await api.get(`/customers/${id}`);
        if (error) throw new Error(error.error || 'Erro ao buscar cliente');
        return data;
    },

    async startWhatsappOnboarding(phone: string) {
        const { data, error } = await api.post('/whatsapp-onboarding/start', { phone });
        if (error) throw new Error(error.error || 'Erro ao iniciar onboarding');
        return data;
    },

    async getOnboardingSessions() {
        const { data, error } = await api.get('/whatsapp-onboarding/sessions');
        if (error) throw new Error(error.error || 'Erro ao listar sessões');
        return data;
    },

    async toggleCustomerStatus(id: string, status: string) {
        const { data, error } = await api.put(`/customers/${id}/status`, { status });
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    async updateCustomer(id: string, customerData: any) {
        const { data, error } = await api.put(`/customers/${id}`, customerData);
        if (error) throw new Error(error.error || 'Erro ao atualizar cliente');
        return data;
    },

    async createUserFromCustomer(customerId: string, password: string) {
        const { data, error } = await api.post(`/customers/${customerId}/create-user`, { password });
        if (error) throw new Error(error.error || 'Erro ao criar acesso');
        return data;
    },

    async sendPreApproval(customerId: string, amount: number) {
        const { data, error } = await api.post(`/customers/${customerId}/pre-approval`, { amount });
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    async updateCustomerRates(id: string, rates: any) {
        const { data, error } = await api.put(`/customers/${id}/rates`, rates);
        if (error) throw new Error(error.error || 'Erro ao atualizar taxas');
        return data;
    },

    async sendInstallmentOffer(customerId: string, offer: any) {
        const { data, error } = await api.post(`/customers/${customerId}/installment-offer`, offer);
        if (error) throw new Error(error.error || 'Erro ao enviar oferta');
        return data;
    },

    async deleteInstallmentOffer(customerId: string) {
        const { data, error } = await api.delete(`/customers/${customerId}/installment-offer`);
        if (error) throw new Error(error.error || 'Erro ao remover oferta');
        return data;
    },

    async getPreApproval() {
        const { data, error } = await api.get('/loans/pre-approval');
        if (error) return null;
        return (data as any)?.amount || null;
    },

    async getClientInstallmentOffer() {
        const { data, error } = await api.get('/loans/installment-offer');
        if (error) return null;
        return (data as any)?.offer || null;
    },

    // ============= NOTIFICATIONS & COUPONS =============

    async getClientNotifications() {
        const { data, error } = await api.get('/notifications');
        if (error) return [];
        return data || [];
    },

    async createNotification(notifData: any) {
        const { data, error } = await api.post('/notifications', notifData);
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    async getClientCoupons() {
        const user = loadFromStorage(STORAGE_KEYS.USER, null);
        const email = user?.email || '';
        const { data, error } = await api.get(`/notifications/coupons?email=${email}`);
        if (error) return [];
        return data || [];
    },

    async getCoupons() {
        const { data, error } = await api.get('/notifications/coupons/all');
        if (error) return [];
        return data || [];
    },

    async saveCoupon(couponData: any) {
        const { data, error } = await api.post('/notifications/coupons', couponData);
        if (error) throw new Error(error.error || 'Erro ao salvar cupom');
        return data;
    },

    async deleteCoupon(id: string) {
        const { data, error } = await api.delete(`/notifications/coupons/${id}`);
        if (error) throw new Error(error.error || 'Erro ao deletar cupom');
        return data;
    },

    // ============= COLLECTION RULES =============

    async getCollectionRules() {
        const { data, error } = await api.get('/settings/collection-rules');
        if (error) return [];
        return data || [];
    },

    async saveCollectionRule(rule: any) {
        const { data, error } = await api.post('/settings/collection-rules', rule);
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    async deleteCollectionRule(id: string) {
        const { data, error } = await api.delete(`/settings/collection-rules/${id}`);
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    // ============= TRANSACTIONS & LOGS =============

    async getTransactions() {
        const { data, error } = await api.get('/finance/transactions');
        if (error) return [];
        return data || [];
    },

    async getInteractionLogs() {
        const { data, error } = await api.get('/finance/interactions');
        if (error) return [];
        return data || [];
    },

    // ============= WHATSAPP CONFIG =============

    async getWhatsappConfig() {
        const { data, error } = await api.get('/settings/whatsapp');
        if (error) return { apiUrl: '', apiKey: '', instanceName: '', isConnected: false };
        return data || { apiUrl: '', apiKey: '', instanceName: '', isConnected: false };
    },

    async saveWhatsappConfig(config: any) {
        const { data, error } = await api.put('/settings/whatsapp', config);
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    // ============= CAMPAIGNS =============

    async getCampaigns() {
        const { data, error } = await api.get('/campaigns');
        if (error) return [];
        return data || [];
    },

    async saveCampaign(campaignData: any) {
        const { data, error } = await api.post('/campaigns', campaignData);
        if (error) throw new Error(error.error || 'Erro ao salvar campanha');
        return data;
    },

    async deleteCampaign(id: string) {
        const { data, error } = await api.delete(`/campaigns/${id}`);
        if (error) throw new Error(error.error || 'Erro ao deletar campanha');
        return data;
    },

    async getActiveCampaigns() {
        const { data, error } = await api.get('/campaigns/active');
        if (error) return [];
        return data || [];
    },

    async sendCampaign(id: string) {
        const { data, error } = await api.post('/campaigns/send', { type: 'campaign', id });
        if (error) throw new Error(error.error || 'Erro ao disparar campanha');
        return data;
    },

    async sendCouponNotification(id: string) {
        const { data, error } = await api.post('/campaigns/send', { type: 'coupon', id });
        if (error) throw new Error(error.error || 'Erro ao disparar cupom');
        return data;
    },

    // ============= GOALS =============

    async getGoalsSettings() {
        const { data, error } = await api.get('/settings/goals');
        if (error) return DEFAULT_GOALS;
        return data || DEFAULT_GOALS;
    },

    async saveGoalsSettings(goals: any) {
        const { data, error } = await api.put('/settings/goals', goals);
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    // ============= FILE UPLOAD =============

    async uploadFile(_bucket: string, _path: string, file: File | Blob) {
        const { data, error } = await api.upload(file);
        if (error) throw new Error(error.error || 'Erro ao fazer upload');
        return data?.url || null;
    },

    async uploadBase64Image(base64: string, filename?: string) {
        if (!base64) return null;
        const { data, error } = await api.uploadBase64(base64, filename);
        if (error) {
            console.warn('Falha no upload base64, retornando original');
            return base64;
        }
        return data?.url || base64;
    },

    // ============= LEAD MANAGEMENT =============

    async importLead(lead: any) {
        const { data, error } = await api.post('/customers/import', { leads: [lead] });
        if (error) return 'error';
        return (data as any)?.added > 0 ? 'added' : 'updated';
    },

    async bulkImportLeads(leads: any[]) {
        const { data, error } = await api.post('/customers/import', { leads });
        if (error) return { added: 0, errors: leads.length };
        return data || { added: 0, errors: 0 };
    },

    async deleteWhatsappLeads() {
        const { data, error } = await api.delete('/customers/whatsapp-leads');
        if (error) throw new Error(error.error || 'Erro');
        return data;
    },

    async bulkDeleteCustomers(ids: string[]) {
        const { data, error } = await api.delete('/customers/bulk', { data: { ids } });
        if (error) throw new Error(error.error || 'Erro ao deletar');
        return data;
    },

    // ============= PAYMENT RECEIPTS =============

    async submitPaymentReceipt(installmentId: string, receiptUrl: string, amount?: number) {
        const { data, error } = await api.post('/payment-receipts', { installmentId, receiptUrl, amount });
        if (error) throw new Error((error as any).error || 'Erro ao enviar comprovante');
        return data;
    },

    async getPaymentReceipts(status?: string) {
        const query = status ? `?status=${status}` : '';
        const { data, error } = await api.get(`/payment-receipts${query}`);
        if (error) return [];
        return data || [];
    },

    async approvePaymentReceipt(id: string, notes?: string, isDischarge?: boolean) {
        const { data, error } = await api.put(`/payment-receipts/${id}/approve`, { notes, isDischarge });
        if (error) throw new Error((error as any).error || 'Erro ao aprovar');
        return data;
    },

    async rejectPaymentReceipt(id: string, notes?: string) {
        const { data, error } = await api.put(`/payment-receipts/${id}/reject`, { notes });
        if (error) throw new Error((error as any).error || 'Erro ao rejeitar');
        return data;
    },

    // ============= SCHEDULED STATUS =============

    async getScheduledStatus() {
        const { data, error } = await api.get('/scheduled-status');
        if (error) return [];
        return data || [];
    },

    async createScheduledStatus(statusData: any) {
        const { data, error } = await api.post('/scheduled-status', statusData);
        if (error) throw new Error((error as any).error || 'Erro ao criar agendamento');
        return data;
    },

    async deleteScheduledStatus(id: string) {
        const { data, error } = await api.delete(`/scheduled-status/${id}`);
        if (error) throw new Error((error as any).error || 'Erro ao deletar agendamento');
        return data;
    },

    async updateScheduledStatusStatus(id: string, status: string, postsCount?: number) {
        const { data, error } = await api.put(`/scheduled-status/${id}/status`, { status, postsCount });
        if (error) throw new Error((error as any).error || 'Erro ao atualizar status');
        return data;
    },

    async generateCaptionFromImage(imageUrl: string) {
        const { data, error } = await api.post('/scheduled-status/generate-caption', { imageUrl });
        if (error) throw new Error((error as any).error || 'Erro ao gerar legenda');
        return data?.caption || '';
    },

    // Consulta CPF completa via TrackFlow
    consultarCPFTrackFlow: async (cpf: string) => {
        // Higienizar CPF: remover pontos, traços e espaços
        const cpfLimpo = cpf.replace(/\D/g, '');
        const response = await api.get(`/cpf/trackflow/${cpfLimpo}`);
        return response.data;
    },

    // ============= DOCUMENTS =============

    async getDocuments() {
        const { data, error } = await api.get('/documents');
        if (error) return [];
        return data || [];
    },

    async getDocument(id: string) {
        const { data, error } = await api.get(`/documents/${id}`);
        if (error) throw new Error((error as any).error || 'Erro ao buscar documento');
        return data;
    },

    // ============= ADMIN — PIX RECEIPT =============

    async attachPixReceipt(requestId: string, pixReceiptUrl: string) {
        const { data, error } = await api.put(`/loan-requests/${requestId}/pix-receipt`, { pixReceiptUrl });
        if (error) throw new Error((error as any).error || 'Erro ao anexar comprovante');
        return data;
    },

    // ============= ADMIN — SEND ACCESS =============

    async adminSendAccess(payload: { customerId?: string; phone: string; name: string; email?: string; cpf?: string }) {
        const { data, error } = await api.post('/admin/send-access', payload);
        if (error) throw new Error((error as any).error || 'Erro ao enviar acesso');
        return data;
    },

    async deleteRequest(id: string, reason: string) {
        const { data, error } = await api.delete(`/loan-requests/${id}`, { data: { reason } });
        if (error) throw new Error((error as any).error || 'Erro ao excluir');
        return data;
    },

    async pauseRequest(id: string, reason: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/pause`, { reason });
        if (error) throw new Error((error as any).error || 'Erro ao pausar');
        return data;
    },

    async resumeRequest(id: string) {
        const { data, error } = await api.put(`/loan-requests/${id}/resume`);
        if (error) throw new Error((error as any).error || 'Erro ao retomar');
        return data;
    },

    async cancelLoan(id: string, reason: string) {
        const { data, error } = await api.delete(`/loans/${id}/cancel`, { data: { reason } });
        if (error) throw new Error((error as any).error || 'Erro ao cancelar contrato');
        return data;
    },

    async getAdminNotifications() {
        const { data } = await api.get('/notifications/admin');
        return data || [];
    },

    async markNotificationRead(id: string) {
        await api.put(`/notifications/${id}/read`);
    },

    // ============= COMMENTS API =============

    async getLessonComments(lessonId: string) {
        const { data, error } = await api.get(`/comments/lesson/${lessonId}`);
        if (error) throw new Error(error.error || 'Erro ao carregar comentários');
        return data;
    },

    async createComment(lessonId: string, payload: { content: string; parentId?: string }) {
        const { data, error } = await api.post(`/comments/lesson/${lessonId}`, payload);
        if (error) throw new Error(error.error || 'Erro ao criar comentário');
        return data;
    },

    async updateComment(commentId: string, payload: { content: string }) {
        const { data, error } = await api.put(`/comments/${commentId}`, payload);
        if (error) throw new Error(error.error || 'Erro ao atualizar comentário');
        return data;
    },

    async deleteComment(commentId: string) {
        const { data, error } = await api.delete(`/comments/${commentId}`);
        if (error) throw new Error(error.error || 'Erro ao excluir comentário');
        return data;
    },

    async getPendingComments() {
        const { data, error } = await api.get('/comments/pending');
        if (error) throw new Error(error.error || 'Erro ao carregar comentários pendentes');
        return data;
    },

    // ============= QUIZ API =============

    async submitQuiz(payload: any) {
        const { data, error } = await api.post('/quiz/submit', payload);
        if (error) throw new Error(error.error || 'Erro ao enviar quiz');
        return data;
    },

    async checkQuizResponse(courseId: string) {
        const { data, error } = await api.get(`/quiz/check/${courseId}`);
        if (error) throw new Error(error.error || 'Erro ao verificar quiz');
        return data;
    },

    async getLeads(status?: 'HOT' | 'WARM' | 'COLD') {
        const url = status ? `/quiz/leads?status=${status}` : '/quiz/leads';
        const { data, error } = await api.get(url);
        if (error) throw new Error(error.error || 'Erro ao carregar leads');
        return data;
    },

    async markLeadContacted(leadId: string, notes: string) {
        const { data, error } = await api.put(`/quiz/leads/${leadId}/contact`, { notes });
        if (error) throw new Error(error.error || 'Erro ao marcar lead como contatado');
        return data;
    },

    // ============= LESSONS API =============

    async getLesson(lessonId: string) {
        const { data, error } = await api.get(`/curso/lessons/${lessonId}`);
        if (error) throw new Error(error.error || 'Erro ao carregar aula');
        return data;
    },

    async markLessonComplete(lessonId: string) {
        const { data, error } = await api.post(`/curso/lessons/${lessonId}/complete`);
        if (error) throw new Error(error.error || 'Erro ao marcar aula como concluída');
        return data;
    },

    // ============= AUTOMATION API =============

    async getAutomationLogs(status?: string) {
        const url = status ? `/automation/logs?status=${status}` : '/automation/logs';
        const { data, error } = await api.get(url);
        if (error) throw new Error(error.error || 'Erro ao carregar logs');
        return data;
    },

    async getAutomationStats() {
        const { data, error } = await api.get('/automation/stats');
        if (error) throw new Error(error.error || 'Erro ao carregar estatísticas');
        return data;
    },

    async retryAutomation(id: string) {
        const { data, error } = await api.post(`/automation/retry/${id}`);
        if (error) throw new Error(error.error || 'Erro ao reenviar automação');
        return data;
    },

    async testAutomation(phone: string, name: string, leadStatus: string) {
        const { data, error } = await api.post('/automation/test', { phone, name, leadStatus });
        if (error) throw new Error(error.error || 'Erro ao enviar teste');
        return data;
    },

    // ============= CURSO ADMIN =============

    async getCourses() {
        // Returns single course object (single-product LMS)
        const { data, error } = await api.get('/curso/admin/course');
        if (error) throw new Error(error.error || 'Erro ao carregar cursos');
        // Backend returns { course } — wrap in array for CourseManager compatibility
        const course = data?.course || data;
        return course ? [course] : [];
    },

    async createCourse(payload: { title: string; description: string; thumbnailUrl?: string }) {
        // First module creation auto-creates the course
        const { data, error } = await api.post('/curso/modules', payload);
        if (error) throw new Error(error.error || 'Erro ao criar curso');
        return data;
    },

    async updateCourse(courseId: string, payload: any) {
        const { data, error } = await api.put(`/curso/admin/course`, payload);
        if (error) throw new Error(error.error || 'Erro ao atualizar curso');
        return data;
    },

    async deleteCourse(_courseId: string) {
        // Single-product LMS: not supported
        throw new Error('Operação não suportada no modelo single-course');
    },

    async createModule(_courseId: string, payload: { title: string; description: string }) {
        const { data, error } = await api.post('/curso/modules', payload);
        if (error) throw new Error(error.error || 'Erro ao criar módulo');
        return data;
    },

    async updateModule(moduleId: string, payload: any) {
        const { data, error } = await api.put(`/curso/modules/${moduleId}`, payload);
        if (error) throw new Error(error.error || 'Erro ao atualizar módulo');
        return data;
    },

    async deleteModule(moduleId: string) {
        const { data, error } = await api.delete(`/curso/modules/${moduleId}`);
        if (error) throw new Error(error.error || 'Erro ao excluir módulo');
        return data;
    },

    async createLesson(moduleId: string, payload: { title: string; description: string; videoUrl: string; duration: number }) {
        const { data, error } = await api.post('/curso/lessons', { ...payload, moduleId });
        if (error) throw new Error(error.error || 'Erro ao criar aula');
        return data;
    },

    async updateLesson(lessonId: string, payload: any) {
        const { data, error } = await api.put(`/curso/lessons/${lessonId}`, payload);
        if (error) throw new Error(error.error || 'Erro ao atualizar aula');
        return data;
    },

    async deleteLesson(lessonId: string) {
        const { data, error } = await api.delete(`/curso/lessons/${lessonId}`);
        if (error) throw new Error(error.error || 'Erro ao excluir aula');
        return data;
    },

    async getWhatsappTemplates() {
        const { data, error } = await api.get('/automation/templates');
        if (error) return { HOT: '', WARM: '', COLD: '' };
        return data;
    },

    async saveWhatsappTemplates(templates: { HOT: string; WARM: string; COLD: string }) {
        const { data, error } = await api.put('/automation/templates', templates);
        if (error) throw new Error(error.error || 'Erro ao salvar templates');
        return data;
    },

    async getQuizQuestions() {
        const { data, error } = await api.get('/quiz/questions');
        if (error) return [];
        return data || [];
    },

    async getScoringRules() {
        const { data, error } = await api.get('/quiz/scoring-rules');
        if (error) return [];
        return data || [];
    },

    async createQuizQuestion(payload: any) {
        const { data, error } = await api.post('/quiz/questions', payload);
        if (error) throw new Error(error.error || 'Erro ao criar pergunta');
        return data;
    },

    async updateQuizQuestion(id: string, payload: any) {
        const { data, error } = await api.put(`/quiz/questions/${id}`, payload);
        if (error) throw new Error(error.error || 'Erro ao atualizar pergunta');
        return data;
    },

    async deleteQuizQuestion(id: string) {
        const { data, error } = await api.delete(`/quiz/questions/${id}`);
        if (error) throw new Error(error.error || 'Erro ao excluir pergunta');
        return data;
    },

    async createScoringRule(payload: any) {
        const { data, error } = await api.post('/quiz/scoring-rules', payload);
        if (error) throw new Error(error.error || 'Erro ao criar regra');
        return data;
    },

    async updateScoringRule(id: string, payload: any) {
        const { data, error } = await api.put(`/quiz/scoring-rules/${id}`, payload);
        if (error) throw new Error(error.error || 'Erro ao atualizar regra');
        return data;
    },

    async deleteScoringRule(id: string) {
        const { data, error } = await api.delete(`/quiz/scoring-rules/${id}`);
        if (error) throw new Error(error.error || 'Erro ao excluir regra');
        return data;
    },

    // ============= COMMENT RATINGS & MANAGEMENT =============

    async rateComment(commentId: string, rating: number) {
        const { data, error } = await api.post(`/comments/${commentId}/rate`, { rating });
        if (error) throw new Error(error.error || 'Erro ao avaliar comentário');
        return data;
    },

    async setCommentPriority(commentId: string, priority: number) {
        const { data, error } = await api.put(`/comments/${commentId}/priority`, { priority });
        if (error) throw new Error(error.error || 'Erro ao definir prioridade');
        return data;
    },

    async pinComment(commentId: string, isPinned: boolean) {
        const { data, error } = await api.put(`/comments/${commentId}/pin`, { isPinned });
        if (error) throw new Error(error.error || 'Erro ao fixar comentário');
        return data;
    },

    async setAdminNotes(commentId: string, adminNotes: string) {
        const { data, error } = await api.put(`/comments/${commentId}/admin-notes`, { adminNotes });
        if (error) throw new Error(error.error || 'Erro ao salvar notas');
        return data;
    },

    async sendBroadcast(requestIds: string[], message: string, type: string) {
        const { data, error } = await api.post('/loan-requests/broadcast', { requestIds, message, type });
        if (error) throw new Error(error.error || 'Erro ao enviar disparo');
        return data;
    }
};

// Export default para compatibilidade
export default apiService;
