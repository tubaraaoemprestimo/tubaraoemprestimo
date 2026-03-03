import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/funil/track
// Registra eventos do funil: STEP_VIEW, CLICK_YES, CLICK_NO,
// VIDEO_PLAY, VIDEO_COMPLETE.
// Fire-and-forget pelo cliente — responde rápido.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/track', async (req: Request, res: Response) => {
    try {
        const { sessionId, step, eventType, metadata } = req.body;

        if (!sessionId || !step || !eventType) {
            return res.status(400).json({ error: 'sessionId, step e eventType são obrigatórios' });
        }

        const ip        = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                        ?? req.headers['x-real-ip'] as string
                        ?? req.socket.remoteAddress
                        ?? '';
        const userAgent = req.headers['user-agent'] ?? '';
        const referer   = req.headers['referer'] ?? '';

        // Extrai UTMs do referer
        let utmSource = '', utmMedium = '', utmCampaign = '', utmContent = '', utmTerm = '';
        try {
            const url = new URL(referer);
            utmSource   = url.searchParams.get('utm_source')   ?? '';
            utmMedium   = url.searchParams.get('utm_medium')   ?? '';
            utmCampaign = url.searchParams.get('utm_campaign') ?? '';
            utmContent  = url.searchParams.get('utm_content')  ?? '';
            utmTerm     = url.searchParams.get('utm_term')     ?? '';
        } catch { /* referer inválido */ }

        const lead = await prisma.funnelLead.upsert({
            where:  { sessionId },
            create: {
                sessionId,
                currentStep: step,
                utmSource:   utmSource   || null,
                utmMedium:   utmMedium   || null,
                utmCampaign: utmCampaign || null,
                utmContent:  utmContent  || null,
                utmTerm:     utmTerm     || null,
                ipAddress:   ip          || null,
                userAgent:   userAgent   || null,
            },
            update: { currentStep: step },
        });

        const event = await prisma.funnelEvent.create({
            data: {
                leadId:    lead.id,
                sessionId,
                step,
                eventType,
                metadata:  metadata ?? undefined,
            },
        });

        return res.status(201).json({ leadId: lead.id, eventId: event.id });
    } catch (err) {
        console.error('[funil/track]', err);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/funil/purchase
// Registra uma compra/clique em "Sim, quero!" antes do redirect ao gateway.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/purchase', async (req: Request, res: Response) => {
    try {
        const { sessionId, step, productName, amount, gatewayRef } = req.body;

        if (!sessionId || !step || !productName || amount === undefined) {
            return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
        }

        const lead = await prisma.funnelLead.upsert({
            where:  { sessionId },
            create: { sessionId, currentStep: step },
            update: { currentStep: step },
        });

        const purchase = await prisma.funnelPurchase.create({
            data: {
                leadId:      lead.id,
                sessionId,
                step,
                productName,
                amount,
                gatewayRef:  gatewayRef ?? null,
            },
        });

        await prisma.funnelEvent.create({
            data: {
                leadId:    lead.id,
                sessionId,
                step,
                eventType: 'CLICK_YES',
                metadata:  { productName, amount },
            },
        });

        return res.status(201).json({ purchaseId: purchase.id });
    } catch (err) {
        console.error('[funil/purchase]', err);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/funil/analytics  (admin — sem auth por ora, proteger depois)
// Retorna sumário de leads, conversões e receita do funil.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics', async (_req: Request, res: Response) => {
    try {
        const [totalLeads, totalPurchases, revenueAgg, byStep] = await Promise.all([
            prisma.funnelLead.count(),
            prisma.funnelPurchase.count(),
            prisma.funnelPurchase.aggregate({ _sum: { amount: true } }),
            prisma.funnelEvent.groupBy({
                by:     ['step', 'eventType'],
                _count: { id: true },
                orderBy: [{ step: 'asc' }],
            }),
        ]);

        return res.json({
            totalLeads,
            totalPurchases,
            totalRevenue: revenueAgg._sum.amount ?? 0,
            byStep,
        });
    } catch (err) {
        console.error('[funil/analytics]', err);
        return res.status(500).json({ error: 'Erro interno' });
    }
});

export const funilRouter = router;
