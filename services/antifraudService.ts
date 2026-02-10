/**
 * Serviço de Antifraude e Captura de Dados
 * Coleta informações silenciosas para análise de risco
 */

import { supabase } from './supabaseClient';

export interface DeviceFingerprint {
    ip: string;
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    timezone: string;
    cookiesEnabled: boolean;
    deviceMemory?: number;
    hardwareConcurrency?: number;
    touchSupport: boolean;
    webglVendor?: string;
    webglRenderer?: string;
    deviceModel?: string;
}

export interface RiskData {
    userId?: string;
    sessionId: string;
    fingerprint: DeviceFingerprint;
    location?: {
        latitude: number;
        longitude: number;
        accuracy: number;
        city?: string;
        state?: string;
    };
    timestamp: string;
    action: string;
    riskScore: number;
    riskFactors: string[];
}

export interface LivenessChallenge {
    type: 'blink' | 'smile' | 'turn_left' | 'turn_right' | 'nod';
    instruction: string;
    completed: boolean;
    timestamp?: string;
}

// Gera um ID único para a sessão
const generateSessionId = (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Sessão atual
let currentSessionId: string | null = null;

export const antifraudService = {
    /**
     * Inicializa sessão de antifraude
     */
    initSession(): string {
        currentSessionId = generateSessionId();
        return currentSessionId;
    },

    /**
     * Retorna sessão atual ou cria uma nova
     */
    getSessionId(): string {
        if (!currentSessionId) {
            currentSessionId = generateSessionId();
        }
        return currentSessionId;
    },

    /**
     * Coleta fingerprint do dispositivo (silencioso)
     */
    async collectFingerprint(): Promise<DeviceFingerprint> {
        const nav = navigator as any;

        // WebGL info
        let webglVendor = '';
        let webglRenderer = '';
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    webglVendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    webglRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
            }
        } catch (e) { }

        // Tenta obter dados de alta entropia (modelo do dispositivo) via Client Hints API
        let uaDataModel = '';
        let uaDataPlatform = '';
        let uaDataPlatformVersion = '';
        let uaDataBrands: string[] = [];

        if ((navigator as any).userAgentData) {
            try {
                // Solicita TODOS os campos de alta entropia disponíveis
                const uaData = await (navigator as any).userAgentData.getHighEntropyValues([
                    "model",
                    "platform",
                    "platformVersion",
                    "uaFullVersion",
                    "fullVersionList",
                    "architecture",
                    "bitness",
                    "formFactor"
                ]);

                uaDataModel = uaData.model || '';
                uaDataPlatform = uaData.platform || '';
                uaDataPlatformVersion = uaData.platformVersion || '';

                // Tenta pegar marcas/versões
                if (uaData.fullVersionList) {
                    uaDataBrands = uaData.fullVersionList.map((b: any) => b.brand);
                }

                console.log('[Antifraud] Client Hints Data:', {
                    model: uaDataModel,
                    platform: uaDataPlatform,
                    platformVersion: uaDataPlatformVersion,
                    brands: uaDataBrands,
                    formFactor: uaData.formFactor,
                    architecture: uaData.architecture
                });
            } catch (e) {
                console.log('[Antifraud] Client Hints API error:', e);
            }
        }

        // Se Client Hints não retornou modelo, tenta extrair do User-Agent
        if (!uaDataModel || uaDataModel === 'K' || uaDataModel.length < 2) {
            uaDataModel = this.parseDeviceModel(navigator.userAgent);
            console.log('[Antifraud] Model from UA parsing:', uaDataModel);
        }

        // Monta string de plataforma mais informativa
        let platformString = uaDataPlatform || navigator.platform;
        if (uaDataPlatformVersion && uaDataPlatform) {
            platformString = `${uaDataPlatform} ${uaDataPlatformVersion}`;
        }

        const fingerprint: DeviceFingerprint = {
            ip: '', // Será preenchido depois
            userAgent: navigator.userAgent,
            platform: platformString,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            deviceMemory: nav.deviceMemory,
            hardwareConcurrency: navigator.hardwareConcurrency,
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            webglVendor,
            webglRenderer,
            deviceModel: uaDataModel
        };

        console.log('[Antifraud] Fingerprint collected:', {
            deviceModel: fingerprint.deviceModel,
            platform: fingerprint.platform,
            touchSupport: fingerprint.touchSupport
        });

        return fingerprint;
    },

    /**
     * Obtém IP público via API externa
     */
    async getPublicIP(): Promise<string> {
        try {
            // Tenta ipify com timestamp para evitar cache
            const response = await fetch(`https://api.ipify.org?format=json&t=${Date.now()}`);
            if (response.ok) {
                const data = await response.json();
                return data.ip;
            }
            throw new Error('Ipify failed');
        } catch (e) {
            try {
                // Fallback para ip-api.com (gratuito para uso não comercial, sem https as vezes, mas tenta)
                // Ou usar outro serviço confiável https
                const response = await fetch('https://api.db-ip.com/v2/free/self');
                if (response.ok) {
                    const data = await response.json();
                    return data.ipAddress;
                }
            } catch (err) {
                return 'unknown';
            }
            return 'unknown';
        }
    },

    /**
     * Solicita localização do usuário
     * Usa mesmas configurações do locationTrackingService para consistência
     */
    async requestLocation(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.log('[Antifraud] Geolocation not supported');
                resolve(null);
                return;
            }

            console.log('[Antifraud] Requesting location...');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    console.log(`[Antifraud] Location captured: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);
                    resolve({
                        latitude,
                        longitude,
                        accuracy,
                    });
                },
                (error) => {
                    console.log('[Antifraud] Location error:', error.code, error.message);
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000, // 15 segundos
                    maximumAge: 60000 // 1 minuto de cache, igual ao locationTrackingService
                }
            );
        });
    },

    /**
     * Calcula score de risco baseado em fatores
     */
    calculateRiskScore(data: {
        fingerprint: DeviceFingerprint;
        location: any;
        previousRequests?: number;
        sameIpRequests?: number;
    }): { score: number; factors: string[] } {
        let score = 0;
        const factors: string[] = [];

        // Verificar se é dispositivo móvel (mais confiável para empréstimo pessoal)
        if (!data.fingerprint.touchSupport) {
            score += 10;
            factors.push('Dispositivo desktop (não mobile)');
        }

        // Verificar cookies desabilitados
        if (!data.fingerprint.cookiesEnabled) {
            score += 15;
            factors.push('Cookies desabilitados');
        }

        // Verificar se não permitiu localização
        if (!data.location) {
            score += 20;
            factors.push('Localização não permitida');
        }

        // Verificar muitas requisições do mesmo IP
        if (data.sameIpRequests && data.sameIpRequests > 3) {
            score += 30;
            factors.push(`Múltiplas solicitações do mesmo IP (${data.sameIpRequests})`);
        }

        // Verificar se o usuário já fez muitos pedidos
        if (data.previousRequests && data.previousRequests > 2) {
            score += 25;
            factors.push(`Cliente com histórico de solicitações (${data.previousRequests})`);
        }

        // Verificar UserAgent suspeito (bots, headless browsers)
        const ua = data.fingerprint.userAgent.toLowerCase();
        if (ua.includes('headless') || ua.includes('phantom') || ua.includes('selenium')) {
            score += 50;
            factors.push('User Agent suspeito (possível bot)');
        }

        // Horário suspeito (madrugada)
        const hour = new Date().getHours();
        if (hour >= 2 && hour < 6) {
            score += 10;
            factors.push('Solicitação em horário incomum');
        }

        return { score: Math.min(score, 100), factors };
    },

    /**
     * Extrai modelo do dispositivo do User-Agent (fallback)
     * Tenta múltiplos padrões para maximizar a chance de sucesso
     */
    parseDeviceModel(userAgent: string): string {
        const ua = userAgent;

        // Lista de marcas conhecidas para matching mais preciso
        const knownBrands = [
            'POCO', 'Xiaomi', 'Redmi', 'Samsung', 'SM-', 'Galaxy',
            'Realme', 'RMX', 'OPPO', 'CPH', 'vivo', 'V20', 'V21', 'V23', 'V25', 'V27', 'V29',
            'OnePlus', 'Huawei', 'Honor', 'Motorola', 'moto', 'LG', 'Sony', 'Xperia',
            'Nokia', 'Google', 'Pixel', 'Asus', 'ZenFone', 'ROG', 'Lenovo', 'TCL'
        ];

        // Padrão 1: Procura por marcas conhecidas no UA
        for (const brand of knownBrands) {
            const brandRegex = new RegExp(`(${brand}[\\s_-]?[A-Z0-9]+[A-Z0-9\\s_-]*)(?:\\s+Build|\\/|;|\\))`, 'i');
            const match = ua.match(brandRegex);
            if (match && match[1]) {
                const model = match[1].trim().replace(/\s+Build.*$/i, '').replace(/[;)]/g, '').trim();
                if (model.length > 2 && model !== 'K') {
                    console.log('[Antifraud] Brand match found:', brand, '->', model);
                    return model;
                }
            }
        }

        // Padrão 2: Android X.X; MODEL Build/
        const androidBuildMatch = ua.match(/Android\s+[\d.]+;\s*([^)]+?)\s+Build\//i);
        if (androidBuildMatch && androidBuildMatch[1]) {
            const model = androidBuildMatch[1].trim();
            // Ignora placeholders de privacidade do Chrome
            if (model !== 'K' && model.length > 2 && !model.startsWith('wv')) {
                console.log('[Antifraud] Android Build pattern:', model);
                return model;
            }
        }

        // Padrão 3: Android X.X; MODEL) - sem Build
        const androidParenMatch = ua.match(/Android\s+[\d.]+;\s*([^;)]+)[;)]/i);
        if (androidParenMatch && androidParenMatch[1]) {
            const model = androidParenMatch[1].trim();
            if (model !== 'K' && model.length > 2 && !model.startsWith('wv')) {
                console.log('[Antifraud] Android paren pattern:', model);
                return model;
            }
        }

        // Padrão 4: Mobile Safari com modelo depois do ;
        const mobileSafariMatch = ua.match(/;\s*([A-Z][A-Za-z0-9\s_-]+)\s+like\s+Mac\s+OS/i);
        if (mobileSafariMatch && mobileSafariMatch[1]) {
            const model = mobileSafariMatch[1].trim();
            if (model !== 'K' && model.length > 2) {
                console.log('[Antifraud] Mobile Safari pattern:', model);
                return model;
            }
        }

        // iPhone/iPad
        if (ua.includes('iPhone')) {
            // Tenta pegar versão do iOS para inferir modelo aproximado
            const iosMatch = ua.match(/iPhone\s*OS\s*([\d_]+)/i);
            if (iosMatch) {
                const version = iosMatch[1].replace(/_/g, '.');
                return `iPhone (iOS ${version})`;
            }
            return 'iPhone';
        }

        if (ua.includes('iPad')) {
            const iosMatch = ua.match(/OS\s*([\d_]+)/i);
            if (iosMatch) {
                const version = iosMatch[1].replace(/_/g, '.');
                return `iPad (iOS ${version})`;
            }
            return 'iPad';
        }

        // Windows
        if (ua.includes('Windows')) {
            return 'PC Windows';
        }

        // Mac
        if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
            return 'Mac';
        }

        // Linux
        if (ua.includes('Linux') && !ua.includes('Android')) {
            return 'PC Linux';
        }

        console.log('[Antifraud] No device model pattern matched for UA:', ua.substring(0, 100));
        return '';
    },

    async logRiskEvent(
        action: string,
        userId?: string,
        additionalData?: any
    ): Promise<RiskData | null> {
        try {
            const sessionId = this.getSessionId();
            const [fingerprint, ip] = await Promise.all([
                this.collectFingerprint(),
                this.getPublicIP(),
            ]);

            fingerprint.ip = ip;

            // Usa localização pré-capturada se disponível, senão tenta solicitar
            let location = additionalData?.locationCaptured || null;
            if (!location) {
                location = await this.requestLocation();
            }

            // Se Client Hints não retornou modelo, tenta parsing do UA
            if (!fingerprint.deviceModel) {
                fingerprint.deviceModel = this.parseDeviceModel(fingerprint.userAgent);
            }

            // Verificar quantas solicitações do mesmo IP
            const { count: sameIpCount } = await supabase
                .from('risk_logs')
                .select('*', { count: 'exact', head: true })
                .eq('ip', ip)
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            const { score, factors } = this.calculateRiskScore({
                fingerprint,
                location,
                sameIpRequests: sameIpCount || 0,
            });

            const riskData: RiskData = {
                userId,
                sessionId,
                fingerprint,
                location: location || undefined,
                timestamp: new Date().toISOString(),
                action,
                riskScore: score,
                riskFactors: factors,
            };

            // Coletar info de bateria (se disponível)
            let batteryInfo: any = null;
            try {
                if ((navigator as any).getBattery) {
                    const battery = await (navigator as any).getBattery();
                    batteryInfo = {
                        level: Math.round(battery.level * 100),
                        charging: battery.charging,
                    };
                }
            } catch (e) { }

            // Info de conexão/rede
            let connectionInfo: any = null;
            try {
                const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
                if (conn) {
                    connectionInfo = {
                        effectiveType: conn.effectiveType,  // 4g, 3g, 2g, slow-2g
                        downlink: conn.downlink,            // Mbps
                        rtt: conn.rtt,                      // ms
                        type: conn.type,                    // wifi, cellular, etc
                    };
                }
            } catch (e) { }

            // Salvar no banco
            await supabase.from('risk_logs').insert({
                user_id: userId,
                session_id: sessionId,
                ip: ip,
                user_agent: fingerprint.userAgent,
                platform: fingerprint.platform,
                screen_resolution: fingerprint.screenResolution,
                timezone: fingerprint.timezone,
                latitude: location?.latitude,
                longitude: location?.longitude,
                action,
                risk_score: score,
                risk_factors: factors,
                additional_data: {
                    ...additionalData,
                    deviceModel: fingerprint.deviceModel,
                    fingerprint,
                    platformVersion: fingerprint.platform,
                    battery: batteryInfo,
                    connection: connectionInfo,
                    deviceMemory: fingerprint.deviceMemory,
                    cpuCores: fingerprint.hardwareConcurrency,
                    language: fingerprint.language,
                    cookiesEnabled: fingerprint.cookiesEnabled,
                    touchSupport: fingerprint.touchSupport,
                    webglVendor: fingerprint.webglVendor,
                    webglRenderer: fingerprint.webglRenderer,
                },
            });

            console.log('[Antifraud] Risk event logged:', {
                ip,
                model: fingerprint.deviceModel,
                location: location ? `${location.latitude},${location.longitude}` : 'denied',
                score
            });

            return riskData;
        } catch (e) {
            console.error('Erro ao registrar evento de risco:', e);
            return null;
        }
    },

    /**
     * Gera desafios de liveness detection
     */
    generateLivenessChallenges(): LivenessChallenge[] {
        const challenges: LivenessChallenge[] = [
            { type: 'blink', instruction: 'Pisque os olhos 2 vezes', completed: false },
            { type: 'smile', instruction: 'Sorria para a câmera', completed: false },
            { type: 'turn_left', instruction: 'Vire o rosto para a esquerda', completed: false },
        ];

        // Retorna 2 desafios aleatórios
        return challenges.sort(() => Math.random() - 0.5).slice(0, 2);
    },

    /**
     * Gera link temporário com expiração
     */
    async generateTemporaryLink(
        type: 'contract' | 'document' | 'payment',
        referenceId: string,
        expiresInHours: number = 24
    ): Promise<string> {
        const token = `${type}_${referenceId}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

        await supabase.from('temporary_links').insert({
            token,
            type,
            reference_id: referenceId,
            expires_at: expiresAt.toISOString(),
            used: false,
        });

        return `${window.location.origin}/link/${token}`;
    },

    /**
     * Valida link temporário
     */
    async validateTemporaryLink(token: string): Promise<{ valid: boolean; type?: string; referenceId?: string }> {
        const { data, error } = await supabase
            .from('temporary_links')
            .select('*')
            .eq('token', token)
            .eq('used', false)
            .single();

        if (error || !data) {
            return { valid: false };
        }

        if (new Date(data.expires_at) < new Date()) {
            return { valid: false };
        }

        return { valid: true, type: data.type, referenceId: data.reference_id };
    },

    /**
     * Marca link como usado
     */
    async markLinkAsUsed(token: string): Promise<void> {
        await supabase.from('temporary_links').update({ used: true }).eq('token', token);
    },

    /**
     * Registra assinatura de contrato com dados completos
     */
    async registerContractSignature(
        contractId: string,
        userId: string,
        signatureImage: string,
        acceptedTerms: boolean
    ): Promise<void> {
        const sessionId = this.getSessionId();
        const fingerprint = await this.collectFingerprint();
        const ip = await this.getPublicIP();
        const location = await this.requestLocation();

        await supabase.from('contract_signatures').insert({
            contract_id: contractId,
            user_id: userId,
            session_id: sessionId,
            signature_image: signatureImage,
            accepted_terms: acceptedTerms,
            ip_address: ip,
            user_agent: fingerprint.userAgent,
            platform: fingerprint.platform,
            screen_resolution: fingerprint.screenResolution,
            timezone: fingerprint.timezone,
            latitude: location?.latitude,
            longitude: location?.longitude,
            signed_at: new Date().toISOString(),
        });
    },

    /**
     * Verifica se o risco é alto demais
     */
    isHighRisk(score: number): boolean {
        return score >= 50;
    },

    /**
     * Verifica se precisa de revisão manual
     */
    needsManualReview(score: number): boolean {
        return score >= 30 && score < 50;
    },

    /**
     * 🚫 Verifica se o CPF está em período de cooldown após reprovação
     * 
     * Regra: Se um empréstimo foi REJECTED nos últimos 30 dias para aquele CPF,
     * o cliente não pode solicitar novo empréstimo. Funciona por CPF, então
     * mesmo trocando de celular/dispositivo o bloqueio persiste.
     * 
     * @param cpf - CPF do cliente (limpo, apenas números)
     * @returns Objeto com status do bloqueio e informações de quando poderá tentar novamente
     */
    async checkRejectionCooldown(cpf: string): Promise<{
        blocked: boolean;
        daysRemaining: number;
        rejectionDate?: string;
        canRetryAt?: string;
        message?: string;
    }> {
        try {
            // Limpa o CPF (mantém apenas números)
            const cleanCpf = cpf.replace(/\D/g, '');
            if (!cleanCpf || cleanCpf.length < 11) {
                return { blocked: false, daysRemaining: 0 };
            }

            // Data limite: 30 dias atrás
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Busca solicitações REJEITADAS deste CPF nos últimos 30 dias
            const { data: rejectedRequests, error } = await supabase
                .from('loan_requests')
                .select('id, cpf, status, date, updated_at')
                .eq('cpf', cleanCpf)
                .eq('status', 'REJECTED')
                .gte('updated_at', thirtyDaysAgo.toISOString())
                .order('updated_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error('[Antifraud] Erro ao verificar cooldown:', error);
                return { blocked: false, daysRemaining: 0 };
            }

            if (!rejectedRequests || rejectedRequests.length === 0) {
                return { blocked: false, daysRemaining: 0 };
            }

            // Existe reprovação nos últimos 30 dias
            const lastRejection = rejectedRequests[0];
            const rejectionDate = new Date(lastRejection.updated_at || lastRejection.date);
            const canRetryAt = new Date(rejectionDate);
            canRetryAt.setDate(canRetryAt.getDate() + 30);

            const now = new Date();
            const diffMs = canRetryAt.getTime() - now.getTime();
            const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            if (daysRemaining <= 0) {
                return { blocked: false, daysRemaining: 0 };
            }

            // Registra tentativa bloqueada no log de risco
            await this.logRiskEvent('BLOCKED_COOLDOWN_30DAYS', undefined, {
                cpf: cleanCpf,
                rejectionDate: rejectionDate.toISOString(),
                daysRemaining,
                canRetryAt: canRetryAt.toISOString()
            });

            return {
                blocked: true,
                daysRemaining,
                rejectionDate: rejectionDate.toISOString(),
                canRetryAt: canRetryAt.toISOString(),
                message: `Sua solicitação foi reprovada em ${rejectionDate.toLocaleDateString('pt-BR')}. Você poderá solicitar novamente em ${canRetryAt.toLocaleDateString('pt-BR')} (${daysRemaining} dias restantes).`
            };
        } catch (error) {
            console.error('[Antifraud] Erro ao verificar cooldown:', error);
            return { blocked: false, daysRemaining: 0 };
        }
    },
};

export default antifraudService;
