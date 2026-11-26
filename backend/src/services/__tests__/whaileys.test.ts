import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySignature, parseIncoming, numbered } from '../whaileys';

const SECRET = 'a'.repeat(64);
const sign = (ts: string, body: string) => createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');

describe('Whaileys: fronteira e leitura de cliques', () => {
    const now = 1_800_000_000_000, ts = String(now), body = '{"key":{"id":"ABC"}}';

    it('aceita assinatura válida e recusa corpo adulterado, replay e lixo', () => {
        expect(verifySignature(body, ts, sign(ts, body), SECRET, now)).toBe(true);
        expect(verifySignature(body + ' ', ts, sign(ts, body), SECRET, now)).toBe(false);
        expect(verifySignature(body, ts, sign(ts, body), SECRET, now + 301_000)).toBe(false);
        expect(verifySignature(body, ts, 'zz', SECRET, now)).toBe(false);
        expect(verifySignature(body, null, sign(ts, body), SECRET, now)).toBe(false);
        expect(verifySignature(body, ts, sign(ts, body), '', now)).toBe(false);
    });

    const opts = [{ id: 'svc:LOAN', title: '💰 Empréstimo' }, { id: 'svc:PHONE', title: '📱 Celular' }];

    it('clique, número e palavra levam à mesma opção', () => {
        expect(parseIncoming({ buttonsResponseMessage: { selectedButtonId: 'svc:PHONE' } }, opts)).toEqual({ kind: 'action', id: 'svc:PHONE' });
        expect(parseIncoming({ listResponseMessage: { singleSelectReply: { selectedRowId: 'svc:LOAN' } } }, opts)).toEqual({ kind: 'action', id: 'svc:LOAN' });
        expect(parseIncoming({ interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{"id":"svc:LOAN"}' } } }, opts)).toEqual({ kind: 'action', id: 'svc:LOAN' });
        expect(parseIncoming({ conversation: '2' }, opts)).toEqual({ kind: 'action', id: 'svc:PHONE' });
        expect(parseIncoming({ conversation: 'emprestimo' }, opts)).toEqual({ kind: 'action', id: 'svc:LOAN' });
        expect(parseIncoming({ conversation: '9' }, opts)).toEqual({ kind: 'text', text: '9' });
    });

    it('mídia e mensagem vazia', () => {
        expect(parseIncoming({ imageMessage: { mimetype: 'image/jpeg' } })).toMatchObject({ kind: 'media', media: 'image' });
        expect(parseIncoming({ ephemeralMessage: { message: { videoMessage: { mimetype: 'video/mp4' } } } })).toMatchObject({ kind: 'media', media: 'video' });
        expect(parseIncoming({ conversation: '   ' })).toEqual({ kind: 'ignored' });
        expect(parseIncoming(null)).toEqual({ kind: 'ignored' });
    });

    it('texto numerado de reserva', () => {
        expect(numbered('Escolha:', opts)).toBe('Escolha:\n\n1. 💰 Empréstimo\n2. 📱 Celular');
    });
});
