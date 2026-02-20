# 📋 Status Atual e Problemas Identificados

**Data/Hora:** 20/02/2026 - 13:06

---

## ✅ O QUE ESTÁ FUNCIONANDO

### Backend
- ✅ Backend rodando na porta 3001
- ✅ API respondendo: https://app-api.tubaraoemprestimo.com.br
- ✅ Cron de cobrança iniciado
- ✅ CollectionAutomation funcionando
- ✅ Templates criados no banco (31 templates)

### Frontend
- ✅ "Migração de Contratos" apareceu no menu
- ✅ Deploy da Vercel concluído
- ✅ Rota `/admin/contract-migrations` funcionando

---

## ❌ PROBLEMAS IDENTIFICADOS

### 1. Templates Não Aparecem na Interface
**Sintoma:** Usuário reporta que templates desapareceram
**Causa Provável:**
- Interface não está carregando os templates do banco
- Possível problema no componente CommunicationHub
- Ou filtro/query incorreto

**Solução:**
- Verificar componente `pages/admin/CommunicationHub.tsx`
- Verificar endpoint `/api/communication/templates`
- Verificar se há filtro por categoria

### 2. Réguas de Cobrança "Não Existem"
**Sintoma:** Usuário reporta que réguas não existem
**Causa Provável:**
- Usuário esperava ver interface visual das réguas
- As réguas são automáticas (cron job), não têm interface visual
- Falta documentação/explicação

**Solução:**
- As réguas funcionam automaticamente às 9h
- Criar painel de visualização das réguas (opcional)
- Adicionar logs/histórico de execução

### 3. Erro: "Argument cpf is missing"
**Localização:** `loanRequests.ts:213`
**Causa:** Tentando criar LoanRequest sem campo CPF obrigatório
**Impacto:** Médio - Impede criação de algumas solicitações

**Solução:** Verificar linha 213 do loanRequests.ts

### 4. Erro: "Column scheduled_status.title does not exist"
**Localização:** `installmentReminders.ts:285`
**Causa:** Schema do banco não tem coluna `title` em `scheduled_status`
**Impacto:** Baixo - Apenas cron de status WhatsApp falha

**Solução:** Adicionar coluna ou ajustar query

### 5. Rate Limit Email
**Sintoma:** "Too many requests. You can only make 2 requests per second"
**Causa:** Resend tem limite de 2 emails/segundo
**Impacto:** Baixo - Apenas em envios em massa

**Solução:** Já implementado delay de 1.5s, considerar upgrade do plano

### 6. WhatsApp Notification Failed: Invalid URL
**Causa:** URL do WhatsApp não configurada ou inválida
**Impacto:** Médio - Notificações WhatsApp não funcionam

**Solução:** Verificar configuração da Evolution API

---

## 🔧 AÇÕES NECESSÁRIAS

### Prioridade ALTA

#### 1. Verificar Por Que Templates Não Aparecem
```bash
# Testar endpoint de templates
curl -H "Authorization: Bearer TOKEN" \
  https://app-api.tubaraoemprestimo.com.br/api/communication/templates
```

#### 2. Corrigir Erro CPF Missing (loanRequests.ts:213)
- Ler arquivo loanRequests.ts linha 213
- Verificar se campo CPF está sendo passado
- Adicionar validação

### Prioridade MÉDIA

#### 3. Adicionar Coluna title em scheduled_status
```sql
ALTER TABLE scheduled_status ADD COLUMN IF NOT EXISTS title VARCHAR(255);
```

#### 4. Configurar URL do WhatsApp
- Verificar variável de ambiente WHATSAPP_URL
- Testar conexão com Evolution API

### Prioridade BAIXA

#### 5. Criar Interface Visual das Réguas
- Painel mostrando as 8 réguas configuradas
- Histórico de execuções
- Estatísticas de envios

---

## 📊 RÉGUAS DE COBRANÇA - COMO FUNCIONAM

As réguas **NÃO têm interface visual**, elas funcionam automaticamente:

### Execução Automática
- ⏰ **Horário:** Todos os dias às 9h (horário de São Paulo)
- 🤖 **Automático:** Não precisa de intervenção manual
- 📧 **Multi-canal:** Email + WhatsApp + Push

### 8 Réguas Configuradas
1. ✅ 7 dias antes do vencimento
2. ✅ 3 dias antes do vencimento
3. ✅ Vence hoje
4. ✅ 1 dia de atraso
5. ✅ 3 dias de atraso
6. ✅ 7 dias de atraso
7. ✅ 15 dias de atraso
8. ✅ 30 dias de atraso

### Como Verificar se Está Funcionando
```bash
# Ver logs do cron
pm2 logs tubarao-backend | grep CollectionAutomation

# Última execução mostrou:
[CollectionAutomation] TOTAL ENVIADO: 0
[CollectionCron] Total de mensagens enviadas: 0
[CollectionCron] Erros: 0
```

**Nota:** Total = 0 porque não há parcelas vencendo/atrasadas no momento.

---

## 🎯 PRÓXIMOS PASSOS

### Para o Usuário:

1. **Templates:**
   - Acesse: `/admin/communication-hub`
   - Vá na aba "Templates"
   - Verifique se os templates aparecem
   - Se não aparecer, me avise

2. **Réguas:**
   - As réguas funcionam automaticamente
   - Não há interface visual (por enquanto)
   - Elas executam às 9h todos os dias
   - Para testar: criar uma parcela vencendo hoje

3. **Migração de Contratos:**
   - ✅ Já está funcionando
   - Menu: "Migração de Contratos"
   - Rota: `/admin/contract-migrations`

### Para Mim (Claude):

1. Verificar por que templates não aparecem na interface
2. Corrigir erro CPF missing em loanRequests.ts:213
3. Adicionar coluna title em scheduled_status
4. Criar interface visual das réguas (opcional)

---

## 📞 Informações de Debug

### Logs Importantes
```bash
# Ver logs em tempo real
ssh ubuntu@136.248.115.113
pm2 logs tubarao-backend --lines 100

# Ver apenas erros
pm2 logs tubarao-backend --err --lines 50

# Ver execução das réguas
pm2 logs tubarao-backend | grep Collection
```

### Endpoints para Testar
- Health: https://app-api.tubaraoemprestimo.com.br/api/health
- Templates: https://app-api.tubaraoemprestimo.com.br/api/communication/templates
- Réguas Stats: https://app-api.tubaraoemprestimo.com.br/api/collection-automation/stats

---

**Última atualização:** 20/02/2026 - 13:06
