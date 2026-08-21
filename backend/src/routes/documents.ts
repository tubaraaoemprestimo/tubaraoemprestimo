import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/documents
 * Lista todos os documentos do cliente autenticado
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Buscar customer_id do usuário
        const customer = await prisma.customer.findFirst({
            where: { userId }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Buscar documentos do cliente
        const documents = await prisma.$queryRaw<Array<{
            id: string;
            type: string;
            loan_id: string | null;
            installment_id: string | null;
            customer_id: string;
            title: string;
            amount: number | null;
            metadata: any;
            created_at: Date;
            created_by: string;
        }>>`
            SELECT
                id, type, loan_id, installment_id, customer_id,
                title, amount, metadata, created_at, created_by
            FROM generated_documents
            WHERE customer_id = ${customer.id}
            ORDER BY created_at DESC
        `;

        res.json(documents);
    } catch (error: any) {
        console.error('[documents] Erro ao listar documentos:', error);
        res.status(500).json({ error: 'Erro ao listar documentos' });
    }
});

/**
 * GET /api/documents/:id
 * Retorna documento específico com HTML completo
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Buscar customer_id do usuário
        const customer = await prisma.customer.findFirst({
            where: { userId }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Buscar documento específico
        const documents = await prisma.$queryRaw<Array<{
            id: string;
            type: string;
            loan_id: string | null;
            installment_id: string | null;
            customer_id: string;
            title: string;
            html_content: string;
            amount: number | null;
            metadata: any;
            created_at: Date;
            created_by: string;
        }>>`
            SELECT *
            FROM generated_documents
            WHERE id = ${id} AND customer_id = ${customer.id}
        `;

        if (documents.length === 0) {
            return res.status(404).json({ error: 'Documento não encontrado' });
        }

        res.json(documents[0]);
    } catch (error: any) {
        console.error('[documents] Erro ao buscar documento:', error);
        res.status(500).json({ error: 'Erro ao buscar documento' });
    }
});

export default router;
