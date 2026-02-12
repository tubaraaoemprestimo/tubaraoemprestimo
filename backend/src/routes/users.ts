import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const usersRouter = Router();

// Todas as rotas requerem autenticação
usersRouter.use(authenticate);

// GET /api/users — Listar todos os usuários (Admin)
usersRouter.get('/', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, name: true, email: true, role: true,
                phone: true, avatarUrl: true, createdAt: true,
                address: true, city: true, neighborhood: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// POST /api/users — Criar usuário (Admin)
usersRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { name, email, password, role, phone } = req.body;

        const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) {
            res.status(400).json({ error: 'Email já cadastrado' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: role || 'CLIENT',
                phone,
                authId: null // Já confirmado (criado pelo admin)
            }
        });

        // Cria Customer associado se for CLIENT
        if (user.role === 'CLIENT') {
            await prisma.customer.create({
                data: {
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || '',
                    cpf: `ADMIN_${user.id.substring(0, 8)}`,
                    status: 'ACTIVE'
                }
            });
        }

        res.status(201).json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        console.error('[Users] Create error:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// PUT /api/users/:id — Atualizar usuário
usersRouter.put('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { name, role, phone, address, city, neighborhood } = req.body;

        await prisma.user.update({
            where: { id },
            data: { name, role, phone, address, city, neighborhood }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// DELETE /api/users/:id — Deletar usuário
usersRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await prisma.user.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
});

// PUT /api/users/:id/password — Reset senha (Admin)
usersRouter.put('/:id/password', requireAdmin, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao resetar senha' });
    }
});
