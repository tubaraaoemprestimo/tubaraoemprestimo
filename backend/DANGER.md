# ⚠️ COMANDOS PERIGOSOS - NUNCA EXECUTAR ⚠️

## 🚨 COMANDOS PROIBIDOS - CAUSAM PERDA DE DADOS

### ❌ NUNCA EXECUTAR ESTES COMANDOS:

```bash
# APAGA TODO O BANCO DE DADOS
npx prisma db push --force-reset
npx prisma migrate reset
npx prisma migrate reset --force

# APAGA DADOS SEM BACKUP
npx prisma db push --force
psql -c "DROP DATABASE tubarao_db"
rm -rf /home/ubuntu/backups/*

# GIT DESTRUTIVO
git reset --hard HEAD
git clean -fd
git push --force origin main
```

## ✅ COMANDOS SEGUROS PARA USAR:

### Aplicar mudanças no schema (SEM apagar dados):
```bash
npx prisma db push
npx prisma migrate dev --name descricao_da_mudanca
```

### Ver status do banco:
```bash
npx prisma studio
npx prisma db pull
```

### Fazer backup manual:
```bash
~/backup-tubarao.sh
```

### Restaurar backup:
```bash
# Listar backups disponíveis
ls -lh ~/backups/

# Restaurar (substitua YYYYMMDD_HHMMSS pela data desejada)
gunzip -c ~/backups/tubarao_db_YYYYMMDD_HHMMSS.sql.gz | PGPASSWORD=tubarao123 psql -U postgres -h localhost tubarao_db
```

## 📋 CHECKLIST ANTES DE QUALQUER COMANDO PRISMA:

1. ✅ Existe backup recente? `ls -lh ~/backups/ | tail -5`
2. ✅ O comando tem `--force-reset`? **NÃO EXECUTAR**
3. ✅ Testei em ambiente local primeiro?
4. ✅ Tenho certeza do que estou fazendo?

## 🔄 BACKUP AUTOMÁTICO

- **Frequência**: Diário às 3h da manhã
- **Localização**: `/home/ubuntu/backups/`
- **Retenção**: 30 dias
- **Script**: `/home/ubuntu/backup-tubarao.sh`
- **Cron**: `0 3 * * * /home/ubuntu/backup-tubarao.sh >> /home/ubuntu/backup.log 2>&1`

## 📞 EM CASO DE EMERGÊNCIA

Se dados foram perdidos acidentalmente:

1. **NÃO FAÇA MAIS NADA** - Cada comando pode sobrescrever dados
2. Verifique backups: `ls -lh ~/backups/`
3. Restaure o backup mais recente (comando acima)
4. Reinicie o backend: `pm2 restart tubarao-backend`

---

**ÚLTIMA ATUALIZAÇÃO**: 2026-03-11
**INCIDENTE**: Database foi apagado com `prisma db push --force-reset` em 2026-03-10
**LIÇÃO**: NUNCA usar comandos com `--force-reset` em produção
