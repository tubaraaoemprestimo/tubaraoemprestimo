import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const isAdminUser = (req: Request) => (req.user?.role || '').toUpperCase() === 'ADMIN';

function esc(value: string): string {
    return value.replace(/'/g, "''");
}

// ============ STATIC ROUTES FIRST (before /:id) ============

// GET /api/notifications/count
notificationsRouter.get('/count', async (req: Request, res: Response) => {
    try {
        const forRole = String(req.query.forRole || '').toUpperCase();
        const email = String(req.query.email || req.user?.email || '');
        const unreadOnly = String(req.query.unread || 'true').toLowerCase() === 'true';

        const clauses: string[] = [];
        if (unreadOnly) clauses.push('is_read = false');

        if (forRole === 'ADMIN' || (isAdminUser(req) && !email)) {
            clauses.push('customer_email IS NULL');
        } else if (email) {
            clauses.push(`customer_email = '${esc(email)}'`);
        }

        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const sql = `SELECT COUNT(*)::int AS count FROM notifications ${where}`;
        const rows: any[] = await prisma.$queryRawUnsafe(sql);
        res.json({ count: rows?.[0]?.count || 0 });
    } catch {
        res.json({ count: 0 });
    }
});

// PUT /api/notifications/read-all  — MUST come before /:id/read
notificationsRouter.put('/read-all', async (req: Request, res: Response) => {
    try {
        // Accept from body OR query params
        const forRole = String(req.body?.forRole || req.query.forRole || '').toUpperCase();
        const email = String(req.body?.email || req.query.email || '');

        let where = '';
        if (forRole === 'ADMIN' || (isAdminUser(req) && !email)) {
            where = 'WHERE customer_email IS NULL';
        } else if (email) {
            where = `WHERE customer_email = '${esc(email)}'`;
        }

        const result: any = await prisma.$executeRawUnsafe(`UPDATE notifications SET is_read = true ${where}`);
        console.log(`[Notifications] Read-all: ${where || 'ALL'}, affected: ${result}`);
        res.json({ success: true });
    } catch (e: any) {
        console.error('[Notifications] read-all error:', e.message);
        res.json({ success: false });
    }
});

// DELETE /api/notifications/clear-all  — MUST come before /:id
notificationsRouter.delete('/clear-all', async (req: Request, res: Response) => {
    try {
        // Accept from query params OR body
        const forRole = String(req.query.forRole || req.body?.forRole || '').toUpperCase();
        const email = String(req.query.email || req.body?.email || '');

        let where = '';
        if (forRole === 'ADMIN' || (isAdminUser(req) && !email)) {
            where = 'WHERE customer_email IS NULL';
        } else if (email) {
            where = `WHERE customer_email = '${esc(email)}'`;
        }

        const result: any = await prisma.$executeRawUnsafe(`DELETE FROM notifications ${where}`);
        console.log(`[Notifications] Clear-all: ${where || 'ALL'}, affected: ${result}`);
        res.json({ success: true });
    } catch (e: any) {
        console.error('[Notifications] clear-all error:', e.message);
        res.json({ success: false });
    }
});

// ============ PARAMETERIZED ROUTES (after static) ============

// GET /api/notifications
notificationsRouter.get('/', async (req: Request, res: Response) => {
    try {
        const forRole = String(req.query.forRole || '').toUpperCase();
        const email = String(req.query.email || req.user?.email || '');
        const limit = Math.min(Number(req.query.limit || 50), 200);
        const unreadOnly = String(req.query.unread || '').toLowerCase() === 'true';

        const clauses: string[] = [];
        if (unreadOnly) clauses.push('is_read = false');

        if (forRole === 'ADMIN' || (isAdminUser(req) && !email)) {
            clauses.push('customer_email IS NULL');
        } else if (email) {
            clauses.push(`customer_email = '${esc(email)}'`);
        }

        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const sql = `SELECT id, title, message, type, is_read, created_at, customer_email, request_id FROM notifications ${where} ORDER BY created_at DESC LIMIT ${Number.isFinite(limit) ? limit : 50}`;
        const rows: any[] = await prisma.$queryRawUnsafe(sql);

        const payload = (rows || []).map((n: any) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            is_read: n.is_read,
            isRead: n.is_read,
            read: n.is_read,
            created_at: n.created_at,
            createdAt: n.created_at,
            customer_email: n.customer_email,
            requestId: n.request_id,
            for_role: n.customer_email ? 'CLIENT' : 'ADMIN'
        }));

        res.json(payload);
    } catch {
        res.json([]);
    }
});

// GET /api/notifications/admin - Notificações específicas para admin
notificationsRouter.get('/admin', requireAdmin, async (req: Request, res: Response) => {
    try {
        const limit = Math.min(Number(req.query.limit || 50), 200);
        // Busca notificações sem customer_email (são as notificações globais de admin)
        const rows: any[] = await prisma.$queryRawUnsafe(
            `SELECT id, title, message, type, is_read, created_at, customer_email, request_id
             FROM notifications
             WHERE customer_email IS NULL
             ORDER BY created_at DESC
             LIMIT ${Number.isFinite(limit) ? limit : 50}`
        );
        const notifications = (rows || []).map((n: any) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            isRead: n.is_read,
            is_read: n.is_read,
            createdAt: n.created_at,
            created_at: n.created_at,
            requestId: n.request_id,
        }));
        res.json(notifications);
    } catch (error) {
        console.error('Erro ao buscar notificações admin:', error);
        res.json([]);
    }
});

// PUT /api/notifications/:id/read
notificationsRouter.put('/:id/read', async (req: Request, res: Response) => {
    try {
        const id = esc(String(req.params.id || ''));
        await prisma.$executeRawUnsafe(`UPDATE notifications SET is_read = true WHERE id = '${id}'`);
        res.json({ success: true });
    } catch {
        res.json({ success: false });
    }
});

// DELETE /api/notifications/:id
notificationsRouter.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = esc(String(req.params.id || ''));
        await prisma.$executeRawUnsafe(`DELETE FROM notifications WHERE id = '${id}'`);
        res.json({ success: true });
    } catch {
        res.json({ success: false });
    }
});

// POST /api/notifications
notificationsRouter.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body || {};
        const id = randomUUID();
        const title = esc(String(body.title || 'Notificacao'));
        const message = esc(String(body.message || ''));
        const type = esc(String(body.type || 'INFO').toUpperCase());
        const isRead = Boolean(body.is_read || body.read || false);
        const email = body.customerEmail || body.customer_email || null;

        const emailSql = email ? `'${esc(String(email))}'` : 'NULL';
        await prisma.$executeRawUnsafe(
            `INSERT INTO notifications (id, title, message, type, is_read, created_at, customer_email) VALUES ('${id}', '${title}', '${message}', '${type}', ${isRead ? 'true' : 'false'}, NOW(), ${emailSql})`
        );

        res.json({ success: true, id });
    } catch {
        res.status(500).json({ error: 'Erro ao criar notificacao' });
    }
});

// ============ COUPONS ============

notificationsRouter.get('/coupons', async (req: Request, res: Response) => {
    try {
        const email = (req.query.email as string) || req.user!.email;
        const coupons = await prisma.coupon.findMany({
            where: {
                OR: [
                    { customerEmail: email },
                    { customerEmail: null }
                ],
                active: true,
                expiresAt: { gte: new Date() },
                usedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(coupons);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar cupons' });
    }
});

notificationsRouter.get('/coupons/all', requireAdmin, async (_req: Request, res: Response) => {
    try {
        const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(coupons);
    } catch {
        res.status(500).json({ error: 'Erro ao buscar cupons' });
    }
});

notificationsRouter.post('/coupons', requireAdmin, async (req: Request, res: Response) => {
    try {
        const data = req.body;
        if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);

        if (data.id) {
            await prisma.coupon.update({ where: { id: data.id }, data });
        } else {
            await prisma.coupon.create({ data });
        }
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao salvar cupom' });
    }
});

notificationsRouter.delete('/coupons/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        await prisma.coupon.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Erro ao deletar cupom' });
    }
});
