import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';

export const uploadRouter = Router();
uploadRouter.use(authenticate);

// Configuração do Multer
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        // Cria subpastas por data
        const dateDir = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const fullPath = path.join(uploadDir, dateDir);
        fs.mkdirSync(fullPath, { recursive: true });
        cb(null, fullPath);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${uuidv4()}${ext}`;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600') // 100MB (vídeos podem ser grandes)
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
uploadRouter.post('/', upload.single('file'), (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
        const relativePath = req.file.path.replace(/\\/g, '/');
        const url = `${apiUrl}/${relativePath}`;

        res.json({
            success: true,
            url,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao fazer upload' });
    }
});

// POST /api/upload/multiple — Upload múltiplo
uploadRouter.post('/multiple', upload.array('files', 10), (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
        const urls = files.map(f => {
            const relativePath = f.path.replace(/\\/g, '/');
            return `${apiUrl}/${relativePath}`;
        });

        res.json({ success: true, urls });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao fazer upload' });
    }
});

// POST /api/upload/base64 — Upload de imagem base64
uploadRouter.post('/base64', async (req: Request, res: Response) => {
    try {
        const { base64, filename } = req.body;

        if (!base64) {
            res.status(400).json({ error: 'Base64 é obrigatório' });
            return;
        }

        // Remove header do base64
        const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Detecta extensão
        let ext = '.png';
        if (base64.includes('image/jpeg')) ext = '.jpg';
        else if (base64.includes('image/gif')) ext = '.gif';
        else if (base64.includes('image/webp')) ext = '.webp';

        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const dateDir = new Date().toISOString().split('T')[0];
        const fullDir = path.join(uploadDir, dateDir);
        fs.mkdirSync(fullDir, { recursive: true });

        const fname = filename || `${uuidv4()}${ext}`;
        const filePath = path.join(fullDir, fname);

        fs.writeFileSync(filePath, buffer);

        const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
        const url = `${apiUrl}/${filePath.replace(/\\/g, '/')}`;

        res.json({ success: true, url });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao fazer upload base64' });
    }
});
