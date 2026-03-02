import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { generateInstallmentPixData, saveInstallmentQRCode } from '../services/pix';

export const pixRouter = Router();
pixRouter.use(authenticate);

// POST /api/pix/generate/:installmentId - Gerar QR Code PIX para parcela
pixRouter.post('/generate/:installmentId', async (req: Request, res: Response) => {
    try {
        const installmentId = String(req.params.installmentId);
        const { customerName, customerCity } = req.body;

        // Buscar a parcela
        const installment = await prisma.installment.findUnique({
            where: { id: installmentId },
            include: {
                loan: {
                    include: {
                        customer: true
                    }
                }
            }
        });

        if (!installment) {
            res.status(404).json({ error: 'Parcela não encontrada' });
            return;
        }

        if (installment.status !== 'OPEN') {
            res.status(400).json({ error: 'Parcela não está mais pendente' });
            return;
        }

        // Buscar chave PIX padrão
        const pixSetting = await prisma.systemSetting.findUnique({
            where: { key: 'pix_key' }
        });

        if (!pixSetting || !pixSetting.value) {
            res.status(400).json({ error: 'Chave PIX não configurada nas configurações' });
            return;
        }

        const customer = installment.loan?.customer || { name: 'Cliente', city: 'SAO PAULO' };

        // Gerar QR Code
        const { pixCode, qrCodeBuffer } = await generateInstallmentPixData(
            pixSetting.value,
            Number(installment.amount),
            customer.name,
            customer.city,
            installment.loanId ? parseInt(installment.loan.installmentsCount.toString()) - installment.loan.installmentsCount + 1 : undefined,
            installment.loan?.id
        );

        // Salvar QR Code e código na parcela
        const savedQrCodeUrl = await saveInstallmentQRCode(
            prisma,
            installmentId,
            qrCodeBuffer,
            pixCode
        );

        res.json({
            success: true,
            pixCode,
            qrCodeUrl: savedQrCodeUrl,
            amount: installment.amount,
            dueDate: installment.dueDate
        });
    } catch (error: any) {
        console.error('[Pix] Erro ao gerar PIX:', error);
        res.status(500).json({ error: 'Erro ao gerar QR Code PIX' });
    }
});

// GET /api/pix/key - Obter chave PIX pública
pixRouter.get('/key', authenticate, async (_req: Request, res: Response) => {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'pix_key' }
        });

        if (!setting) {
            res.status(404).json({ error: 'Chave PIX não configurada' });
            return;
        }

        res.json({ key: setting.value });
    } catch {
        res.status(500).json({ error: 'Erro ao buscar chave PIX' });
    }
});

// PUT /api/pix/key - Configurar chave PIX (admin)
pixRouter.put('/key', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { key, type } = req.body;

        await prisma.systemSetting.upsert({
            where: { key: 'pix_key' },
            update: {
                value: key,
                key: 'pix_key'
            },
            create: {
                key: 'pix_key',
                value: key
            }
        });

        // Se especificado, salva o tipo também
        if (type) {
            await prisma.systemSetting.upsert({
                where: { key: 'pix_key_type' },
                update: { value: type, key: 'pix_key_type' },
                create: { key: 'pix_key_type', value: type }
            });
        }

        res.json({ success: true });
    } catch {
        res.status(500). json({ error: 'Erro ao configurar chave PIX' });
    }
});
