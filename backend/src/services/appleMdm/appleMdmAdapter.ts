import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';

/**
 * Único ponto do backend que fala com o servidor MDM (NanoHUB).
 * API conferida na doc oficial do NanoHUB v0.2.0: HTTP Basic usuário "nanohub",
 * rotas NanoMDM sob /api/v1/nanomdm/ (enqueue, push, pushcert) e /version.
 *
 * Dois adaptadores:
 *  - Mock: desenvolvimento/testes. NUNCA marca nada como confirmado no aparelho;
 *    o máximo que um comando mock atinge é "queued" com origem MOCK.
 *  - NanoHub: real. "dispatched" só quando o NanoHUB aceitou e o push saiu;
 *    "acknowledged" só chega pelo webhook com o resultado do aparelho.
 *
 * Política (não negociável, ver docs/financiamento-celulares/11_REVISAO_JURIDICA.md):
 * nenhum comando é disparado por evento financeiro. Não existe função que receba
 * contrato/parcela. Comandos só para aparelhos ORG_OWNED (patrimônio da empresa).
 */

// supervisedOnly: exigência da Apple (o iOS recusa em aparelho não supervisionado).
export const ALLOWED_COMMANDS = {
    DeviceInformation: { sensitive: false, supervisedOnly: false, label: 'Inventário do aparelho' },
    SecurityInfo: { sensitive: false, supervisedOnly: false, label: 'Informações de segurança' },
    ProfileList: { sensitive: false, supervisedOnly: false, label: 'Perfis instalados' },
    InstalledApplicationList: { sensitive: false, supervisedOnly: false, label: 'Apps instalados' },
    EnableLostMode: { sensitive: true, supervisedOnly: true, label: 'Ativar Modo Perdido (aparelho da empresa perdido/roubado)' },
    DisableLostMode: { sensitive: true, supervisedOnly: true, label: 'Desativar Modo Perdido' },
    DeviceLocation: { sensitive: true, supervisedOnly: true, label: 'Localizar (só em Modo Perdido)' },
    DeviceLock: { sensitive: true, supervisedOnly: false, label: 'Bloqueio de tela corporativo' },
} as const;

// Campos pedidos no inventário (DeviceInformation exige a lista Queries).
export const INVENTORY_QUERIES = [
    'DeviceName', 'OSVersion', 'SerialNumber', 'ModelName', 'ProductName', 'IMEI', 'PhoneNumber',
    'IsSupervised', 'IsMDMLostModeEnabled', 'IsActivationLockEnabled', 'BatteryLevel', 'DeviceCapacity', 'AvailableDeviceCapacity',
];

/**
 * Lê um valor escalar de um plist XML pela chave (string/integer/real/true/false/date).
 * ponytail: regex, não parser completo; serve para respostas planas do MDM (QueryResponses,
 * Authenticate, DeviceLocation). Trocar por parser de plist se precisar de dicts aninhados com chaves repetidas.
 */
export function plistGet(xml: string, key: string): string | number | boolean | undefined {
    const m = new RegExp(`<key>${key}</key>\\s*<(string|integer|real|true|false|date)\\s*/?>(?:([^<]*)</\\1>)?`).exec(xml);
    if (!m) return undefined;
    if (m[1] === 'true' || m[1] === 'false') return m[1] === 'true';
    if (m[1] === 'integer' || m[1] === 'real') return Number(m[2]);
    return m[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
export type MdmRequestType = keyof typeof ALLOWED_COMMANDS;

// Propósitos aceitos. Termos de cobrança são recusados (ver isForbiddenPurpose).
export const FORBIDDEN_PURPOSE = /(inadimpl|atras|cobran|d[ií]vida|parcela|pagamento|pagar|quita|bloqueio por|devendo)/i;
export function isForbiddenPurpose(purpose: string) {
    return FORBIDDEN_PURPOSE.test(purpose);
}

export interface EnqueueResult {
    accepted: boolean;
    pushOk: boolean;
    commandUuid: string;
    detail: string;
}

export interface MdmAdapter {
    readonly name: 'mock' | 'nanohub';
    status(): Promise<{ reachable: boolean; version?: string; error?: string }>;
    pushCert(topic?: string): Promise<{ topic: string; notAfter: string | null } | null>;
    enqueue(enrollmentId: string, requestType: MdmRequestType, params?: Record<string, any>): Promise<EnqueueResult>;
}

function xmlEscape(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Gera o plist do comando (formato de `cmdr.py` do NanoMDM). Valores: string ou lista de strings. */
export function buildCommandPlist(requestType: MdmRequestType, commandUuid: string, params: Record<string, string | string[]> = {}) {
    const extra = Object.entries(params)
        .map(([k, v]) => `\t\t<key>${xmlEscape(k)}</key>\n\t\t${Array.isArray(v)
            ? `<array>${v.map(s => `<string>${xmlEscape(s)}</string>`).join('')}</array>`
            : `<string>${xmlEscape(String(v))}</string>`}`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>Command</key>
\t<dict>
\t\t<key>RequestType</key>
\t\t<string>${requestType}</string>${extra ? '\n' + extra : ''}
\t</dict>
\t<key>CommandUUID</key>
\t<string>${commandUuid}</string>
</dict>
</plist>`;
}

export class MockMdmAdapter implements MdmAdapter {
    readonly name = 'mock' as const;
    async status() { return { reachable: false, error: 'Adaptador simulado: nenhum servidor MDM real conectado' }; }
    async pushCert() { return null; }
    async enqueue(_e: string, _r: MdmRequestType): Promise<EnqueueResult> {
        return { accepted: true, pushOk: false, commandUuid: randomUUID(), detail: 'SIMULADO: nada foi enviado a um aparelho' };
    }
}

export class NanoHubAdapter implements MdmAdapter {
    readonly name = 'nanohub' as const;
    private http: AxiosInstance;
    constructor(baseUrl: string, apiKey: string, http?: AxiosInstance) {
        this.http = http || axios.create({ baseURL: baseUrl.replace(/\/$/, ''), timeout: 15000, auth: { username: 'nanohub', password: apiKey } });
    }
    async status() {
        try {
            const { data } = await this.http.get('/version');
            return { reachable: true, version: typeof data === 'object' ? data.version : String(data) };
        } catch (err: any) {
            return { reachable: false, error: err?.code === 'ECONNREFUSED' ? 'servidor MDM fora do ar' : `falha ao consultar (${err?.response?.status || err?.code || 'erro'})` };
        }
    }
    async pushCert(topic?: string) {
        if (!topic) return null;
        try {
            const { data } = await this.http.get('/api/v1/nanomdm/pushcert', { params: { topic } });
            return { topic: data.topic, notAfter: data.not_after || null };
        } catch { return null; }
    }
    async enqueue(enrollmentId: string, requestType: MdmRequestType, params: Record<string, any> = {}): Promise<EnqueueResult> {
        const commandUuid = randomUUID();
        const body = buildCommandPlist(requestType, commandUuid, params);
        try {
            const { data } = await this.http.put(`/api/v1/nanomdm/enqueue/${encodeURIComponent(enrollmentId)}`, body, { headers: { 'Content-Type': 'application/xml' } });
            const st = data?.status?.[enrollmentId] || {};
            return {
                accepted: true,
                pushOk: Boolean(st.push_result) && !st.push_error,
                commandUuid: data?.command_uuid || commandUuid,
                detail: st.push_error ? `push falhou: ${String(st.push_error).slice(0, 200)}` : 'enfileirado e push enviado',
            };
        } catch (err: any) {
            return { accepted: false, pushOk: false, commandUuid, detail: `NanoHUB recusou (${err?.response?.status || err?.code || 'erro'})` };
        }
    }
}

export function getMdmAdapter(env = process.env, realCommands: boolean): MdmAdapter {
    if (realCommands && env.NANOHUB_URL && env.NANOHUB_API_KEY) return new NanoHubAdapter(env.NANOHUB_URL, env.NANOHUB_API_KEY);
    return new MockMdmAdapter();
}
