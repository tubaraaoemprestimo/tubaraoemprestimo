# 🐛 BUGS E CORREÇÕES NECESSÁRIAS - Tubarão Empréstimos

**Data:** 17/03/2026
**Reportado por:** Usuário Admin
**Status:** Pendente de correção

---

## 📋 PROBLEMAS IDENTIFICADOS

### 1. ❌ CLT - Carteira de Trabalho não abre
**Problema:** Ao tentar abrir documentos de CLT (Carteira de Trabalho), o sistema não exibe o arquivo.

**Localização:**
- Frontend: `pages/admin/Requests.tsx`
- Backend: `backend/src/routes/loanRequests.ts`

**Causa provável:**
- Campo `workCardUrl` pode estar vazio ou com formato incorreto
- Falta validação se o arquivo existe antes de tentar abrir

**Correção necessária:**
```typescript
// Em Requests.tsx - adicionar validação antes de abrir
const handleViewWorkCard = (request: LoanRequest) => {
    if (!request.workCardUrl) {
        addToast('Carteira de trabalho não enviada', 'warning');
        return;
    }
    setViewingImage({ urls: [request.workCardUrl], title: 'Carteira de Trabalho' });
};
```

---

### 2. ❌ Pedido de documento adicional trava o sistema
**Problema:**
- Admin pede documento adicional
- Sistema muda status para `WAITING_DOCS`
- Cliente não consegue enviar novo documento
- Fica travado com mensagem "está em análise"

**Localização:**
- Backend: `backend/src/routes/loanRequests.ts` (linha ~1535)
- Frontend: `pages/client/Dashboard.tsx` ou wizard

**Causa:**
- Status `WAITING_DOCS` bloqueia o cliente de reenviar documentos
- Não há rota específica para cliente enviar documentos adicionais

**Correção necessária:**

**Backend - Criar nova rota:**
```typescript
// POST /api/loan-requests/:id/upload-additional-docs
loanRequestsRouter.post('/:id/upload-additional-docs', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            supplementalDocUrl,
            addressProofUrl,
            instagramHandle
        } = req.body;

        // Verificar se é o dono da solicitação
        const request = await prisma.loanRequest.findUnique({
            where: { id }
        });

        if (!request || request.userId !== req.user!.id) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        // Atualizar documentos e mudar status de volta para PENDING
        const updated = await prisma.loanRequest.update({
            where: { id },
            data: {
                supplementalDocUrl: supplementalDocUrl || request.supplementalDocUrl,
                addressProofUrl: addressProofUrl || request.addressProofUrl,
                instagramHandle: instagramHandle || request.instagramHandle,
                status: 'PENDING', // Volta para análise
                supplementalUploadedAt: new Date()
            }
        });

        // Notificar admin
        await sendPushToRole('ADMIN', {
            title: '📄 Documentos Adicionais Enviados',
            body: `${request.clientName} enviou os documentos solicitados`,
            data: { type: 'DOCS_UPLOADED', requestId: id }
        });

        res.json({ success: true, request: updated });
    } catch (error) {
        console.error('Erro ao enviar documentos adicionais:', error);
        res.status(500).json({ error: 'Erro ao enviar documentos' });
    }
});
```

**Frontend - Criar componente de upload:**
```typescript
// Em Dashboard.tsx ou criar novo componente AdditionalDocsUpload.tsx
const [uploadingDocs, setUploadingDocs] = useState(false);

const handleUploadAdditionalDocs = async () => {
    setUploadingDocs(true);
    try {
        await apiService.uploadAdditionalDocs(pendingRequest.id, {
            supplementalDocUrl: newDocUrl,
            addressProofUrl: newAddressUrl,
            instagramHandle: newInstagram
        });
        addToast('Documentos enviados! Aguarde nova análise.', 'success');
        loadPendingRequest();
    } catch (error) {
        addToast('Erro ao enviar documentos', 'error');
    }
    setUploadingDocs(false);
};
```

---

### 3. ❌ Documentos enviados não aparecem atualizados para o admin
**Problema:**
- Cliente envia novo documento
- Admin vê apenas o documento antigo
- Não aparece o arquivo novo que o cliente enviou

**Causa:**
- Frontend não está recarregando os dados após upload
- Ou backend não está salvando corretamente o novo arquivo

**Correção necessária:**
```typescript
// Backend - garantir que salva o novo arquivo
data: {
    supplementalDocUrl: supplementalDocUrl || request.supplementalDocUrl, // ✅ Atualiza se vier novo
    supplementalUploadedAt: new Date(), // ✅ Marca data do upload
    status: 'PENDING' // ✅ Volta para análise
}

// Frontend Admin - recarregar após notificação
useEffect(() => {
    const interval = setInterval(() => {
        loadRequests(); // Recarrega a cada 30s
    }, 30000);
    return () => clearInterval(interval);
}, []);
```

---

### 4. ❌ Documentos aprovados não vão para pasta do cliente
**Problema:**
- Admin aprova documentos
- Documentos não aparecem na área "Meus Documentos" do cliente

**Causa:**
- Não há tabela `generated_documents` ou similar
- Documentos ficam apenas na `loan_requests`

**Correção necessária:**
```sql
-- Criar tabela de documentos gerados
CREATE TABLE IF NOT EXISTS customer_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    customer_id TEXT NOT NULL,
    loan_request_id TEXT,
    document_type TEXT NOT NULL, -- 'RG', 'CNH', 'WORK_CARD', 'ADDRESS_PROOF', etc
    document_url TEXT NOT NULL,
    status TEXT DEFAULT 'APPROVED', -- 'PENDING', 'APPROVED', 'REJECTED'
    uploaded_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    approved_by TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

```typescript
// Backend - ao aprovar, copiar para customer_documents
await prisma.customerDocument.create({
    data: {
        customerId: request.userId,
        loanRequestId: request.id,
        documentType: 'WORK_CARD',
        documentUrl: request.workCardUrl,
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: req.user!.id
    }
});
```

---

### 5. ❌ Referências não mostram nome, apenas número
**Problema:**
- No admin, referências aparecem só com número de telefone
- Falta o campo nome

**Localização:**
- Schema Prisma: `prisma/schema.prisma`
- Frontend: `pages/admin/Requests.tsx`

**Correção necessária:**
```prisma
// Em schema.prisma - adicionar campo nome nas referências
model LoanRequest {
    // ... outros campos
    reference1Name String?
    reference1Phone String?
    reference2Name String?
    reference2Phone String?
}
```

```typescript
// Backend - tornar obrigatório no POST
const { reference1Name, reference1Phone, reference2Name, reference2Phone } = req.body;

if (!reference1Name || !reference1Phone) {
    return res.status(400).json({ error: 'Referência 1 (nome e telefone) é obrigatória' });
}

if (!reference2Name || !reference2Phone) {
    return res.status(400).json({ error: 'Referência 2 (nome e telefone) é obrigatória' });
}
```

```typescript
// Frontend wizard - adicionar campo nome
<input
    type="text"
    placeholder="Nome da referência 1"
    required
/>
<input
    type="tel"
    placeholder="Telefone da referência 1"
    required
/>
```

---

### 6. ❌ Falta notificação de aprovação de contraproposta
**Problema:**
- Admin aprova com novo valor
- Cliente aceita
- Admin não recebe notificação de que está tudo certo
- Não tem onde enviar comprovante de PIX para o cliente

**Correção necessária:**

**Backend - adicionar notificação:**
```typescript
// Após cliente aceitar contraproposta
await sendPushToRole('ADMIN', {
    title: '✅ Contraproposta Aceita',
    body: `${request.clientName} aceitou o valor de R$ ${request.approvedAmount}`,
    data: { type: 'COUNTEROFFER_ACCEPTED', requestId: request.id }
});

// Enviar email para admin
await emailService.send({
    to: 'admin@tubarao.com',
    subject: '✅ Cliente aceitou contraproposta',
    html: `Cliente ${request.clientName} aceitou R$ ${request.approvedAmount}. Faça o PIX e envie o comprovante.`
});
```

**Frontend - criar área para enviar comprovante de PIX:**
```typescript
// Em Requests.tsx - adicionar botão "Enviar Comprovante PIX"
{request.status === 'PENDING_ACCEPTANCE' && request.counterofferAccepted && (
    <button onClick={() => openPixUploadModal(request)}>
        <Upload /> Enviar Comprovante PIX
    </button>
)}
```

---

## 🔧 PRIORIDADE DE CORREÇÃO

### 🔴 CRÍTICO (fazer primeiro):
1. ✅ Pedido de documento adicional trava o sistema
2. ✅ Documentos enviados não aparecem atualizados

### 🟡 IMPORTANTE (fazer em seguida):
3. ✅ Referências sem nome
4. ✅ Falta notificação de aprovação
5. ✅ Documentos não vão para pasta do cliente

### 🟢 MENOR PRIORIDADE:
6. ✅ CLT - Carteira de Trabalho não abre

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar rota `/upload-additional-docs` no backend
- [ ] Adicionar campos `reference1Name` e `reference2Name` no schema
- [ ] Criar tabela `customer_documents`
- [ ] Implementar notificações de contraproposta aceita
- [ ] Criar componente de upload de documentos adicionais no frontend
- [ ] Adicionar validação de referências obrigatórias
- [ ] Criar área para admin enviar comprovante PIX
- [ ] Testar fluxo completo: pedido doc → cliente envia → admin aprova

---

**Próximos passos:** Implementar as correções na ordem de prioridade acima.
