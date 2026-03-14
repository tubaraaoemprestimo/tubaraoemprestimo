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

async function uploadFileToR2(filePath: string, folder: string): Promise<string> {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const timestamp = Date.now();
        const uuid = uuidv4();
        const key = `${folder}/${timestamp}-${uuid}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: 'video/mp4',
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

async function migrateVideos() {
    console.log('🚀 Starting video migration to Cloudflare R2...\n');

    // Buscar todas as solicitações com vídeos
    const requests = await prisma.loanRequest.findMany({
        where: {
            OR: [
                { videoSelfieUrl: { not: null } },
                { videoHouseUrl: { not: null } },
                { videoVehicleUrl: { not: null } }
            ]
        },
        select: {
            id: true,
            customerId: true,
            videoSelfieUrl: true,
            videoHouseUrl: true,
            videoVehicleUrl: true
        }
    });

    console.log(`📊 Found ${requests.length} requests with videos\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const request of requests) {
        console.log(`\n🔄 Processing request: ${request.id}`);

        const updates: any = {};

        // Processar video_selfie_url
        if (request.videoSelfieUrl && !request.videoSelfieUrl.includes('r2.dev')) {
            let localPath = request.videoSelfieUrl
                .replace('https://app-api.tubaraoemprestimo.com.br/', '')
                .replace('//', '/');

            // Se o caminho já contém /home/ubuntu/backend/backend, não adicionar novamente
            const fullPath = localPath.startsWith('/home/ubuntu/backend/backend')
                ? localPath
                : path.join('/home/ubuntu/backend/backend', localPath);

            if (fs.existsSync(fullPath)) {
                try {
                    const r2Url = await uploadFileToR2(fullPath, `solicitacoes/${request.customerId || 'anonymous'}/videos`);
                    updates.videoSelfieUrl = r2Url;
                    successCount++;
                } catch (error) {
                    console.error(`❌ Failed to upload video_selfie for ${request.id}`);
                    errorCount++;
                }
            } else {
                console.warn(`⚠️  File not found: ${fullPath}`);
                errorCount++;
            }
        }

        // Processar video_house_url
        if (request.videoHouseUrl && !request.videoHouseUrl.includes('r2.dev') && !request.videoHouseUrl.includes('blob:')) {
            let localPath = request.videoHouseUrl
                .replace('https://app-api.tubaraoemprestimo.com.br/', '')
                .replace('//', '/');

            // Se o caminho já contém /home/ubuntu/backend/backend, não adicionar novamente
            const fullPath = localPath.startsWith('/home/ubuntu/backend/backend')
                ? localPath
                : path.join('/home/ubuntu/backend/backend', localPath);

            if (fs.existsSync(fullPath)) {
                try {
                    const r2Url = await uploadFileToR2(fullPath, `solicitacoes/${request.customerId || 'anonymous'}/videos`);
                    updates.videoHouseUrl = r2Url;
                    successCount++;
                } catch (error) {
                    console.error(`❌ Failed to upload video_house for ${request.id}`);
                    errorCount++;
                }
            } else {
                console.warn(`⚠️  File not found: ${fullPath}`);
                errorCount++;
            }
        }

        // Processar video_vehicle_url
        if (request.videoVehicleUrl && !request.videoVehicleUrl.includes('r2.dev')) {
            let localPath = request.videoVehicleUrl
                .replace('https://app-api.tubaraoemprestimo.com.br/', '')
                .replace('//', '/');

            // Se o caminho já contém /home/ubuntu/backend/backend, não adicionar novamente
            const fullPath = localPath.startsWith('/home/ubuntu/backend/backend')
                ? localPath
                : path.join('/home/ubuntu/backend/backend', localPath);

            if (fs.existsSync(fullPath)) {
                try {
                    const r2Url = await uploadFileToR2(fullPath, `solicitacoes/${request.customerId || 'anonymous'}/videos`);
                    updates.videoVehicleUrl = r2Url;
                    successCount++;
                } catch (error) {
                    console.error(`❌ Failed to upload video_vehicle for ${request.id}`);
                    errorCount++;
                }
            } else {
                console.warn(`⚠️  File not found: ${fullPath}`);
                errorCount++;
            }
        }

        // Atualizar banco de dados se houver mudanças
        if (Object.keys(updates).length > 0) {
            await prisma.loanRequest.update({
                where: { id: request.id },
                data: updates
            });
            console.log(`✅ Updated database for request ${request.id}`);
        }
    }

    console.log('\n\n📊 MIGRATION SUMMARY:');
    console.log(`✅ Success: ${successCount} videos`);
    console.log(`❌ Errors: ${errorCount} videos`);
    console.log(`📦 Total requests processed: ${requests.length}`);
}

migrateVideos()
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
