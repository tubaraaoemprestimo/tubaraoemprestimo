/**
 * NotificationHub — Central de Notificações 360°
 *
 * Dispara Email + WhatsApp + Push + InApp de forma isolada.
 * Falha em um canal NÃO bloqueia os demais.
 *
 * Uso:
 *   await notificationHub.notify({ ... });
 */

import { prisma } from './prisma';
import { emailService } from './email';
import { sendWhatsAppMessage } from './whatsapp';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface NotifyPayload {
    // Destino
    userId?: string | null;          // User.id (para push subscriptions)
    customerId?: string | null;      // Customer.id (para InApp)
    email?: string | null;
    phone?: string | null;
    role?: 'ADMIN' | 'CLIENT';       // Disparo por papel (admin push broadcast)

    // Conteúdo
    title: string;
    message: string;                 // Texto curto (InApp, Push, WA)
    emailHtml?: string | null;       // HTML rico para email (se omitido usa message)
    emailSubject?: string | null;    // Subject do email (se omitido usa title)
    waMessage?: string | null;       // Texto WA customizado (se omitido usa message)

    // InApp
    type?: string;                   // Tipo da notificação no banco
    requestId?: string | null;       // Link para solicitação específica

    // Canais (default: todos habilitados)
    channels?: {
        email?: boolean;
        whatsapp?: boolean;
        push?: boolean;
        inApp?: boolean;
    };
}

export interface NotifyResult {
    email: boolean | null;
    whatsapp: boolean | null;
    push: boolean | null;
    inApp: boolean | null;
}

// ─── Importação lazy do push (evita circular deps) ───────────────────────────

async function getPushFns() {
    const mod = await import('../routes/push');
    return {
        sendPushToUser: (mod as any).sendPushToUser as (userId: string, title: string, body: string, data?: Record<string, any>) => Promise<number>,
        sendPushToRole: (mod as any).sendPushToRole as (role: string, title: string, body: string, data?: Record<string, any>) => Promise<number>,
    };
}

// ─── Hub principal ────────────────────────────────────────────────────────────

export const notificationHub = {
    /**
     * Dispara notificação em todos os canais configurados.
     * Cada canal é isolado — falha não afeta os demais.
     */
    async notify(payload: NotifyPayload): Promise<NotifyResult> {
        const ch = payload.channels ?? {};
        const emailEnabled  = ch.email    !== false;
        const waEnabled     = ch.whatsapp !== false;
        const pushEnabled   = ch.push     !== false;
        const inAppEnabled  = ch.inApp    !== false;

        const result: NotifyResult = { email: null, whatsapp: null, push: null, inApp: null };

        // ── 1. EMAIL ─────────────────────────────────────────────────────────
        if (emailEnabled && payload.email) {
            try {
                const subject = payload.emailSubject || payload.title;
                const html = payload.emailHtml || `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:30px;border-radius:12px;">
                        <h1 style="color:#D4AF37;">🦈 Tubarão Empréstimos</h1>
                        <h2>${payload.title}</h2>
                        <p style="color:#ccc;font-size:16px;">${payload.message}</p>
                        <hr style="border-color:#333;margin:20px 0;"/>
                        <p style="color:#666;font-size:12px;text-align:center;">Tubarão Empréstimos — Plataforma de Crédito Premium</p>
                    </div>`;
                result.email = await emailService.send(payload.email, subject, html);
                console.log(`[Hub] Email → ${payload.email}: ${result.email ? '✅' : '❌'}`);
            } catch (err: any) {
                console.error(`[Hub] Email ERRO → ${payload.email}:`, err?.message);
                result.email = false;
            }
        }

        // ── 2. WHATSAPP ──────────────────────────────────────────────────────
        if (waEnabled && payload.phone) {
            try {
                const text = payload.waMessage || payload.message;
                result.whatsapp = await sendWhatsAppMessage(payload.phone, text);
                console.log(`[Hub] WhatsApp → ${payload.phone}: ${result.whatsapp ? '✅' : '❌'}`);
            } catch (err: any) {
                console.error(`[Hub] WhatsApp ERRO → ${payload.phone}:`, err?.message);
                result.whatsapp = false;
            }
        }

        // ── 3. PUSH ──────────────────────────────────────────────────────────
        if (pushEnabled) {
            try {
                const { sendPushToUser, sendPushToRole } = await getPushFns();
                const data = payload.requestId ? { requestId: payload.requestId } : undefined;

                if (payload.userId) {
                    const sent = await sendPushToUser(payload.userId, payload.title, payload.message, data);
                    result.push = sent > 0;
                    console.log(`[Hub] Push → user ${payload.userId}: ${sent} dispositivos`);
                } else if (payload.role) {
                    const sent = await sendPushToRole(payload.role, payload.title, payload.message, data);
                    result.push = sent > 0;
                    console.log(`[Hub] Push → role ${payload.role}: ${sent} dispositivos`);
                }
            } catch (err: any) {
                console.error('[Hub] Push ERRO:', err?.message);
                result.push = false;
            }
        }

        // ── 4. IN-APP (banco) ────────────────────────────────────────────────
        if (inAppEnabled) {
            try {
                await prisma.notification.create({
                    data: {
                        customerId:    payload.customerId    || null,
                        customerEmail: payload.email        || null,
                        title:         payload.title,
                        message:       payload.message,
                        type:          payload.type         || 'INFO',
                        requestId:     payload.requestId    || null,
                        isRead:        false,
                    }
                });
                result.inApp = true;
                console.log(`[Hub] InApp → criado: "${payload.title}"`);
            } catch (err: any) {
                console.error('[Hub] InApp ERRO:', err?.message);
                result.inApp = false;
            }
        }

        return result;
    },

    /**
     * Notifica TODOS os admins via InApp + Push.
     * Útil para eventos onde o admin deve agir (cliente enviou doc, aceitou contraproposta, etc.)
     */
    async notifyAdmins(opts: {
        title: string;
        message: string;
        type?: string;
        requestId?: string | null;
        emailToAdmin?: string | null;
        waToAdmin?: string | null;
    }): Promise<void> {
        try {
            // InApp para cada admin (usa customerId = admin.id conforme padrão do sistema)
            const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        customerId:    admin.id,
                        customerEmail: admin.email || null,
                        title:         opts.title,
                        message:       opts.message,
                        type:          opts.type || 'INFO',
                        requestId:     opts.requestId || null,
                        isRead:        false,
                    }
                }).catch((e: any) => console.error('[Hub] Admin InApp ERRO:', e?.message));
            }

            // Push broadcast para role ADMIN
            try {
                const { sendPushToRole } = await getPushFns();
                const data = opts.requestId ? { requestId: opts.requestId } : undefined;
                await sendPushToRole('ADMIN', opts.title, opts.message, data);
            } catch (err: any) {
                console.error('[Hub] Admin Push ERRO:', err?.message);
            }

            // Email opcional para admin
            if (opts.emailToAdmin) {
                emailService.send(opts.emailToAdmin, opts.title, `<p>${opts.message}</p>`).catch((e: any) => {
                    console.error('[Hub] Admin Email ERRO:', e?.message);
                });
            }

            // WhatsApp opcional para admin
            if (opts.waToAdmin) {
                sendWhatsAppMessage(opts.waToAdmin, `*${opts.title}*\n\n${opts.message}`).catch((e: any) => {
                    console.error('[Hub] Admin WhatsApp ERRO:', e?.message);
                });
            }
        } catch (err: any) {
            console.error('[Hub] notifyAdmins ERRO:', err?.message);
        }
    }
};
