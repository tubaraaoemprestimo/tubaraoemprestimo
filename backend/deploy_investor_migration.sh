#!/bin/bash
# Script de deploy para aplicar migration de investidores
# Execute este script na VM Oracle Cloud (150.136.63.252)

echo "🦈 Tubarão Empréstimos - Deploy Migration Investidores"
echo "======================================================="
echo ""

# 1. Aplicar migration no banco de dados
echo "📊 Aplicando migration no banco de dados..."
psql -U tubarao_user -d tubarao_db -f migration_add_investor_fields.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration aplicada com sucesso!"
else
    echo "❌ Erro ao aplicar migration. Verifique as credenciais do banco."
    exit 1
fi

echo ""
echo "🔄 Reiniciando backend..."
pm2 restart tubarao-backend

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📋 Próximos passos:"
echo "1. Testar nova solicitação de investidor"
echo "2. Verificar se o valor aparece corretamente no admin"
echo "3. Conferir email e WhatsApp com valores corretos"
