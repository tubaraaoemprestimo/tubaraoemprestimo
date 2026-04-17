#!/bin/bash
# DEPLOY P1: Baixa Manual e Quitação Total
# Execute este script no servidor: ubuntu@136.248.115.113

echo "=== DEPLOY P1: Baixa Manual + Quitação Total ==="
echo "Servidor: ubuntu@136.248.115.113"
echo "Data: $(date)"
echo ""

cd /home/ubuntu/tubaraoemprestimo || exit 1

echo "[1/5] Git pull..."
git pull origin main

echo "[2/5] Build backend..."
cd backend
npm run build

echo "[3/5] Restart PM2..."
pm2 restart tubarao-backend

echo "[4/5] Aguardando 3s..."
sleep 3

echo "[5/5] Logs do backend..."
pm2 logs tubarao-backend --lines 30 --nostream

echo ""
echo "=== DEPLOY CONCLUÍDO ==="
echo "Validar em: https://app.tubaraoemprestimo.com.br/admin/contracts"
echo ""
echo "Testes:"
echo "1. Abrir contrato com parcelas OPEN"
echo "2. Clicar 'Baixa ✓' em uma parcela → deve marcar como PAID"
echo "3. Clicar 'Quitação Total 🏁' → deve quitar todas parcelas e loan.status=COMPLETED"
