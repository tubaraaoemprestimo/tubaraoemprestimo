# 🟢 Nível Ouro Tubarão - Documentação Completa

**Data de Implementação:** 20/02/2026
**Status:** ✅ Implementado

---

## 📋 Visão Geral

O **Nível Ouro Tubarão** é um benefício exclusivo para clientes disciplinados que completaram 12 pagamentos consecutivos em dia. Substitui completamente a funcionalidade de "Renegociação".

### Objetivo
Recompensar clientes pontuais com um plano de quitação facilitado em apenas 5 parcelas.

---

## 🎯 Regras de Elegibilidade

Para ativar o Nível Ouro Tubarão, o cliente precisa atender **TODOS** os critérios:

1. ✅ **12 pagamentos consecutivos confirmados**
2. ✅ **Todos os 12 pagamentos feitos em dia** (sem atrasos)
3. ✅ **Nenhuma parcela em atraso** no momento da ativação
4. ✅ **Contrato ativo** (status = APPROVED)
5. ✅ **Não ter utilizado o Nível Ouro anteriormente** (uso único por contrato)

---

## 💰 Cálculo do Novo Plano

Quando o cliente ativa o Nível Ouro Tubarão:

### Fórmula da Nova Parcela
```
Nova Parcela = Juros Mensal (R$ 300) + (Valor do Empréstimo ÷ 5)
```

### Exemplo Prático
- **Empréstimo original:** R$ 10.000,00
- **Juros mensal:** R$ 300,00
- **Principal por parcela:** R$ 10.000 ÷ 5 = R$ 2.000,00
- **Nova parcela:** R$ 300 + R$ 2.000 = **R$ 2.300,00**
- **Total em 5 parcelas:** R$ 2.300 × 5 = **R$ 11.500,00**

---

## 🏗️ Arquitetura da Implementação

### 1. Banco de Dados

**Tabela:** `loans`

**Novos Campos Adicionados:**
```sql
ALTER TABLE loans ADD COLUMN nivel_ouro_utilizado BOOLEAN DEFAULT FALSE;
ALTER TABLE loans ADD COLUMN data_ativacao_nivel_ouro TIMESTAMP;
```

**Schema Prisma:**
```prisma
model Loan {
  id                      String        @id @default(uuid())
  customerId              String        @map("customer_id")
  requestId               String        @unique @map("request_id")
  amount                  Float
  installmentsCount       Int           @map("installments_count")
  remainingAmount         Float         @map("remaining_amount")
  status                  String        @default("APPROVED")
  startDate               DateTime      @map("start_date")
  createdAt               DateTime      @default(now()) @map("created_at")
  nivelOuroUtilizado      Boolean       @default(false) @map("nivel_ouro_utilizado")
  dataAtivacaoNivelOuro   DateTime?     @map("data_ativacao_nivel_ouro")
  installments            Installment[]
  customer                Customer      @relation(fields: [customerId], references: [id])
  loanRequest             LoanRequest   @relation(fields: [requestId], references: [id])

  @@map("loans")
}
```

---

### 2. Backend (API)

**Arquivo:** `backend/src/routes/loans.ts`

#### Endpoint 1: Ativar Nível Ouro
```
POST /api/loans/:loanId/nivel-ouro
```

**Autenticação:** Requerida (JWT)

**Fluxo de Execução:**
1. Valida se o empréstimo existe e pertence ao usuário
2. Verifica todas as regras de elegibilidade
3. Cancela parcelas abertas antigas (status → CANCELLED)
4. Cria 5 novas parcelas com vencimento mensal
5. Atualiza o empréstimo (marca como utilizado, atualiza contagem)
6. Cria notificação para admin
7. Envia email para o cliente
8. Notifica admins via WhatsApp

**Response (Sucesso):**
```json
{
  "success": true,
  "message": "Nível Ouro Tubarão ativado com sucesso!",
  "plan": {
    "installments": 5,
    "installmentValue": 2300.00,
    "totalAmount": 11500.00,
    "firstDueDate": "2026-03-20T00:00:00.000Z",
    "newInstallments": [...]
  }
}
```

**Response (Erro - Não Elegível):**
```json
{
  "error": "Pagamentos insuficientes",
  "message": "Você precisa de 12 pagamentos consecutivos em dia. Você tem 8 pagamentos confirmados."
}
```

#### Endpoint 2: Verificar Elegibilidade
```
GET /api/loans/:loanId/nivel-ouro/eligibility
```

**Autenticação:** Requerida (JWT)

**Response:**
```json
{
  "eligible": true,
  "reason": "Você está elegível para o Nível Ouro Tubarão!",
  "details": {
    "alreadyUsed": false,
    "isActive": true,
    "hasOverdue": false,
    "paidCount": 12,
    "has12Payments": true,
    "allOnTime": true
  }
}
```

---

### 3. Frontend

**Arquivo:** `pages/client/ClientDashboard.tsx`

#### Mudanças Implementadas:

1. **Removido:**
   - Botão "Renegociar"
   - Modal de renegociação
   - Estados `renegotiateInstallments` e `simulationResult`
   - Função `handleRenegotiateSubmit()`
   - useEffect de recálculo de simulação

2. **Adicionado:**
   - Botão "Nível Ouro" com indicador visual (bolinha verde/cinza)
   - Modal "Nível Ouro Tubarão" com design premium
   - Estados `nivelOuroEligibility` e `activeLoanId`
   - Função `handleNivelOuroSubmit()`
   - Verificação automática de elegibilidade no `loadDashboardData()`

#### Componente do Botão:
```tsx
<button
  onClick={() => {
    if (nivelOuroEligibility?.eligible) {
      setIsNivelOuroOpen(true);
    } else {
      addToast(nivelOuroEligibility?.reason || 'Você não está elegível', 'info');
    }
  }}
  disabled={!activeLoanId}
  className="flex flex-col items-center gap-2 py-4 hover:bg-zinc-800/50 disabled:opacity-40 transition-all border-r border-zinc-800 active:scale-95"
>
  <div className={`w-5 h-5 rounded-full ${nivelOuroEligibility?.eligible ? 'bg-green-500' : 'bg-zinc-600'}`}></div>
  <span className="text-[10px] font-semibold text-zinc-300">Nível Ouro</span>
</button>
```

#### Modal do Nível Ouro:
- Design premium com gradiente dourado
- Mensagem fixa sobre disciplina
- Lista de benefícios exclusivos
- Botões de ação (Cancelar / Ativar Agora)

---

## 📧 Notificações Automáticas

### 1. Email para o Cliente
**Assunto:** "🟢 Nível Ouro Tubarão Ativado — Parabéns!"

**Conteúdo:**
- Banner dourado de parabéns
- Detalhes do novo plano (5 parcelas)
- Data da primeira parcela
- Lista de benefícios
- Design premium em HTML

### 2. Notificação no Sistema (Admin)
**Título:** "🟢 Nível Ouro Ativado — [Nome do Cliente]"

**Mensagem:**
```
[Nome] ([CPF]) ativou o Nível Ouro Tubarão!
Contrato: #[ID]

Novo plano: 5x de R$ [valor]
Total: R$ [total]

Cliente completou 12 pagamentos consecutivos em dia! 🎉
```

### 3. WhatsApp para Admins
Todos os admins cadastrados recebem mensagem via WhatsApp com os mesmos detalhes.

---

## 🔄 Fluxo Completo de Uso

### Passo 1: Cliente Acessa Dashboard
- Sistema verifica automaticamente elegibilidade
- Botão "Nível Ouro" aparece com indicador visual

### Passo 2: Cliente Clica no Botão
- **Se elegível:** Abre modal com detalhes
- **Se não elegível:** Mostra toast com motivo

### Passo 3: Cliente Confirma Ativação
- Frontend envia POST para `/api/loans/:loanId/nivel-ouro`
- Backend valida todas as regras
- Cria novo plano de 5 parcelas

### Passo 4: Confirmação
- Cliente recebe toast de sucesso
- Email é enviado automaticamente
- Admins são notificados
- Dashboard é recarregado com novo plano

### Passo 5: Quitação
- Cliente paga as 5 novas parcelas
- Após 5ª parcela paga, contrato é automaticamente fechado (status → PAID)

---

## 🚀 Deploy

### 1. Aplicar Schema no Banco de Dados
```bash
cd ~/backend/backend
npx prisma db push
npx prisma generate
```

### 2. Rebuild do Backend
```bash
npm run build
pm2 restart tubarao-backend
```

### 3. Verificar Logs
```bash
pm2 logs tubarao-backend --lines 50
```

### 4. Deploy do Frontend
O Vercel fará deploy automático após push para GitHub.

---

## 🧪 Testes Recomendados

### Teste 1: Verificar Elegibilidade
```bash
curl -X GET https://api.tubaraoemprestimo.com.br/api/loans/{loanId}/nivel-ouro/eligibility \
  -H "Authorization: Bearer {token}"
```

### Teste 2: Ativar Nível Ouro
```bash
curl -X POST https://api.tubaraoemprestimo.com.br/api/loans/{loanId}/nivel-ouro \
  -H "Authorization: Bearer {token}"
```

### Teste 3: Validações de Erro
- Tentar ativar com menos de 12 pagamentos
- Tentar ativar com parcelas em atraso
- Tentar ativar duas vezes no mesmo contrato
- Tentar ativar em contrato inativo

---

## 📊 Métricas Sugeridas

- Total de ativações do Nível Ouro
- Taxa de conversão (elegíveis vs ativações)
- Tempo médio até ativação (após 12º pagamento)
- Taxa de quitação das 5 parcelas
- Perfil dos clientes que ativam (ticket médio, região, etc)

---

## 🔐 Segurança

- ✅ Autenticação JWT obrigatória
- ✅ Validação de propriedade do empréstimo
- ✅ Verificação de elegibilidade no backend (não confia no frontend)
- ✅ Uso único por contrato (flag `nivelOuroUtilizado`)
- ✅ Auditoria via notificações e logs
- ✅ Transações atômicas no banco de dados

---

## 🐛 Troubleshooting

### Erro: "Pagamentos insuficientes"
**Causa:** Cliente tem menos de 12 pagamentos confirmados
**Solução:** Aguardar até completar 12 pagamentos

### Erro: "Pagamentos com atraso"
**Causa:** Algum dos 12 primeiros pagamentos foi feito após o vencimento
**Solução:** Infelizmente não é elegível (regra de negócio)

### Erro: "Nível Ouro já utilizado"
**Causa:** Cliente já ativou o benefício neste contrato
**Solução:** Benefício é único por contrato

### Botão não aparece no dashboard
**Causa:** Nenhum empréstimo ativo encontrado
**Solução:** Verificar se existe empréstimo com status APPROVED

---

## 📝 Changelog

### v1.0 - 20/02/2026
- ✅ Implementação inicial do Nível Ouro Tubarão
- ✅ Remoção completa da funcionalidade de renegociação
- ✅ Validação de 12 pagamentos consecutivos em dia
- ✅ Cálculo automático de 5 parcelas
- ✅ Notificações por email, sistema e WhatsApp
- ✅ Indicador visual de elegibilidade
- ✅ Uso único por contrato
- ✅ Auto-fechamento após quitação

---

## 🎓 Próximas Melhorias

- [ ] Dashboard de métricas do Nível Ouro (admin)
- [ ] Badge especial para clientes que ativaram
- [ ] Histórico de ativações no perfil do cliente
- [ ] Notificação proativa quando cliente se torna elegível
- [ ] Gamificação: progresso visual dos 12 pagamentos
- [ ] Certificado digital de "Cliente Ouro"
- [ ] Benefícios adicionais para clientes Ouro (taxas menores, etc)

---

## 👥 Equipe

**Desenvolvido por:** Claude Code (Anthropic)
**Data:** 20/02/2026
**Projeto:** Tubarão Empréstimos

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs do backend: `pm2 logs tubarao-backend`
2. Verificar console do navegador (F12)
3. Consultar esta documentação
4. Testar endpoints via Postman/curl

---

**Fim da documentação** 🦈🟢
