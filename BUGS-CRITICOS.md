# 🐛 BUGS CRÍTICOS - Tubarão Empréstimos

**Data:** 17/03/2026
**Reportado por:** Usuário Admin
**Status:** EM CORREÇÃO

---

## 🔴 BUGS CRÍTICOS NOVOS (Prioridade Máxima)

### BUG 1: Lógica de Aceite de Contrato Redundante ⚠️

**Problema:**
- Admin aprova exatamente o mesmo valor solicitado (ex: pediu R$ 1000, aprovou R$ 1000)
- Sistema ainda exige que cliente entre no app e "aceite" a proposta
- Isso é desnecessário quando não há contraproposta

**Causa:**
- Lógica de aprovação sempre muda status para `PENDING_ACCEPTANCE`
- Não verifica se `approvedAmount === requestedAmount`

**Solução:**
```typescript
// Em backend/src/routes/loanRequests.ts - rota de aprovação
if (approvedAmount === request.requestedAmount) {
    // Mesmo valor = não precisa aceite do cliente
    status = 'APPROVED'; // ou ativar contrato direto
} else {
    // Valor diferente = contraproposta, precisa aceite
    status = 'PENDING_ACCEPTANCE';
}
```

**Localização:**
- Backend: `backend/src/routes/loanRequests.ts` (rota de aprovação do admin)

---

### BUG 2: Botão de 'Aceitar' Quebrado no Painel do Cliente ⚠️

**Problema:**
- Quando valor é diferente e cliente precisa aceitar contraproposta
- Botão de confirmar no app do cliente não funciona
- Pode estar dando erro 500 no servidor

**Causa:**
- Requisição onClick falhando
- Server Action não está atualizando banco corretamente
- Falta tratamento de erro no frontend

**Solução:**
```typescript
// Frontend - adicionar tratamento de erro
const handleAcceptCounteroffer = async () => {
    try {
        await apiService.acceptCounteroffer(requestId);
        addToast('Proposta aceita com sucesso!', 'success');
        loadPendingRequest();
    } catch (error: any) {
        console.error('Erro ao aceitar:', error);
        addToast(error.response?.data?.error || 'Erro ao aceitar proposta', 'error');
    }
};

// Backend - verificar se rota existe e funciona
loanRequestsRouter.put('/:id/accept-counteroffer', async (req, res) => {
    try {
        const request = await prisma.loanRequest.findUnique({
            where: { id: req.params.id }
        });

        if (!request || request.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        const updated = await prisma.loanRequest.update({
            where: { id: req.params.id },
            data: {
                counterOfferAccepted: true,
                counterOfferAcceptedAt: new Date(),
                status: 'APPROVED' // ou próximo status
            }
        });

        // Notificar admin
        await sendPushToRole('ADMIN', {
            title: '✅ Contraproposta Aceita',
            body: `${request.clientName} aceitou R$ ${request.approvedAmount}`,
            data: { type: 'COUNTEROFFER_ACCEPTED', requestId: request.id }
        });

        res.json({ success: true, request: updated });
    } catch (error) {
        console.error('Erro ao aceitar contraproposta:', error);
        res.status(500).json({ error: 'Erro ao aceitar proposta' });
    }
});
```

**Localização:**
- Frontend: `pages/client/Dashboard.tsx` ou componente de aceite
- Backend: `backend/src/routes/loanRequests.ts`

---

### BUG 3: Envio de Documentos Adicionais Falhando/Invisíveis ⚠️

**Problema:**
- Admin solicita correção de documento (ex: print Instagram incorreto)
- Cliente tem dificuldade de enviar pelo app
- Quando upload funciona do lado do cliente, arquivo não aparece no painel do Admin

**Causa:**
- Rota de upload pode estar falhando
- Frontend não está enviando arquivo corretamente
- Backend não está salvando ou retornando URL atualizada
- Admin não está recarregando dados após upload

**Solução:**
```typescript
// Backend - rota já foi corrigida em /supplemental-upload
// Verificar se está funcionando corretamente

// Frontend Cliente - componente de upload
const handleUploadAdditionalDoc = async (file: File, docType: string) => {
    try {
        setUploading(true);

        // Upload do arquivo
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await apiService.uploadFile(formData);

        // Enviar URL para backend
        await apiService.uploadAdditionalDocs(requestId, {
            [docType]: uploadRes.url
        });

        addToast('Documento enviado! Aguarde análise.', 'success');
        loadPendingRequest();
    } catch (error: any) {
        console.error('Erro ao enviar:', error);
        addToast(error.response?.data?.error || 'Erro ao enviar documento', 'error');
    } finally {
        setUploading(false);
    }
};

// Frontend Admin - recarregar automaticamente
useEffect(() => {
    const interval = setInterval(() => {
        loadRequests(); // Recarrega a cada 30s
    }, 30000);
    return () => clearInterval(interval);
}, []);
```

**Localização:**
- Frontend Cliente: componente de upload de documentos adicionais
- Frontend Admin: `pages/admin/Requests.tsx`
- Backend: `backend/src/routes/loanRequests.ts` (rota `/supplemental-upload` já corrigida)

---

## 📋 BUGS ANTERIORES (já documentados)

### 4. ❌ CLT - Carteira de Trabalho não abre
- Status: Pendente
- Prioridade: Baixa

### 5. ✅ Referências não mostram nome, apenas número
- Status: **CORRIGIDO** (2026-03-17)
- Schema atualizado com campos `reference1Name`, `reference2Name`
- Validação obrigatória implementada
- Aguardando deploy

### 6. ❌ Documentos aprovados não vão para pasta do cliente
- Status: Pendente
- Prioridade: Média

### 7. ❌ Falta notificação de aprovação de contraproposta
- Status: Pendente (será resolvido junto com BUG 2)
- Prioridade: Alta

---

## 🔧 ORDEM DE CORREÇÃO

### 🔴 URGENTE (fazer agora):
1. **BUG 1** - Lógica de aceite redundante
2. **BUG 2** - Botão de aceitar quebrado
3. **BUG 3** - Upload de documentos adicionais

### 🟡 IMPORTANTE (fazer depois):
4. Notificação de contraproposta aceita
5. Documentos não vão para pasta do cliente

### 🟢 MENOR PRIORIDADE:
6. CLT - Carteira de trabalho não abre

---

## 📝 PRÓXIMOS PASSOS

1. Corrigir lógica de aprovação (BUG 1)
2. Implementar/corrigir rota de aceite de contraproposta (BUG 2)
3. Testar upload de documentos adicionais (BUG 3)
4. Deploy das correções
5. Testar fluxo completo em produção

---

**Última atualização:** 2026-03-17 13:35
