import { describe, it, expect, vi } from 'vitest';
import { normalizeMessage, nextStatus, mapStatus, phoneFromJid, aiAllowed, isPrivateJid } from '../inbox';
import { trustedWebhook, inboxText } from '../inboxBoundary';

const rec = (message: any) => ({ key: { id: 'ficticio', fromMe: false, remoteJid: '12345@lid' }, messageTimestamp: 1790000000, message });
describe('Central WhatsApp: contrato do provedor e fronteiras de confiança', () => {
    it.each(['OPEN', '', false, null])('não toma origem desconhecida como credencial: %s', header => {
        expect(trustedWebhook('empresa', 'empresa', header, 'a'.repeat(32))).toBe(false);
    });
    it('exige instância e segredo próprios', () => {
        const k = 'a'.repeat(32);
        expect(trustedWebhook('empresa', 'empresa', k, k)).toBe(true);
        expect(trustedWebhook('outra', 'empresa', k, k)).toBe(false);
        expect(trustedWebhook('empresa', 'empresa', k, undefined)).toBe(false);
    });
    it('não trata LID, grupo, broadcast ou newsletter como telefone', () => {
        expect(phoneFromJid('12345@lid')).toBeNull();
        expect(phoneFromJid('12345@lid', '5511900000000@s.whatsapp.net')).toBe('5511900000000');
        for (const jid of ['status@broadcast','12345@g.us','12345@newsletter','texto','foo@lid']) expect(isPrivateJid(jid)).toBe(false);
    });
    it.each([['audioMessage','audio'],['documentMessage','document'],['imageMessage','image'],['videoMessage','video']])('preserva tipo e ID sem guardar binário: %s', (k, type) => {
        const n = normalizeMessage(rec({ [k]: { data: 'conteudo-binario' } }));
        expect(n).toMatchObject({ type, externalId: 'ficticio', phone: null, fromMe: false });
        expect(JSON.stringify(n)).not.toContain('conteudo-binario');
    });
    it('não disponibiliza mídia de visualização única', () => {
        for (const m of [{ imageMessage: { viewOnce: true } }, { viewOnceMessageV2: { message: { videoMessage: {} } } }]) expect(normalizeMessage(rec(m))).toMatchObject({ type: 'view_once', mediaMime: null });
    });
    it('não inventa leitura nem regride ACKs', () => {
        expect(mapStatus('inexistente')).toBeNull();
        expect(nextStatus({ status: 'READ', statusRank: 4 }, mapStatus('SERVER_ACK')!)).toBeNull();
        expect(nextStatus({ status: 'SENT', statusRank: 2 }, mapStatus('DELIVERY_ACK')!)).toEqual({ status: 'DELIVERED', statusRank: 3 });
    });
    it('oculta segredos de convites e senhas', () => {
        expect(inboxText('https://example.invalid/#/ativar?c=valor-secreto\nSenha: valor-secreto')).not.toContain('valor-secreto');
    });
    it.each(['WAITING_HUMAN','HUMAN_ACTIVE','CLOSED',null])('IA não envia no estado %s', async mode => {
        const db = { whatsappConfig: { findFirst: async () => ({ instanceName: 'empresa' }) }, waConversation: { findUnique: vi.fn().mockResolvedValue(mode ? { mode } : null) } };
        expect(await aiAllowed('12345@lid', db)).toBe(false);
    });
});
