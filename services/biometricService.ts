/**
 * 🔐 Entrar com a biometria do próprio aparelho (Face ID, Touch ID, digital ou rosto do Android).
 *
 * Usa a mesma biometria que o cliente já tem configurada no celular (WebAuthn / chave de acesso).
 * O servidor envia um desafio de uso único, o aparelho assina depois da digital/rosto e o servidor
 * confere a assinatura. Nenhuma senha fica guardada no celular.
 */
import { api } from './apiClient';

const LOCAL_KEY = 'biometric_credential';
const OLD_PASSWORD_PREFIX = 'bio_auth_'; // versão antiga guardava a senha criptografada: apagamos

const toB64 = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf); let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (s: string) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out.buffer;
};

const FRIENDLY: Record<string, string> = {
    NotAllowedError: 'Biometria cancelada ou não reconhecida. Toque de novo ou entre com a senha.',
    InvalidStateError: 'A biometria já está ativada neste aparelho.',
    NotSupportedError: 'Este navegador não aceita biometria. Use Chrome ou Safari atualizado.',
    SecurityError: 'Abra o app pelo endereço oficial para usar a biometria.',
    AbortError: 'Biometria cancelada. Tente de novo.',
};
const friendly = (e: any) => FRIENDLY[e?.name] || e?.error || 'Não foi possível usar a biometria agora. Entre com a senha.';

function deviceName(): string {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Samsung|SM-/i.test(ua)) return 'Samsung';
    if (/Xiaomi|Redmi|POCO/i.test(ua)) return 'Xiaomi';
    if (/Motorola|moto/i.test(ua)) return 'Motorola';
    if (/Android/i.test(ua)) return 'Android';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows PC';
    return 'Celular';
}

const readLocal = (): { credentialId: string; userId?: string; userEmail?: string } | null => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { return null; }
};
const writeLocal = (v: { credentialId: string; userId: string; userEmail?: string }) => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(v)); } catch { /* modo privado */ }
};

export const biometricService = {
    isSupported: () => typeof window !== 'undefined' && !!(window.PublicKeyCredential && navigator.credentials),

    /** O aparelho tem digital/rosto configurado? */
    async isPlatformAuthenticatorAvailable(): Promise<boolean> {
        try { return biometricService.isSupported() && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
        catch { return false; }
    },

    hasLocalCredential: () => !!readLocal(),

    /** Remove a senha que a versão antiga guardava no aparelho. */
    purgeLegacyPasswords() {
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k?.startsWith(OLD_PASSWORD_PREFIX)) localStorage.removeItem(k);
            }
        } catch { /* ok */ }
    },

    /** Entrar com a biometria. Devolve a sessão pronta (o servidor conferiu a assinatura). */
    async login(): Promise<{ success: boolean; user?: any; error?: string; needsPassword?: boolean }> {
        try {
            if (!biometricService.isSupported()) return { success: false, error: FRIENDLY.NotSupportedError };
            const { data: opt, error: optErr } = await api.post<any>('/auth/biometric/options', {});
            if (optErr || !opt?.challenge) return { success: false, error: (optErr as any)?.error || 'Sem conexão. Tente de novo.' };
            const local = readLocal();
            const cred = await navigator.credentials.get({ publicKey: {
                challenge: fromB64(opt.challenge),
                rpId: window.location.hostname,
                userVerification: 'required',
                timeout: 60000,
                // Com o id salvo vai direto na biometria; sem ele o aparelho mostra as contas que tem.
                ...(local ? { allowCredentials: [{ id: fromB64(local.credentialId), type: 'public-key' as const }] } : {}),
            } }) as PublicKeyCredential | null;
            if (!cred) return { success: false, error: FRIENDLY.AbortError };
            const r = cred.response as AuthenticatorAssertionResponse;
            const body = { credentialId: toB64(cred.rawId), clientDataJSON: toB64(r.clientDataJSON), authenticatorData: toB64(r.authenticatorData), signature: toB64(r.signature) };
            const { data, error } = await api.post<any>('/auth/biometric/login', body);
            if (error || !data?.accessToken) {
                if ((error as any)?.code === 'BIO_UNKNOWN') { try { localStorage.removeItem(LOCAL_KEY); } catch { /* ok */ } }
                return { success: false, needsPassword: (error as any)?.code === 'BIO_UNKNOWN', error: (error as any)?.error || 'Biometria não confere. Entre com a senha.' };
            }
            api.setSession(data.accessToken, data.refreshToken);
            try { localStorage.setItem('tubarao_user', JSON.stringify(data.user)); } catch { /* ok */ }
            writeLocal({ credentialId: body.credentialId, userId: data.user.id, userEmail: data.user.email });
            return { success: true, user: data.user };
        } catch (e: any) {
            return { success: false, error: friendly(e) };
        }
    },

    /** Ativa a biometria do aparelho para a conta logada (uma vez, logo depois do login com senha). */
    async activate(user: { id: string; email: string; name?: string }): Promise<{ success: boolean; error?: string }> {
        try {
            if (!(await biometricService.isPlatformAuthenticatorAvailable())) return { success: false, error: 'Configure a digital ou o rosto nos ajustes do celular.' };
            const { data: opt, error: optErr } = await api.post<any>('/auth/biometric/register-options', {});
            if (optErr || !opt?.challenge) return { success: false, error: (optErr as any)?.error || 'Sem conexão. Tente de novo.' };
            const cred = await navigator.credentials.create({ publicKey: {
                challenge: fromB64(opt.challenge),
                rp: { name: 'Tubarão Empréstimos', id: window.location.hostname },
                user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.name || user.email },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
                excludeCredentials: (opt.exclude || []).map((id: string) => ({ id: fromB64(id), type: 'public-key' as const })),
                attestation: 'none',
                timeout: 60000,
            } }) as PublicKeyCredential | null;
            if (!cred) return { success: false, error: FRIENDLY.AbortError };
            const r = cred.response as AuthenticatorAttestationResponse;
            const pk = r.getPublicKey?.();
            if (!pk) return { success: false, error: FRIENDLY.NotSupportedError };
            const credentialId = toB64(cred.rawId);
            const { error } = await api.post('/auth/biometric/register', {
                credentialId, publicKey: toB64(pk), attestationObject: toB64(r.attestationObject), clientDataJSON: toB64(r.clientDataJSON), deviceName: deviceName(),
            });
            if (error) return { success: false, error: (error as any)?.error || 'Erro ao ativar a biometria.' };
            writeLocal({ credentialId, userId: user.id, userEmail: user.email });
            return { success: true };
        } catch (e: any) {
            // Já ativada neste aparelho (InvalidStateError): considera ok.
            if (e?.name === 'InvalidStateError') return { success: true };
            return { success: false, error: friendly(e) };
        }
    },

    /** Esta conta já tem biometria ativada neste aparelho? */
    async isActiveHere(userId: string) {
        const local = readLocal();
        if (!local || local.userId !== userId) return false;
        const { data } = await api.get<any[]>('/auth/biometric/mine');
        return !!data?.some(c => c.credentialId === local.credentialId);
    },
};

export default biometricService;
