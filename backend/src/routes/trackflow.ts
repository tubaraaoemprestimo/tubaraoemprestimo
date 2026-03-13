import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const TRACKFLOW_TOKEN = '46e3cab6883b9755ce85aed22086f74b182c38415e47f6bd18b28f788f2f914f';
const TRACKFLOW_BASE_URL = 'https://apis.trackflow.services/api';

interface TrackFlowQueryRequest {
    apiType: 'cpf' | 'cnpj' | 'contatos' | 'nome-endereco' | 'historico-veicular';
    queryParams: any;
}

// Consultar API TrackFlow e salvar histórico
router.post('/query', authenticate, async (req: Request, res: Response) => {
    try {
        const { apiType, queryParams } = req.body as TrackFlowQueryRequest;
        const userId = (req as any).user.id;

        console.log('[TrackFlow] Nova consulta:', { apiType, queryParams, userId });

        // Verificar se já existe consulta idêntica nas últimas 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingQuery = await prisma.trackFlowQuery.findFirst({
            where: {
                userId,
                apiType,
                queryParams: queryParams,
                createdAt: { gte: oneDayAgo },
                success: true
            },
            orderBy: { createdAt: 'desc' }
        });

        if (existingQuery && existingQuery.response) {
            console.log('[TrackFlow] Retornando consulta em cache (últimas 24h)');
            return res.json({
                success: true,
                cached: true,
                data: existingQuery.response,
                cachedAt: existingQuery.createdAt
            });
        }

        // Montar URL e parâmetros
        let url = '';
        const params: any = { token: TRACKFLOW_TOKEN, ...queryParams };

        switch (apiType) {
            case 'cpf':
                url = `${TRACKFLOW_BASE_URL}/cpf`;
                break;
            case 'cnpj':
                url = `${TRACKFLOW_BASE_URL}/cnpj`;
                break;
            case 'contatos':
                url = `${TRACKFLOW_BASE_URL}/contatos`;
                break;
            case 'nome-endereco':
                url = `${TRACKFLOW_BASE_URL}/nome-endereco`;
                break;
            case 'historico-veicular':
                url = `${TRACKFLOW_BASE_URL}/historico-veicular`;
                break;
            default:
                return res.status(400).json({ error: 'Tipo de API inválido' });
        }

        console.log('[TrackFlow] Chamando API:', url, params);

        // Chamar API TrackFlow
        const response = await axios.get(url, { params, timeout: 30000 });

        console.log('[TrackFlow] Resposta da API:', {
            status: response.status,
            success: response.data?.success,
            hasData: !!response.data?.data
        });

        // Salvar no banco
        const savedQuery = await prisma.trackFlowQuery.create({
            data: {
                userId,
                apiType,
                queryParams,
                response: response.data,
                success: response.data?.success || false,
                errorMsg: response.data?.error || null
            }
        });

        console.log('[TrackFlow] Consulta salva no banco:', savedQuery.id);

        return res.json({
            success: true,
            cached: false,
            data: response.data,
            queryId: savedQuery.id
        });

    } catch (error: any) {
        console.error('[TrackFlow] Erro na consulta:', error.response?.data || error.message);

        // Salvar erro no banco
        try {
            const userId = (req as any).user.id;
            const { apiType, queryParams } = req.body;

            await prisma.trackFlowQuery.create({
                data: {
                    userId,
                    apiType,
                    queryParams,
                    response: null,
                    success: false,
                    errorMsg: error.response?.data?.error || error.message
                }
            });
        } catch (dbError) {
            console.error('[TrackFlow] Erro ao salvar no banco:', dbError);
        }

        return res.status(500).json({
            success: false,
            error: error.response?.data?.error || 'Erro ao consultar API TrackFlow'
        });
    }
});

// Listar histórico de consultas
router.get('/history', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { apiType, limit = 50 } = req.query;

        const where: any = { userId };
        if (apiType) {
            where.apiType = apiType;
        }

        const queries = await prisma.trackFlowQuery.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });

        return res.json({ success: true, queries });
    } catch (error: any) {
        console.error('[TrackFlow] Erro ao buscar histórico:', error);
        return res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// Buscar consulta específica
router.get('/query/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const id = String(req.params.id);

        const query = await prisma.trackFlowQuery.findFirst({
            where: { id, userId }
        });

        if (!query) {
            return res.status(404).json({ error: 'Consulta não encontrada' });
        }

        return res.json({ success: true, query });
    } catch (error: any) {
        console.error('[TrackFlow] Erro ao buscar consulta:', error);
        return res.status(500).json({ error: 'Erro ao buscar consulta' });
    }
});

export default router;
