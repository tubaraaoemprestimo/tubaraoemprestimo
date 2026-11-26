import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { emailService } from './email';

/**
 * "Esqueci minha senha" — usado pelo app (/auth/forgot-password) e pelo WhatsApp de botões.
 * - Nunca revela se o e-mail existe.
 * - Link vale 1 h e é de uso único: o token carrega uma impressão do hash da senha atual;
 *   quando a senha muda, todos os links antigos param de funcionar (sem tabela nova).
 */
const SECRET = () => process.env.JWT_SECRET || 'default-secret';
export const MIN_PASSWORD = 6;
const WINDOW_MS = 15 * 60_000;
const MAX_PER_WINDOW = 3;
// ponytail: limite em memória (um processo PM2). Se escalar para cluster, mover para Redis/tabela.
const hits = new Map<string, number[]>();

const fingerprint = (passwordHash: string) => createHash('sha256').update(`pwd:${passwordHash}`).digest('hex').slice(0, 16);

export function allowRequest(key: string, max = MAX_PER_WINDOW, now = Date.now()) {
    const recent = (hits.get(key) || []).filter(t => now - t < WINDOW_MS);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(now); hits.set(key, recent);
    return true;
}

/** Envia o e-mail se a conta existir. Devolve true só para registro interno — nunca mostrar ao cliente. */
export async function requestPasswordReset(rawEmail: string, db: any = prisma, mailer = emailService): Promise<boolean> {
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !allowRequest(`mail:${email}`)) return false;
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return false;
    const token = jwt.sign({ userId: user.id, type: 'password_reset', pv: fingerprint(user.password) }, SECRET(), { expiresIn: '1h' });
    return mailer.sendPasswordReset(user.email, user.name, token);
}

export class ResetError extends Error {}

export async function resetPassword(token: string, newPassword: string, db: any = prisma) {
    if (!token || typeof newPassword !== 'string') throw new ResetError('Token e nova senha são obrigatórios');
    if (newPassword.length < MIN_PASSWORD) throw new ResetError(`A senha deve ter pelo menos ${MIN_PASSWORD} caracteres`);
    if (newPassword.length > 128) throw new ResetError('Senha muito longa');
    let decoded: any;
    try { decoded = jwt.verify(token, SECRET()); }
    catch (e: any) { throw new ResetError(e?.name === 'TokenExpiredError' ? 'Link expirado. Solicite um novo.' : 'Link inválido. Solicite um novo.'); }
    if (decoded?.type !== 'password_reset' || !decoded.pv) throw new ResetError('Link inválido. Solicite um novo.');
    const user = await db.user.findUnique({ where: { id: decoded.userId } });
    if (!user || fingerprint(user.password) !== decoded.pv) throw new ResetError('Este link já foi usado. Solicite um novo.');
    await db.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 12) } });
}
