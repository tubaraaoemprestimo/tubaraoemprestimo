// Script Node.js para enviar notificações via função interna
// Executa diretamente no servidor sem precisar de autenticação HTTP

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Importar funções de notificação (ajustar path conforme necessário)
const { emailService } = require('../src/services/email');

// IDs das solicitações
const requestIds = [
    '4e23aef2-3f8d-4917-a5a2-636a9ca27c47', // Yuri
    'c2beb28c-ed8f-46be-953f-a6a3f0319d6e', // Jefferson
    'a3c213c1-c2d6-4ecc-9343-ca7732e984d3'  // Teste completo
];

const description = `Documentos obrigatórios não foram enviados no momento da solicitação. Por favor, envie:

✅ Selfie
✅ RG frente e verso
✅ Comprovante de endereço
✅ Vídeo selfie
✅ Vídeo da casa
✅ Carteira de trabalho

Prazo: 48 horas

Acesse o app e envie os documentos na área indicada.`;

function brandedEmailHtml(body) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000; color: #fff; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #D4AF37; font-size: 24px;">🦈 Tubarão Empréstimos</h1>
        </div>
        <div style="color: #ccc; font-size: 15px; line-height: 1.6;">
            ${body}
        </div>
        <hr style="border-color: #333; margin: 25px 0;" />
        <p style="color: #666; font-size: 12px; text-align: center;">
            Tubarão Empréstimos — Plataforma de Crédito Premium
        </p>
    </div>`;
}

async function sendWhatsAppNotification(phone, message) {
    try {
        const axios = require('axios');
        const config = await prisma.whatsappConfig.findFirst();

        if (!config || !config.isConnected) {
            console.log(`   ⚠️  WhatsApp não configurado`);
            return;
        }

        const normalizePhoneBR = (phone) => {
            let cleaned = phone.replace(/\D/g, '');
            if (cleaned.length === 11 && !cleaned.startsWith('55')) {
                cleaned = '55' + cleaned;
            }
            return cleaned;
        };

        const number = normalizePhoneBR(phone);
        if (number.length < 12) {
            console.log(`   ⚠️  Telefone inválido: ${phone}`);
            return;
        }

        await axios.post(
            `${config.apiUrl}/message/sendText/${config.instanceName}`,
            {
                number,
                text: message,
                options: { delay: 1200, presence: 'composing', linkPreview: false }
            },
            { headers: { apikey: config.apiKey }, timeout: 15000 }
        );

        console.log(`   ✅ WhatsApp enviado para ${phone}`);
    } catch (error) {
        console.error(`   ❌ Erro WhatsApp:`, error.message);
    }
}

async function notifyClient(requestId) {
    try {
        const loanRequest = await prisma.loanRequest.findUnique({
            where: { id: requestId }
        });

        if (!loanRequest) {
            console.log(`❌ Solicitação ${requestId} não encontrada`);
            return;
        }

        console.log(`\n📧 Notificando ${loanRequest.clientName}...`);

        // Email
        if (loanRequest.email) {
            const html = brandedEmailHtml(`
                <h2 style="color: #FFD700;">📄 Documentos Solicitados</h2>
                <p>Olá, <strong>${loanRequest.clientName}</strong>!</p>
                <p>Precisamos de documentos para dar andamento à sua solicitação:</p>
                <div style="background:#111;border:1px solid #333;border-radius:8px;padding:15px;margin:15px 0;">
                    <p style="color:#D4AF37;font-weight:bold;">Documentos necessários:</p>
                    <p style="color:#ccc;white-space:pre-line;">${description}</p>
                </div>
                <p style="color: #aaa;">Envie os documentos o mais breve possível para agilizar a análise.</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://www.tubaraoemprestimo.com.br" style="background: #D4AF37; color: #000; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Enviar Documentos</a>
                </div>
            `);

            await emailService.send(
                loanRequest.email,
                '📄 Documentos Solicitados — Tubarão Empréstimos',
                html
            );
            console.log(`   ✅ Email enviado para ${loanRequest.email}`);
        }

        // WhatsApp
        if (loanRequest.phone) {
            const waMsg = `📄 *Documentos Solicitados*\n\nOlá, ${loanRequest.clientName.split(' ')[0]}!\n\nPrecisamos de documentos para sua solicitação:\n\n${description}\n\nEnvie pelo app o mais rápido possível.\n\n_Tubarão Empréstimos 🦈_`;
            await sendWhatsAppNotification(loanRequest.phone, waMsg);
        }

        // Notificação no sistema
        if (loanRequest.customerId) {
            await prisma.notification.create({
                data: {
                    customerId: loanRequest.customerId,
                    customerEmail: loanRequest.email,
                    title: '📄 Documentos Solicitados',
                    message: `Precisamos de documentos adicionais. Acesse o app.`,
                    type: 'WARNING'
                }
            });
            console.log(`   ✅ Notificação no sistema criada`);
        }

        console.log(`✅ ${loanRequest.clientName} - Notificações enviadas!`);

    } catch (error) {
        console.error(`❌ Erro ao notificar:`, error.message);
    }
}

async function main() {
    console.log('🚀 Iniciando notificações para clientes sem documentos...\n');
    console.log(`Total de clientes: ${requestIds.length}\n`);

    for (const id of requestIds) {
        await notifyClient(id);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Processo concluído!');
    await prisma.$disconnect();
}

main().catch(console.error);
