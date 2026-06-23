import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { saveBufferToStorage } from '../services/storageService';

export const uploadRouter = Router();
uploadRouter.use(authenticate);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600') // 100MB
    },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/quicktime',
            'application/pdf'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido'));
        }
    }
});

// POST /api/upload — Upload de arquivo único
uploadRouter.post('/', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        const userId = req.user?.id || 'anonymous';
        const url = await saveBufferToStorage(
            req.file.buffer,
            req.file.mimetype,
            `solicitacoes/${userId}`,
            req.file.originalname
        );

        res.json({
            success: true,
            url,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

    } catch (error: any) {
        console.error('[Upload] Erro:', error);
        res.status(500).json({
            error: 'Erro ao fazer upload',
            details: error.message
        });
    }
});

// POST /api/upload/multiple — Upload múltiplo
uploadRouter.post('/multiple', upload.array('files', 10), async (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        const userId = req.user?.id || 'anonymous';
        const urls = await Promise.all(files.map(file =>
            saveBufferToStorage(file.buffer, file.mimetype, `solicitacoes/${userId}`, file.originalname)
        ));

        res.json({
            success: true,
            urls,
            count: urls.length
        });

    } catch (error: any) {
        console.error('[Upload] Erro múltiplo:', error);
        res.status(500).json({
            error: 'Erro ao fazer upload múltiplo',
            details: error.message
        });
    }
});

// POST /api/upload/base64 — Upload de imagem base64
uploadRouter.post('/base64', async (req: Request, res: Response) => {
    try {
        const { base64, filename, folder } = req.body;

        if (!base64) {
            res.status(400).json({ error: 'Base64 é obrigatório' });
            return;
        }

        const mimeMatch = base64.match(/^data:([^;]+);base64,/);
        const mimetype = mimeMatch ? mimeMatch[1] : 'image/png';
        const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const userId = req.user?.id || 'anonymous';
        const uploadFolder = folder || `solicitacoes/${userId}`;
        const url = await saveBufferToStorage(buffer, mimetype, uploadFolder, filename);

        res.json({ success: true, url });

    } catch (error: any) {
        console.error('[Upload] Erro base64:', error);
        res.status(500).json({
            error: 'Erro ao fazer upload base64',
            details: error.message
        });
    }
});
