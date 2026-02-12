import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';

export const referralsRouter = Router();

const KEY = 'referrals_data';

type ReferralRow = {
    id: string;
    referrer_customer_id: string;
    referrer_name: string;
    referred_name: string;
    referred_cpf: string;
    status: string;
    reward_amount?: number;
    notes?: string | null;
    converted_at?: string | null;
    created_at: string;
};

async function loadReferrals(): Promise<ReferralRow[]> {
    const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (!row?.value) return [];
    try {
        const parsed = JSON.parse(row.value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function saveReferrals(data: ReferralRow[]): Promise<void> {
    await prisma.systemSetting.upsert({
        where: { key: KEY },
        update: { value: JSON.stringify(data) },
        create: { key: KEY, value: JSON.stringify(data) }
    });
}

// GET /api/referrals
referralsRouter.get('/', async (req: Request, res: Response) => {
    try {
        let data = await loadReferrals();

        const referrerId = String(req.query.referrer_customer_id || '').trim();
        const referredCpf = String(req.query.referred_cpf || '').trim();
        const limit = Number(req.query.limit || 0);

        if (referrerId) data = data.filter((r) => r.referrer_customer_id === referrerId);
        if (referredCpf) data = data.filter((r) => r.referred_cpf === referredCpf);
        if (Number.isFinite(limit) && limit > 0) data = data.slice(0, limit);

        res.json(data);
    } catch {
        res.json([]);
    }
});

// POST /api/referrals
referralsRouter.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body || {};
        const data = await loadReferrals();

        const row: ReferralRow = {
            id: body.id || crypto.randomUUID(),
            referrer_customer_id: String(body.referrer_customer_id || ''),
            referrer_name: String(body.referrer_name || ''),
            referred_name: String(body.referred_name || ''),
            referred_cpf: String(body.referred_cpf || ''),
            status: String(body.status || 'PENDING').toUpperCase(),
            reward_amount: Number(body.reward_amount || 50),
            notes: body.notes || null,
            converted_at: body.converted_at || null,
            created_at: body.created_at || new Date().toISOString()
        };

        data.unshift(row);
        await saveReferrals(data);
        res.status(201).json(row);
    } catch {
        res.status(500).json({ error: 'Erro ao criar indicacao' });
    }
});

// PUT /api/referrals/:id
referralsRouter.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id || '');
        const data = await loadReferrals();
        const idx = data.findIndex((r) => r.id === id);

        if (idx < 0) {
            res.status(404).json({ error: 'Indicacao nao encontrada' });
            return;
        }

        data[idx] = {
            ...data[idx],
            ...req.body,
            id: data[idx].id
        };

        await saveReferrals(data);
        res.json(data[idx]);
    } catch {
        res.status(500).json({ error: 'Erro ao atualizar indicacao' });
    }
});
