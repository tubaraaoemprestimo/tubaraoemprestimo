import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const customersRouter = Router();
customersRouter.use(authenticate);

// GET /api/customers — Listar clientes
customersRouter.get('/', async (_req: Request, res: Response) => {
    try {
        const customers = await prisma.customer.findMany({
            orderBy: { joinedAt: 'desc' },
            include: {
                _count: { select: { loanRequests: true } }
            }
        });

        res.json(customers.map(c => ({
            ...c,
            loanRequestsCount: c._count.loanRequests
        })));
    } catch (error) {
        console.error('[Customers] list error:', error);
        res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
});


// PUT /api/customers/location — Salvar localizacao do usuario atual (chamado em cada acesso)
customersRouter.put('/location', async (req: Request, res: Response) => {
    try {
        const email = String(req.body?.customer_email || req.user?.email || '').trim().toLowerCase();
        if (!email) {
            res.status(400).json({ error: 'Email obrigatorio' });
            return;
        }

        const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';

        await prisma.$executeRawUnsafe(`
            UPDATE customers
            SET latitude = $1, longitude = $2,
                city = COALESCE($3, city),
                state = COALESCE($4, state),
                address = COALESCE($5, address),
                location_updated_at = NOW(),
                device_info = $7,
                last_ip = $8
            WHERE LOWER(email) = LOWER($6)
        `,
            req.body?.latitude ?? null,
            req.body?.longitude ?? null,
            req.body?.city ?? null,
            req.body?.state ?? null,
            req.body?.address ?? null,
            email,
            userAgent.substring(0, 500),
            String(ip).substring(0, 100)
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
            SELECT email, name, phone, latitude, longitude, city, state, address,
                   device_info, last_ip, location_updated_at, joined_at
            FROM customers
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY location_updated_at DESC NULLS LAST, joined_at DESC
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
            device_info: r.device_info,
            last_ip: r.last_ip,
            updated_at: r.location_updated_at || r.joined_at || new Date().toISOString()
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
        const customerId = req.params.id as string;

        // Verificar se o cliente existe
        const existing = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!existing) {
            res.status(404).json({ error: 'Cliente não encontrado' });
            return;
        }

        // Whitelist de campos atualizáveis para evitar erros do Prisma
        const allowedFields = [
            'name', 'cpf', 'email', 'phone', 'status',
            'internalScore', 'totalDebt', 'activeLoansCount',
            'address', 'neighborhood', 'city', 'state', 'zipCode',
            'latitude', 'longitude', 'monthlyIncome',
            'preApprovedAmount', 'preApprovedAt',
            'instagram', 'source', 'profilePic', 'birthDate',
            'monthlyInterestRate', 'lateFixedFee', 'lateInterestDaily', 'lateInterestMonthly',
            'installmentOffer', 'referralCode', 'referralPoints',
            'partnerId', 'isPartnerCustomer', 'partnerCommissionRate',
            'contractTermsAccepted'
        ];

        const updateData: any = {};

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }

        // Tratar campos numéricos
        if (updateData.internalScore !== undefined) updateData.internalScore = parseInt(updateData.internalScore) || 0;
        if (updateData.totalDebt !== undefined) updateData.totalDebt = parseFloat(updateData.totalDebt) || 0;
        if (updateData.activeLoansCount !== undefined) updateData.activeLoansCount = parseInt(updateData.activeLoansCount) || 0;
        if (updateData.monthlyIncome !== undefined) updateData.monthlyIncome = parseFloat(updateData.monthlyIncome) || null;
        if (updateData.referralPoints !== undefined) updateData.referralPoints = parseInt(updateData.referralPoints) || 0;
        if (updateData.monthlyInterestRate !== undefined) updateData.monthlyInterestRate = parseFloat(updateData.monthlyInterestRate) || null;
        if (updateData.lateFixedFee !== undefined) updateData.lateFixedFee = parseFloat(updateData.lateFixedFee) || null;
        if (updateData.lateInterestDaily !== undefined) updateData.lateInterestDaily = parseFloat(updateData.lateInterestDaily) || null;
        if (updateData.lateInterestMonthly !== undefined) updateData.lateInterestMonthly = parseFloat(updateData.lateInterestMonthly) || null;

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
            return;
        }

        await prisma.customer.update({
            where: { id: customerId },
            data: updateData
        });

        console.log(`[Customers] Updated customer ${customerId}, fields: ${Object.keys(updateData).join(', ')}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[Customers] Update error:', error?.message || error);
        res.status(500).json({ error: 'Erro ao atualizar cliente', details: error?.message });
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
