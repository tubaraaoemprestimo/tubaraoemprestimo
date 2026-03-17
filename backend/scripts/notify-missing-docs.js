// Script para notificar clientes sem documentos
// Executa a rota /supplemental para enviar email + WhatsApp + push

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// IDs das solicitações sem documentos
const requestsWithoutDocs = [
    {
        id: '4e23aef2-3f8d-4917-a5a2-636a9ca27c47',
        name: 'Yuri Arruda De Carvalho',
        description: 'Documentos obrigatórios não foram enviados. Por favor, envie:\n\n✅ Selfie\n✅ RG frente e verso\n✅ Comprovante de endereço\n✅ Vídeo selfie\n✅ Vídeo da casa\n✅ Carteira de trabalho\n\nPrazo: 48 horas'
    },
    {
        id: 'c2beb28c-ed8f-46be-953f-a6a3f0319d6e',
        name: 'Jefferson Santos',
        description: 'Documentos obrigatórios não foram enviados. Por favor, envie:\n\n✅ Selfie\n✅ RG frente e verso\n✅ Comprovante de endereço\n✅ Vídeo selfie\n✅ Vídeo da casa\n✅ Carteira de trabalho\n\nPrazo: 48 horas'
    },
    {
        id: 'a3c213c1-c2d6-4ecc-9343-ca7732e984d3',
        name: 'Teste completo',
        description: 'Documentos obrigatórios não foram enviados. Por favor, envie:\n\n✅ Selfie\n✅ RG frente e verso\n✅ Comprovante de endereço\n✅ Vídeo selfie\n✅ Vídeo da casa\n✅ Carteira de trabalho\n\nPrazo: 48 horas'
    }
];

async function notifyClient(request) {
    try {
        console.log(`\n📧 Notificando ${request.name}...`);

        const response = await axios.put(
            `${API_URL}/loan-requests/${request.id}/supplemental`,
            { description: request.description },
            {
                headers: {
                    'Content-Type': 'application/json'
                    // Nota: Em produção, adicionar token de autenticação admin
                }
            }
        );

        if (response.data.success) {
            console.log(`✅ ${request.name} - Notificações enviadas com sucesso!`);
            console.log(`   - Email enviado`);
            console.log(`   - WhatsApp enviado`);
            console.log(`   - Push notification enviado`);
        }
    } catch (error) {
        console.error(`❌ Erro ao notificar ${request.name}:`, error.response?.data || error.message);
    }
}

async function notifyAll() {
    console.log('🚀 Iniciando notificações para clientes sem documentos...\n');
    console.log(`Total de clientes: ${requestsWithoutDocs.length}\n`);

    for (const request of requestsWithoutDocs) {
        await notifyClient(request);
        // Aguardar 2 segundos entre cada notificação
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Processo concluído!');
}

// Executar
notifyAll().catch(console.error);
