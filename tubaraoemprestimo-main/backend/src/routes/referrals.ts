import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';

export const referralsRouter = Router();

// GET /api/referrals — Listar indicações
referralsRouter.get('/', async (req: Request, res: Response) => {
    try {
        const { referrer_customer_id, customer_id, status } = req.query;
        const where: any = {};

        if (referrer_customer_id) where.referrerCustomerId = String(referrer_customer_id);
        if (customer_id) where.referredCustomerId = String(customer_id);
        if (status) where.status = String(status).toUpperCase();

        const referrals = await prisma.referral.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                referrer: { select: { id: true, name: true, email: true, phone: true, referralCode: true, referralPoints: true } },
                referred: { select: { id: true, name: true, email: true, phone: true } }
            }
        });

        const mapped = referrals.map((r: any) => ({
            id: r.id,
            referrer_customer_id: r.referrerCustomerId,
            referrer_code: r.referrerCode,
            referrer_name: r.referrer?.name || '',
            referrer_email: r.referrer?.email || '',
            referred_customer_id: r.referredCustomerId,
            referred_name: r.referredName,
            referred_phone: r.referredPhone,
            status: r.status,
            points_awarded: r.pointsAwarded,
            bonus_amount: r.bonusAmount,
            created_at: r.createdAt,
            approved_at: r.approvedAt
        }));

        res.json(mapped);
    } catch (error) {
        console.error('[Referrals] list error:', error);
        res.json([]);
    }
});

// GET /api/referrals/my — Indicações do cliente logado
referralsRouter.get('/my', authenticate, async (req: Request, res: Response) => {
    try {
        const customer = await prisma.customer.findFirst({
            where: { OR: [{ userId: req.user!.id }, { email: req.user!.email }] }
        });

        if (!customer) {
            res.json({ referralCode: '', points: 0, referrals: [], totalBonus: 0 });
            return;
        }

        const referrals = await prisma.referral.findMany({
            where: { referrerCustomerId: customer.id },
            orderBy: { createdAt: 'desc' }
        });

        const totalPoints = customer.referralPoints || 0;
        const totalBonus = referrals.reduce((sum: number, r: any) => sum + (r.bonusAmount || 0), 0);

        res.json({
            referralCode: customer.referralCode || '',
            points: totalPoints,
            totalBonus,
            referrals: referrals.map((r: any) => ({
                id: r.id,
                referred_name: r.referredName,
                referred_phone: r.referredPhone,
                status: r.status,
                points_awarded: r.pointsAwarded,
                bonus_amount: r.bonusAmount,
                created_at: r.createdAt,
                approved_at: r.approvedAt
            }))
        });
    } catch (error) {
        console.error('[Referrals] my error:', error);
        res.json({ referralCode: '', points: 0, referrals: [], totalBonus: 0 });
    }
});

// POST /api/referrals — Admin cria indicação manual
referralsRouter.post('/', authenticate, async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const referral = await prisma.referral.create({
            data: {
                referrerCustomerId: body.referrer_customer_id,
                referrerCode: body.referrer_code || '',
                referredCustomerId: body.referred_customer_id || null,
                referredName: body.referred_name || '',
                referredPhone: body.referred_phone || '',
                status: (body.status || 'PENDING').toUpperCase(),
                pointsAwarded: body.points_awarded || 0,
                bonusAmount: body.bonus_amount || 0
            }
        });

        res.status(201).json({ success: true, id: referral.id });
    } catch (error) {
        console.error('[Referrals] create error:', error);
        res.status(500).json({ error: 'Erro ao criar indicação' });
    }
});

// PUT /api/referrals/:id — Atualizar indicação
referralsRouter.put('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const data: any = {};
        if (req.body.status) data.status = req.body.status;
        if (req.body.points_awarded !== undefined) data.pointsAwarded = req.body.points_awarded;
        if (req.body.bonus_amount !== undefined) data.bonusAmount = req.body.bonus_amount;
        if (req.body.status === 'APPROVED') data.approvedAt = new Date();

        await prisma.referral.update({
            where: { id: req.params.id as string },
            data
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Referrals] update error:', error);
        res.status(500).json({ error: 'Erro ao atualizar indicação' });
    }
});
