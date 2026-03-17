# 🚀 Deploy - Correção de Referências

**Data**: 2026-03-17
**Objetivo**: Adicionar campos de nome para referências pessoais

---

## ✅ Mudanças Implementadas

### 1. Schema Prisma
- ✅ Adicionados campos: `reference1Name`, `reference1Phone`, `reference2Name`, `reference2Phone`
- Arquivo: `backend/prisma/schema.prisma` (linhas 268-271)

### 2. Migration SQL
- ✅ Criado script de migração manual
- Arquivo: `backend/migrations/add_reference_names.sql`

### 3. Backend - Validação
- ✅ Referências agora são obrigatórias (nome + telefone)
- Arquivo: `backend/src/routes/loanRequests.ts` (função `validateRequestByProfile`)

### 4. Backend - Salvamento
- ✅ Campos salvos ao criar nova solicitação
- Arquivo: `backend/src/routes/loanRequests.ts` (POST `/api/loan-requests`)

---

## 📋 Checklist de Deploy

### Passo 1: Conectar ao Servidor
```bash
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113
```

### Passo 2: Backup do Banco (OBRIGATÓRIO)
```bash
# Já existe backup automático diário, mas fazer backup manual antes de mudanças
pg_dump -U postgres tubarao_db > /home/ubuntu/backups/manual_before_references_$(date +%Y%m%d_%H%M%S).sql
```

### Passo 3: Aplicar Migration SQL
```bash
# Conectar ao PostgreSQL
psql -U postgres -d tubarao_db

# Executar migration
ALTER TABLE loan_requests
ADD COLUMN IF NOT EXISTS reference1_name TEXT,
ADD COLUMN IF NOT EXISTS reference1_phone TEXT,
ADD COLUMN IF NOT EXISTS reference2_name TEXT,
ADD COLUMN IF NOT EXISTS reference2_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_loan_requests_references ON loan_requests(reference1_phone, reference2_phone);

# Verificar
\d loan_requests

# Sair
\q
```

### Passo 4: Atualizar Código Backend
```bash
cd /home/ubuntu/backend/backend

# Fazer stash de mudanças locais (se houver)
git stash

# Puxar código atualizado
git pull origin main

# Restaurar stash se necessário
git stash pop

# Instalar dependências (se houver novas)
npm install
```

### Passo 5: Reiniciar Backend
```bash
pm2 restart tubarao-backend

# Verificar logs
pm2 logs tubarao-backend --lines 50
```

### Passo 6: Testar
```bash
# Verificar se backend está rodando
pm2 status

# Testar endpoint
curl -X GET https://tubaraoemprestimo.com.br/api/health
```

---

## 🧪 Testes Manuais

### No Admin:
1. Acessar painel de solicitações
2. Verificar se referências aparecem com nome + telefone
3. Testar aprovação de solicitação

### No Cliente:
1. Tentar criar nova solicitação SEM preencher referências
2. Deve retornar erro: "Referência 1 (nome e telefone) é obrigatória"
3. Preencher referências completas e enviar
4. Verificar se dados foram salvos corretamente

---

## ⚠️ Rollback (se necessário)

Se algo der errado:

```bash
# Reverter migration
psql -U postgres -d tubarao_db -c "
ALTER TABLE loan_requests
DROP COLUMN IF EXISTS reference1_name,
DROP COLUMN IF EXISTS reference1_phone,
DROP COLUMN IF EXISTS reference2_name,
DROP COLUMN IF EXISTS reference2_phone;
"

# Reverter código
cd /home/ubuntu/backend/backend
git reset --hard HEAD~1
pm2 restart tubarao-backend
```

---

## 📝 Próximos Passos

Após deploy bem-sucedido:
- [ ] Atualizar frontend para incluir campos de nome nas referências
- [ ] Testar fluxo completo: cliente envia → admin visualiza
- [ ] Marcar bug #5 como resolvido em `BUGS-CORRECOES.md`

---

**IMPORTANTE**:
- ✅ Backup automático está ativo (diário às 3h)
- ✅ Migration usa `IF NOT EXISTS` (seguro executar múltiplas vezes)
- ✅ Validação só afeta NOVAS solicitações (registros antigos não quebram)
