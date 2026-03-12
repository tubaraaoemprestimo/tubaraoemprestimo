import { Router, Request, Response } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import axios from 'axios';

export const cpfLookupRouter = Router();

// ============ Helpers ============

/**
 * Valida formato do CPF (11 dígitos + dígitos verificadores)
 */
function isValidCPF(cpf: string): boolean {
    const cleaned = cpf.replace(/\D/g, '');

    if (cleaned.length !== 11) return false;

    // Rejeita sequências conhecidas (ex: 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cleaned[9])) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleaned[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cleaned[10])) return false;

    return true;
}

/**
 * Formata CPF para exibição: 000.000.000-00
 */
function formatCPF(cpf: string): string {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// ============ Rate Limiting simples (in-memory) ============

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // máx requests por janela
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
}

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetAt) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000);

// ============ ROUTES ============

// POST /api/cpf/lookup - Validar e consultar CPF
cpfLookupRouter.post('/lookup', authenticate, async (req: Request, res: Response) => {
    try {
        const { cpf } = req.body;

        if (!cpf) {
            res.status(400).json({ error: 'CPF é obrigatório' });
            return;
        }

        const cleanedCPF = cpf.replace(/\D/g, '');

        // Validação local do CPF
        if (!isValidCPF(cleanedCPF)) {
            res.json({
                valid: false,
                cpf: formatCPF(cleanedCPF),
                message: 'CPF inválido (dígitos verificadores incorretos)'
            });
            return;
        }

        // Rate limiting por IP
        const rateLimitKey = req.ip || req.user!.id;
        if (!checkRateLimit(rateLimitKey)) {
            res.status(429).json({ error: 'Muitas requisições. Aguarde 1 minuto.' });
            return;
        }

        // Verifica se CPF está na blacklist interna
        const blacklisted = await prisma.blacklist.findFirst({
            where: { cpf: cleanedCPF, active: true }
        });

        if (blacklisted) {
            res.json({
                valid: true,
                cpf: formatCPF(cleanedCPF),
                blacklisted: true,
                blacklistReason: blacklisted.reason,
                message: 'CPF encontrado na blacklist'
            });
            return;
        }

        // Verifica se CPF já está cadastrado como cliente
        const existingCustomer = await prisma.customer.findFirst({
            where: { cpf: cleanedCPF },
            select: { id: true, name: true, status: true }
        });

        // Consulta API externa (RapidAPI) se configurada
        let externalData: any = null;
        const cpfApiUrl = process.env.CPF_API_URL;
        const cpfApiToken = process.env.CPF_API_TOKEN;

        if (cpfApiUrl && cpfApiToken) {
            try {
                const response = await axios.post(cpfApiUrl, {
                    cpf: cleanedCPF
                }, {
                    headers: {
                        'Authorization': `Bearer ${cpfApiToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                });

                externalData = response.data;
            } catch (apiError: any) {
                console.error('[CPF] Erro na API externa:', apiError.message);
                // Não falha o request — retorna o que temos internamente
                externalData = { error: 'API externa indisponível' };
            }
        }

        res.json({
            valid: true,
            cpf: formatCPF(cleanedCPF),
            blacklisted: false,
            existingCustomer: existingCustomer ? {
                id: existingCustomer.id,
                name: existingCustomer.name,
                status: existingCustomer.status
            } : null,
            externalData,
            message: 'CPF válido'
        });
    } catch (error: any) {
        console.error('[CPF] Erro na consulta:', error);
        res.status(500).json({ error: 'Erro ao consultar CPF' });
    }
});

// POST /api/cpf/validate - Validação rápida (apenas dígitos, sem API externa)
cpfLookupRouter.post('/validate', authenticate, async (req: Request, res: Response) => {
    try {
        const { cpf } = req.body;

        if (!cpf) {
            res.status(400).json({ error: 'CPF é obrigatório' });
            return;
        }

        const cleanedCPF = cpf.replace(/\D/g, '');
        const valid = isValidCPF(cleanedCPF);

        res.json({
            valid,
            cpf: formatCPF(cleanedCPF),
            message: valid ? 'CPF válido' : 'CPF inválido'
        });
    } catch {
        res.status(500).json({ error: 'Erro ao validar CPF' });
    }
});

// GET /api/cpf/check/:cpf - Verificação rápida por GET (admin only)
cpfLookupRouter.get('/check/:cpf', authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
        const cleanedCPF = (req.params.cpf as string).replace(/\D/g, '');

        if (!isValidCPF(cleanedCPF)) {
            res.json({ valid: false, message: 'CPF inválido' });
            return;
        }

        // Busca informações internas
        const [customer, blacklist, loanRequests] = await Promise.all([
            prisma.customer.findFirst({
                where: { cpf: cleanedCPF },
                select: { id: true, name: true, status: true, internalScore: true, totalDebt: true, activeLoansCount: true }
            }),
            prisma.blacklist.findFirst({
                where: { cpf: cleanedCPF, active: true }
            }),
            prisma.loanRequest.findMany({
                where: { cpf: cleanedCPF },
                select: { id: true, status: true, amount: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 5
            })
        ]);

        res.json({
            valid: true,
            cpf: formatCPF(cleanedCPF),
            customer: customer || null,
            blacklisted: !!blacklist,
            blacklistReason: blacklist?.reason || null,
            recentRequests: loanRequests,
            summary: {
                isCustomer: !!customer,
                isBlacklisted: !!blacklist,
                hasActiveLoans: (customer?.activeLoansCount || 0) > 0,
                totalDebt: customer?.totalDebt || 0,
                requestCount: loanRequests.length
            }
        });
    } catch {
        res.status(500).json({ error: 'Erro ao verificar CPF' });
    }
});

// GET /api/cpf/trackflow/:cpf - Consulta completa TrackFlow (Admin only)
cpfLookupRouter.get('/trackflow/:cpf', requireAdmin, async (req, res) => {
    try {
        const cpf = String(req.params.cpf);

        // Validar formato
        if (!isValidCPF(cpf)) {
            return res.status(400).json({
                success: false,
                error: 'CPF inválido'
            });
        }

        // Higienizar CPF
        const cpfLimpo = cpf.replace(/\D/g, '');

        // Chamar API TrackFlow
        const trackflowToken = process.env.TRACKFLOW_API_TOKEN;
        if (!trackflowToken) {
            return res.status(500).json({
                success: false,
                error: 'Token TrackFlow não configurado'
            });
        }

        const trackflowUrl = `https://apis.trackflow.services/api/cpf?cpf=${cpfLimpo}&token=${trackflowToken}`;

        const response = await axios.get(trackflowUrl, {
            timeout: 30000 // 30 segundos
        });

        // Retornar dados
        return res.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        console.error('Erro ao consultar TrackFlow:', error.message);

        // Tratar erros específicos
        if (error.response) {
            const status = error.response.status;
            if (status === 401) {
                return res.status(401).json({ success: false, error: 'Token TrackFlow inválido' });
            }
            if (status === 402) {
                return res.status(402).json({ success: false, error: 'Saldo insuficiente na wallet TrackFlow' });
            }
            if (status === 403) {
                return res.status(403).json({ success: false, error: 'Plano TrackFlow inativo' });
            }
            if (status === 429) {
                return res.status(429).json({ success: false, error: 'Limite de requisições excedido' });
            }
        }

        return res.status(500).json({
            success: false,
            error: 'Erro ao consultar CPF na TrackFlow'
        });
    }
});

export default cpfLookupRouter;
