import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const customersRouter = Router();
customersRouter.use(authenticate);

// GET /api/customers — Listar clientes
customersRouter.get('/', async (_req: Request, res: Response) => {
    try {
        const rows = await prisma.$queryRawUnsafe(`
            SELECT
              id, user_id, name, cpf, email, phone, status,
              internal_score, total_debt, active_loans_count,
              address, neighborhood, city, state, zip_code,
              latitude, longitude, monthly_income,
              pre_approved_amount, pre_approved_at,
              instagram, source, profile_pic, birth_date,
              monthly_interest_rate, late_fixed_fee, late_interest_daily, late_interest_monthly,
              installment_offer, joined_at
            FROM customers
            ORDER BY joined_at DESC
        `);

        const mapped = (rows || []).map((c: any) => ({
            id: c.id,
            userId: c.user_id,
            name: c.name,
            cpf: c.cpf,
            email: c.email,
            phone: c.phone,
            status: c.status,
            internalScore: c.internal_score,
            totalDebt: c.total_debt,
            activeLoansCount: c.active_loans_count,
            address: c.address,
            neighborhood: c.neighborhood,
            city: c.city,
            state: c.state,
            zipCode: c.zip_code,
            latitude: c.latitude,
            longitude: c.longitude,
            monthlyIncome: c.monthly_income,
            preApprovedAmount: c.pre_approved_amount,
            preApprovedAt: c.pre_approved_at,
            instagram: c.instagram,
            source: c.source,
            profilePic: c.profile_pic,
            birthDate: c.birth_date,
            monthlyInterestRate: c.monthly_interest_rate,
            lateFixedFee: c.late_fixed_fee,
            lateInterestDaily: c.late_interest_daily,
            lateInterestMonthly: c.late_interest_monthly,
            installmentOffer: c.installment_offer,
            joinedAt: c.joined_at,
            preApprovedOffer: c.pre_approved_amount ? {
                amount: c.pre_approved_amount,
                createdAt: c.pre_approved_at || new Date().toISOString()
            } : undefined,
            customRates: (c.monthly_interest_rate || c.late_fixed_fee || c.late_interest_daily || c.late_interest_monthly) ? {
                monthlyInterestRate: c.monthly_interest_rate,
                lateFixedFee: c.late_fixed_fee,
                lateInterestDaily: c.late_interest_daily,
                lateInterestMonthly: c.late_interest_monthly
            } : undefined,
        }));

        res.json(mapped);
    } catch (error) {
        console.error('[Customers] list error:', error);
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

        await prisma.$executeRawUnsafe(`
            UPDATE customers
            SET latitude = $1, longitude = $2,
                city = COALESCE($3, city),
                state = COALESCE($4, state),
                address = COALESCE($5, address)
            WHERE LOWER(email) = LOWER($6)
        `,
            req.body?.latitude ?? null,
            req.body?.longitude ?? null,
            req.body?.city ?? null,
            req.body?.state ?? null,
            req.body?.address ?? null,
            email
        );

        res.json({ success: true });
    } catch (e) {
        console.error('[Customers] location save error:', e);
        res.status(500).json({ error: 'Erro ao salvar localizacao' });
    }
});

// GET /api/customers/locations — Listar localizacoes (admin)
customersRouter.get('/locations', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const rows = await prisma.$queryRawUnsafe(`
            SELECT email, name, phone, latitude, longitude, city, state, address, joined_at
            FROM customers
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY joined_at DESC
        `);

        res.json((rows || []).map((r: any) => ({
            customer_email: r.email,
            customer_name: r.name,
            phone: r.phone,
            latitude: r.latitude,
            longitude: r.longitude,
            city: r.city,
            state: r.state,
            address: r.address,
            updated_at: r.joined_at || new Date().toISOString()
        })));
    } catch (e) {
        console.error('[Customers] locations error:', e);
        res.status(500).json({ error: 'Erro ao buscar localizacoes' });
    }
});

// GET /api/customers/locations/:email — Localizacao por email (admin)
customersRouter.get('/locations/:email', requireAdmin, async (req: Request, res: Response) => {
    try {
        const email = decodeURIComponent(String(req.params.email || '')).toLowerCase();
        const rows = await prisma.$queryRawUnsafe(`
            SELECT email, name, phone, latitude, longitude, city, state, address, joined_at
            FROM customers
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
        `, email);
        const customer: any = rows?.[0];
        if (!customer) {
            res.status(404).json({ error: 'Cliente nao encontrado' });
            return;
        }
        res.json({
            customer_email: customer.email,
            customer_name: customer.name,
            phone: customer.phone,
            latitude: customer.latitude,
            longitude: customer.longitude,
            city: customer.city,
            state: customer.state,
            address: customer.address,
            updated_at: customer.joined_at || new Date().toISOString()
        });
    } catch (e) {
        console.error('[Customers] location by email error:', e);
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
