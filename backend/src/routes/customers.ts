import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const customersRouter = Router();
customersRouter.use(authenticate);

// GET /api/customers — Listar clientes
customersRouter.get('/', async (req: Request, res: Response) => {
    try {
        const customers = await prisma.customer.findMany({
            orderBy: { joinedAt: 'desc' }
        });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
});


// PUT /api/customers/location — Salvar localizacao do usuario atual
customersRouter.put('/location', async (req: Request, res: Response) => {
    try {
        const email = String(req.body?.customer_email || req.user?.email || '').trim().toLowerCase();
        if (!email) {
            res.status(400).json({ error: 'Email obrigatorio' });
            return;
        }

        const customer = await prisma.customer.findFirst({ where: { email } });
        if (!customer) {
            // Nao quebrar fluxo de admin sem customer associado
            res.status(204).send();
            return;
        }

        await prisma.customer.update({
            where: { id: customer.id },
            data: {
                latitude: req.body?.latitude ?? null,
                longitude: req.body?.longitude ?? null,
                city: req.body?.city ?? customer.city,
                state: req.body?.state ?? customer.state,
                address: req.body?.address ?? customer.address
            }
        });

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao salvar localizacao' });
    }
});

// GET /api/customers/locations — Listar localizacoes (admin)
customersRouter.get('/locations', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const rows = await prisma.customer.findMany({
            where: {
                latitude: { not: null },
                longitude: { not: null }
            },
            select: {
                email: true,
                name: true,
                latitude: true,
                longitude: true,
                city: true,
                state: true,
                address: true
            },
            orderBy: { joinedAt: 'desc' }
        });

        res.json(rows.map((r) => ({
            customer_email: r.email,
            customer_name: r.name,
            latitude: r.latitude,
            longitude: r.longitude,
            city: r.city,
            state: r.state,
            address: r.address,
            updated_at: new Date().toISOString()
        })));
    } catch {
        res.status(500).json({ error: 'Erro ao buscar localizacoes' });
    }
});

// GET /api/customers/locations/:email — Localizacao por email (admin)
customersRouter.get('/locations/:email', requireAdmin, async (req: Request, res: Response) => {
    try {
        const email = decodeURIComponent(String(req.params.email || '')).toLowerCase();
        const customer = await prisma.customer.findFirst({ where: { email } });
        if (!customer) {
            res.status(404).json({ error: 'Cliente nao encontrado' });
            return;
        }
        res.json({
            customer_email: customer.email,
            customer_name: customer.name,
            latitude: customer.latitude,
            longitude: customer.longitude,
            city: customer.city,
            state: customer.state,
            address: customer.address,
            updated_at: new Date().toISOString()
        });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar localizacao' });
    }
});

// GET /api/customers/:id — Buscar cliente por ID
customersRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: req.params.id as string },
            include: { loanRequests: true, loans: { include: { installments: true } } }
        });
        if (!customer) {
            res.status(404).json({ error: 'Cliente não encontrado' });
            return;
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
});

// PUT /api/customers/:id — Atualizar cliente
customersRouter.put('/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        await prisma.customer.update({
            where: { id: req.params.id as string },
            data
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
});

// PUT /api/customers/:id/status — Toggle status
customersRouter.put('/:id/status', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { status } = req.body;
        await prisma.customer.update({
            where: { id: req.params.id as string },
            data: { status }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// PUT /api/customers/:id/rates — Taxas personalizadas
customersRouter.put('/:id/rates', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { monthlyInterestRate, lateFixedFee, lateInterestDaily, lateInterestMonthly } = req.body;
        await prisma.customer.update({
            where: { id: req.params.id as string },
            data: { monthlyInterestRate, lateFixedFee, lateInterestDaily, lateInterestMonthly }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar taxas' });
    }
});

// POST /api/customers/:id/pre-approval — Pré-aprovação
customersRouter.post('/:id/pre-approval', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { amount } = req.body;
        await prisma.customer.update({
            where: { id: req.params.id as string },
            data: {
                preApprovedAmount: amount,
                preApprovedAt: new Date()
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao enviar pré-aprovação' });
    }
});

// POST /api/customers/:id/installment-offer — Oferta de parcelamento
customersRouter.post('/:id/installment-offer', requireAdmin, async (req: Request, res: Response) => {
    try {
        const offer = req.body;
        await prisma.customer.update({
            where: { id: req.params.id as string },
            data: { installmentOffer: offer }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao enviar oferta' });
    }
});

// DELETE /api/customers/:id/installment-offer
customersRouter.delete('/:id/installment-offer', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.customer.update({
            where: { id: req.params.id as string },
            data: { installmentOffer: null as any }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover oferta' });
    }
});

// POST /api/customers/:id/create-user — Criar acesso para cliente
customersRouter.post('/:id/create-user', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { password } = req.body;
        const customer = await prisma.customer.findUnique({ where: { id: req.params.id as string } });
        if (!customer) { res.status(404).json({ error: 'Cliente não encontrado' }); return; }

        const bcryptjs = require('bcryptjs');
        const hashedPassword = await bcryptjs.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name: customer.name,
                email: customer.email,
                password: hashedPassword,
                role: 'CLIENT',
                phone: customer.phone,
                authId: null
            }
        });

        await prisma.customer.update({
            where: { id: req.params.id as string },
            data: { userId: user.id }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar acesso' });
    }
});

// POST /api/customers/import — Importar leads
customersRouter.post('/import', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { leads } = req.body;
        let added = 0, errors = 0;

        for (const lead of leads) {
            try {
                const existing = await prisma.customer.findFirst({
                    where: { phone: lead.phone }
                });
                if (existing) {
                    await prisma.customer.update({
                        where: { id: existing.id },
                        data: { name: lead.name, profilePic: lead.profilePic }
                    });
                } else {
                    await prisma.customer.create({
                        data: {
                            name: lead.name,
                            phone: lead.phone,
                            email: `${lead.phone}@imported.local`,
                            cpf: `IMP_${lead.phone.slice(-8)}`,
                            source: 'IMPORT',
                            profilePic: lead.profilePic
                        }
                    });
                }
                added++;
            } catch {
                errors++;
            }
        }

        res.json({ added, errors });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao importar' });
    }
});

// DELETE /api/customers/bulk — Deletar em massa
customersRouter.delete('/bulk', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;
        await prisma.customer.deleteMany({ where: { id: { in: ids } } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar' });
    }
});

// DELETE /api/customers/whatsapp-leads — Deletar leads importados do WhatsApp
customersRouter.delete('/whatsapp-leads', requireAdmin, async (_req: Request, res: Response) => {
    try {
        await prisma.customer.deleteMany({
            where: {
                OR: [
                    { source: 'WHATSAPP' },
                    { source: 'IMPORT' },
                    { email: { endsWith: '@whatsapp.lead' } },
                    { email: { endsWith: '@imported.local' } }
                ]
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar leads' });
    }
});
