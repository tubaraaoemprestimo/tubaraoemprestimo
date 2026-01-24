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

        // Tenta obter dados de alta entropia (modelo do dispositivo)
        let uaDataModel = '';
        let uaDataPlatform = '';
        let uaDataPlatformVersion = '';

        if ((navigator as any).userAgentData) {
            try {
                const uaData = await (navigator as any).userAgentData.getHighEntropyValues([
                    "model",
                    "platform",
                    "platformVersion",
                    "uaFullVersion"
                ]);
                uaDataModel = uaData.model;
                uaDataPlatform = uaData.platform;
                uaDataPlatformVersion = uaData.platformVersion;
            } catch (e) {
                console.log('Client Hints API error', e);
            }
        }

        const fingerprint: DeviceFingerprint = {
            ip: '', // Será preenchido pelo servidor
            userAgent: navigator.userAgent,
            platform: uaDataPlatform || navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            deviceMemory: nav.deviceMemory,
            hardwareConcurrency: navigator.hardwareConcurrency,
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            webglVendor,
            webglRenderer,
            deviceModel: uaDataModel // Novo campo para o modelo real
        };

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
     */
    parseDeviceModel(userAgent: string): string {
        // Android: tenta extrair modelo entre "; " e " Build" ou ")"
        const androidMatch = userAgent.match(/;\s*([^;]+(?:POCO|Xiaomi|Samsung|Redmi|Realme|OPPO|vivo|OnePlus|Huawei|Motorola|LG|Sony|Nokia|Google|Pixel)[^;]*?)\s*(?:Build|;|\))/i);
        if (androidMatch) {
            return androidMatch[1].trim();
        }

        // Fallback: pega qualquer coisa entre Android X.X; e Build
        const genericAndroid = userAgent.match(/Android\s+[\d.]+;\s*([^)]+?)(?:\s+Build|\))/i);
        if (genericAndroid) {
            // Remove "K" genérico que Chrome usa para privacidade
            const model = genericAndroid[1].trim();
            if (model !== 'K' && model.length > 2) {
                return model;
            }
        }

        // iPhone
        if (userAgent.includes('iPhone')) {
            return 'iPhone';
        }

        // iPad
        if (userAgent.includes('iPad')) {
            return 'iPad';
        }

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
                    platformVersion: fingerprint.platform
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
};

export default antifraudService;
