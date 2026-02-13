import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

/**
 * Middleware de autenticação JWT
 * Verifica o token no header Authorization: Bearer <token>
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token não fornecido' });
            return;
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'default-secret';

        const decoded = jwt.verify(token, secret) as AuthUser;

        // Verifica se o usuário ainda existe
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, name: true, role: true }
        });

        if (!user) {
            res.status(401).json({ error: 'Usuário não encontrado' });
            return;
        }

        req.user = user;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
            return;
        }
        res.status(401).json({ error: 'Token inválido' });
    }
};

/**
 * Middleware que exige role de ADMIN
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        return;
    }
    next();
};

/**
 * Middleware opcional de autenticação (não bloqueia se não tiver token)
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const secret = process.env.JWT_SECRET || 'default-secret';
            const decoded = jwt.verify(token, secret) as AuthUser;
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, email: true, name: true, role: true }
            });
            if (user) req.user = user;
        }
    } catch {
        // Ignora erro — auth é opcional
    }
    next();
};

/**
 * Gera Access Token JWT
 */
export function generateAccessToken(user: AuthUser): string {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );
}

/**
 * Gera Refresh Token JWT
 */
export function generateRefreshToken(user: AuthUser): string {
    return jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
        { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any }
    );
}
