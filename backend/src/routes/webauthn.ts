import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, generateAccessToken, generateRefreshToken } from '../middleware/auth';
import { allowRequest } from '../services/passwordReset';
import { newChallenge, verifyAssertion, verifyRegistration, WebAuthnError } from '../services/webauthn';

/** /api/auth/biometric — entrar com a biometria do aparelho (conferida aqui no servidor). */
export const webauthnRouter = Router();

const ipOf = (req: Request) => String(req.headers['cf-connecting-ip'] || req.ip);
const str = (v: unknown, max = 20000) => typeof v === 'string' && v.length > 0 && v.length <= max;

webauthnRouter.post('/options', (req: Request, res: Response) => {
    if (!allowRequest(`bio:${ipOf(req)}`, 40)) { res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }); return; }
    try { res.json({ challenge: newChallenge('get') }); }
    catch (e: any) { res.status(503).json({ error: e.message }); }
});

webauthnRouter.post('/login', async (req: Request, res: Response) => {
    try {
        const { credentialId, clientDataJSON, authenticatorData, signature } = req.body || {};
        if (![credentialId, clientDataJSON, authenticatorData, signature].every(v => str(v))) { res.status(400).json({ error: 'Dados da biometria incompletos.' }); return; }
        const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId }, include: { user: true } });
        if (!cred?.publicKey || !cred.user) {
            res.status(401).json({ error: 'Biometria ainda não ativada neste aparelho. Entre com a senha uma vez para ativar.', code: 'BIO_UNKNOWN' });
            return;
        }
        const { signCount } = verifyAssertion({ publicKey: cred.publicKey, clientDataJSON, authenticatorData, signature });
        await prisma.webAuthnCredential.update({ where: { id: cred.id }, data: { signCount, lastUsedAt: new Date() } });
        const u = cred.user;
        const authUser = { id: u.id, email: u.email, name: u.name, role: u.role };
        res.json({
            user: { id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, avatarUrl: u.avatarUrl },
            accessToken: generateAccessToken(authUser),
            refreshToken: generateRefreshToken(authUser),
        });
    } catch (e: any) {
        if (e instanceof WebAuthnError) { res.status(401).json({ error: e.message }); return; }
        console.error('[Biometric] login error:', e?.message);
        res.status(500).json({ error: 'Erro ao entrar com biometria. Use a senha.' });
    }
});

webauthnRouter.get('/mine', authenticate, async (req: Request, res: Response) => {
    const creds = await prisma.webAuthnCredential.findMany({ where: { userId: req.user!.id }, select: { credentialId: true, deviceName: true, createdAt: true, lastUsedAt: true } });
    res.json(creds);
});

webauthnRouter.post('/register-options', authenticate, async (req: Request, res: Response) => {
    try {
        const creds = await prisma.webAuthnCredential.findMany({ where: { userId: req.user!.id }, select: { credentialId: true } });
        res.json({ challenge: newChallenge('create', req.user!.id), exclude: creds.map(c => c.credentialId) });
    } catch (e: any) { res.status(503).json({ error: e.message }); }
});

webauthnRouter.post('/register', authenticate, async (req: Request, res: Response) => {
    try {
        const { credentialId, publicKey, attestationObject, clientDataJSON, deviceName } = req.body || {};
        if (![credentialId, publicKey, attestationObject, clientDataJSON].every(v => str(v))) { res.status(400).json({ error: 'Dados da biometria incompletos.' }); return; }
        const user = req.user!;
        verifyRegistration({ userId: user.id, credentialId, publicKey, attestationObject, clientDataJSON });
        const existing = await prisma.webAuthnCredential.findUnique({ where: { credentialId } });
        if (existing && existing.userId !== user.id) { res.status(409).json({ error: 'Biometria já usada por outra conta.' }); return; }
        if (!existing) {
            await prisma.webAuthnCredential.create({ data: {
                userId: user.id, userEmail: user.email, credentialId, publicKey, attestationObject,
                deviceName: String(deviceName || 'Celular').slice(0, 60), signCount: 0,
            } });
        }
        res.json({ success: true });
    } catch (e: any) {
        if (e instanceof WebAuthnError) { res.status(400).json({ error: e.message }); return; }
        console.error('[Biometric] register error:', e?.message);
        res.status(500).json({ error: 'Erro ao ativar biometria.' });
    }
});
