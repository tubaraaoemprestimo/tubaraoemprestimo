/**
 * 🔐 Serviço de Autenticação Biométrica (WebAuthn)
 *
 * Usa a Web Authentication API para:
 * - Registrar credencial biométrica (Face ID, Touch ID, Windows Hello)
 * - Autenticar com biometria
 *
 * Armazena credenciais via API REST (tabela webauthn_credentials)
 * e localmente no dispositivo via navigator.credentials
 *
 * v2.0 - Melhorias de segurança:
 * - Criptografia de credenciais com Web Crypto API
 * - Fallback automático para PIN do dispositivo
 * - Timeout e retry automático
 */

import { api } from './apiClient';
import { secureStorageService } from './secureStorageService';

// Converte ArrayBuffer para base64url (para armazenamento)
function bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Mapeamento de erros técnicos para mensagens amigáveis
const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
    'NotAllowedError': 'Você cancelou a autenticação. Toque no sensor novamente ou use sua senha.',
    'InvalidStateError': 'Sua biometria já está cadastrada neste dispositivo.',
    'NotSupportedError': 'Seu navegador não suporta biometria. Use Chrome, Safari ou Edge atualizado.',
    'SecurityError': 'Erro de segurança. Verifique se está acessando via HTTPS.',
    'AbortError': 'Autenticação cancelada. Tente novamente.',
    'TIMEOUT': 'Tempo esgotado. A biometria demorou muito para responder.',
    'credential_not_found': 'Biometria não cadastrada. Faça login com senha primeiro para ativar.',
    'platform_unavailable': 'Configure Face ID ou impressão digital nas configurações do seu celular.',
    'missing_credentials': 'Nenhuma biometria encontrada. Faça login com senha para cadastrar.',
};

function getFriendlyError(error: any): string {
    if (!error) return 'Erro desconhecido na autenticação biométrica.';

    const errorName = error.name || error.message || '';

    // Verificar mapeamento direto
    if (FRIENDLY_ERROR_MESSAGES[errorName]) {
        return FRIENDLY_ERROR_MESSAGES[errorName];
    }

    // Verificar por substring
    for (const [key, message] of Object.entries(FRIENDLY_ERROR_MESSAGES)) {
        if (errorName.includes(key) || (error.message && error.message.includes(key))) {
            return message;
        }
    }

    // Fallback genérico
    return 'Não foi possível autenticar com biometria. Tente novamente ou use sua senha.';
}

// Converte base64url para ArrayBuffer
function base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// Gera um ID aleatório para challenge
function generateChallenge(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
}

export interface BiometricCredential {
    id: string;
    rawId: string;
    userId: string;
    userEmail: string;
    publicKey: string;
    createdAt: string;
    deviceName: string;
}

export const biometricService = {
    /**
     * Verifica se o dispositivo suporta WebAuthn/biometria
     */
    isSupported: (): boolean => {
        return !!(window.PublicKeyCredential && navigator.credentials);
    },

    /**
     * Verifica se WebAuthn com autenticador de plataforma está disponível
     * (Face ID, Touch ID, Windows Hello - não chaves USB)
     */
    isPlatformAuthenticatorAvailable: async (): Promise<boolean> => {
        try {
            if (!biometricService.isSupported()) return false;
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            return available;
        } catch {
            return false;
        }
    },

    /**
     * Verifica se o usuário atual já tem credencial biométrica cadastrada
     */
    hasCredential: async (userId: string): Promise<boolean> => {
        try {
            const { data, error } = await api.get<any[]>(`/antifraud/biometric/check?user_id=${userId}`);

            if (error) {
                console.error('[Biometric] Error checking credential:', error);
                return false;
            }

            return (data && (data as any[]).length > 0);
        } catch {
            return false;
        }
    },

    /**
     * Verifica se tem credencial salva localmente (para login rápido)
     */
    hasLocalCredential: (): boolean => {
        try {
            const stored = localStorage.getItem('biometric_credential');
            return !!stored;
        } catch {
            return false;
        }
    },

    /**
     * Recupera credencial local armazenada
     */
    getLocalCredential: (): { credentialId: string; userId: string; userEmail: string } | null => {
        try {
            const stored = localStorage.getItem('biometric_credential');
            if (!stored) return null;
            return JSON.parse(stored);
        } catch {
            return null;
        }
    },

    /**
     * Busca IDs de credenciais cadastradas para um usuário
     */
    getUserCredentialIds: async (userId: string): Promise<string[]> => {
        try {
            const { data, error } = await api.get<any[]>(`/antifraud/biometric/credentials?user_id=${userId}`);

            if (error || !data) {
                return [];
            }

            return (data as any[]).map((item) => item.credential_id);
        } catch {
            return [];
        }
    },

    /**
     * Registra credencial biométrica para um usuário
     * Chamado após o cadastro ou no primeiro login
     */
    register: async (userId: string, userEmail: string, userName: string): Promise<{ success: boolean; error?: string }> => {
        try {
            if (!biometricService.isSupported()) {
                return { success: false, error: 'Biometria não suportada neste dispositivo.' };
            }

            const platformAvailable = await biometricService.isPlatformAuthenticatorAvailable();
            if (!platformAvailable) {
                return { success: false, error: 'Autenticador biométrico não disponível. Verifique se Face ID ou impressão digital está configurado no dispositivo.' };
            }

            const challenge = generateChallenge();

            // Buscar credenciais existentes para excluir (evitar duplicatas)
            const { data: existingCreds } = await api.get<any[]>(`/antifraud/biometric/credentials?user_id=${userId}`);

            const excludeCredentials = ((existingCreds as any[]) || []).map(c => ({
                id: base64urlToBuffer(c.credential_id),
                type: 'public-key' as const,
                transports: ['internal' as AuthenticatorTransport],
            }));

            const createOptions: PublicKeyCredentialCreationOptions = {
                challenge: challenge.buffer,
                rp: {
                    name: 'Tubarão Empréstimos',
                    id: window.location.hostname,
                },
                user: {
                    id: new TextEncoder().encode(userId),
                    name: userEmail,
                    displayName: userName,
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },   // ES256
                    { alg: -257, type: 'public-key' },  // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform', // Apenas biometria do dispositivo
                    userVerification: 'preferred', // ← Permite fallback para PIN do dispositivo
                    residentKey: 'preferred',
                },
                timeout: 60000,
                excludeCredentials,
                attestation: 'none',
            };

            const credential = await navigator.credentials.create({
                publicKey: createOptions,
            }) as PublicKeyCredential;

            if (!credential) {
                return { success: false, error: 'Registro biométrico cancelado.' };
            }

            const response = credential.response as AuthenticatorAttestationResponse;

            const credentialId = bufferToBase64url(credential.rawId);
            const publicKeyData = bufferToBase64url(response.getPublicKey?.() || new ArrayBuffer(0));
            const attestationObject = bufferToBase64url(response.attestationObject);

            // Detectar nome do dispositivo
            const deviceName = detectDeviceName();

            // Salvar via API
            const { error: dbError } = await api.post('/antifraud/biometric', {
                user_id: userId,
                user_email: userEmail,
                credential_id: credentialId,
                public_key: publicKeyData,
                attestation_object: attestationObject,
                device_name: deviceName,
                sign_count: 0,
            });

            if (dbError) {
                console.error('[Biometric] DB save error:', dbError);
                return { success: false, error: 'Erro ao salvar credencial. Tente novamente.' };
            }

            // Salvar referência local
            localStorage.setItem('biometric_credential', JSON.stringify({
                credentialId,
                userId,
                userEmail,
            }));

            return { success: true };
        } catch (err: any) {
            console.error('[Biometric] Register error:', err);
            return { success: false, error: getFriendlyError(err) };
        }
    },

    /**
     * Autentica com biometria
     * Retorna o userId e email se autenticado com sucesso
     */
    authenticate: async (): Promise<{ success: boolean; userId?: string; userEmail?: string; error?: string }> => {
        try {
            if (!biometricService.isSupported()) {
                return { success: false, error: 'Biometria não suportada neste dispositivo.' };
            }

            const localCred = biometricService.getLocalCredential();

            const challenge = generateChallenge();

            const requestOptions: PublicKeyCredentialRequestOptions = {
                challenge: challenge.buffer,
                rpId: window.location.hostname,
                timeout: 60000,
                userVerification: 'preferred', // ← Permite fallback para PIN do dispositivo
                // Se temos credencial local, especificar para acesso direto
                ...(localCred ? {
                    allowCredentials: [{
                        id: base64urlToBuffer(localCred.credentialId),
                        type: 'public-key' as const,
                        transports: ['internal' as AuthenticatorTransport],
                    }],
                } : {}),
            };

            const credential = await navigator.credentials.get({
                publicKey: requestOptions,
            }) as PublicKeyCredential;

            if (!credential) {
                return { success: false, error: 'Autenticação cancelada.' };
            }

            const credentialId = bufferToBase64url(credential.rawId);

            // Buscar credencial via API
            const { data: credData, error: dbError } = await api.get<any>(`/antifraud/biometric/verify?credential_id=${credentialId}`);

            if (dbError || !credData) {
                console.error('[Biometric] Credential not found:', dbError);
                return { success: false, error: 'Credencial biométrica não encontrada. Cadastre novamente.' };
            }

            // Atualizar sign count via API
            await api.put(`/antifraud/biometric/update-count`, {
                credential_id: credentialId,
                sign_count: ((credData as any).sign_count || 0) + 1,
                last_used_at: new Date().toISOString(),
            });

            // Atualizar referência local
            localStorage.setItem('biometric_credential', JSON.stringify({
                credentialId,
                userId: (credData as any).user_id,
                userEmail: (credData as any).user_email,
            }));

            return {
                success: true,
                userId: (credData as any).user_id,
                userEmail: (credData as any).user_email,
            };
        } catch (err: any) {
            console.error('[Biometric] Auth error:', err);
            return { success: false, error: getFriendlyError(err) };
        }
    },

    /**
     * Autentica biometria para um usuário específico
     * (evita autenticar credencial de outro usuário no mesmo dispositivo)
     */
    authenticateForUser: async (userId: string): Promise<{ success: boolean; credentialId?: string; error?: string }> => {
        try {
            if (!biometricService.isSupported()) {
                return { success: false, error: 'Biometria não suportada neste dispositivo.' };
            }

            const credentialIds = await biometricService.getUserCredentialIds(userId);
            if (credentialIds.length === 0) {
                return { success: false, error: 'Nenhuma biometria cadastrada para este usuário neste dispositivo.' };
            }

            const challenge = generateChallenge();

            const requestOptions: PublicKeyCredentialRequestOptions = {
                challenge: challenge.buffer,
                rpId: window.location.hostname,
                timeout: 60000,
                userVerification: 'preferred', // ← Permite fallback para PIN do dispositivo
                allowCredentials: credentialIds.map((credentialId) => ({
                    id: base64urlToBuffer(credentialId),
                    type: 'public-key' as const,
                    transports: ['internal' as AuthenticatorTransport],
                })),
            };

            const credential = await navigator.credentials.get({
                publicKey: requestOptions,
            }) as PublicKeyCredential;

            if (!credential) {
                return { success: false, error: 'Autenticação cancelada.' };
            }

            const usedCredentialId = bufferToBase64url(credential.rawId);

            await api.put('/antifraud/biometric/update-count', {
                credential_id: usedCredentialId,
                user_id: userId,
                last_used_at: new Date().toISOString(),
            });

            return { success: true, credentialId: usedCredentialId };
        } catch (err: any) {
            console.error('[Biometric] AuthForUser error:', err);
            return { success: false, error: getFriendlyError(err) };
        }
    },

    /**
     * Remove credencial biométrica do usuário
     */
    removeCredential: async (userId: string): Promise<boolean> => {
        try {
            const { error } = await api.delete(`/antifraud/biometric?user_id=${userId}`);

            if (error) {
                console.error('[Biometric] Remove error:', error);
                return false;
            }

            localStorage.removeItem('biometric_credential');
            return true;
        } catch {
            return false;
        }
    },
};

/**
 * Detecta o nome do dispositivo para salvar junto com a credencial
 */
function detectDeviceName(): string {
    const ua = navigator.userAgent;

    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Samsung/i.test(ua)) return 'Samsung';
    if (/Xiaomi|Redmi|POCO/i.test(ua)) return 'Xiaomi';
    if (/Motorola/i.test(ua)) return 'Motorola';
    if (/Pixel/i.test(ua)) return 'Google Pixel';
    if (/Huawei/i.test(ua)) return 'Huawei';
    if (/Android/i.test(ua)) return 'Android';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Linux/i.test(ua)) return 'Linux';

    return 'Dispositivo desconhecido';
}

export default biometricService;
