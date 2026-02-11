import { supabase } from './supabaseClient';
import { autoNotificationService } from './autoNotificationService';
import { deviceSecurityService } from './deviceSecurityService';
import { whatsappService } from './whatsappService';
import { emailService } from './emailService';
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
                    // Retorna erro de autenticação - sem fallbacks demo
                    console.error('Auth error:', authError);
                    return { user: null, error: authError };
                }

                // Get user profile from database
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_id', authData.user.id)
                    .single();

                // DEBUG: Log para verificar dados
                console.log('[Auth] Auth user ID:', authData.user.id);
                console.log('[Auth] User data from DB:', userData);
                console.log('[Auth] User error:', userError);

                // Normalizar role para uppercase
                const userRole = (userData?.role || 'CLIENT').toString().toUpperCase();
                console.log('[Auth] Final role:', userRole);

                const userId = userData?.id || authData.user.id;
                const userName = userData?.name || authData.user.email?.split('@')[0] || 'Usuário';
                const userEmail = authData.user.email || '';

                // 🔒 VERIFICAÇÃO DE SEGURANÇA DE DISPOSITIVO
                // Só aplica para clientes (não admins)
                if (userRole === 'CLIENT') {
                    try {
                        console.log('[Auth] 🔒 Checking device security...');
                        const deviceCheck = await deviceSecurityService.checkDevice(
                            userId,
                            userName,
                            userEmail
                        );

                        if (!deviceCheck.allowed) {
                            console.log('[Auth] ❌ Device blocked:', deviceCheck.blockReason);
                            // Faz logout da sessão criada
                            await supabase.auth.signOut();
                            return {
                                user: null,
                                error: {
                                    message: deviceCheck.blockReason || 'Dispositivo não autorizado. Entre em contato com o suporte.',
                                    code: 'DEVICE_BLOCKED'
                                }
                            };
                        }

                        if (deviceCheck.isNewDevice) {
                            console.log('[Auth] ⚠️ New device registered');
                        }

                        console.log('[Auth] ✅ Device check passed');
                    } catch (deviceError) {
                        console.error('[Auth] Device security check error:', deviceError);
                        // Não bloqueia em caso de erro na verificação, apenas loga
                    }
                }

                const user = {
                    id: userId,
                    name: userName,
                    email: userEmail,
                    role: userRole,
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

        signUp: async (email: string, password: string, name: string, role: UserRole = UserRole.CLIENT, phone?: string) => {
            try {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { name, role, phone },
                        emailRedirectTo: `${window.location.origin}/#/login?confirmed=true`
                    }
                });

                if (authError) throw authError;

                // Create user profile
                if (authData.user) {
                    await supabase.from('users').insert({
                        auth_id: authData.user.id,
                        name,
                        email,
                        role,
                        ...(phone ? { phone } : {})
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

    resetPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
        try {
            // Se o email não tem @, adiciona o domínio padrão
            const formattedEmail = email.includes('@') ? email : `${email}@tubarao.local`;

            const { error } = await supabase.auth.resetPasswordForEmail(formattedEmail, {
                redirectTo: `${window.location.origin}/#/reset-password`
            });

            if (error) {
                console.error('Reset password error:', error);
                return { success: false, message: 'Erro ao enviar email. Verifique o endereço.' };
            }

            return { success: true, message: 'Email de recuperação enviado! Verifique sua caixa de entrada.' };
        } catch (err) {
            console.error('Reset password error:', err);
            return { success: false, message: 'Erro ao processar solicitação.' };
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
            // Método 1: Tentar usar Edge Function (requer deploy no Supabase)
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            const supabaseUrl = 'https://cwhiujeragsethxjekkb.supabase.co';

            let authUserId: string | null = null;

            if (token) {
                try {
                    const response = await fetch(
                        `${supabaseUrl}/functions/v1/create-user`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                email: userData.email,
                                password: userData.password,
                                name: userData.name,
                                role: userData.role,
                                cpf: userData.cpf,
                                phone: userData.phone
                            })
                        }
                    );

                    const result = await response.json();
                    if (result.success && result.user?.id) {
                        console.log('User created via Edge Function');
                        authUserId = result.user.id;
                    }
                } catch (edgeFnError) {
                    console.log('Edge Function not available, using fallback...');
                }
            }

            // Método 2: Fallback - usar signUp (requer confirmação de email desabilitada no Supabase)
            if (!authUserId) {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: userData.email,
                    password: userData.password,
                    options: {
                        data: {
                            name: userData.name,
                            role: userData.role
                        }
                    }
                });

                if (authError) {
                    console.error('Auth error creating user:', authError);
                    return false;
                }

                // Verificar se o usuário foi criado (não apenas "awaiting confirmation")
                if (!authData.user) {
                    console.error('User not created - check email confirmation settings');
                    return false;
                }

                authUserId = authData.user.id;

                // Criar perfil na tabela users
                const { error: profileError } = await supabase.from('users').insert({
                    auth_id: authUserId,
                    name: userData.name,
                    email: userData.email,
                    role: userData.role
                });

                if (profileError) {
                    console.error('Profile error:', profileError);
                }
            }

            // Se for Cliente, criar registro na tabela customers também
            if (userData.role === 'CLIENT' && authUserId) {
                // Primeiro, buscar o ID do usuário na tabela users
                const { data: userRecord } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_id', authUserId)
                    .single();

                const userId = userRecord?.id || null;

                const { error: customerError } = await supabase.from('customers').insert({
                    user_id: userId,
                    name: userData.name,
                    cpf: userData.cpf || '000.000.000-00',
                    email: userData.email,
                    phone: userData.phone || '',
                    status: 'ACTIVE',
                    internal_score: 500, // Score inicial
                    total_debt: 0,
                    active_loans_count: 0,
                    address: userData.address || null,
                    neighborhood: userData.neighborhood || null,
                    city: userData.city || null,
                    state: userData.state || null,
                    zip_code: userData.zipCode || null,
                    monthly_income: userData.monthlyIncome || null
                });

                if (customerError) {
                    console.error('Customer creation error:', customerError);
                    // Não falhar se o customer não foi criado, usuário já existe
                } else {
                    console.log('Customer created successfully');
                }
            }

            return true;
        } catch (err) {
            console.error('Create user error:', err);
            return false;
        }
    },

    deleteUser: async (id: string): Promise<boolean> => {
        try {
            // 1. Buscar dados do usuário antes de deletar
            const { data: userData } = await supabase
                .from('users')
                .select('auth_id, email')
                .eq('id', id)
                .single();

            if (!userData) {
                console.error('User not found');
                return false;
            }

            // 2. Tentar usar Edge Function para deleção completa (inclui Auth)
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            const supabaseUrl = 'https://cwhiujeragsethxjekkb.supabase.co';

            if (token) {
                try {
                    const response = await fetch(
                        `${supabaseUrl}/functions/v1/delete-user`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                userId: id,
                                authId: userData.auth_id,
                                email: userData.email
                            })
                        }
                    );

                    const result = await response.json();
                    if (result.success) {
                        console.log('User deleted via Edge Function (including Auth)');
                        return true;
                    }
                } catch (edgeFnError) {
                    console.log('Edge Function not available, using fallback...');
                }
            }

            // 3. Fallback: Deletar localmente (sem Auth)
            // Deletar customer associado (se existir)
            await supabase.from('customers').delete().eq('email', userData.email);

            // Deletar da tabela users
            const { error: userError } = await supabase
                .from('users')
                .delete()
                .eq('id', id);

            if (userError) {
                console.error('Error deleting user:', userError);
                return false;
            }

            console.log('User deleted from users and customers tables (Auth remains)');
            return true;
        } catch (err) {
            console.error('Delete user error:', err);
            return false;
        }
    },

    // Atualizar usuário
    updateUser: async (id: string, userData: { name?: string; role?: UserRole; phone?: string; address?: string; city?: string; neighborhood?: string }): Promise<boolean> => {
        try {
            // Atualizar na tabela users
            const { error: userError } = await supabase
                .from('users')
                .update({
                    name: userData.name,
                    role: userData.role,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (userError) {
                console.error('Error updating user:', userError);
                return false;
            }

            // Buscar email do usuário para atualizar customers
            const { data: userRecord } = await supabase
                .from('users')
                .select('email')
                .eq('id', id)
                .single();

            if (userRecord?.email) {
                // Atualizar dados adicionais na tabela customers (se existir)
                await supabase
                    .from('customers')
                    .update({
                        name: userData.name,
                        phone: userData.phone,
                        address: userData.address,
                        city: userData.city,
                        neighborhood: userData.neighborhood,
                        updated_at: new Date().toISOString()
                    })
                    .eq('email', userRecord.email);
            }

            return true;
        } catch (err) {
            console.error('Update user error:', err);
            return false;
        }
    },

    // Resetar senha do usuário (Admin only)
    resetUserPassword: async (id: string, newPassword: string): Promise<boolean> => {
        try {
            // Buscar o email do usuário
            const { data: user, error: fetchError } = await supabase
                .from('users')
                .select('email')
                .eq('id', id)
                .single();

            if (fetchError || !user?.email) {
                console.error('User not found:', fetchError);
                return false;
            }

            // Gerar hash da nova senha
            const passwordHash = btoa(newPassword); // Simples para demo, usar bcrypt em produção

            // Atualizar a senha na tabela users
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) {
                console.error('Error resetting password:', updateError);
                return false;
            }

            console.log('Password reset successfully for user:', user.email);
            return true;
        } catch (err) {
            console.error('Reset password error:', err);
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
            // Campos que devem sempre permanecer como string (nunca converter para número)
            const stringOnlyKeys = ['pixKey', 'pixKeyType', 'pixReceiverName', 'lateInterestDailyType', 'lateInterestMonthlyType', 'lateInterestYearlyType', 'lateFixedFeeType'];
            data.forEach(item => {
                // Se é um campo que deve ser string, manter como string
                if (stringOnlyKeys.includes(item.key)) {
                    settings[item.key] = item.value;
                } else {
                    // Tentar parsear como número, senão manter como string
                    const numValue = parseFloat(item.value);
                    settings[item.key] = isNaN(numValue) ? item.value : numValue;
                }
            });

            return {
                monthlyInterestRate: settings.monthlyInterestRate || 5,
                lateFeeRate: settings.lateFeeRate || 2,
                lateInterestDaily: settings.lateInterestDaily || 0,
                lateInterestDailyType: settings.lateInterestDailyType || 'PERCENT',
                lateInterestMonthly: settings.lateInterestMonthly || 0,
                lateInterestMonthlyType: settings.lateInterestMonthlyType || 'PERCENT',
                lateInterestYearly: settings.lateInterestYearly || 0,
                lateInterestYearlyType: settings.lateInterestYearlyType || 'PERCENT',
                lateFixedFee: settings.lateFixedFee || 0,
                lateFixedFeeType: settings.lateFixedFeeType || 'FIXED',
                pixKey: settings.pixKey || '',
                pixKeyType: settings.pixKeyType || 'ALEATORIA',
                pixReceiverName: settings.pixReceiverName || '',
            };
        } catch {
            return { monthlyInterestRate: 5, lateFeeRate: 2 };
        }
    },

    updateSettings: async (s: SystemSettings) => {
        const updates = [
            { key: 'monthlyInterestRate', value: s.monthlyInterestRate?.toString() || '0' },
            { key: 'lateFeeRate', value: s.lateFeeRate?.toString() || '0' },
            { key: 'lateInterestDaily', value: s.lateInterestDaily?.toString() || '0' },
            { key: 'lateInterestDailyType', value: s.lateInterestDailyType || 'PERCENT' },
            { key: 'lateInterestMonthly', value: s.lateInterestMonthly?.toString() || '0' },
            { key: 'lateInterestMonthlyType', value: s.lateInterestMonthlyType || 'PERCENT' },
            { key: 'lateInterestYearly', value: s.lateInterestYearly?.toString() || '0' },
            { key: 'lateInterestYearlyType', value: s.lateInterestYearlyType || 'PERCENT' },
            { key: 'lateFixedFee', value: s.lateFixedFee?.toString() || '0' },
            { key: 'lateFixedFeeType', value: s.lateFixedFeeType || 'FIXED' },
            { key: 'pixKey', value: s.pixKey || '' },
            { key: 'pixKeyType', value: s.pixKeyType || 'ALEATORIA' },
            { key: 'pixReceiverName', value: s.pixReceiverName || '' },
        ];

        await supabase.from('system_settings').upsert(updates, { onConflict: 'key' });
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
            profileType: r.profile_type || undefined,
            limpaNomeContractSigned: r.limpa_nome_contract_signed || false,
            limpaNomeContractDate: r.limpa_nome_contract_date || undefined,
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
            supplementalInfo: r.supplemental_requested_at ? {
                requestedAt: r.supplemental_requested_at,
                description: r.supplemental_description,
                docUrl: r.supplemental_doc_url,
                uploadedAt: r.supplemental_uploaded_at
            } : undefined,
            supplementalDescription: r.supplemental_description || undefined,
            signatureUrl: r.signature_url,
            contractPdfUrl: r.contract_pdf_url || (() => {
                // Fallback: tentar extrair do supplemental_description JSON
                try {
                    const desc = JSON.parse(r.supplemental_description || '{}');
                    return desc.contractPdfUrl || undefined;
                } catch { return undefined; }
            })()
        }));
    },

    submitRequest: async (data: any) => {
        try {
            // First, find or create customer
            // Buscar por CPF primeiro
            let { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('cpf', data.cpf)
                .single();

            let customerId = existingCustomer?.id;

            // Se não achou por CPF, tentar por email (evita duplicatas)
            if (!customerId && data.email) {
                const { data: customerByEmail } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('email', data.email)
                    .single();
                customerId = customerByEmail?.id;
            }

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
                    console.error('❌ Error creating customer:', customerError);
                    // Tentar buscar novamente (pode ter sido criado por outro request simultâneo)
                    const { data: retryCustomer } = await supabase
                        .from('customers')
                        .select('id')
                        .or(`cpf.eq.${data.cpf},email.eq.${data.email}`)
                        .limit(1)
                        .single();

                    if (retryCustomer?.id) {
                        customerId = retryCustomer.id;
                    } else {
                        return false;
                    }
                } else {
                    customerId = newCustomer.id;
                    // 🎉 Novo cliente! Enviar boas-vindas
                    autoNotificationService.onWelcome(data.email, data.name, data.phone).catch(console.error);
                }
            }

            // Create loan request
            // Helper para serializar arrays de URLs
            const serializeUrls = (urls: string | string[]): string => {
                if (!urls) return '';
                if (Array.isArray(urls)) {
                    return urls.length > 0 ? JSON.stringify(urls) : '';
                }
                return urls;
            };

            // Montar dados do request
            // Campos BASE (garantidos no schema original)
            const baseData: any = {
                customer_id: customerId,
                client_name: data.name,
                cpf: data.cpf,
                email: data.email,
                phone: data.phone || '',
                amount: Number(data.amount) || (data.profileType === 'LIMPA_NOME' ? 0 : 1000),
                installments: data.installments || 4,
                status: 'PENDING',
                father_phone: data.contactTrust1 ? `${data.contactTrust1Name || 'Ref 1'}: ${data.contactTrust1}` : (data.fatherPhone || null),
                mother_phone: data.contactTrust2 ? `${data.contactTrust2Name || 'Ref 2'}: ${data.contactTrust2}` : (data.motherPhone || null),
                spouse_phone: data.spousePhone || null,
                selfie_url: typeof data.selfie === 'string' ? data.selfie : '',
                id_card_url: serializeUrls(data.idCardFront),
                id_card_back_url: serializeUrls(data.idCardBack),
                proof_of_address_url: serializeUrls(data.proofAddress),
                proof_income_url: serializeUrls(data.proofIncome),
                vehicle_url: serializeUrls(data.vehicleFront),
                video_selfie_url: typeof data.videoSelfie === 'string' ? data.videoSelfie : '',
                video_house_url: typeof data.videoHouse === 'string' ? data.videoHouse : '',
                video_vehicle_url: typeof data.videoVehicle === 'string' ? data.videoVehicle : '',
                signature_url: typeof data.signature === 'string' ? data.signature : '',
                // supplemental_description sempre existe (TEXT no schema base)
                supplemental_description: JSON.stringify({
                    occupation: data.occupation || 'N/A',
                    instagram: data.instagram || 'N/A',
                    workCardSent: data.workCard?.length ? true : false,
                    housePhotos: serializeUrls(data.housePhotos),
                    billInName: serializeUrls(data.billInName),
                    location: data.location || null,
                    guarantee: data.guarantee ? {
                        type: data.guarantee.type,
                        description: data.guarantee.description,
                        estimatedValue: data.guarantee.estimatedValue,
                        photos: data.guarantee.photos,
                        video: data.guarantee.video || ''
                    } : null,
                    motoColor: data.motoColor || null,
                    // Endereço do cliente
                    cep: data.cep || null,
                    address: data.address || null,
                    number: data.number || null,
                    // Guardar dados extras no JSON como fallback seguro
                    isReturningClient: data.isReturningClient || false,
                    returningClientNote: data.returningClientNote || '',
                    limpaNomeContractSigned: data.limpaNomeContractSigned || false,
                    birthDate: data.birthDate || null
                })
            };

            // Campos ESTENDIDOS (adicionados por migrações - podem não existir)
            const extendedFields: Record<string, any> = {
                profile_type: data.profileType || 'CLT',
                service_type: data.profileType === 'LIMPA_NOME' ? 'SERVICO' : data.profileType === 'MOTO' ? 'FINANCIAMENTO' : 'EMPRESTIMO',
                birth_date: data.birthDate || null,
                limpa_nome_contract_signed: data.limpaNomeContractSigned || false,
                limpa_nome_contract_date: data.limpaNomeContractSigned ? new Date().toISOString() : null,
                is_returning_client: data.isReturningClient || false,
                returning_client_note: data.returningClientNote || '',
            };

            console.log('📤 Enviando request para DB:', { profileType: data.profileType, amount: baseData.amount, customerId });

            // Tentativa 1: com TODOS os campos (base + estendidos)
            const fullData = { ...baseData, ...extendedFields };
            let { error: requestError } = await supabase.from('loan_requests').insert(fullData);

            if (!requestError) {
                console.log('✅ Request criado com sucesso (todos os campos)!');
                return true;
            }

            console.error('❌ Erro com todos os campos:', requestError.message || requestError);

            // Tentativa 2: remover colunas que o erro indica como inexistentes
            // PostgREST retorna erro com nome da coluna que não existe
            const errorMsg = requestError.message || '';
            if (errorMsg.includes('does not exist') || requestError.code === 'PGRST204' || requestError.code === '42703') {
                // Remover progressivamente campos estendidos e tentar novamente
                const fieldsToTry = Object.keys(extendedFields);
                let currentData = { ...fullData };

                for (const field of fieldsToTry) {
                    if (errorMsg.includes(field)) {
                        console.log(`⚠️ Removendo campo inexistente: ${field}`);
                        delete currentData[field];
                    }
                }

                const retry1 = await supabase.from('loan_requests').insert(currentData);
                if (!retry1.error) {
                    console.log('✅ Request criado com sucesso (após remover campos)!');
                    return true;
                }
                console.error('❌ Erro na segunda tentativa:', retry1.error.message || retry1.error);
            }

            // Tentativa 3: FALLBACK - usar APENAS campos base (schema original)
            console.log('⚠️ Tentando com apenas campos base...');
            const retry2 = await supabase.from('loan_requests').insert(baseData);

            if (!retry2.error) {
                console.log('✅ Request criado com sucesso (apenas campos base)!');
                return true;
            }

            console.error('❌ Erro mesmo com campos base:', retry2.error.message || retry2.error);
            return false;
        } catch (err) {
            console.error('❌ Exceção em submitRequest:', err);
            return false;
        }
    },

    // Submeter solicitação de cliente antigo (formulário simplificado)
    submitReturningClientRequest: async (data: {
        name: string;
        cpf: string;
        phone: string;
        email: string;
        instagram?: string;
        birthDate?: string;
        amount: number;
        preferredDueDay: number;
    }): Promise<boolean> => {
        try {
            // Verificar se já existe cliente com esse CPF
            let { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('cpf', data.cpf)
                .single();

            let customerId = existingCustomer?.id;

            // Se não existe, criar cliente
            if (!customerId) {
                const { data: newCustomer, error: customerError } = await supabase
                    .from('customers')
                    .insert({
                        name: data.name,
                        cpf: data.cpf,
                        email: data.email,
                        phone: data.phone,
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

            // Criar loan_request com status RETURNING_PENDING
            const { error: requestError } = await supabase.from('loan_requests').insert({
                customer_id: customerId,
                client_name: data.name,
                cpf: data.cpf,
                email: data.email,
                phone: data.phone,
                amount: data.amount,
                installments: 12,
                status: 'RETURNING_PENDING', // Status especial para cliente antigo
                is_returning_client: true,
                returning_client_note: `Instagram: ${data.instagram || 'N/A'} | Data Nasc: ${data.birthDate || 'N/A'} | Vencimento preferido: Dia ${data.preferredDueDay}`
            });

            if (requestError) {
                console.error('Error creating returning client request:', requestError);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in submitReturningClientRequest:', error);
            return false;
        }
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

        // ✅ Enviar notificação automática de aprovação
        if (request.email) {
            await autoNotificationService.onLoanApproved(request.email, request.amount);
        }

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

    updateLoanRequestValues: async (id: string, amount: number, installments: number) => {
        const { error } = await supabase
            .from('loan_requests')
            .update({
                amount: amount,
                installments: installments
            })
            .eq('id', id);
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
            .order('joined_at', { ascending: false })
            .limit(5000);

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
            } : undefined,
            customRates: c.custom_rates ? {
                monthlyInterestRate: c.custom_rates.monthly_interest_rate,
                lateFixedFee: c.custom_rates.late_fixed_fee,
                lateInterestDaily: c.custom_rates.late_interest_daily,
                lateInterestMonthly: c.custom_rates.late_interest_monthly
            } : undefined,
            installmentOffer: c.installment_offer || undefined
        }));
    },

    toggleCustomerStatus: async (id: string, status: string) => {
        const { error } = await supabase
            .from('customers')
            .update({ status })
            .eq('id', id);
        return !error;
    },

    updateCustomer: async (id: string, data: {
        name?: string;
        cpf?: string;
        email?: string;
        phone?: string;
        address?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        monthlyIncome?: number;
    }): Promise<boolean> => {
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.cpf) updateData.cpf = data.cpf;
        if (data.email) updateData.email = data.email;
        if (data.phone) updateData.phone = data.phone;
        if (data.address) updateData.address = data.address;
        if (data.neighborhood) updateData.neighborhood = data.neighborhood;
        if (data.city) updateData.city = data.city;
        if (data.state) updateData.state = data.state;
        if (data.zipCode) updateData.zip_code = data.zipCode;
        if (data.monthlyIncome !== undefined) updateData.monthly_income = data.monthlyIncome;

        const { error } = await supabase
            .from('customers')
            .update(updateData)
            .eq('id', id);

        return !error;
    },

    createUserFromCustomer: async (customerId: string, password: string): Promise<{ success: boolean; error?: string }> => {
        // Buscar dados do cliente
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('name, email, phone, cpf')
            .eq('id', customerId)
            .single();

        if (fetchError || !customer) {
            return { success: false, error: 'Cliente não encontrado' };
        }

        // Verificar se já existe usuário com esse email ou CPF
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .or(`email.eq.${customer.email},cpf.eq.${customer.cpf}`)
            .single();

        if (existingUser) {
            return { success: false, error: 'Já existe um usuário com este email ou CPF' };
        }

        // Criar usuário
        const { error: insertError } = await supabase
            .from('users')
            .insert({
                name: customer.name,
                email: customer.email,
                cpf: customer.cpf,
                phone: customer.phone,
                password: password, // Em produção, deveria ser hash
                role: 'client',
                customer_id: customerId,
                created_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('Error creating user:', insertError);
            return { success: false, error: insertError.message };
        }

        return { success: true };
    },

    sendPreApproval: async (customerId: string, amount: number) => {
        // Buscar dados do cliente
        const { data: customer } = await supabase
            .from('customers')
            .select('name, email, phone')
            .eq('id', customerId)
            .single();

        // Atualizar no banco
        const { error } = await supabase
            .from('customers')
            .update({
                pre_approved_amount: amount,
                pre_approved_at: new Date().toISOString()
            })
            .eq('id', customerId);

        if (error) return false;

        // Enviar notificações se cliente encontrado
        if (customer) {
            const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

            // 📱 Enviar WhatsApp
            if (customer.phone) {
                const whatsappMsg = `🎉 *OFERTA PRÉ-APROVADA!*\n\n` +
                    `Olá ${customer.name.split(' ')[0]}!\n\n` +
                    `Você tem *R$ ${formattedAmount}* pré-aprovados para empréstimo!\n\n` +
                    `✅ Aproveite essa oportunidade exclusiva!\n\n` +
                    `📱 *Acesse o App:*\nhttps://www.tubaraoemprestimo.com.br/\n\n` +
                    `_Tubarão Empréstimos 🦈_`;

                whatsappService.sendMessage(customer.phone, whatsappMsg).catch(console.error);
            }

            // 📧 Enviar Email
            if (customer.email) {
                emailService.sendEmail({
                    to: customer.email,
                    subject: `🎉 Você tem R$ ${formattedAmount} pré-aprovados!`,
                    html: `<h1>Parabéns ${customer.name}!</h1>
                        <p>Você tem <strong>R$ ${formattedAmount}</strong> pré-aprovados para empréstimo!</p>
                        <p>Aproveite essa oportunidade exclusiva. Acesse seu app para contratar.</p>
                        <p>Tubarão Empréstimos 🦈</p>`
                }).catch(console.error);

                // 🔔 Notificação no app (UMA VEZ apenas)
                autoNotificationService.createNotification(
                    customer.email,
                    '🎉 Crédito Pré-Aprovado',
                    `Você tem R$ ${formattedAmount} pré-aprovados para empréstimo! Aproveite!`,
                    'SUCCESS',
                    '/client/dashboard'
                ).catch(console.error);
            }
        }

        return true;
    },

    updateCustomerRates: async (customerId: string, rates?: {
        monthlyInterestRate?: number;
        lateFixedFee?: number;
        lateInterestDaily?: number;
        lateInterestMonthly?: number;
    }) => {
        const customRates = rates ? {
            monthly_interest_rate: rates.monthlyInterestRate,
            late_fixed_fee: rates.lateFixedFee,
            late_interest_daily: rates.lateInterestDaily,
            late_interest_monthly: rates.lateInterestMonthly
        } : null;

        const { error } = await supabase
            .from('customers')
            .update({ custom_rates: customRates })
            .eq('id', customerId);

        return !error;
    },

    sendInstallmentOffer: async (customerId: string, offer: {
        amount: number;
        installments: number;
        interestRate: number;
        installmentValue: number;
        totalAmount: number;
        expiresAt?: string;
    }) => {
        // Buscar dados do cliente
        const { data: customer } = await supabase
            .from('customers')
            .select('name, email, phone')
            .eq('id', customerId)
            .single();

        const expiresAt = offer.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Salvar no banco
        const { error } = await supabase
            .from('customers')
            .update({
                installment_offer: {
                    amount: offer.amount,
                    installments: offer.installments,
                    interest_rate: offer.interestRate,
                    installment_value: offer.installmentValue,
                    total_amount: offer.totalAmount,
                    expires_at: expiresAt,
                    created_at: new Date().toISOString()
                }
            })
            .eq('id', customerId);

        if (error) return false;

        // Enviar notificações se cliente encontrado
        if (customer) {
            const formattedAmount = offer.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const formattedInstallment = offer.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const expiresDate = new Date(expiresAt).toLocaleDateString('pt-BR');

            // 📱 Enviar WhatsApp
            if (customer.phone) {
                const whatsappMsg = `💰 *OFERTA ESPECIAL DE PARCELAMENTO!*\n\n` +
                    `Olá ${customer.name.split(' ')[0]}!\n\n` +
                    `Preparamos uma oferta exclusiva para você:\n\n` +
                    `💵 Valor: *R$ ${formattedAmount}*\n` +
                    `📅 Parcelas: *${offer.installments}x de R$ ${formattedInstallment}*\n` +
                    `📊 Taxa: *${offer.interestRate}% a.m.*\n\n` +
                    `⏰ Válido até: ${expiresDate}\n\n` +
                    `📱 *Acesse o App:*\nhttps://www.tubaraoemprestimo.com.br/\n\n` +
                    `_Tubarão Empréstimos 🦈_`;

                whatsappService.sendMessage(customer.phone, whatsappMsg).catch(console.error);
            }

            // 📧 Enviar Email
            if (customer.email) {
                emailService.sendEmail({
                    to: customer.email,
                    subject: `💰 Oferta Especial: R$ ${formattedAmount} em ${offer.installments}x!`,
                    html: `<h1>Olá ${customer.name}!</h1>
                        <p>Preparamos uma oferta especial de parcelamento para você:</p>
                        <ul>
                            <li><strong>Valor:</strong> R$ ${formattedAmount}</li>
                            <li><strong>Parcelas:</strong> ${offer.installments}x de R$ ${formattedInstallment}</li>
                            <li><strong>Taxa:</strong> ${offer.interestRate}% a.m.</li>
                        </ul>
                        <p>⏰ <strong>Válido até:</strong> ${expiresDate}</p>
                        <p>Acesse seu app para aceitar essa oferta exclusiva!</p>
                        <p>Tubarão Empréstimos 🦈</p>`
                }).catch(console.error);

                // 🔔 Notificação no app (UMA VEZ apenas)
                autoNotificationService.createNotification(
                    customer.email,
                    '💰 Oferta Especial de Parcelamento!',
                    `R$ ${formattedAmount} em ${offer.installments}x de R$ ${formattedInstallment}. Válido até ${expiresDate}.`,
                    'SUCCESS',
                    '/client/dashboard'
                ).catch(console.error);
            }
        }

        return true;
    },

    deleteInstallmentOffer: async (customerId: string) => {
        const { error } = await supabase
            .from('customers')
            .update({ installment_offer: null })
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

    getClientInstallmentOffer: async () => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (!user) return null;

        const { data } = await supabase
            .from('customers')
            .select('installment_offer')
            .eq('email', user.email)
            .single();

        if (!data?.installment_offer) return null;

        const offer = data.installment_offer;
        return {
            amount: offer.amount,
            installments: offer.installments,
            interestRate: offer.interest_rate,
            installmentValue: offer.installment_value,
            totalAmount: offer.total_amount,
            createdAt: offer.created_at
        };
    },

    getClientNotifications: async () => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (!user) return [];

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('customer_email', user.email)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error || !data) return [];

        return data.map((n: any) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            created_at: n.created_at,
            read: n.read || false
        }));
    },

    // Criar notificação para um cliente
    createNotification: async (
        customerEmail: string,
        title: string,
        message: string,
        type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS' = 'INFO'
    ): Promise<boolean> => {
        const { error } = await supabase.from('notifications').insert({
            customer_email: customerEmail,
            title,
            message,
            type,
            read: false
        });
        return !error;
    },

    getClientCoupons: async () => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (!user) return [];

        // Buscar todos os cupons ativos e não expirados
        // Cupons com customer_email NULL são para todos
        // Cupons com customer_email específico são apenas para aquele cliente
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('active', true)
            .gte('expires_at', new Date().toISOString());

        if (error || !data) {
            console.log('Erro ao buscar cupons:', error);
            return [];
        }

        // Filtrar: cupons gerais (sem email) + cupons específicos para este cliente
        const filteredCoupons = data.filter((c: any) =>
            c.customer_email === null || c.customer_email === '' || c.customer_email === user.email
        );

        return filteredCoupons.map((c: any) => ({
            code: c.code,
            discount: c.discount,
            description: c.description || '',
            expiresAt: c.expires_at
        }));
    },

    // Admin Coupon Management
    getCoupons: async () => {
        const { data } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });

        if (!data) return [];

        return data.map((c: any) => ({
            id: c.id,
            code: c.code,
            discount: c.discount,
            description: c.description || '',
            customerEmail: c.customer_email,
            active: c.active,
            expiresAt: c.expires_at,
            createdAt: c.created_at
        }));
    },

    saveCoupon: async (coupon: {
        id?: string;
        code: string;
        discount: number;
        description: string;
        customerEmail: string | null;
        expiresAt: string;
        active: boolean;
    }) => {
        const isNew = !coupon.id;

        const { data: savedCoupon, error } = await supabase.from('coupons').upsert({
            id: coupon.id || undefined,
            code: coupon.code,
            discount: coupon.discount,
            description: coupon.description,
            customer_email: coupon.customerEmail,
            expires_at: coupon.expiresAt,
            active: coupon.active
        }).select().single();

        if (error) return false;

        // 📢 Se for um NOVO cupom ativo, enviar notificação
        if (isNew && coupon.active && savedCoupon) {
            const expiresDate = new Date(coupon.expiresAt).toLocaleDateString('pt-BR');

            if (coupon.customerEmail) {
                // Cupom para cliente específico
                await autoNotificationService.createNotification(
                    coupon.customerEmail,
                    '🎟️ Cupom Exclusivo!',
                    `Use o código ${coupon.code} e ganhe ${coupon.discount}% de desconto! Válido até ${expiresDate}.`,
                    'SUCCESS',
                    '/client/dashboard'
                );

                // Buscar telefone do cliente
                const { data: customer } = await supabase
                    .from('customers')
                    .select('phone, name')
                    .eq('email', coupon.customerEmail)
                    .single();

                if (customer?.phone) {
                    whatsappService.sendMessage(
                        customer.phone,
                        `🎟️ *CUPOM EXCLUSIVO!*\n\n` +
                        `Olá ${customer.name?.split(' ')[0] || 'Cliente'}!\n\n` +
                        `Use o código *${coupon.code}* e ganhe *${coupon.discount}% de desconto*!\n\n` +
                        `📋 ${coupon.description || 'Aproveite essa oferta!'}\n` +
                        `⏰ Válido até: ${expiresDate}\n\n` +
                        `📱 *Acesse o App:*\nhttps://www.tubaraoemprestimo.com.br/\n\n` +
                        `_Tubarão Empréstimos 🦈_`
                    ).catch(console.error);
                }
            }
            // Nota: Cupons para todos os clientes são enviados via Edge Function send-campaign
        }

        return true;
    },

    deleteCoupon: async (id: string) => {
        const { error } = await supabase.from('coupons').delete().eq('id', id);
        return !error;
    },
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
        try {
            const { data, error } = await supabase
                .from('ai_chat_history')
                .select(`
                    id,
                    phone,
                    role,
                    message,
                    created_at,
                    customers ( name )
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error fetching interaction logs:', error);
                return [];
            }

            if (!data) return [];

            const interactions: InteractionLog[] = [];

            // Process reverse to perform grouping (start from oldest? No, rely on index logic)
            // Array is Newest -> Oldest

            for (let i = 0; i < data.length; i++) {
                const msg = data[i];

                // We only care about User messages as the "root" of an interaction
                if (msg.role === 'user') {
                    // Look for the reply (which should be NEWER, i.e., lower index)
                    let reply = '';
                    // Check if the previous item in the array (newer in time) is an assistant message
                    if (i > 0 && data[i - 1].role === 'assistant') {
                        reply = data[i - 1].message;
                    }

                    // Simple intent classification based on keywords
                    let intent: 'PAYMENT_PROMISE' | 'REQUEST_BOLETO' | 'SUPPORT' | 'UNKNOWN' = 'UNKNOWN';
                    const text = msg.message.toLowerCase();

                    if (text.includes('pagar') || text.includes('prometo') || text.includes('hoje') || text.includes('depósito')) {
                        intent = 'PAYMENT_PROMISE';
                    } else if (text.includes('boleto') || text.includes('link') || text.includes('pix') || text.includes('fatura')) {
                        intent = 'REQUEST_BOLETO';
                    } else if (text.includes('ajuda') || text.includes('falar') || text.includes('atendente') || text.includes('humano')) {
                        intent = 'SUPPORT';
                    }

                    interactions.push({
                        id: msg.id,
                        userName: (Array.isArray(msg.customers) ? (msg.customers[0] as any)?.name : (msg.customers as any)?.name) || msg.phone,
                        userRole: 'CLIENT',
                        message: msg.message,
                        intent: intent,
                        reply: reply,
                        timestamp: msg.created_at
                    });
                }
            }

            return interactions;
        } catch (error) {
            console.error('Exception in getInteractionLogs:', error);
            return [];
        }
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
        const isNew = !cmp.id;

        const { data: savedCampaign, error } = await supabase.from('campaigns').upsert({
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
        }).select().single();

        if (error) return false;

        // 📢 Se for uma NOVA campanha ativa, enviar notificação para todos os clientes
        if (isNew && cmp.active && savedCampaign) {
            // Buscar todos os clientes com email
            const { data: customers } = await supabase
                .from('customers')
                .select('email')
                .not('email', 'is', null);

            if (customers) {
                // Criar notificação para cada cliente
                for (const customer of customers) {
                    if (customer.email) {
                        autoNotificationService.createNotification(
                            customer.email,
                            `📢 ${cmp.title}`,
                            cmp.description,
                            'INFO',
                            cmp.link || '/client/dashboard'
                        ).catch(console.error);
                    }
                }
            }
            // Nota: O WhatsApp para campanhas é enviado via Edge Function send-campaign na página Marketing
        }

        return true;
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
            console.log(`📤 Iniciando upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) -> ${bucket}/${path}`);

            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error(`❌ Erro no upload de ${file.name}:`, error.message);
                throw error;
            }

            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            console.log(`✅ Upload concluído: ${urlData.publicUrl}`);
            return urlData.publicUrl;
        } catch (error: any) {
            console.error('❌ Upload error:', error?.message || error);
            return null;
        }
    },

    // Update contract PDF URL on loan_requests table
    updateContractPdfUrl: async (requestId: string, pdfUrl: string): Promise<boolean> => {
        try {
            // Tentativa 1: campo dedicado contract_pdf_url
            const { error } = await supabase
                .from('loan_requests')
                .update({ contract_pdf_url: pdfUrl })
                .eq('id', requestId);

            if (!error) {
                console.log('✅ contract_pdf_url salvo no loan_requests');
                return true;
            }

            // Tentativa 2: se coluna não existe, salvar no supplemental_description JSON
            console.warn('⚠️ Coluna contract_pdf_url pode não existir, salvando no supplemental_description...');
            const { data: current } = await supabase
                .from('loan_requests')
                .select('supplemental_description')
                .eq('id', requestId)
                .single();

            if (current) {
                let desc: any = {};
                try { desc = JSON.parse(current.supplemental_description || '{}'); } catch { desc = {}; }
                desc.contractPdfUrl = pdfUrl;

                const { error: error2 } = await supabase
                    .from('loan_requests')
                    .update({ supplemental_description: JSON.stringify(desc) })
                    .eq('id', requestId);

                if (!error2) {
                    console.log('✅ contractPdfUrl salvo no supplemental_description');
                    return true;
                }
            }

            return false;
        } catch (err) {
            console.error('❌ Erro ao salvar contract_pdf_url:', err);
            return false;
        }
    },

    // Get the most recent request for current client (any status, for contract download)
    getClientLatestRequest: async (): Promise<any | null> => {
        const user = loadFromStorage<any>(STORAGE_KEYS.USER, null);
        if (!user) return null;

        const { data } = await supabase
            .from('loan_requests')
            .select('*')
            .eq('email', user.email)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        return data || null;
    },

    // Lead Import Helper
    importLead: async (name: string, phone: string, profilePic?: string): Promise<'added' | 'updated' | 'error'> => {
        try {
            // Verifica se cliente já existe pelo telefone
            const { data: existing } = await supabase
                .from('customers')
                .select('id')
                .eq('phone', phone)
                .maybeSingle();

            if (existing) return 'updated';

            // Cria novo lead
            // Email fake para garantir constraint unique se houver
            const fakeEmail = `${phone.replace(/\D/g, '')}@whatsapp.lead`;

            // Tenta inserir
            // Truncar telefone para garantir que cabe em varchar(20)
            const safePhone = phone.replace(/[^0-9+]/g, '').substring(0, 20);

            // Gerar CPF fake de 11 dígitos
            // Usa números do telefone para gerar algo 'quase' único mas fixo tamanho
            const numbers = phone.replace(/\D/g, '');
            const safeCpf = `9${numbers.padEnd(10, '0').slice(-10)}`; // Começa com 9, 11 chars total

            const { error } = await supabase.from('customers').insert({
                name: (name || `WhatsApp ${safePhone}`).substring(0, 50), // Garante nome curto se precisar
                phone: safePhone,
                email: fakeEmail,
                cpf: safeCpf,
                status: 'ACTIVE',
                // origin: 'WAPP', // Removido origin pois pode não existir no schema ou ser curto
                internal_score: 500,
                total_debt: 0,
                active_loans_count: 0
            });

            if (error) {
                // Se der erro de Unique Constraint no CPF ou Email, ignorar e considerar 'updated'
                console.warn('Import lead minor error (likely dup):', error.message);
                return 'error';
            }
            return 'added';
        } catch (e) {
            console.error('Import Lead Exception:', e);
            return 'error';
        }
    },

    bulkImportLeads: async (leads: { name: string; phone: string }[]): Promise<{ added: number; errors: number }> => {
        // 1. Buscar telefones já existentes para evitar erros de constraint e duplicatas
        const { data: existingData, error: fetchError } = await supabase
            .from('customers')
            .select('phone');

        if (fetchError) {
            console.error('Error fetching existing phones:', fetchError);
            return { added: 0, errors: leads.length };
        }

        const existingPhones = new Set(existingData?.map(c => c.phone) || []);

        // 2. Processar e filtrar apenas NOVOS leads
        const newLeads = [];
        const processedPhones = new Set(); // Para evitar duplicatas dentro do próprio arquivo VCF

        for (const l of leads) {
            // Sanitização robusta de telefone (igual ao whatsappService)
            let clean = l.phone.replace(/\D/g, '');
            while (clean.startsWith('0')) clean = clean.substring(1);

            if (!clean.startsWith('55')) {
                if (clean.length === 13) clean = clean.slice(-11);
                else if (clean.length === 12) clean = clean.slice(-10);

                if (clean.length >= 10 && clean.length <= 11) clean = '55' + clean;
            }
            const safePhone = clean.substring(0, 20);

            // Se já existe no banco ou já foi processado neste lote, pula
            if (existingPhones.has(safePhone) || processedPhones.has(safePhone)) continue;

            processedPhones.add(safePhone);

            const numbers = safePhone.replace(/\D/g, '');
            const safeCpf = `9${numbers.padEnd(10, '0').slice(-10)}`;
            const fakeEmail = `${numbers}@whatsapp.lead`;

            newLeads.push({
                name: (l.name || `WhatsApp ${safePhone}`).substring(0, 50),
                phone: safePhone,
                email: fakeEmail,
                cpf: safeCpf,
                status: 'ACTIVE',
                internal_score: 500,
                total_debt: 0,
                active_loans_count: 0,
                joined_at: new Date().toISOString()
            });
        }

        if (newLeads.length === 0) {
            return { added: 0, errors: 0 };
        }

        // 3. Batch Insert dos novos
        const BATCH_SIZE = 100;
        let added = 0;
        let errors = 0;

        for (let i = 0; i < newLeads.length; i += BATCH_SIZE) {
            const batch = newLeads.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from('customers').insert(batch);

            if (error) {
                console.error('Batch insert error:', error);

                // Se falhar o batch, tentar um a um para salvar os que não derem erro (fallback)
                for (const item of batch) {
                    const { error: singleError } = await supabase.from('customers').insert(item);
                    if (!singleError) added++;
                    else errors++;
                }
            } else {
                added += batch.length;
            }
        }
        return { added, errors };
    },

    // Limpar leads importados do WhatsApp
    deleteWhatsappLeads: async (): Promise<number> => {
        const { count, error } = await supabase
            .from('customers')
            .delete({ count: 'exact' })
            .ilike('email', '%@whatsapp.lead');

        if (error) {
            console.error('Error deleting leads:', error);
            return 0;
        }
        return count || 0;
    },

    bulkDeleteCustomers: async (ids: string[]): Promise<boolean> => {
        const { error } = await supabase
            .from('customers')
            .delete()
            .in('id', ids);

        if (error) {
            console.error('Error deleting customers:', error);
            return false;
        }
        return true;
    },

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
