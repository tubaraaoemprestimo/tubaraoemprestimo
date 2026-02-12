#!/bin/bash
# ============================================
# Deploy Script - Tubarao Backend para Oracle VM
# Uso: ./deploy.sh opc@SEU_IP_ORACLE
# ============================================

set -e

REMOTE_USER_HOST="${1:-opc@SEU_IP_ORACLE}"
REMOTE_DIR="/home/opc/tubarao-backend"
LOCAL_BACKEND="./backend"

echo "=========================================="
echo "  Deploy Tubarao Backend"
echo "  Target: ${REMOTE_USER_HOST}:${REMOTE_DIR}"
echo "=========================================="

# 1. Build local
echo "[1/5] Building backend..."
cd "${LOCAL_BACKEND}"
npm run build
cd ..

# 2. Enviar arquivos
echo "[2/5] Enviando arquivos..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.env' \
    --exclude 'uploads/*' \
    --exclude 'logs/*' \
    --exclude '.git' \
    "${LOCAL_BACKEND}/" "${REMOTE_USER_HOST}:${REMOTE_DIR}/"

# 3. Enviar configs de deploy
echo "[3/5] Enviando configs..."
scp deploy/ecosystem.config.js "${REMOTE_USER_HOST}:${REMOTE_DIR}/"

# 4. Instalar dependencias e migrar banco
echo "[4/5] Instalando dependencias remotamente..."
ssh "${REMOTE_USER_HOST}" << 'REMOTE_EOF'
cd ~/tubarao-backend
npm install --production
npx prisma generate
npx prisma migrate deploy
mkdir -p logs uploads
REMOTE_EOF

# 5. Reiniciar PM2
echo "[5/5] Reiniciando aplicacao..."
ssh "${REMOTE_USER_HOST}" << 'REMOTE_EOF'
cd ~/tubarao-backend
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js
pm2 save
echo "Deploy concluido! Status:"
pm2 status
REMOTE_EOF

echo ""
echo "=========================================="
echo "  DEPLOY CONCLUIDO!"
echo "=========================================="
echo "  API: https://api.tubaraoemprestimo.com.br"
echo "  Health: https://api.tubaraoemprestimo.com.br/api/health"
echo "=========================================="
