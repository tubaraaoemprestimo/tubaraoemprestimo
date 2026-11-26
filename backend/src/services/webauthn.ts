import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';

/**
 * Biometria do próprio aparelho (Face ID, Touch ID, digital e rosto do Android) via WebAuthn.
 * O servidor cria um desafio de uso único; o aparelho assina com a chave guardada no chip seguro
 * depois da biometria; aqui conferimos a assinatura com a chave pública salva. Nenhuma senha fica no celular.
 * Sem biblioteca externa: ES256 / RS256 com node:crypto.
 */
const TTL = 2 * 60_000;
// ponytail: desafios em memória (PM2 fork, 1 processo). Se virar cluster, mover para Redis/tabela.
const pending = new Map<string, { exp: number; kind: 'get' | 'create'; userId?: string }>();
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest();
const dec = (s: string) => Buffer.from(s, 'base64url');

export class WebAuthnError extends Error {}

export function newChallenge(kind: 'get' | 'create', userId?: string, now = Date.now()) {
    for (const [k, v] of pending) if (v.exp < now) pending.delete(k);
    if (pending.size > 5000) throw new WebAuthnError('Muitas tentativas agora. Tente em instantes.');
    const c = randomBytes(32).toString('base64url');
    pending.set(c, { exp: now + TTL, kind, userId });
    return c;
}

export function allowedOrigins(): string[] {
    const list = (process.env.WEBAUTHN_ORIGINS || process.env.FRONTEND_URL || 'https://www.tubaraoemprestimo.com.br')
        .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    if (process.env.NODE_ENV !== 'production') list.push('http://localhost:5173');
    return list;
}

function clientData(raw: string, type: 'webauthn.get' | 'webauthn.create', now: number) {
    const buf = dec(raw);
    let cd: any;
    try { cd = JSON.parse(buf.toString('utf8')); } catch { throw new WebAuthnError('Resposta da biometria inválida.'); }
    if (cd?.type !== type) throw new WebAuthnError('Resposta da biometria inválida.');
    if (!allowedOrigins().includes(cd.origin)) throw new WebAuthnError('Use o app pelo endereço oficial.');
    const entry = pending.get(cd.challenge);
    pending.delete(cd.challenge); // uso único, mesmo se falhar
    if (!entry || entry.exp < now || entry.kind !== (type === 'webauthn.get' ? 'get' : 'create')) throw new WebAuthnError('O tempo acabou. Tente de novo.');
    return { buf, entry, rpIdHash: sha256(new URL(cd.origin).hostname) };
}

function checkAuthData(auth: Buffer, rpIdHash: Buffer) {
    if (auth.length < 37 || !auth.subarray(0, 32).equals(rpIdHash)) throw new WebAuthnError('Biometria de outro endereço.');
    const flags = auth[32];
    if (!(flags & 0x01) || !(flags & 0x04)) throw new WebAuthnError('O aparelho não confirmou a biometria.');
}

/** Login: confere a assinatura do aparelho. Devolve o contador novo. */
export function verifyAssertion(a: { publicKey: string; clientDataJSON: string; authenticatorData: string; signature: string }, now = Date.now()) {
    const { buf, rpIdHash } = clientData(a.clientDataJSON, 'webauthn.get', now);
    const auth = dec(a.authenticatorData);
    checkAuthData(auth, rpIdHash);
    let ok = false;
    try {
        const key = createPublicKey({ key: dec(a.publicKey), format: 'der', type: 'spki' });
        ok = verify('sha256', Buffer.concat([auth, sha256(buf)]), key, dec(a.signature));
    } catch { ok = false; }
    if (!ok) throw new WebAuthnError('Biometria não confere. Entre com a senha.');
    // ponytail: sem detecção de clone pelo contador — contadores antigos foram gravados pelo navegador
    // e passkeys sincronizadas (iCloud/Google) mandam 0. Ligar quando todos os contadores vierem daqui.
    return { signCount: auth.readUInt32BE(33) };
}

const AUTH_DATA_KEY = Buffer.from([0x68, ...Buffer.from('authData')]);

/** Tira o authData do attestationObject (CBOR) sem biblioteca: chave texto "authData" + byte string. */
export function authDataFromAttestation(att: Buffer): Buffer {
    const i = att.indexOf(AUTH_DATA_KEY);
    if (i < 0) throw new WebAuthnError('Cadastro da biometria inválido.');
    let p = i + AUTH_DATA_KEY.length;
    const h = att[p];
    let len: number;
    if (h >= 0x40 && h <= 0x57) { len = h - 0x40; p += 1; }
    else if (h === 0x58) { len = att[p + 1]; p += 2; }
    else if (h === 0x59) { len = att.readUInt16BE(p + 1); p += 3; }
    else throw new WebAuthnError('Cadastro da biometria inválido.');
    return att.subarray(p, p + len);
}

/** Cadastro: desafio do próprio usuário, endereço certo, biometria feita e id da credencial confere. */
export function verifyRegistration(r: { userId: string; credentialId: string; publicKey: string; attestationObject: string; clientDataJSON: string }, now = Date.now()) {
    const { entry, rpIdHash } = clientData(r.clientDataJSON, 'webauthn.create', now);
    if (entry.userId !== r.userId) throw new WebAuthnError('Sessão diferente. Tente de novo.');
    const auth = authDataFromAttestation(dec(r.attestationObject));
    checkAuthData(auth, rpIdHash);
    if (!(auth[32] & 0x40) || auth.length < 55) throw new WebAuthnError('Cadastro da biometria inválido.');
    const idLen = auth.readUInt16BE(53);
    if (!auth.subarray(55, 55 + idLen).equals(dec(r.credentialId))) throw new WebAuthnError('Cadastro da biometria inválido.');
    // ponytail: a chave pública vem de getPublicKey() do navegador (SPKI) e não é comparada com a COSE do authData.
    // Chave errada só impede o login da própria conta; comparar quando houver parser COSE.
    let type: string | undefined;
    try { type = createPublicKey({ key: dec(r.publicKey), format: 'der', type: 'spki' }).asymmetricKeyType; } catch { /* inválida */ }
    if (type !== 'ec' && type !== 'rsa') throw new WebAuthnError('Chave da biometria inválida.');
}
