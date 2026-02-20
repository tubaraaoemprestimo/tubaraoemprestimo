# 📧 Guia de Integração - Template Service

## Como usar o Template Service para automação

O `templateService` dispara automaticamente templates via **Email, WhatsApp, Push Notification e Notificação do Sistema**.

---

## 🚀 Uso Básico

```typescript
import { templateService } from '../services/templateService';

// Disparar template para um destinatário
await templateService.triggerTemplate(
  'INSTALLMENT_DUE_7_DAYS',  // Trigger event
  {
    email: 'cliente@email.com',
    phone: '11999999999',
    userId: 'user-id',
    customerId: 'customer-id'
  },
  {
    nome: 'João Silva',
    valor: '500.00',
    data_vencimento: '27/02/2026',
    pix_key: 'pix@tubarao.com'
  }
);
```

**Resultado:** Envia automaticamente via Email + WhatsApp + Push + Notificação do Sistema

---

## 📋 Exemplos de Integração

### 1. Empréstimo Aprovado

**Arquivo:** `backend/src/routes/loanRequests.ts`

```typescript
// Após aprovar empréstimo
const customer = await prisma.customer.findUnique({ where: { id: request.customerId } });

await templateService.triggerTemplate(
  'LOAN_APPROVED',
  {
    email: customer.email,
    phone: customer.phone,
    userId: customer.id,
    customerId: customer.id
  },
  {
    nome: customer.name,
    valor: formatCurrency(request.amount),
    parcelas: request.installments,
    pix_key: systemPixKey
  }
);
```

---

### 2. Lembrete de Vencimento (7 dias antes)

**Arquivo:** `backend/src/cron/installmentReminders.ts`

```typescript
// No cron job de lembretes
const installmentsDue7Days = await prisma.installment.findMany({
  where: {
    dueDate: {
      gte: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    status: 'PENDING'
  },
  include: { loan: { include: { customer: true } } }
});

for (const installment of installmentsDue7Days) {
  const customer = installment.loan.customer;

  await templateService.triggerTemplate(
    'INSTALLMENT_DUE_7_DAYS',
    {
      email: customer.email,
      phone: customer.phone,
      userId: customer.id,
      customerId: customer.id
    },
    {
      nome: customer.name,
      valor: formatCurrency(installment.amount),
      data_vencimento: formatDate(installment.dueDate),
      pix_key: systemPixKey
    }
  );

  // Delay para evitar rate limiting
  await new Promise(r => setTimeout(r, 1500));
}
```

---

### 3. Parcela em Atraso

**Arquivo:** `backend/src/cron/installmentReminders.ts`

```typescript
// Detectar parcelas em atraso
const overdueInstallments = await prisma.installment.findMany({
  where: {
    dueDate: { lt: new Date() },
    status: 'PENDING'
  },
  include: { loan: { include: { customer: true } } }
});

for (const installment of overdueInstallments) {
  const customer = installment.loan.customer;
  const daysOverdue = Math.floor((Date.now() - installment.dueDate.getTime()) / (1000 * 60 * 60 * 24));

  // Escolher template baseado nos dias de atraso
  const triggerEvent = daysOverdue >= 7 ? 'INSTALLMENT_OVERDUE_7_DAYS' : 'INSTALLMENT_OVERDUE_1_DAY';

  await templateService.triggerTemplate(
    triggerEvent,
    {
      email: customer.email,
      phone: customer.phone,
      userId: customer.id,
      customerId: customer.id
    },
    {
      nome: customer.name,
      valor: formatCurrency(installment.amount),
      data_vencimento: formatDate(installment.dueDate),
      dias_atraso: daysOverdue,
      valor_com_juros: formatCurrency(installment.amount * 1.1), // Exemplo com 10% de juros
      pix_key: systemPixKey,
      telefone_suporte: '(11) 99999-9999'
    }
  );
}
```

---

### 4. Cupom de Parceiro Disparado

**Arquivo:** `backend/src/routes/campaigns.ts`

```typescript
// Ao disparar cupom
const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
const customers = await prisma.customer.findMany({ where: { status: 'ACTIVE' } });

for (const customer of customers) {
  await templateService.triggerTemplate(
    'PARTNER_COUPON',
    {
      email: customer.email,
      phone: customer.phone,
      userId: customer.id,
      customerId: customer.id
    },
    {
      nome: customer.name,
      partner_name: coupon.partnerName,
      code: coupon.code,
      discount: coupon.discount,
      description: coupon.description,
      expires_at: formatDate(coupon.expiresAt)
    }
  );

  await new Promise(r => setTimeout(r, 1500));
}
```

---

### 5. Boas-vindas (Novo Usuário)

**Arquivo:** `backend/src/routes/auth.ts`

```typescript
// Após criar conta
await templateService.triggerTemplate(
  'USER_REGISTERED',
  {
    email: newUser.email,
    phone: newUser.phone,
    userId: newUser.id,
    customerId: newUser.id
  },
  {
    nome: newUser.name,
    email: newUser.email,
    link_app: 'https://www.tubaraoemprestimo.com.br'
  }
);
```

---

### 6. Solicitação de Documentos

**Arquivo:** `backend/src/routes/loanRequests.ts`

```typescript
// Quando empréstimo precisa de documentos
await templateService.triggerTemplate(
  'DOCUMENTS_REQUESTED',
  {
    email: customer.email,
    phone: customer.phone,
    userId: customer.id,
    customerId: customer.id
  },
  {
    nome: customer.name,
    lista_documentos: '• RG ou CNH\n• Comprovante de residência\n• Selfie com documento',
    link_app: 'https://www.tubaraoemprestimo.com.br/upload',
    prazo_dias: '3'
  }
);
```

---

### 7. Oferta Pré-Aprovada

**Arquivo:** `backend/src/services/preApprovalService.ts`

```typescript
// Quando cliente é pré-aprovado
await templateService.triggerTemplate(
  'PRE_APPROVED_OFFER',
  {
    email: customer.email,
    phone: customer.phone,
    userId: customer.id,
    customerId: customer.id
  },
  {
    nome: customer.name,
    valor_pre_aprovado: formatCurrency(preApprovedAmount),
    taxa: '2.5',
    max_parcelas: '12',
    data_validade: formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    link_app: 'https://www.tubaraoemprestimo.com.br'
  }
);
```

---

### 8. Programa de Indicação

**Arquivo:** `backend/src/routes/referrals.ts`

```typescript
// Quando indicação é aprovada
await templateService.triggerTemplate(
  'REFERRAL_PROGRAM',
  {
    email: referrer.email,
    phone: referrer.phone,
    userId: referrer.id,
    customerId: referrer.id
  },
  {
    nome: referrer.name,
    bonus_valor: '50',
    referral_code: referrer.referralCode,
    link_indicacao: `https://www.tubaraoemprestimo.com.br/ref/${referrer.referralCode}`
  }
);
```

---

## 🔄 Disparo em Massa

Para disparar para múltiplos destinatários:

```typescript
const customers = await prisma.customer.findMany({ where: { status: 'ACTIVE' } });

await templateService.triggerTemplateMultiple(
  'CAMPAIGN_DISCOUNT',
  customers.map(c => ({
    email: c.email,
    phone: c.phone,
    userId: c.id,
    customerId: c.id
  })),
  (recipient) => ({
    nome: customers.find(c => c.email === recipient.email)?.name || 'Cliente',
    desconto: '20',
    data_validade: '31/03/2026',
    link_app: 'https://www.tubaraoemprestimo.com.br'
  })
);
```

---

## 📊 Trigger Events Disponíveis

### Cobrança
- `INSTALLMENT_DUE_7_DAYS` - 7 dias antes do vencimento
- `INSTALLMENT_DUE_3_DAYS` - 3 dias antes do vencimento
- `INSTALLMENT_DUE_TODAY` - Vence hoje
- `INSTALLMENT_OVERDUE_1_DAY` - 1 dia de atraso
- `INSTALLMENT_OVERDUE_7_DAYS` - 7+ dias de atraso

### Marketing
- `CAMPAIGN_DISCOUNT` - Campanha de desconto
- `PARTNER_COUPON` - Cupom de parceiro
- `REFERRAL_PROGRAM` - Programa de indicação
- `PRE_APPROVED_OFFER` - Oferta pré-aprovada
- `SYSTEM_NEWS` - Novidades do sistema

### Atendimento
- `AUTO_REPLY_OFF_HOURS` - Resposta automática fora do horário
- `SUPPORT_TICKET_OPENED` - Ticket aberto
- `SUPPORT_TICKET_RESOLVED` - Ticket resolvido
- `DOCUMENTS_REQUESTED` - Solicitação de documentos
- `DOCUMENTS_RECEIVED` - Documentos recebidos

### Sistema
- `USER_REGISTERED` - Boas-vindas
- `EMAIL_VERIFICATION` - Verificação de email
- `PASSWORD_RESET` - Redefinição de senha
- `PROFILE_UPDATED` - Cadastro atualizado
- `SCHEDULED_MAINTENANCE` - Manutenção programada

---

## 🛠️ Funções Auxiliares

### Formatar Moeda
```typescript
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

### Formatar Data
```typescript
function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}
```

---

## ✅ Checklist de Integração

Para cada evento do sistema:

1. [ ] Identificar o trigger event apropriado
2. [ ] Coletar dados do destinatário (email, phone, userId, customerId)
3. [ ] Preparar variáveis do template
4. [ ] Chamar `templateService.triggerTemplate()`
5. [ ] Adicionar delay se for loop (1500ms)
6. [ ] Testar envio em todos os canais

---

## 🎯 Resultado

Cada chamada de `triggerTemplate()` envia automaticamente:

✅ **Email** - Se tiver template de email e recipient.email
✅ **WhatsApp** - Se tiver template de WhatsApp e recipient.phone
✅ **Push Notification** - Se tiver template de notification e recipient.userId
✅ **Notificação do Sistema** - Se tiver recipient.customerId (sempre cria)

**Tudo automático, em um único comando!** 🚀
