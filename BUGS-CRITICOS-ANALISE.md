# 🚨 ANÁLISE DE BUGS CRÍTICOS - Tubarão Empréstimos

**Data:** 17/03/2026 15:58
**Status:** ANÁLISE COMPLETA

---

## 🔍 BUG 1: Erro ao Aceitar Contraproposta (Falso Positivo)

### Problema Identificado:
**Arquivo:** `backend/src/routes/loanRequests.ts` (linha 1344-1356)

```typescript
const loan = await prisma.loan.create({
    data: {
        customerId: updatedRequest.customerId,
        requestId: updatedRequest.id,
        amount: updatedRequest.approvedAmount,
        installmentsCount: updatedRequest.installments,
        remainingAmount: updatedRequest.approvedAmount,
        status: 'APPROVED',
        startDate: new Date(),
        isService: updatedRequest.profileType === 'LIMPA_NOME',
        isInvestment: updatedRequest.profileType === 'INVESTIDOR',
        isLoan: ['CLT', 'AUTONOMO', 'MOTO', 'GARANTIA'].includes(updatedRequest.profileType || '')
        // ❌ FALTA: principalAmount (campo obrigatório no schema)
    }
});
```

**Erro no log:**
```
Argument `principalAmount` is missing.
```

### Causa Raiz:
O schema Prisma exige o campo `principalAmount` mas o código não está enviando.

### Solução:
Adicionar `principalAmount: updatedRequest.approvedAmount` no create do loan.

### Frontend (ClientDashboard.tsx linha 458-468):
```typescript
onClick={async () => {
    try {
        await apiService.acceptCounteroffer(pendingRequest.id);
        addToast('Contrato aceito! Seu crédito está sendo processado.', 'success');
        loadDashboardData(); // ✅ Recarrega dados
    } catch (error: any) {
        console.error('Erro ao aceitar contraproposta:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Erro ao aceitar contrato';
        addToast(errorMsg, 'error');
        // ❌ PROBLEMA: Não recarrega dados em caso de erro
        // A solicitação some porque loadDashboardData() só é chamado no success
    }
}}
```

**Correção Frontend:**
Sempre chamar `loadDashboardData()` no finally, não só no success.

---

## 🔍 BUG 2: Exibição de Parcelas Estática (Hardcoded)

### Problema Identificado:
**Arquivo:** `pages/client/ClientDashboard.tsx` (linha 437)

```typescript
<span className="font-bold text-white">
    {pendingRequest.installments}x de R$ {((pendingRequest.approvedAmount || pendingRequest.amount) / pendingRequest.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
</span>
```

**Problema:**
- Sempre exibe "Nx de R$ X.XX" (formato mensal)
- Ignora `installmentType` (DAILY vs MONTHLY)
- Não mostra "30 diárias" quando configurado pelo admin

### Solução:
Renderização condicional baseada em `installmentType`:

```typescript
{pendingRequest.installmentType === 'DAILY' ? (
    <span className="font-bold text-white">
        {pendingRequest.installments} diárias de R$ {((pendingRequest.approvedAmount || pendingRequest.amount) / pendingRequest.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    </span>
) : (
    <span className="font-bold text-white">
        {pendingRequest.installments}x de R$ {((pendingRequest.approvedAmount || pendingRequest.amount) / pendingRequest.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    </span>
)}
```

---

## 🔍 BUG 3: Upload de Documentos Pendentes Falhando

### Problema Identificado:
**Arquivo:** `backend/src/routes/loanRequests.ts` (linha 1678-1740)

Rota: `PUT /api/loan-requests/:id/supplemental-upload`

```typescript
// Linha 1699-1708: Atualiza documentos
const updated = await prisma.loanRequest.update({
    where: { id },
    data: {
        supplementalDocUrl: docUrl,
        addressProofUrl: addressProof || undefined,
        instagramHandle: instagram || undefined,
        supplementalUploadedAt: new Date(),
        status: 'PENDING' // ✅ Volta para PENDING
    }
});
```

**Problemas:**
1. ✅ Status muda para PENDING (correto)
2. ❌ Não cria notificação para o Admin
3. ❌ Admin não é alertado que documentos foram enviados
4. ❌ Documentos não aparecem automaticamente na tela do admin

### Solução:
Adicionar notificação após upload bem-sucedido (linha 1711-1727 já existe mas pode estar falhando).

---

## 🔍 DEMANDA 1: Notificação de Documentos Solicitados

### Análise:
**Arquivo:** `backend/src/routes/loanRequests.ts` (linha 1711-1727)

```typescript
// ✅ JÁ EXISTE: Notificação push para admin
await sendPushNotification(
    adminUser.id,
    '📄 Documentos Adicionais Enviados',
    `${updated.clientName} enviou os documentos solicitados.`
);

// ✅ JÁ EXISTE: Notificação no banco
await prisma.notification.create({
    data: {
        userId: adminUser.id,
        title: '📄 Documentos Adicionais Enviados',
        message: `${updated.clientName} enviou os documentos solicitados.`,
        type: 'INFO'
    }
});
```

**Status:** ✅ IMPLEMENTADO (verificar se está funcionando)

### Possível Problema:
- Admin pode não estar recebendo push notifications
- Notificações podem não estar aparecendo na UI do admin

---

## 🔍 DEMANDA 2: Sincronização de Dados para Ficha do Cliente

### Problema:
Dados da solicitação (Instagram, Endereço, CEP, Bairro) não atualizam o perfil do cliente.

### Locais para Implementar:

#### 1. Na Criação da Solicitação
**Arquivo:** `backend/src/routes/loanRequests.ts` (após criar loanRequest)

```typescript
// Após criar loanRequest, atualizar customer
if (customerId) {
    await prisma.customer.update({
        where: { id: customerId },
        data: {
            instagram: instagram || undefined,
            street: street || undefined,
            number: number || undefined,
            neighborhood: neighborhood || undefined,
            city: city || undefined,
            state: state || undefined,
            zipCode: zipCode || undefined
        }
    });
}
```

#### 2. Na Aprovação do Contrato
**Arquivo:** `backend/src/routes/loanRequests.ts` (linha 1376-1383)

Adicionar atualização de endereço junto com activeLoansCount:

```typescript
await prisma.customer.update({
    where: { id: updatedRequest.customerId },
    data: {
        activeLoansCount: { increment: 1 },
        totalDebt: { increment: updatedRequest.approvedAmount },
        // ✨ ADICIONAR:
        instagram: updatedRequest.instagramHandle || undefined,
        street: updatedRequest.street || undefined,
        number: updatedRequest.number || undefined,
        neighborhood: updatedRequest.neighborhood || undefined,
        city: updatedRequest.city || undefined,
        state: updatedRequest.state || undefined,
        zipCode: updatedRequest.zipCode || undefined
    }
});
```

---

## 📋 CHECKLIST DE CORREÇÕES

### Backend (loanRequests.ts)

- [ ] **BUG 1:** Adicionar `principalAmount` no create do loan (linha 1344)
- [ ] **BUG 3:** Verificar se notificações estão sendo criadas corretamente (linha 1711-1727)
- [ ] **DEMANDA 2:** Adicionar sync de dados na criação da solicitação
- [ ] **DEMANDA 2:** Adicionar sync de dados na aprovação do contrato (linha 1376)

### Frontend (ClientDashboard.tsx)

- [ ] **BUG 1:** Mover `loadDashboardData()` para finally block (linha 462)
- [ ] **BUG 2:** Adicionar renderização condicional de parcelas (linha 437)

### Testes

- [ ] Testar aceite de contraproposta (deve criar loan com sucesso)
- [ ] Testar exibição de parcelas diárias vs mensais
- [ ] Testar upload de documentos pendentes
- [ ] Verificar se admin recebe notificação de documentos
- [ ] Verificar se dados sincronizam para ficha do cliente

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO

1. **BUG 1 (CRÍTICO):** Corrigir principalAmount no backend
2. **BUG 1 (CRÍTICO):** Corrigir reload no frontend
3. **BUG 2 (ALTO):** Corrigir exibição de parcelas
4. **DEMANDA 2 (MÉDIO):** Implementar sync de dados
5. **BUG 3 (BAIXO):** Verificar notificações de upload

---

**Desenvolvedor:** Claude Code
**Data:** 17/03/2026 15:58
