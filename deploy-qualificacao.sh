#!/bin/bash
# Script de Deploy - Sistema de Qualificação de Leads
# Data: 18/02/2026

echo "🦈 Iniciando deploy do sistema de qualificação..."

# 1. Navegar para o diretório correto
cd ~/backend/backend

# 2. Fazer pull das alterações
echo "📥 Baixando alterações do GitHub..."
git pull origin main

# 3. Aplicar schema no banco de dados
echo "🗄️ Aplicando schema no banco de dados..."
npx prisma db push

# 4. Gerar Prisma Client
echo "🔧 Gerando Prisma Client..."
npx prisma generate

# 5. Rebuild do backend
echo "🏗️ Compilando backend..."
npm run build

# 6. Reiniciar PM2
echo "🔄 Reiniciando serviço..."
pm2 restart tubarao-backend

# 7. Verificar logs
echo "📋 Verificando logs..."
pm2 logs tubarao-backend --lines 50

echo "✅ Deploy concluído!"
