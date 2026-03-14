import { Router, Request, Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';

export const uploadRouter = Router();
uploadRouter.use(authenticate);

// Configuração do Cloudflare R2
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
    }
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Configuração do Multer para memória (não salva em disco)
const storage = multer.memoryStorage();

const upload = multer({
    storage,
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

/**
 * Função auxiliar para fazer upload no Cloudflare R2
 * @param buffer - Buffer do arquivo
 * @param mimetype - MIME type do arquivo
 * @param folder - Pasta no bucket (ex: 'solicitacoes/user-id')
 * @param originalName - Nome original do arquivo (opcional)
 * @returns URL pública do arquivo no R2
 */
async function uploadToR2(
    buffer: Buffer,
    mimetype: string,
    folder: string = 'uploads',
    originalName?: string
): Promise<string> {
    try {
        // Gerar nome único do arquivo
        const ext = getExtensionFromMimetype(mimetype);
        const timestamp = Date.now();
        const uuid = uuidv4();
        const filename = originalName
            ? `${timestamp}-${uuid}-${sanitizeFilename(originalName)}`
            : `${timestamp}-${uuid}${ext}`;

        // Key completa no bucket (com pasta)
        const key = `${folder}/${filename}`;

        // Upload para o R2
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: mimetype,
            CacheControl: 'public, max-age=31536000' // Cache de 1 ano
        });

        await r2Client.send(command);

        // Construir URL pública final
        const publicUrl = `${R2_PUBLIC_URL}/${key}`;

        console.log(`[Upload] ✅ Arquivo enviado para R2: ${publicUrl}`);
        return publicUrl;

    } catch (error: any) {
        console.error('[Upload] ❌ Erro ao enviar para R2:', error);
        throw new Error(`Falha no upload para R2: ${error.message}`);
    }
}

/**
 * Obter extensão do arquivo baseado no MIME type
 */
function getExtensionFromMimetype(mimetype: string): string {
    const mimeMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'application/pdf': '.pdf'
    };
    return mimeMap[mimetype] || '.bin';
}

/**
 * Sanitizar nome do arquivo (remover caracteres especiais)
 */
function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();
}

// POST /api/upload — Upload de arquivo único
uploadRouter.post('/', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        // Validar configuração do R2
        if (!R2_PUBLIC_URL || !process.env.R2_ACCESS_KEY_ID) {
            console.error('[Upload] ❌ Cloudflare R2 não configurado');
            res.status(500).json({ error: 'Serviço de upload não configurado' });
            return;
        }

        // Determinar pasta baseado no usuário
        const userId = req.user?.id || 'anonymous';
        const folder = `solicitacoes/${userId}`;

        // Upload para o R2
        const publicUrl = await uploadToR2(
            req.file.buffer,
            req.file.mimetype,
            folder,
            req.file.originalname
        );

        res.json({
            success: true,
            url: publicUrl,
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

        // Validar configuração do R2
        if (!R2_PUBLIC_URL || !process.env.R2_ACCESS_KEY_ID) {
            console.error('[Upload] ❌ Cloudflare R2 não configurado');
            res.status(500).json({ error: 'Serviço de upload não configurado' });
            return;
        }

        const userId = req.user?.id || 'anonymous';
        const folder = `solicitacoes/${userId}`;

        // Upload de todos os arquivos em paralelo
        const uploadPromises = files.map(file =>
            uploadToR2(file.buffer, file.mimetype, folder, file.originalname)
        );

        const urls = await Promise.all(uploadPromises);

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

        // Validar configuração do R2
        if (!R2_PUBLIC_URL || !process.env.R2_ACCESS_KEY_ID) {
            console.error('[Upload] ❌ Cloudflare R2 não configurado');
            res.status(500).json({ error: 'Serviço de upload não configurado' });
            return;
        }

        // Extrair MIME type do base64
        const mimeMatch = base64.match(/^data:([^;]+);base64,/);
        const mimetype = mimeMatch ? mimeMatch[1] : 'image/png';

        // Remove header do base64
        const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Determinar pasta
        const userId = req.user?.id || 'anonymous';
        const uploadFolder = folder || `solicitacoes/${userId}`;

        // Upload para o R2
        const publicUrl = await uploadToR2(
            buffer,
            mimetype,
            uploadFolder,
            filename
        );

        res.json({
            success: true,
            url: publicUrl
        });

    } catch (error: any) {
        console.error('[Upload] Erro base64:', error);
        res.status(500).json({
            error: 'Erro ao fazer upload base64',
            details: error.message
        });
    }
});
