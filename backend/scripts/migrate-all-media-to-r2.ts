import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime'
    };
    return mimeMap[ext] || 'application/octet-stream';
}

async function uploadFileToR2(filePath: string, folder: string): Promise<string> {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const timestamp = Date.now();
        const uuid = uuidv4();
        const key = `${folder}/${timestamp}-${uuid}-${fileName}`;
        const mimeType = getMimeType(filePath);

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
            CacheControl: 'public, max-age=31536000'
        });

        await r2Client.send(command);
        const publicUrl = `${R2_PUBLIC_URL}/${key}`;
        console.log(`✅ Uploaded: ${fileName} → ${publicUrl}`);
        return publicUrl;
    } catch (error: any) {
        console.error(`❌ Error uploading ${filePath}:`, error.message);
        throw error;
    }
}

function normalizeLocalPath(url: string): string {
    if (!url) return '';

    let localPath = url
        .replace('https://app-api.tubaraoemprestimo.com.br/', '')
        .replace('http://localhost:3001/', '')
        .replace('//', '/');

    // Se o caminho já contém /home/ubuntu/backend/backend, não adicionar novamente
    return localPath.startsWith('/home/ubuntu/backend/backend')
        ? localPath
        : path.join('/home/ubuntu/backend/backend', localPath);
}

function shouldMigrate(url: string | null): boolean {
    if (!url) return false;
    if (url.includes('r2.dev')) return false;
    if (url.includes('blob:')) return false;
    if (url.startsWith('data:')) return false;
    return true;
}

async function migrateAllMedia() {
    console.log('🚀 Starting complete media migration to Cloudflare R2...\n');

    // Buscar todas as solicitações com mídias locais
    const requests = await prisma.loanRequest.findMany({
        where: {
            createdAt: {
                gte: new Date('2026-03-11')
            }
        },
        select: {
            id: true,
            customerId: true,
            selfieUrl: true,
            idCardUrl: true,
            idCardBackUrl: true,
            proofOfAddressUrl: true,
            proofIncomeUrl: true,
            vehicleUrl: true,
            videoSelfieUrl: true,
            videoHouseUrl: true,
            videoVehicleUrl: true,
            signatureUrl: true,
            workCardUrl: true,
            supplementalDocUrl: true
        }
    });

    console.log(`📊 Found ${requests.length} requests to check\n`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const fields = [
        'selfieUrl',
        'idCardUrl',
        'idCardBackUrl',
        'proofOfAddressUrl',
        'proofIncomeUrl',
        'vehicleUrl',
        'videoSelfieUrl',
        'videoHouseUrl',
        'videoVehicleUrl',
        'signatureUrl',
        'workCardUrl',
        'supplementalDocUrl'
    ];

    for (const request of requests) {
        console.log(`\n🔄 Processing request: ${request.id}`);

        const updates: any = {};
        let hasChanges = false;

        for (const field of fields) {
            const url = (request as any)[field];

            if (!shouldMigrate(url)) {
                continue;
            }

            const fullPath = normalizeLocalPath(url);

            if (fs.existsSync(fullPath)) {
                try {
                    const mediaType = field.includes('video') ? 'videos' :
                                     field.includes('signature') ? 'signatures' : 'documents';
                    const r2Url = await uploadFileToR2(
                        fullPath,
                        `solicitacoes/${request.customerId || 'anonymous'}/${mediaType}`
                    );
                    updates[field] = r2Url;
                    hasChanges = true;
                    successCount++;
                } catch (error) {
                    console.error(`❌ Failed to upload ${field} for ${request.id}`);
                    errorCount++;
                }
            } else {
                console.warn(`⚠️  File not found (${field}): ${fullPath}`);
                skippedCount++;
            }
        }

        // Atualizar banco de dados se houver mudanças
        if (hasChanges) {
            await prisma.loanRequest.update({
                where: { id: request.id },
                data: updates
            });
            console.log(`✅ Updated database for request ${request.id}`);
        }
    }

    console.log('\n\n📊 MIGRATION SUMMARY:');
    console.log(`✅ Success: ${successCount} files`);
    console.log(`❌ Errors: ${errorCount} files`);
    console.log(`⏭️  Skipped: ${skippedCount} files (not found or already migrated)`);
    console.log(`📦 Total requests processed: ${requests.length}`);
}

migrateAllMedia()
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
