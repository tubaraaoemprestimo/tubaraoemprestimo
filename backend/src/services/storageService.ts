import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
    }
});

function getExtensionFromMimetype(mimetype: string): string {
    const mimeMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf'
    };
    return mimeMap[mimetype] || '.bin';
}

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();
}

function withExtension(filename: string, mimetype: string): string {
    const safe = sanitizeFilename(filename || 'upload');
    return path.extname(safe) ? safe : `${safe}${getExtensionFromMimetype(mimetype)}`;
}

function hasR2Config(): boolean {
    return Boolean(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        R2_PUBLIC_URL
    );
}

export async function saveBufferToStorage(
    buffer: Buffer,
    mimetype: string,
    folder = 'uploads',
    originalName?: string
): Promise<string> {
    const ext = getExtensionFromMimetype(mimetype);
    const filename = originalName
        ? `${Date.now()}-${uuidv4()}-${withExtension(originalName, mimetype)}`
        : `${Date.now()}-${uuidv4()}${ext}`;

    if (hasR2Config()) {
        const key = `${folder}/${filename}`;
        await r2Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: mimetype,
            CacheControl: 'public, max-age=31536000'
        }));
        return `${R2_PUBLIC_URL}/${key}`;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('Cloudflare R2 não configurado em produção');
    }

    const dateFolder = new Date().toISOString().slice(0, 10);
    const uploadDir = path.join(process.cwd(), 'uploads', dateFolder);
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return `/uploads/${dateFolder}/${filename}`;
}
