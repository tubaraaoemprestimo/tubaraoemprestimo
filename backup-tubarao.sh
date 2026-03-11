#!/bin/bash
# ============================================
# BACKUP AUTOMÁTICO TUBARÃO EMPRÉSTIMOS
# ============================================
# Este script faz backup completo do banco de dados PostgreSQL
# e dos arquivos de configuração do sistema.
#
# Executado diariamente via cron às 3h da manhã
# ============================================

set -e

# Configurações
DB_NAME="tubarao_db"
DB_USER="postgres"
DB_PASSWORD="tubarao123"
BACKUP_DIR="/home/ubuntu/backups"
RETENTION_DAYS=30  # Manter backups dos últimos 30 dias
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/tubarao_db_${DATE}.sql"
CONFIG_BACKUP="${BACKUP_DIR}/config_${DATE}.tar.gz"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo "[$(date)] =========================================="
echo "[$(date)] Iniciando backup do Tubarão Empréstimos"
echo "[$(date)] =========================================="

# 1. Backup do banco de dados PostgreSQL
echo "[$(date)] Fazendo backup do banco de dados..."
PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -h localhost "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] ✅ Backup do banco concluído: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date)] ❌ ERRO ao fazer backup do banco!"
    exit 1
fi

# 2. Backup dos arquivos de configuração
echo "[$(date)] Fazendo backup das configurações..."
cd /home/ubuntu/backend/backend
tar -czf "$CONFIG_BACKUP" \
    .env \
    prisma/schema.prisma \
    package.json \
    tsconfig.json \
    ecosystem.config.js 2>/dev/null || true

if [ -f "$CONFIG_BACKUP" ]; then
    CONFIG_SIZE=$(du -h "$CONFIG_BACKUP" | cut -f1)
    echo "[$(date)] ✅ Backup de configurações concluído: $CONFIG_BACKUP ($CONFIG_SIZE)"
else
    echo "[$(date)] ⚠️  Backup de configurações falhou (não crítico)"
fi

# 3. Compactar backup SQL para economizar espaço
echo "[$(date)] Compactando backup SQL..."
gzip -f "$BACKUP_FILE"
COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo "[$(date)] ✅ Backup compactado: ${BACKUP_FILE}.gz ($COMPRESSED_SIZE)"

# 4. Remover backups antigos (mais de 30 dias)
echo "[$(date)] Removendo backups antigos (>${RETENTION_DAYS} dias)..."
find "$BACKUP_DIR" -name "tubarao_db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "config_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/tubarao_db_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] ✅ Limpeza concluída. Backups mantidos: $REMAINING"

# 5. Verificar espaço em disco
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
echo "[$(date)] 💾 Uso de disco: ${DISK_USAGE}%"

if [ "$DISK_USAGE" -gt 80 ]; then
    echo "[$(date)] ⚠️  ALERTA: Disco com mais de 80% de uso!"
fi

echo "[$(date)] =========================================="
echo "[$(date)] Backup concluído com sucesso!"
echo "[$(date)] =========================================="
