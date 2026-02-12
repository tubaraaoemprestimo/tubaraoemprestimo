#!/bin/bash
# ============================================
# Setup Oracle Cloud ARM VM - Tubarao Emprestimos
# Oracle Linux 8 / Ubuntu 22.04 (Ampere A1 - 4 OCPU, 24GB RAM)
# ============================================
# Uso: ssh opc@SEU_IP 'bash -s' < setup-oracle-vm.sh
# ============================================

set -e

echo "=========================================="
echo "  Setup Oracle Cloud VM - Tubarao Backend"
echo "=========================================="

# ============ 1. ATUALIZAR SISTEMA ============
echo "[1/8] Atualizando sistema..."
sudo apt update && sudo apt upgrade -y 2>/dev/null || sudo dnf update -y

# ============ 2. INSTALAR POSTGRESQL 16 ============
echo "[2/8] Instalando PostgreSQL 16..."

# Ubuntu/Debian
if command -v apt &>/dev/null; then
    sudo apt install -y wget gnupg2
    sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
    sudo apt update
    sudo apt install -y postgresql-16 postgresql-client-16
fi

# Oracle Linux/RHEL
if command -v dnf &>/dev/null; then
    sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-aarch64/pgdg-redhat-repo-latest.noarch.rpm
    sudo dnf -qy module disable postgresql
    sudo dnf install -y postgresql16-server postgresql16
    sudo /usr/pgsql-16/bin/postgresql-16-setup initdb
fi

# Iniciar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configurar banco e usuario
echo "[2.1] Criando banco tubarao_db..."
sudo -u postgres psql -c "CREATE USER tubarao WITH PASSWORD 'TROCAR_SENHA_AQUI' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE tubarao_db OWNER tubarao;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tubarao_db TO tubarao;"

# Permitir conexoes locais com senha
sudo sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' /etc/postgresql/16/main/pg_hba.conf 2>/dev/null || true
sudo sed -i 's/local   all             all                                     ident/local   all             all                                     md5/' /var/lib/pgsql/16/data/pg_hba.conf 2>/dev/null || true

sudo systemctl restart postgresql
echo "  PostgreSQL 16 instalado!"

# ============ 3. INSTALAR NODE.JS 20 LTS ============
echo "[3/8] Instalando Node.js 20 LTS..."

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || \
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -

sudo apt install -y nodejs 2>/dev/null || sudo dnf install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2
echo "  Node.js $(node -v) + PM2 instalados!"

# ============ 4. INSTALAR NGINX ============
echo "[4/8] Instalando Nginx..."
sudo apt install -y nginx 2>/dev/null || sudo dnf install -y nginx

sudo systemctl start nginx
sudo systemctl enable nginx
echo "  Nginx instalado!"

# ============ 5. INSTALAR CERTBOT (SSL) ============
echo "[5/8] Instalando Certbot (Let's Encrypt)..."
sudo apt install -y certbot python3-certbot-nginx 2>/dev/null || \
sudo dnf install -y certbot python3-certbot-nginx

echo "  Certbot instalado!"
echo "  Para gerar SSL: sudo certbot --nginx -d api.tubaraoemprestimo.com.br"

# ============ 6. CONFIGURAR FIREWALL ============
echo "[6/8] Configurando Firewall..."

# iptables (Oracle Linux)
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT

# Salvar regras
sudo sh -c 'iptables-save > /etc/iptables.rules' 2>/dev/null || true

# UFW (Ubuntu)
if command -v ufw &>/dev/null; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 3001/tcp
    sudo ufw allow 8080/tcp
    sudo ufw --force enable
fi

echo "  Firewall configurado (80, 443, 3001, 8080)!"

# ============ 7. CRIAR ESTRUTURA DO PROJETO ============
echo "[7/8] Criando estrutura..."

mkdir -p ~/tubarao-backend/uploads
mkdir -p ~/tubarao-backend/backups

echo "  Estrutura criada em ~/tubarao-backend/"

# ============ 8. CONFIGURAR BACKUP AUTOMATICO ============
echo "[8/8] Configurando backup automatico..."

cat > ~/tubarao-backend/backup.sh << 'BACKUP_EOF'
#!/bin/bash
# Backup diario do PostgreSQL
BACKUP_DIR=~/tubarao-backend/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="tubarao_db_${TIMESTAMP}.sql.gz"

# Fazer dump comprimido
PGPASSWORD='TROCAR_SENHA_AQUI' pg_dump -h localhost -U tubarao tubarao_db | gzip > "${BACKUP_DIR}/${FILENAME}"

# Manter apenas os ultimos 7 backups
cd "${BACKUP_DIR}" && ls -t *.sql.gz | tail -n +8 | xargs -r rm --

echo "[$(date)] Backup criado: ${FILENAME}"
BACKUP_EOF

chmod +x ~/tubarao-backend/backup.sh

# Adicionar ao cron (todo dia as 3h)
(crontab -l 2>/dev/null; echo "0 3 * * * ~/tubarao-backend/backup.sh >> ~/tubarao-backend/backups/backup.log 2>&1") | sort -u | crontab -

echo "  Backup automatico configurado (diario as 3h)!"

# ============ RESUMO ============
echo ""
echo "=========================================="
echo "  SETUP COMPLETO!"
echo "=========================================="
echo ""
echo "Proximos passos:"
echo ""
echo "1. TROCAR SENHAS nos arquivos:"
echo "   - Este script (TROCAR_SENHA_AQUI)"
echo "   - backup.sh (TROCAR_SENHA_AQUI)"
echo ""
echo "2. ENVIAR CODIGO do backend:"
echo "   scp -r ./backend/* opc@SEU_IP:~/tubarao-backend/"
echo ""
echo "3. INSTALAR DEPENDENCIAS:"
echo "   cd ~/tubarao-backend && npm install"
echo ""
echo "4. CONFIGURAR .env:"
echo "   cp .env.example .env && nano .env"
echo "   DATABASE_URL=postgresql://tubarao:SUA_SENHA@localhost:5432/tubarao_db"
echo ""
echo "5. RODAR MIGRATIONS:"
echo "   npx prisma migrate deploy"
echo "   npx prisma db seed  (se precisar)"
echo ""
echo "6. CONFIGURAR NGINX:"
echo "   sudo cp deploy/nginx.conf /etc/nginx/sites-available/tubarao"
echo "   sudo ln -s /etc/nginx/sites-available/tubarao /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "7. GERAR SSL:"
echo "   sudo certbot --nginx -d api.tubaraoemprestimo.com.br"
echo ""
echo "8. INICIAR COM PM2:"
echo "   cd ~/tubarao-backend && pm2 start ecosystem.config.js"
echo "   pm2 save && pm2 startup"
echo ""
echo "=========================================="
