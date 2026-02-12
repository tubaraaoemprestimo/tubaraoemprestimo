/**
 * 🔒 Device Security Service
 * Sistema inteligente de detecção e bloqueio de dispositivos suspeitos
 *
 * Funcionalidades:
 * - Detecta login em dispositivo diferente
 * - Bloqueia automaticamente dispositivos não reconhecidos
 * - Gera alertas para o admin
 * - Mantém lista de dispositivos confiáveis por usuário
 */

import { api } from './apiClient';
import { antifraudService, DeviceFingerprint } from './antifraudService';

export interface TrustedDevice {
    id: string;
    user_id: string;
    device_fingerprint: string;
    device_name: string;
    device_model: string;
    platform: string;
    browser: string;
    screen_resolution: string;
    last_ip: string;
    last_location_lat?: number;
    last_location_lng?: number;
    is_verified: boolean;
    is_primary: boolean;
    trust_score: number;
    login_count: number;
    first_seen_at: string;
    last_seen_at: string;
}

export interface SecurityBlock {
    id: string;
    user_id: string;
    block_type: 'new_device' | 'suspicious_location' | 'high_risk' | 'multiple_devices';
    block_reason: string;
    device_fingerprint: string;
    ip_address: string;
    device_info: any;
    is_resolved: boolean;
    created_at: string;
}

export interface SecurityAlert {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    alert_type: 'new_device' | 'blocked_access' | 'high_risk_login' | 'location_change';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    device_info: any;
    ip_address: string;
    location: any;
    is_read: boolean;
    created_at: string;
}

export interface DeviceCheckResult {
    allowed: boolean;
    isNewDevice: boolean;
    isTrusted: boolean;
    requiresVerification: boolean;
    blockReason?: string;
    matchedDevice?: TrustedDevice;
    riskScore: number;
    riskFactors: string[];
}

/**
 * Gera um hash/fingerprint único para o dispositivo
 */
const generateDeviceFingerprint = (fp: DeviceFingerprint): string => {
    // Combina fatores que identificam unicamente o dispositivo
    const factors = [
        fp.deviceModel || '',
        fp.platform || '',
        fp.screenResolution || '',
        fp.hardwareConcurrency?.toString() || '',
        fp.deviceMemory?.toString() || '',
        fp.timezone || '',
        fp.language || '',
        // Não inclui IP pois muda frequentemente
    ].join('|');

    // Gera hash simples
    let hash = 0;
    for (let i = 0; i < factors.length; i++) {
        const char = factors.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return `dev_${Math.abs(hash).toString(36)}`;
};

/**
 * Extrai nome do navegador do User-Agent
 */
const parseBrowserName = (ua: string): string => {
    if (ua.includes('Chrome') && !ua.includes('Edge') && !ua.includes('OPR')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
    return 'Outro';
};

/**
 * Gera nome amigável para o dispositivo
 */
const generateDeviceName = (fp: DeviceFingerprint): string => {
    const model = fp.deviceModel || 'Dispositivo';
    const browser = parseBrowserName(fp.userAgent);
    return `${model} - ${browser}`;
};

export const deviceSecurityService = {
    /**
     * Obtém configurações de segurança do sistema
     */
    async getSecuritySettings(): Promise<Record<string, string>> {
        try {
            const { data } = await api.get<any[]>('/antifraud/security-settings');

            const settings: Record<string, string> = {};
            ((data as any[]) || []).forEach((item: any) => {
                settings[item.setting_key] = item.setting_value;
            });

            return settings;
        } catch {
            // Retorna defaults se tabela não existir
            return {
                block_new_devices: 'true',
                require_verification_new_device: 'true',
                max_devices_per_user: '3',
                block_different_model: 'true',
                notify_admin_new_device: 'true',
                auto_block_high_risk: 'true'
            };
        }
    },

    /**
     * Obtém todos os dispositivos confiáveis de um usuário
     */
    async getUserDevices(userId: string): Promise<TrustedDevice[]> {
        const { data, error } = await api.get<any[]>(`/antifraud/device/list?user_id=${userId}`);

        if (error) {
            console.error('[DeviceSecurity] Error fetching devices:', error);
            return [];
        }

        return (data as any[]) || [];
    },

    /**
     * Verifica se o dispositivo atual é conhecido/confiável
     */
    async checkDevice(
        userId: string,
        userName: string,
        userEmail: string
    ): Promise<DeviceCheckResult> {
        console.log('[DeviceSecurity] Checking device for user:', userId);

        // Coleta fingerprint do dispositivo atual
        const fingerprint = await antifraudService.collectFingerprint();
        const ip = await antifraudService.getPublicIP();
        fingerprint.ip = ip;

        const deviceFingerprint = generateDeviceFingerprint(fingerprint);
        const settings = await this.getSecuritySettings();

        // Busca dispositivos do usuário
        const userDevices = await this.getUserDevices(userId);

        // Verifica se este dispositivo já é conhecido
        const matchedDevice = userDevices.find(d =>
            d.device_fingerprint === deviceFingerprint ||
            (d.device_model === fingerprint.deviceModel &&
                d.screen_resolution === fingerprint.screenResolution)
        );

        const riskFactors: string[] = [];
        let riskScore = 0;

        // CASO 1: Dispositivo já conhecido
        if (matchedDevice) {
            console.log('[DeviceSecurity] Known device found:', matchedDevice.device_name);

            // Atualiza última atividade
            await this.updateDeviceActivity(matchedDevice.id, ip, fingerprint);

            return {
                allowed: true,
                isNewDevice: false,
                isTrusted: matchedDevice.is_verified,
                requiresVerification: false,
                matchedDevice,
                riskScore: 0,
                riskFactors: []
            };
        }

        // CASO 2: Dispositivo novo
        console.log('[DeviceSecurity] NEW DEVICE DETECTED!');
        riskFactors.push('Dispositivo novo/desconhecido');
        riskScore += 40;

        // Verifica se é modelo de celular diferente
        const primaryDevice = userDevices.find(d => d.is_primary);
        if (primaryDevice && fingerprint.deviceModel &&
            settings.block_different_model === 'true') {

            if (primaryDevice.device_model !== fingerprint.deviceModel) {
                riskFactors.push(`Modelo diferente: ${fingerprint.deviceModel} (esperado: ${primaryDevice.device_model})`);
                riskScore += 30;
            }
        }

        // Verifica limite de dispositivos
        const maxDevices = parseInt(settings.max_devices_per_user) || 3;
        if (userDevices.length >= maxDevices) {
            riskFactors.push(`Limite de dispositivos atingido (${userDevices.length}/${maxDevices})`);
            riskScore += 20;
        }

        // Verifica se deve bloquear automaticamente
        const shouldBlock = settings.block_new_devices === 'true' || riskScore >= 70;
        const requiresVerification = settings.require_verification_new_device === 'true';

        if (shouldBlock) {
            // Cria bloqueio
            await this.createSecurityBlock(userId, {
                block_type: 'new_device',
                block_reason: `Tentativa de acesso de dispositivo não reconhecido: ${fingerprint.deviceModel || 'Desconhecido'}`,
                device_fingerprint: deviceFingerprint,
                ip_address: ip,
                device_info: {
                    model: fingerprint.deviceModel,
                    platform: fingerprint.platform,
                    browser: parseBrowserName(fingerprint.userAgent),
                    screen: fingerprint.screenResolution,
                    fingerprint
                }
            });

            // Gera alerta para admin
            if (settings.notify_admin_new_device === 'true') {
                await this.createSecurityAlert({
                    user_id: userId,
                    user_name: userName,
                    user_email: userEmail,
                    alert_type: 'new_device',
                    severity: riskScore >= 70 ? 'critical' : 'high',
                    title: `🚨 Dispositivo novo detectado`,
                    description: `${userName} (${userEmail}) tentou acessar de um dispositivo diferente: ${fingerprint.deviceModel || 'Desconhecido'}. ${riskFactors.join('. ')}.`,
                    device_info: {
                        model: fingerprint.deviceModel,
                        platform: fingerprint.platform,
                        browser: parseBrowserName(fingerprint.userAgent),
                        screen: fingerprint.screenResolution
                    },
                    ip_address: ip
                });
            }

            return {
                allowed: false,
                isNewDevice: true,
                isTrusted: false,
                requiresVerification,
                blockReason: `Login bloqueado: Dispositivo não reconhecido (${fingerprint.deviceModel || 'Desconhecido'}). Entre em contato com o suporte.`,
                riskScore,
                riskFactors
            };
        }

        // Dispositivo novo mas permitido (adiciona à lista)
        await this.addTrustedDevice(userId, fingerprint, ip);

        return {
            allowed: true,
            isNewDevice: true,
            isTrusted: false,
            requiresVerification,
            riskScore,
            riskFactors
        };
    },

    /**
     * Adiciona um dispositivo à lista de confiáveis
     */
    async addTrustedDevice(
        userId: string,
        fingerprint: DeviceFingerprint,
        ip: string,
        isVerified: boolean = false
    ): Promise<TrustedDevice | null> {
        const deviceFingerprint = generateDeviceFingerprint(fingerprint);
        const deviceName = generateDeviceName(fingerprint);
        const browser = parseBrowserName(fingerprint.userAgent);

        // Verifica se é o primeiro dispositivo (será o primário)
        const existingDevices = await this.getUserDevices(userId);
        const isPrimary = existingDevices.length === 0;

        const { data, error } = await api.post<any>('/antifraud/device/trust', {
            user_id: userId,
            device_fingerprint: deviceFingerprint,
            device_name: deviceName,
            device_model: fingerprint.deviceModel || 'Desconhecido',
            platform: fingerprint.platform,
            browser: browser,
            screen_resolution: fingerprint.screenResolution,
            last_ip: ip,
            is_verified: isVerified,
            is_primary: isPrimary,
            trust_score: isVerified ? 100 : 50,
            login_count: 1
        });

        if (error) {
            console.error('[DeviceSecurity] Error adding device:', error);
            return null;
        }

        console.log('[DeviceSecurity] Device added:', deviceName);
        return data as TrustedDevice;
    },

    /**
     * Atualiza última atividade do dispositivo
     */
    async updateDeviceActivity(
        deviceId: string,
        ip: string,
        fingerprint?: DeviceFingerprint
    ): Promise<void> {
        await api.put(`/antifraud/device/${deviceId}/activity`, {
            last_ip: ip,
            last_seen_at: new Date().toISOString()
        });
    },

    /**
     * Remove um dispositivo da lista de confiáveis
     */
    async removeDevice(deviceId: string): Promise<boolean> {
        const { error } = await api.delete(`/antifraud/device/${deviceId}`);
        return !error;
    },

    /**
     * Marca dispositivo como verificado
     */
    async verifyDevice(deviceId: string): Promise<boolean> {
        const { error } = await api.put(`/antifraud/device/${deviceId}/verify`, {
            is_verified: true,
            trust_score: 100
        });
        return !error;
    },

    /**
     * Define dispositivo como primário
     */
    async setPrimaryDevice(userId: string, deviceId: string): Promise<boolean> {
        const { error } = await api.put(`/antifraud/device/${deviceId}/set-primary`, {
            user_id: userId
        });
        return !error;
    },

    /**
     * Cria um bloqueio de segurança
     */
    async createSecurityBlock(userId: string, data: {
        block_type: string;
        block_reason: string;
        device_fingerprint?: string;
        ip_address?: string;
        device_info?: any;
        expires_at?: string;
    }): Promise<void> {
        await api.post('/antifraud/security-block', {
            user_id: userId,
            ...data,
            is_resolved: false
        });

        // Also create admin notification
        const notifPayload: any = {
            customer_email: null,
            type: 'WARNING',
            title: '🔒 Cliente bloqueado pelo antifraude',
            message: data.block_reason,
            link: '/admin/security-hub?tab=antifraud',
            read: false,
            for_role: 'ADMIN'
        };

        const { error } = await api.post('/notifications', notifPayload);
        if (error) {
            console.error('[DeviceSecurity] failed to insert admin notification:', error);
        }
    },

    /**
     * Verifica se o usuário está bloqueado
     */
    async checkUserBlocked(userId: string): Promise<SecurityBlock | null> {
        const { data } = await api.get<any>(`/antifraud/security-block/check?user_id=${userId}`);

        if (data) {
            // Verifica se expirou
            if ((data as any).expires_at && new Date((data as any).expires_at) < new Date()) {
                await this.resolveBlock((data as any).id, 'SYSTEM', 'Bloqueio expirado');
                return null;
            }
        }

        return data as SecurityBlock;
    },

    /**
     * Resolve um bloqueio e adiciona dispositivo como confiável
     * O desbloqueio é INSTANTÂNEO — o dispositivo é liberado imediatamente
     */
    async resolveBlock(
        blockId: string,
        resolvedBy: string,
        notes?: string
    ): Promise<boolean> {
        const { data, error } = await api.put<any>(`/antifraud/security-block/${blockId}/resolve`, {
            resolved_by: resolvedBy,
            resolution_notes: notes
        });

        if (error) return false;

        // The backend should handle adding the device as trusted and resolving
        // all pending blocks for this user. If not, this is handled server-side.
        return true;
    },

    /**
     * Obtém bloqueios pendentes (para admin)
     */
    async getPendingBlocks(): Promise<SecurityBlock[]> {
        const { data } = await api.get<any[]>('/antifraud/security-blocks?resolved=false');
        return (data as any[]) || [];
    },

    /**
     * Cria um alerta de segurança
     */
    async createSecurityAlert(data: {
        user_id: string;
        user_name: string;
        user_email: string;
        alert_type: string;
        severity: string;
        title: string;
        description: string;
        device_info?: any;
        ip_address?: string;
        location?: any;
    }): Promise<void> {
        await api.post('/antifraud/security-alerts', {
            ...data,
            is_read: false,
            is_actioned: false
        });

        console.log('[DeviceSecurity] Alert created:', data.title);
    },

    /**
     * Obtém alertas não lidos (para admin)
     */
    async getUnreadAlerts(): Promise<SecurityAlert[]> {
        const { data } = await api.get<any[]>('/antifraud/security-alerts?is_read=false');
        return (data as any[]) || [];
    },

    /**
     * Obtém todos os alertas recentes
     */
    async getRecentAlerts(limit: number = 50): Promise<SecurityAlert[]> {
        const { data } = await api.get<any[]>(`/antifraud/security-alerts?limit=${limit}`);
        return (data as any[]) || [];
    },

    /**
     * Marca alerta como lido
     */
    async markAlertRead(alertId: string): Promise<void> {
        await api.put(`/antifraud/security-alerts/${alertId}/read`, { is_read: true });
    },

    /**
     * Conta alertas não lidos
     */
    async getUnreadAlertCount(): Promise<number> {
        const { data } = await api.get<any>('/antifraud/security-alerts/count?is_read=false');
        return (data as any)?.count || 0;
    },

    /**
     * Atualiza configuração de segurança
     */
    async updateSecuritySetting(key: string, value: string): Promise<boolean> {
        const { error } = await api.put('/antifraud/security-settings', {
            setting_key: key,
            setting_value: value,
            updated_at: new Date().toISOString()
        });
        return !error;
    },

    /**
     * Libera todos os dispositivos de um usuário (reset)
     */
    async resetUserDevices(userId: string): Promise<boolean> {
        const { error } = await api.delete(`/antifraud/device/reset?user_id=${userId}`);
        return !error;
    },

    /**
     * Libera um usuário de todos os bloqueios
     */
    async unblockUser(userId: string, adminName: string): Promise<boolean> {
        const { error } = await api.put(`/antifraud/security-block/unblock-user`, {
            user_id: userId,
            resolved_by: adminName,
            resolution_notes: 'Desbloqueado manualmente pelo admin'
        });
        return !error;
    }
};

export default deviceSecurityService;
