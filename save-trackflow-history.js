const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

const TRACKFLOW_TOKEN = '46e3cab6883b9755ce85aed22086f74b182c38415e47f6bd18b28f788f2f914f';
const TRACKFLOW_BASE_URL = 'https://apis.trackflow.services/api';

async function queryAndSave(phone) {
  try {
    console.log(`\n🔍 Consultando ${phone}...`);

    // Consultar TrackFlow API - endpoint correto é GET /contatos?telefone=
    const response = await axios.get(`${TRACKFLOW_BASE_URL}/contatos`, {
      params: { telefone: phone },
      headers: {
        'Authorization': `Bearer ${TRACKFLOW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`✅ Dados recebidos para ${phone}`);

    // Salvar no banco
    const saved = await prisma.trackFlowQuery.create({
      data: {
        apiType: 'contatos',
        queryParams: { telefone: phone },
        response: response.data,
        success: true,
        userId: '6dea1e7f-2d7e-46cf-85d4-5bc788502764' // Admin user ID
      }
    });

    console.log(`💾 Salvo no histórico - ID: ${saved.id}`);
    console.log(`📊 CPF: ${response.data.cpf || 'N/A'}`);
    console.log(`👤 Nome: ${response.data.nome || 'N/A'}`);

    return saved;
  } catch (error) {
    console.error(`❌ Erro ao consultar ${phone}:`, error.message);

    // Salvar erro no banco
    await prisma.trackFlowQuery.create({
      data: {
        apiType: 'contatos',
        queryParams: { telefone: phone },
        response: { error: error.message },
        success: false,
        errorMsg: error.message,
        userId: '6dea1e7f-2d7e-46cf-85d4-5bc788502764' // Admin user ID
      }
    });

    return null;
  }
}

async function main() {
  const phones = ['11972258709', '11960304395'];

  for (const phone of phones) {
    await queryAndSave(phone);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay entre consultas
  }

  console.log('\n✅ Processo concluído!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
