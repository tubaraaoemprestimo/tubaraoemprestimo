// InfoSeek API Proxy
// Resolve CORS da API InfoSeek

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const INFOSEEK_API_KEY = 'sk_prod_2de8b4cfd0dd8d3c6f575750759b9160bf13dc4806bc85d8a697421dd0e2d4ec';
const INFOSEEK_BASE_URL = 'https://api.infoseekdata.com.br/api';

// POST /api/infoseek - Proxy para InfoSeek API
router.post('/infoseek', async (req: Request, res: Response) => {
    try {
        const { type, value } = req.body;

        // Validar parâmetros
        if (!type || !value) {
            return res.status(400).json({
                success: false,
                error: 'Parâmetros inválidos. Envie { type: "cpf" ou "cnpj", value: "..." }'
            });
        }

        // Validar tipo
        if (type !== 'cpf' && type !== 'cnpj') {
            return res.status(400).json({
                success: false,
                error: 'Tipo deve ser "cpf" ou "cnpj"'
            });
        }

        console.log(`[InfoSeek Proxy] Validando ${type.toUpperCase()}:`, value);

        // Chamar API InfoSeek
        const endpoint = `${INFOSEEK_BASE_URL}/validate/${type}`;
        const response = await axios.post(endpoint,
            { value },
            {
                headers: {
                    'Authorization': `Bearer ${INFOSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 segundos
            }
        );

        console.log(`[InfoSeek Proxy] Resposta ${type.toUpperCase()}:`, response.data);

        // Retornar resposta da InfoSeek
        return res.json(response.data);

    } catch (error: any) {
        console.error('[InfoSeek Proxy] Erro:', error.message);

        if (error.response) {
            // Erro da API InfoSeek
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data?.message || error.message
            });
        }

        // Erro de conexão
        return res.status(500).json({
            success: false,
            error: 'Erro ao conectar com a API InfoSeek'
        });
    }
});

export default router;
