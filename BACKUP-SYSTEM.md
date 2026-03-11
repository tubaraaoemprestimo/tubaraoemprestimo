# 🛡️ PROTEÇÃO CONTRA PERDA DE DADOS - TUBARÃO EMPRÉSTIMOS

## ✅ SISTEMA DE BACKUP AUTOMÁTICO INSTALADO

### 📦 O que foi configurado:

1. **Script de Backup Diário** (`/home/ubuntu/backup-tubarao.sh`)
   - Faz backup completo do PostgreSQL (tubarao_db)
   - Faz backup das configurações (.env, schema.prisma, package.json)
   - Compacta os arquivos (economiza 80% de espaço)
   - Remove backups com mais de 30 dias automaticamente
   - Monitora uso de disco

2. **Cron Job Automático**
   - Executa todo dia às **3h da manhã**
   - Logs salvos em `/home/ubuntu/backup.log`
   - Comando: `0 3 * * * /home/ubuntu/backup-tubarao.sh >> /home/ubuntu/backup.log 2>&1`

3. **Documentação de Segurança** (`DANGER.md`)
   - Lista de comandos PROIBIDOS que apagam dados
   - Checklist antes de executar comandos Prisma
   - Instruções de restauração de backup

### 📍 Localização dos Backups:

```bash
/home/ubuntu/backups/
├── tubarao_db_YYYYMMDD_HHMMSS.sql.gz  (banco de dados)
└── config_YYYYMMDD_HHMMSS.tar.gz      (configurações)
```

### 🔄 Como usar:

#### Fazer backup manual:
```bash
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113
~/backup-tubarao.sh
```

#### Listar backups disponíveis:
```bash
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113
ls -lh ~/backups/
```

#### Restaurar backup:
```bash
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113

# 1. Listar backups
ls -lh ~/backups/

# 2. Restaurar (substitua a data)
gunzip -c ~/backups/tubarao_db_20260311_030420.sql.gz | PGPASSWORD=tubarao123 psql -U postgres -h localhost tubarao_db

# 3. Reiniciar backend
pm2 restart tubarao-backend
```

### ⚠️ COMANDOS PROIBIDOS (NUNCA EXECUTAR):

```bash
❌ npx prisma db push --force-reset    # APAGA TODO O BANCO
❌ npx prisma migrate reset            # APAGA TODO O BANCO
❌ psql -c "DROP DATABASE tubarao_db"  # APAGA TODO O BANCO
❌ rm -rf ~/backups/*                  # APAGA TODOS OS BACKUPS
❌ git reset --hard HEAD               # PERDE MUDANÇAS NÃO COMMITADAS
❌ git clean -fd                       # APAGA ARQUIVOS NÃO RASTREADOS
```

### ✅ COMANDOS SEGUROS:

```bash
✅ npx prisma db push                  # Aplica mudanças SEM apagar dados
✅ npx prisma migrate dev              # Cria migration SEM apagar dados
✅ npx prisma studio                   # Visualiza dados
✅ ~/backup-tubarao.sh                 # Faz backup manual
```

### 📊 Status Atual:

- ✅ Backup automático: **ATIVO** (diário às 3h)
- ✅ Último backup: 2026-03-11 03:04 (24KB compactado)
- ✅ Backups mantidos: 30 dias
- ✅ Espaço em disco: 14% usado (168GB livres)
- ✅ Documentação: `DANGER.md` no projeto

### 🚨 EM CASO DE EMERGÊNCIA:

1. **NÃO ENTRE EM PÂNICO**
2. **NÃO EXECUTE MAIS COMANDOS** (pode sobrescrever dados)
3. Verifique se existe backup recente: `ls -lh ~/backups/`
4. Restaure o backup (comando acima)
5. Reinicie o backend: `pm2 restart tubarao-backend`

---

**Data de instalação**: 2026-03-11
**Próximo backup automático**: 2026-03-12 às 3h da manhã
**Retenção**: 30 dias (aproximadamente 30 backups mantidos)
