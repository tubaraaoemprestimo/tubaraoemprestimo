import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

export const adminRouter = Router();

// Middleware para garantir que é admin
const isAdmin = async (req: Request, res: Response, next: Function) => {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        return;
    }
    next();
};

// =============================================
// BLACKLIST
// =============================================

// GET /api/admin/blacklist - Listar blacklist
adminRouter.get('/blacklist', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const blacklist = await prisma.blacklist.findMany({
            orderBy: { addedAt: 'desc' }
        });
        res.json(blacklist);
    } catch (err) {
        console.error('[Admin] Error fetching blacklist:', err);
        res.status(500).json({ error: 'Erro ao buscar blacklist' });
    }
});

// POST /api/admin/blacklist - Adicionar à blacklist
adminRouter.post('/blacklist', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const { cpf, name, reason } = req.body;
        const cleanCpf = cpf.replace(/\D/g, '');

        if (!cleanCpf || !name || !reason) {
            res.status(400).json({ error: 'Dados incompletos' });
            return;
        }

        const existing = await prisma.blacklist.findUnique({ where: { cpf: cleanCpf } });
        if (existing) {
            res.status(400).json({ error: 'CPF já está na blacklist' });
            return;
        }

        const entry = await prisma.blacklist.create({
            data: {
                cpf: cleanCpf,
                name,
                reason,
                addedBy: req.user!.name,
                active: true
            }
        });

        res.json(entry);
    } catch (err) {
        console.error('[Admin] Error adding to blacklist:', err);
        res.status(500).json({ error: 'Erro ao adicionar à blacklist' });
    }
});

// DELETE /api/admin/blacklist/:id - Remover da blacklist
adminRouter.delete('/blacklist/:id', authenticate, isAdmin, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await prisma.blacklist.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover da blacklist' });
    }
});
