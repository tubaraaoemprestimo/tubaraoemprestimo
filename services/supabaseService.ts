import { supabase } from './supabaseClient';
import {
    LoanRequest,
    LoanStatus,
    LoanPackage,
    SystemSettings,
    Customer,
    CollectionRule,
    Loan,
    InteractionLog,
    Transaction,
    WhatsappConfig,
    BrandSettings,
    UserAccess,
    UserRole,
    Installment,
    Campaign,
    GoalsSettings
} from '../types';

// Helper to convert snake_case to camelCase
const toCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((result: any, key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camelKey] = toCamelCase(obj[key]);
            return result;
        }, {});
    }
    return obj;
};

// Helper to convert camelCase to snake_case
const toSnakeCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(toSnakeCase);
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((result: any, key) => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = toSnakeCase(obj[key]);
            return result;
        }, {});
    }
    return obj;
};

// Local storage fallback for offline support
const STORAGE_KEYS = {
    USER: 'tubarao_user',
    SESSION: 'tubarao_session'
};

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
        console.warn(`Error loading ${key}`, e);
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

// Default settings
const DEFAULT_BRAND_SETTINGS: BrandSettings = {
    systemName: "TUBARÃO EMPRÉSTIMO",
    logoUrl: null,
    primaryColor: "#FF0000",
    secondaryColor: "#D4AF37",
    backgroundColor: "#000000",
    companyName: "Tubarão Empréstimos S.A.",
    cnpj: "00.000.000/0001-00",
    address: "Av. Paulista, 1000 - São Paulo, SP",
    phone: "(11) 99999-9999"
};

const DEFAULT_GOALS: GoalsSettings = {
    monthlyLoanGoal: 600000,
    monthlyClientGoal: 60,
    monthlyApprovalRateGoal: 75,
    projections: [
        { month: 'Jan', target: 80000 },
        { month: 'Fev', target: 95000 },
        { month: 'Mar', target: 110000 },
        { month: 'Abr', target: 125000 },
        { month: 'Mai', target: 140000 },
        { month: 'Jun', target: 155000 },
        { month: 'Jul', target: 170000 },
        { month: 'Ago', target: 185000 },
        { month: 'Set', target: 200000 },
        { month: 'Out', target: 215000 },
        { month: 'Nov', target: 230000 },
        { month: 'Dez', target: 250000 }
    ],
    expectedGrowthRate: 12,
    goalPeriod: new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
};

export const supabaseService = {
    resetSystem: async () => {
        localStorage.clear();
        await supabase.auth.signOut();
        window.location.reload();
    },

    // ============================================
    // AUTH & USERS
    // ============================================
    auth: {
        signIn: async (credentials: { identifier: string; password: string }) => {
            try {
                // Try to sign in with email/password
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: credentials.identifier.includes('@')
                        ? credentials.identifier
                        : `${credentials.identifier}@tubarao.local`,
                    password: credentials.password
                });

                if (authError) {
                    // Fallback: Check if it's the admin demo user
                    if (credentials.identifier === 'admin' && credentials.password === 'admin') {
                        const adminUser = {
                            id: 'admin_demo',
                            name: 'Administrador',
                            email: 'admin@tubarao.com',
                            role: 'ADMIN' as UserRole,
                            token: 'demo_token_' + Date.now(),
                            avatarUrl: null
                        };
                        saveToStorage(STORAGE_KEYS.USER, adminUser);
                        return { user: adminUser, error: null };
                    }

                    // For demo purposes, allow any login as client
                    const clientUser = {
                        id: 'client_demo_' + Date.now(),
                        name: credentials.identifier,
                        email: credentials.identifier.includes('@') ? credentials.identifier : `${credentials.identifier}@client.com`,
                        role: 'CLIENT' as UserRole,
                        token: 'demo_token_' + Date.now(),
                        avatarUrl: null
                    };
                    saveToStorage(STORAGE_KEYS.USER, clientUser);
                    return { user: clientUser, error: null };
                }

                // Get user profile from database
                const { data: userData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_id', authData.user.id)
                    .single();

                const user = {
                    id: userData?.id || authData.user.id,
                    name: userData?.name || authData.user.email?.split('@')[0] || 'Usuário',
                    email: authData.user.email || '',
                    role: userData?.role || 'CLIENT',
                    token: authData.session?.access_token || '',
                    avatarUrl: userData?.avatar_url || null
                };

                saveToStorage(STORAGE_KEYS.USER, user);
                return { user, error: null };
            } catch (error) {
                console.error('Sign in error:', error);
                return { user: null, error };
            }
        },

        signUp: async (email: string, password: string, name: string, role: UserRole = UserRole.CLIENT) => {
            try {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { name, role }
                    }
                });

                if (authError) throw authError;

                // Create user profile
                if (authData.user) {
                    await supabase.from('users').insert({
                        auth_id: authData.user.id,
                        name,
                        email,
                        role
                    });
                }

                return { data: authData, error: null };
            } catch (error) {
                return { data: null, error };
            }
        },

        signOut: async () => {
            localStorage.removeItem(STORAGE_KEYS.USER);
            await supabase.auth.signOut();
        },

        getUser: () => loadFromStorage<any>(STORAGE_KEYS.USER, null),

        getSession: async () => {
            const { data } = await supabase.auth.getSession();
            return data.session;
        }
    },

    changePassword: async (oldPass: string, newPass: string): Promise<boolean> => {
        try {
            const { error } = await supabase.auth.updateUser({ password: newPass });
            return !error;
        } catch {
            return false;
        }
    },

    updateUserAvatar: async (avatarUrl: string): Promise<boolean> => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (user) {
            user.avatarUrl = avatarUrl;
            saveToStorage(STORAGE_KEYS.USER, user);

            // Update in database
            await supabase
                .from('users')
                .update({ avatar_url: avatarUrl })
                .eq('id', user.id);

            return true;
        }
        return false;
    },

    getUsers: async (): Promise<UserAccess[]> => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }

        return data.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role as UserRole,
            createdAt: u.created_at
        }));
    },

    createUser: async (userData: any): Promise<boolean> => {
        try {
            const { error } = await supabase.from('users').insert({
                name: userData.name,
                email: userData.email,
                role: userData.role
            });
            return !error;
        } catch {
            return false;
        }
    },

    deleteUser: async (id: string): Promise<boolean> => {
        try {
            const { error } = await supabase.from('users').delete().eq('id', id);
            return !error;
        } catch {
            return false;
        }
    },

    // ============================================
    // BRANDING
    // ============================================
    getBrandSettings: async (): Promise<BrandSettings> => {
        try {
            const { data, error } = await supabase
                .from('brand_settings')
                .select('*')
                .limit(1)
                .single();

            if (error || !data) return DEFAULT_BRAND_SETTINGS;

            return {
                systemName: data.system_name,
                logoUrl: data.logo_url,
                primaryColor: data.primary_color,
                secondaryColor: data.secondary_color,
                backgroundColor: data.background_color,
                companyName: data.company_name,
                cnpj: data.cnpj,
                address: data.address,
                phone: data.phone
            };
        } catch {
            return DEFAULT_BRAND_SETTINGS;
        }
    },

    updateBrandSettings: async (settings: BrandSettings): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('brand_settings')
                .upsert({
                    id: '00000000-0000-0000-0000-000000000001',
                    system_name: settings.systemName,
                    logo_url: settings.logoUrl,
                    primary_color: settings.primaryColor,
                    secondary_color: settings.secondaryColor,
                    background_color: settings.backgroundColor,
                    company_name: settings.companyName,
                    cnpj: settings.cnpj,
                    address: settings.address,
                    phone: settings.phone,
                    updated_at: new Date().toISOString()
                });
            return !error;
        } catch {
            return false;
        }
    },

    resetBrandSettings: async (): Promise<BrandSettings> => {
        await supabaseService.updateBrandSettings(DEFAULT_BRAND_SETTINGS);
        return DEFAULT_BRAND_SETTINGS;
    },

    // ============================================
    // PACKAGES
    // ============================================
    getPackages: async (): Promise<LoanPackage[]> => {
        const { data, error } = await supabase
            .from('loan_packages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];

        return data.map(p => ({
            id: p.id,
            name: p.name,
            minValue: p.min_value,
            maxValue: p.max_value,
            minInstallments: p.min_installments,
            maxInstallments: p.max_installments,
            interestRate: p.interest_rate
        }));
    },

    savePackage: async (pkg: LoanPackage) => {
        const { error } = await supabase.from('loan_packages').upsert({
            id: pkg.id || undefined,
            name: pkg.name,
            min_value: pkg.minValue,
            max_value: pkg.maxValue,
            min_installments: pkg.minInstallments,
            max_installments: pkg.maxInstallments,
            interest_rate: pkg.interestRate
        });
        return !error;
    },

    deletePackage: async (id: string) => {
        const { error } = await supabase.from('loan_packages').delete().eq('id', id);
        return !error;
    },

    // ============================================
    // SETTINGS
    // ============================================
    getSettings: async (): Promise<SystemSettings> => {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('key, value');

            if (!data || data.length === 0) {
                return { monthlyInterestRate: 5, lateFeeRate: 2 };
            }

            const settings: any = {};
            data.forEach(item => {
                settings[item.key] = typeof item.value === 'string' ? parseFloat(item.value) || item.value : item.value;
            });

            return {
                monthlyInterestRate: settings.monthlyInterestRate || 5,
                lateFeeRate: settings.lateFeeRate || 2
            };
        } catch {
            return { monthlyInterestRate: 5, lateFeeRate: 2 };
        }
    },

    updateSettings: async (s: SystemSettings) => {
        await supabase.from('system_settings').upsert([
            { key: 'monthlyInterestRate', value: s.monthlyInterestRate.toString() },
            { key: 'lateFeeRate', value: s.lateFeeRate.toString() }
        ], { onConflict: 'key' });
        return true;
    },

    // ============================================
    // LOAN REQUESTS
    // ============================================
    getRequests: async (): Promise<LoanRequest[]> => {
        const { data, error } = await supabase
            .from('loan_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching requests:', error);
            return [];
        }

        return data.map(r => ({
            id: r.id,
            clientName: r.client_name,
            cpf: r.cpf,
            email: r.email,
            phone: r.phone,
            amount: r.amount,
            installments: r.installments,
            status: r.status as LoanStatus,
            date: r.created_at,
            references: {
                fatherPhone: r.father_phone || '',
                motherPhone: r.mother_phone || '',
                spousePhone: r.spouse_phone || ''
            },
            documents: {
                selfieUrl: r.selfie_url,
                idCardUrl: r.id_card_url,
                idCardBackUrl: r.id_card_back_url,
                proofOfAddressUrl: r.proof_of_address_url,
                proofIncomeUrl: r.proof_income_url,
                vehicleUrl: r.vehicle_url,
                videoSelfieUrl: r.video_selfie_url,
                videoHouseUrl: r.video_house_url,
                videoVehicleUrl: r.video_vehicle_url
            },
            supplementalInfo: r.supplemental_description ? {
                requestedAt: r.supplemental_requested_at,
                description: r.supplemental_description,
                docUrl: r.supplemental_doc_url,
                uploadedAt: r.supplemental_uploaded_at
            } : undefined,
            signatureUrl: r.signature_url
        }));
    },

    submitRequest: async (data: any) => {
        // First, find or create customer
        let { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('cpf', data.cpf)
            .single();

        let customerId = existingCustomer?.id;

        if (!customerId) {
            const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                    name: data.name,
                    cpf: data.cpf,
                    email: data.email,
                    phone: data.phone || '',
                    status: 'ACTIVE',
                    internal_score: 500,
                    total_debt: 0,
                    active_loans_count: 0
                })
                .select('id')
                .single();

            if (customerError) {
                console.error('Error creating customer:', customerError);
                return false;
            }
            customerId = newCustomer.id;
        }

        // Create loan request
        const { error: requestError } = await supabase.from('loan_requests').insert({
            customer_id: customerId,
            client_name: data.name,
            cpf: data.cpf,
            email: data.email,
            phone: data.phone || '',
            amount: Number(data.income) * 3 || 5000,
            installments: 12,
            status: 'PENDING',
            father_phone: data.fatherPhone,
            mother_phone: data.motherPhone,
            spouse_phone: data.spousePhone,
            selfie_url: data.selfie,
            id_card_url: data.idCardFront,
            id_card_back_url: data.idCardBack,
            proof_of_address_url: data.proofAddress,
            proof_income_url: data.proofIncome,
            vehicle_url: data.vehicleFront,
            video_selfie_url: data.videoSelfie,
            video_house_url: data.videoHouse,
            video_vehicle_url: data.videoVehicle,
            signature_url: data.signature
        });

        if (requestError) {
            console.error('Error creating request:', requestError);
            return false;
        }

        return true;
    },

    approveLoan: async (id: string) => {
        // Get request details
        const { data: request } = await supabase
            .from('loan_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (!request) return false;

        // Update request status
        await supabase
            .from('loan_requests')
            .update({ status: 'APPROVED' })
            .eq('id', id);

        // Create loan
        const totalAmount = request.amount * 1.3;
        const { data: loan, error: loanError } = await supabase
            .from('loans')
            .insert({
                customer_id: request.customer_id,
                request_id: id,
                amount: request.amount,
                installments_count: request.installments,
                remaining_amount: totalAmount,
                status: 'APPROVED',
                start_date: new Date().toISOString()
            })
            .select('id')
            .single();

        if (loanError || !loan) {
            console.error('Error creating loan:', loanError);
            return false;
        }

        // Create installments
        const installmentAmount = totalAmount / request.installments;
        const installments = [];

        for (let i = 0; i < request.installments; i++) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (i + 1) * 30);

            installments.push({
                loan_id: loan.id,
                due_date: dueDate.toISOString().split('T')[0],
                amount: installmentAmount,
                status: 'OPEN'
            });
        }

        await supabase.from('installments').insert(installments);

        // Update customer stats
        await supabase
            .from('customers')
            .update({
                active_loans_count: request.customer_id ? 1 : 0,
                total_debt: totalAmount
            })
            .eq('id', request.customer_id);

        return true;
    },

    rejectLoan: async (id: string) => {
        const { error } = await supabase
            .from('loan_requests')
            .update({ status: 'REJECTED' })
            .eq('id', id);
        return !error;
    },

    requestSupplementalDoc: async (requestId: string, description: string) => {
        const { error } = await supabase
            .from('loan_requests')
            .update({
                status: 'WAITING_DOCS',
                supplemental_description: description,
                supplemental_requested_at: new Date().toISOString()
            })
            .eq('id', requestId);
        return !error;
    },

    uploadSupplementalDoc: async (requestId: string, docUrl: string) => {
        const { error } = await supabase
            .from('loan_requests')
            .update({
                status: 'PENDING',
                supplemental_doc_url: docUrl,
                supplemental_uploaded_at: new Date().toISOString()
            })
            .eq('id', requestId);
        return !error;
    },

    // ============================================
    // CLIENT LOANS
    // ============================================
    getClientLoans: async (): Promise<Loan[]> => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (!user) return [];

        // Get customer by email
        const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('email', user.email)
            .single();

        if (!customer) return [];

        const { data: loans } = await supabase
            .from('loans')
            .select(`
        *,
        installments (*)
      `)
            .eq('customer_id', customer.id)
            .order('created_at', { ascending: false });

        if (!loans) return [];

        return loans.map(l => ({
            id: l.id,
            amount: l.amount,
            installmentsCount: l.installments_count,
            remainingAmount: l.remaining_amount,
            status: l.status as LoanStatus,
            startDate: l.start_date,
            installments: (l.installments || []).map((i: any) => ({
                id: i.id,
                dueDate: i.due_date,
                amount: i.amount,
                status: i.status,
                pixCode: i.pix_code,
                proofUrl: i.proof_url,
                paidAt: i.paid_at
            }))
        }));
    },

    getClientPendingRequest: async (): Promise<LoanRequest | null> => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (!user) return null;

        const { data } = await supabase
            .from('loan_requests')
            .select('*')
            .eq('email', user.email)
            .in('status', ['PENDING', 'WAITING_DOCS'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!data) return null;

        return {
            id: data.id,
            clientName: data.client_name,
            cpf: data.cpf,
            email: data.email,
            phone: data.phone,
            amount: data.amount,
            installments: data.installments,
            status: data.status as LoanStatus,
            date: data.created_at,
            references: {
                fatherPhone: data.father_phone || '',
                motherPhone: data.mother_phone || '',
                spousePhone: data.spouse_phone || ''
            },
            documents: {},
            supplementalInfo: data.supplemental_description ? {
                requestedAt: data.supplemental_requested_at,
                description: data.supplemental_description,
                docUrl: data.supplemental_doc_url,
                uploadedAt: data.supplemental_uploaded_at
            } : undefined
        };
    },

    uploadPaymentProof: async (loanId: string, installmentId: string, proofUrl: string): Promise<boolean> => {
        // Update installment
        const { data: installment } = await supabase
            .from('installments')
            .update({
                status: 'PAID',
                proof_url: proofUrl,
                paid_at: new Date().toISOString()
            })
            .eq('id', installmentId)
            .select('amount')
            .single();

        if (!installment) return false;

        // Update loan remaining amount manually
        const { data: loanData } = await supabase
            .from('loans')
            .select('remaining_amount')
            .eq('id', loanId)
            .single();

        if (loanData) {
            await supabase
                .from('loans')
                .update({ remaining_amount: loanData.remaining_amount - installment.amount })
                .eq('id', loanId);
        }


        return true;
    },

    // ============================================
    // CUSTOMERS / CRM
    // ============================================
    getCustomers: async (): Promise<Customer[]> => {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('joined_at', { ascending: false });

        if (error) return [];

        return data.map(c => ({
            id: c.id,
            name: c.name,
            cpf: c.cpf,
            email: c.email,
            phone: c.phone,
            status: c.status as 'ACTIVE' | 'BLOCKED',
            internalScore: c.internal_score,
            totalDebt: c.total_debt,
            activeLoansCount: c.active_loans_count,
            joinedAt: c.joined_at,
            address: c.address,
            neighborhood: c.neighborhood,
            city: c.city,
            state: c.state,
            zipCode: c.zip_code,
            latitude: c.latitude,
            longitude: c.longitude,
            monthlyIncome: c.monthly_income,
            preApprovedOffer: c.pre_approved_amount ? {
                amount: c.pre_approved_amount,
                createdAt: c.pre_approved_at
            } : undefined
        }));
    },

    toggleCustomerStatus: async (id: string, status: string) => {
        const { error } = await supabase
            .from('customers')
            .update({ status })
            .eq('id', id);
        return !error;
    },

    sendPreApproval: async (customerId: string, amount: number) => {
        const { error } = await supabase
            .from('customers')
            .update({
                pre_approved_amount: amount,
                pre_approved_at: new Date().toISOString()
            })
            .eq('id', customerId);
        return !error;
    },

    getPreApproval: async (): Promise<number | null> => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (!user) return null;

        const { data } = await supabase
            .from('customers')
            .select('pre_approved_amount')
            .eq('email', user.email)
            .single();

        return data?.pre_approved_amount || null;
    },

    // ============================================
    // COLLECTION RULES
    // ============================================
    getCollectionRules: async (): Promise<CollectionRule[]> => {
        const { data } = await supabase
            .from('collection_rules')
            .select('*')
            .order('days_offset', { ascending: true });

        if (!data) return [];

        return data.map(r => ({
            id: r.id,
            daysOffset: r.days_offset,
            type: r.type,
            messageTemplate: r.message_template,
            active: r.active
        }));
    },

    saveCollectionRule: async (rule: CollectionRule) => {
        const { error } = await supabase.from('collection_rules').upsert({
            id: rule.id || undefined,
            days_offset: rule.daysOffset,
            type: rule.type,
            message_template: rule.messageTemplate,
            active: rule.active
        });
        return !error;
    },

    deleteCollectionRule: async (id: string) => {
        const { error } = await supabase.from('collection_rules').delete().eq('id', id);
        return !error;
    },

    // ============================================
    // TRANSACTIONS
    // ============================================
    getTransactions: async (): Promise<Transaction[]> => {
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (!data) return [];

        return data.map(t => ({
            id: t.id,
            type: t.type,
            description: t.description,
            amount: t.amount,
            date: t.date,
            category: t.category
        }));
    },

    getInteractionLogs: async (): Promise<InteractionLog[]> => {
        // This would be implemented with a chatbot interactions table
        return [];
    },

    // ============================================
    // WHATSAPP CONFIG
    // ============================================
    getWhatsappConfig: async (): Promise<WhatsappConfig> => {
        const { data } = await supabase
            .from('whatsapp_config')
            .select('*')
            .limit(1)
            .single();

        if (!data) {
            return { apiUrl: '', apiKey: '', instanceName: '', isConnected: false };
        }

        return {
            apiUrl: data.api_url || '',
            apiKey: data.api_key || '',
            instanceName: data.instance_name || '',
            isConnected: data.is_connected || false
        };
    },

    saveWhatsappConfig: async (c: WhatsappConfig) => {
        const { error } = await supabase.from('whatsapp_config').upsert({
            id: '00000000-0000-0000-0000-000000000001',
            api_url: c.apiUrl,
            api_key: c.apiKey,
            instance_name: c.instanceName,
            is_connected: c.isConnected,
            updated_at: new Date().toISOString()
        });
        return !error;
    },

    // ============================================
    // CAMPAIGNS
    // ============================================
    getCampaigns: async (): Promise<Campaign[]> => {
        const { data } = await supabase
            .from('campaigns')
            .select('*')
            .order('priority', { ascending: false });

        if (!data) return [];

        return data.map(c => ({
            id: c.id,
            title: c.title,
            description: c.description,
            imageUrl: c.image_url,
            link: c.link,
            startDate: c.start_date,
            endDate: c.end_date,
            frequency: c.frequency,
            active: c.active,
            priority: c.priority
        }));
    },

    saveCampaign: async (cmp: Campaign) => {
        const { error } = await supabase.from('campaigns').upsert({
            id: cmp.id || undefined,
            title: cmp.title,
            description: cmp.description,
            image_url: cmp.imageUrl,
            link: cmp.link,
            start_date: cmp.startDate,
            end_date: cmp.endDate,
            frequency: cmp.frequency,
            active: cmp.active,
            priority: cmp.priority
        });
        return !error;
    },

    deleteCampaign: async (id: string) => {
        const { error } = await supabase.from('campaigns').delete().eq('id', id);
        return !error;
    },

    getActiveCampaigns: async (): Promise<Campaign[]> => {
        const today = new Date().toISOString().split('T')[0];

        const { data } = await supabase
            .from('campaigns')
            .select('*')
            .eq('active', true)
            .lte('start_date', today)
            .gte('end_date', today)
            .order('priority', { ascending: false });

        if (!data) return [];

        return data.map(c => ({
            id: c.id,
            title: c.title,
            description: c.description,
            imageUrl: c.image_url,
            link: c.link,
            startDate: c.start_date,
            endDate: c.end_date,
            frequency: c.frequency,
            active: c.active,
            priority: c.priority
        }));
    },

    // ============================================
    // GOALS & PROJECTIONS
    // ============================================
    getGoalsSettings: async (): Promise<GoalsSettings> => {
        try {
            const { data } = await supabase
                .from('goals_settings')
                .select('*')
                .limit(1)
                .single();

            if (!data) return DEFAULT_GOALS;

            return {
                monthlyLoanGoal: data.monthly_loan_goal,
                monthlyClientGoal: data.monthly_client_goal,
                monthlyApprovalRateGoal: data.monthly_approval_rate_goal,
                projections: data.projections || DEFAULT_GOALS.projections,
                expectedGrowthRate: data.expected_growth_rate,
                goalPeriod: data.goal_period
            };
        } catch {
            return DEFAULT_GOALS;
        }
    },

    saveGoalsSettings: async (goals: GoalsSettings): Promise<boolean> => {
        const { error } = await supabase.from('goals_settings').upsert({
            id: '00000000-0000-0000-0000-000000000001',
            monthly_loan_goal: goals.monthlyLoanGoal,
            monthly_client_goal: goals.monthlyClientGoal,
            monthly_approval_rate_goal: goals.monthlyApprovalRateGoal,
            projections: goals.projections,
            expected_growth_rate: goals.expectedGrowthRate,
            goal_period: goals.goalPeriod,
            updated_at: new Date().toISOString()
        });
        return !error;
    },

    // ============================================
    // FILE UPLOAD (STORAGE)
    // ============================================
    uploadFile: async (bucket: string, path: string, file: File): Promise<string | null> => {
        try {
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            return null;
        }
    },

    // Helper to upload base64 image
    uploadBase64Image: async (bucket: string, path: string, base64: string): Promise<string | null> => {
        try {
            // Convert base64 to Blob
            const base64Data = base64.split(',')[1] || base64;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, blob, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'image/png'
                });

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Upload base64 error:', error);
            // Return the base64 as fallback for demo
            return base64;
        }
    }
};
