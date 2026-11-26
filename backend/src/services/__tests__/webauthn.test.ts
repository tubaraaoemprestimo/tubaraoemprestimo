import { describe, it, expect, beforeAll } from 'vitest';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

process.env.WEBAUTHN_ORIGINS = 'https://www.tubaraoemprestimo.com.br';
import { newChallenge, verifyAssertion, verifyRegistration, authDataFromAttestation } from '../webauthn';

const ORIGIN = 'https://www.tubaraoemprestimo.com.br';
const b64 = (b: Buffer) => b.toString('base64url');
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest();

function authData(flags: number, count = 7, host = 'www.tubaraoemprestimo.com.br', extra = Buffer.alloc(0)) {
    const c = Buffer.alloc(4); c.writeUInt32BE(count);
    return Buffer.concat([sha(host), Buffer.from([flags]), c, extra]);
}
function assertion(keys: any, challenge: string, opts: { origin?: string; flags?: number; type?: string } = {}) {
    const cd = Buffer.from(JSON.stringify({ type: opts.type || 'webauthn.get', challenge, origin: opts.origin || ORIGIN }));
    const ad = authData(opts.flags ?? 0x05);
    const sig = sign('sha256', Buffer.concat([ad, sha(cd)]), keys.privateKey);
    return { publicKey: b64(keys.publicKey.export({ format: 'der', type: 'spki' })), clientDataJSON: b64(cd), authenticatorData: b64(ad), signature: b64(sig) };
}

describe('Biometria do aparelho (WebAuthn) conferida no servidor', () => {
    let ec: any, rsa: any;
    beforeAll(() => {
        ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }); // iPhone / Android
        rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }); // Windows Hello
    });

    it('assinatura válida entra (ES256 e RS256) e devolve o contador', () => {
        expect(verifyAssertion(assertion(ec, newChallenge('get')))).toEqual({ signCount: 7 });
        expect(verifyAssertion(assertion(rsa, newChallenge('get')))).toEqual({ signCount: 7 });
    });

    it('desafio é de uso único (replay recusado)', () => {
        const a = assertion(ec, newChallenge('get'));
        verifyAssertion(a);
        expect(() => verifyAssertion(a)).toThrow(/tempo acabou/);
    });

    it('recusa desafio inventado, vencido, site falso, sem biometria e assinatura de outra chave', () => {
        expect(() => verifyAssertion(assertion(ec, 'inventado'))).toThrow(/tempo acabou/);
        const old = newChallenge('get', undefined, Date.now() - 3 * 60_000);
        expect(() => verifyAssertion(assertion(ec, old))).toThrow(/tempo acabou/);
        expect(() => verifyAssertion(assertion(ec, newChallenge('get'), { origin: 'https://tubarao-falso.com' }))).toThrow(/endereço oficial/);
        expect(() => verifyAssertion(assertion(ec, newChallenge('get'), { flags: 0x01 }))).toThrow(/não confirmou a biometria/);
        const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
        const forged = { ...assertion(other, newChallenge('get')), publicKey: b64(ec.publicKey.export({ format: 'der', type: 'spki' })) };
        expect(() => verifyAssertion(forged)).toThrow(/não confere/);
    });

    it('cadastro: confere desafio do próprio usuário e o id da credencial dentro do attestation', () => {
        const credId = Buffer.from('credencial-do-aparelho-123');
        const len = Buffer.alloc(2); len.writeUInt16BE(credId.length);
        const ad = authData(0x45, 0, 'www.tubaraoemprestimo.com.br', Buffer.concat([Buffer.alloc(16), len, credId, Buffer.from([0xa0])]));
        // CBOR: {"fmt":"none","attStmt":{},"authData": bytes}
        const att = Buffer.concat([Buffer.from([0xa3, 0x63]), Buffer.from('fmt'), Buffer.from([0x64]), Buffer.from('none'), Buffer.from([0x67]), Buffer.from('attStmt'), Buffer.from([0xa0, 0x68]), Buffer.from('authData'), Buffer.from([0x58, ad.length]), ad]);
        expect(authDataFromAttestation(att).equals(ad)).toBe(true);
        const reg = (challenge: string, userId = 'u1', id = credId) => ({
            userId, credentialId: b64(id), publicKey: b64(ec.publicKey.export({ format: 'der', type: 'spki' })), attestationObject: b64(att),
            clientDataJSON: b64(Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN }))),
        });
        expect(() => verifyRegistration(reg(newChallenge('create', 'u1')))).not.toThrow();
        expect(() => verifyRegistration(reg(newChallenge('create', 'u2')))).toThrow(/Sessão diferente/);
        expect(() => verifyRegistration(reg(newChallenge('get')))).toThrow(/tempo acabou/);
        expect(() => verifyRegistration(reg(newChallenge('create', 'u1'), 'u1', Buffer.from('outro-id')))).toThrow(/inválido/);
    });
});
