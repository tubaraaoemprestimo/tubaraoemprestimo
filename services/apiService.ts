// apiService.ts — Substitui supabaseService.ts
// Todas as funções têm a MESMA interface do supabaseService
// mas usam a API REST (apiClient) ao invés do Supabase direto

import { api } from './apiClient';

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
        const { data, error } = await api.put(`/users/${id}`, { password });
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

        async signUp(creds: { email: string; password: string; name?: string; phone?: string }) {
            const { data, error } = await api.auth.signUp({
                ...creds,
                email: normalizeEmail(creds.email)
            });
            return { data, error };
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
        return data || [];
    },

    async submitRequest(requestData: any) {
        // Upload de documentos base64 antes de enviar
        const docFields = [
            'selfieUrl', 'idCardUrl', 'idCardBackUrl', 'proofOfAddressUrl',
            'proofIncomeUrl', 'vehicleUrl', 'videoSelfieUrl', 'videoHouseUrl',
            'videoVehicleUrl', 'signatureUrl', 'workCardUrl'
        ];

        const uploadedData = { ...requestData };

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

    async uploadSupplementalDoc(id: string, docUrl: string) {
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

    // ============= CLIENT LOANS =============

    async getClientLoans() {
        const { data, error } = await api.get('/loans');
        if (error) return [];
        return data || [];
    },

    async getClientPendingRequest() {
        const { data, error } = await api.get('/loan-requests/pending');
        if (error) return null;
        return data;
    },

    async uploadPaymentProof(loanId: string, installmentId: string, proofUrl: string) {
        const { data, error } = await api.put(`/loans/${loanId}/installments/${installmentId}/proof`, { proofUrl });
        if (error) throw new Error(error.error || 'Erro ao enviar comprovante');
        return data;
    },

    // ============= CUSTOMERS / CRM =============

    async getCustomers() {
        const { data, error } = await api.get('/customers');
        if (error) return [];
        return data || [];
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
    }
};

// Export default para compatibilidade
export default apiService;
