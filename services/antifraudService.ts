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

        const fingerprint: DeviceFingerprint = {
            ip: '', // Será preenchido pelo servidor
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            deviceMemory: nav.deviceMemory,
            hardwareConcurrency: navigator.hardwareConcurrency,
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            webglVendor,
            webglRenderer,
        };

        return fingerprint;
    },

    /**
     * Obtém IP público via API externa
     */
    async getPublicIP(): Promise<string> {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    },

    /**
     * Solicita localização do usuário
     */
    async requestLocation(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    });
                },
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
     * Registra evento de risco no banco
     */
    async logRiskEvent(
        action: string,
        userId?: string,
        additionalData?: any
    ): Promise<RiskData | null> {
        try {
            const sessionId = this.getSessionId();
            const [fingerprint, ip, location] = await Promise.all([
                this.collectFingerprint(),
                this.getPublicIP(),
                this.requestLocation(),
            ]);

            fingerprint.ip = ip;

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
                additional_data: additionalData,
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
