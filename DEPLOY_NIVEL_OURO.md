# 🚀 GUIA RÁPIDO DE DEPLOY - Nível Ouro Tubarão

**Data:** 20/02/2026
**Status:** ✅ Código pronto para deploy

---

## 📋 Arquivos Modificados

### Backend
- ✅ `backend/prisma/schema.prisma` - Adicionados campos `nivelOuroUtilizado` e `dataAtivacaoNivelOuro`
- ✅ `backend/src/routes/loans.ts` - Adicionadas rotas do Nível Ouro

### Frontend
- ✅ `pages/client/ClientDashboard.tsx` - Substituído "Renegociar" por "Nível Ouro"

### Documentação
- ✅ `NIVEL_OURO_TUBARAO.md` - Documentação completa
- ✅ `DEPLOY_NIVEL_OURO.md` - Este guia

---

## 🔧 COMANDOS PARA EXECUTAR NO SERVIDOR

### Opção 1: Script Completo (Recomendado)

```bash
# 1. Conectar via SSH
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113

# 2. Executar todos os comandos de uma vez
cd ~/backend/backend && \
git pull origin main && \
npx prisma db push && \
npx prisma generate && \
npm run build && \
pm2 restart tubarao-backend && \
pm2 logs tubarao-backend --lines 50
```

### Opção 2: Passo a Passo

```bash
# 1. Conectar via SSH
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113

# 2. Navegar para o diretório do backend
cd ~/backend/backend

# 3. Fazer pull das alterações
git pull origin main

# 4. Aplicar schema no banco de dados (adiciona novos campos)
npx prisma db push

# 5. Gerar Prisma Client
npx prisma generate

# 6. Rebuild do backend
npm run build

# 7. Reiniciar PM2
pm2 restart tubarao-backend

# 8. Verificar logs
pm2 logs tubarao-backend --lines 50
```

---

## ✅ Checklist de Deploy

### Antes do Deploy
- [x] Código commitado no GitHub
- [x] Documentação criada
- [x] Schema do Prisma atualizado
- [x] Rotas backend implementadas
- [x] Frontend atualizado

### Durante o Deploy
- [ ] Conectar via SSH no servidor
- [ ] Navegar para `~/backend/backend`
- [ ] Executar `git pull origin main`
- [ ] Executar `npx prisma db push` (adiciona campos no banco)
- [ ] Executar `npx prisma generate`
- [ ] Executar `npm run build`
- [ ] Executar `pm2 restart tubarao-backend`
- [ ] Verificar logs com `pm2 logs tubarao-backend --lines 50`

### Após o Deploy
- [ ] Testar elegibilidade: GET `/api/loans/:loanId/nivel-ouro/eligibility`
- [ ] Testar ativação (com conta de teste): POST `/api/loans/:loanId/nivel-ouro`
- [ ] Verificar se botão aparece no dashboard do cliente
- [ ] Verificar se indicador visual funciona (bolinha verde/cinza)
- [ ] Testar modal de ativação
- [ ] Verificar notificações (email, sistema, WhatsApp)

---

## 🌐 URLs de Acesso

### Produção (após deploy)
- **Dashboard Cliente:** https://www.tubaraoemprestimo.com.br/#/client/dashboard
- **API Elegibilidade:** https://www.tubaraoemprestimo.com.br/api/loans/:loanId/nivel-ouro/eligibility
- **API Ativação:** https://www.tubaraoemprestimo.com.br/api/loans/:loanId/nivel-ouro

### Desenvolvimento (local)
- **Dashboard Cliente:** http://localhost:5173/#/client/dashboard
- **API Elegibilidade:** http://localhost:3000/api/loans/:loanId/nivel-ouro/eligibility
- **API Ativação:** http://localhost:3000/api/loans/:loanId/nivel-ouro

---

## 🧪 Testes Pós-Deploy

### 1. Verificar Schema do Banco
```bash
# Conectar no banco
psql -U postgres -d tubarao_db

# Verificar se campos foram adicionados
\d loans

# Deve mostrar:
# - nivel_ouro_utilizado (boolean)
# - data_ativacao_nivel_ouro (timestamp)
```

### 2. Testar API de Elegibilidade
```bash
# Substituir {loanId} e {token}
curl -X GET https://www.tubaraoemprestimo.com.br/api/loans/{loanId}/nivel-ouro/eligibility \
  -H "Authorization: Bearer {token}"
```

**Resposta esperada:**
```json
{
  "eligible": false,
  "reason": "Você tem 5 pagamentos. Precisa de 12 pagamentos consecutivos",
  "details": {
    "alreadyUsed": false,
    "isActive": true,
    "hasOverdue": false,
    "paidCount": 5,
    "has12Payments": false,
    "allOnTime": true
  }
}
```

### 3. Testar Frontend
1. Fazer login como cliente
2. Acessar dashboard
3. Verificar se botão "Nível Ouro" aparece
4. Verificar indicador visual (bolinha verde se elegível, cinza se não)
5. Clicar no botão:
   - Se não elegível: deve mostrar toast com motivo
   - Se elegível: deve abrir modal

---

## 🔍 Verificações de Segurança

### 1. Campos no Banco de Dados
```sql
-- Verificar se campos foram criados
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'loans'
AND column_name IN ('nivel_ouro_utilizado', 'data_ativacao_nivel_ouro');
```

### 2. Logs do Backend
```bash
# Ver logs em tempo real
pm2 logs tubarao-backend

# Ver últimas 100 linhas
pm2 logs tubarao-backend --lines 100

# Ver apenas erros
pm2 logs tubarao-backend --err
```

### 3. Status do PM2
```bash
pm2 status
```

**Saída esperada:**
```
┌─────┬──────────────────┬─────────┬─────────┬──────────┐
│ id  │ name             │ status  │ restart │ uptime   │
├─────┼──────────────────┼─────────┼─────────┼──────────┤
│ 0   │ tubarao-backend  │ online  │ 0       │ 2m       │
└─────┴──────────────────┴─────────┴─────────┴──────────┘
```

---

## ⚠️ Troubleshooting

### Erro: "Prisma schema validation"
**Causa:** Schema não foi aplicado corretamente
**Solução:**
```bash
cd ~/backend/backend
npx prisma db push --force-reset  # ⚠️ CUIDADO: Reseta o banco
# OU
npx prisma db push --accept-data-loss
```

### Erro: "Cannot find module '@prisma/client'"
**Causa:** Prisma Client não foi gerado
**Solução:**
```bash
npx prisma generate
npm run build
pm2 restart tubarao-backend
```

### Erro: Backend não reinicia
**Causa:** Erro de compilação ou sintaxe
**Solução:**
```bash
# Ver logs de erro
pm2 logs tubarao-backend --err

# Verificar se há erros de TypeScript
npm run build
```

### Erro: "Route not found" ao testar API
**Causa:** Backend não foi reiniciado ou rota não foi registrada
**Solução:**
```bash
# Verificar se arquivo loans.ts foi atualizado
cat ~/backend/backend/src/routes/loans.ts | grep "nivel-ouro"

# Reiniciar backend
pm2 restart tubarao-backend
```

### Botão não aparece no frontend
**Causa:** Frontend não foi atualizado ou não há empréstimo ativo
**Solução:**
1. Verificar se código foi commitado e Vercel fez deploy
2. Limpar cache do navegador (Ctrl+Shift+R)
3. Verificar console do navegador (F12) para erros
4. Verificar se cliente tem empréstimo ativo

---

## 📊 Monitoramento Pós-Deploy

### Métricas para Acompanhar (Primeiras 24h)

1. **Erros no Backend**
   ```bash
   pm2 logs tubarao-backend --err --lines 100
   ```

2. **Requisições à API**
   - Quantas verificações de elegibilidade
   - Quantas ativações bem-sucedidas
   - Quantas tentativas rejeitadas

3. **Notificações Enviadas**
   - Emails enviados com sucesso
   - WhatsApp enviados com sucesso
   - Notificações criadas no sistema

4. **Feedback dos Clientes**
   - Clientes reportando problemas
   - Clientes conseguindo ativar
   - Dúvidas sobre elegibilidade

---

## 📝 Comandos Úteis

```bash
# Ver logs em tempo real
pm2 logs tubarao-backend

# Ver status do PM2
pm2 status

# Reiniciar backend
pm2 restart tubarao-backend

# Ver últimas 100 linhas de log
pm2 logs tubarao-backend --lines 100

# Verificar se o banco está rodando
sudo systemctl status postgresql

# Conectar no banco de dados
psql -U postgres -d tubarao_db

# Ver tabela loans
\d loans

# Contar empréstimos com Nível Ouro ativado
SELECT COUNT(*) FROM loans WHERE nivel_ouro_utilizado = true;

# Ver últimas ativações
SELECT id, customer_id, nivel_ouro_utilizado, data_ativacao_nivel_ouro
FROM loans
WHERE nivel_ouro_utilizado = true
ORDER BY data_ativacao_nivel_ouro DESC
LIMIT 10;
```

---

## 🎯 Critérios de Sucesso

O deploy será considerado bem-sucedido quando:

- ✅ Backend reinicia sem erros
- ✅ Campos aparecem no banco de dados
- ✅ API de elegibilidade responde corretamente
- ✅ Botão "Nível Ouro" aparece no dashboard
- ✅ Indicador visual funciona (verde/cinza)
- ✅ Modal abre corretamente
- ✅ Ativação funciona para clientes elegíveis
- ✅ Validações bloqueiam clientes não elegíveis
- ✅ Notificações são enviadas (email, sistema, WhatsApp)
- ✅ Novas parcelas são criadas corretamente

---

## 📞 Contatos de Emergência

Se algo der errado durante o deploy:

1. **Reverter alterações:**
   ```bash
   cd ~/backend/backend
   git reset --hard HEAD~1
   npm run build
   pm2 restart tubarao-backend
   ```

2. **Verificar logs:**
   ```bash
   pm2 logs tubarao-backend --err --lines 200
   ```

3. **Restaurar backup do banco (se necessário):**
   ```bash
   # Apenas se houver backup configurado
   pg_restore -U postgres -d tubarao_db backup.sql
   ```

---

## 🎉 Pós-Deploy

Após deploy bem-sucedido:

1. ✅ Avisar equipe que funcionalidade está no ar
2. ✅ Monitorar logs por 24h
3. ✅ Coletar feedback dos primeiros usuários
4. ✅ Documentar qualquer ajuste necessário
5. ✅ Celebrar! 🦈🟢

---

**Desenvolvido por:** Claude Code (Anthropic)
**Data:** 20/02/2026 00:10 UTC
**Versão:** 1.0

🦈 **Tubarão Empréstimos - Nível Ouro Tubarão**
