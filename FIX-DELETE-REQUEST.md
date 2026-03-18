# ✅ Correção: Erro ao Excluir Solicitação

**Data**: 2026-03-18 14:49
**Status**: ✅ CORRIGIDO

---

## 🐛 Problema Identificado

Ao tentar excluir uma solicitação no painel admin, o sistema retornava erro:

```
Unknown argument `adminNotes`. Available options are marked with ?.
```

---

## 🔍 Causa Raiz

O campo `adminNotes` existe apenas no modelo **`Loan`**, mas o código estava tentando atualizar esse campo no modelo **`LoanRequest`**.

**Estrutura do banco:**
- ✅ `Loan.adminNotes` - Campo existe (linha 383 do schema)
- ❌ `LoanRequest.adminNotes` - Campo NÃO existe

**Código problemático** (`backend/src/routes/loanRequests.ts`):

```typescript
// DELETE endpoint - linha 1880
await prisma.loanRequest.update({
    where: { id },
    data: {
        status: 'CANCELLED',
        adminNotes: `Cancelado: ${reason}` // ❌ Campo não existe em LoanRequest
    }
});

// PUT /pause endpoint - linha 1925
await prisma.loanRequest.update({
    where: { id },
    data: {
        status: 'PAUSED',
        adminNotes: `Pausado (anterior: ${request.status})` // ❌ Campo não existe
    }
});
```

---

## ✅ Solução Implementada

Removido o campo `adminNotes` dos updates de `LoanRequest`:

```typescript
// DELETE endpoint - CORRIGIDO
await prisma.loanRequest.update({
    where: { id },
    data: {
        status: 'CANCELLED' // ✅ Apenas status
    }
});

// PUT /pause endpoint - CORRIGIDO
await prisma.loanRequest.update({
    where: { id },
    data: {
        status: 'PAUSED' // ✅ Apenas status
    }
});
```

**Nota**: O motivo da exclusão/pausa ainda é enviado ao cliente via notificação e WhatsApp, então a informação não é perdida.

---

## 🚀 Deploy

1. ✅ Código corrigido em `backend/src/routes/loanRequests.ts`
2. ✅ Build realizado (`npm run build`)
3. ✅ Deploy via SCP para servidor
4. ✅ PM2 restart #371
5. ✅ Commit: `92081f5`

---

## 🧪 Como Testar

1. Acesse https://www.tubaraoemprestimo.com.br/admin/requests
2. Clique em uma solicitação
3. Clique em "Excluir"
4. Digite um motivo (opcional)
5. Confirme a exclusão
6. ✅ Solicitação deve ser marcada como CANCELLED
7. ✅ Cliente recebe notificação com o motivo

**Teste de Pausar:**
1. Clique em "Pausar" em uma solicitação
2. ✅ Status muda para PAUSED
3. Clique em "Retomar"
4. ✅ Status volta ao anterior

---

## 📊 Arquivos Modificados

- `backend/src/routes/loanRequests.ts` (linhas 1880-1885, 1925-1930)

---

## 🔄 Histórico de Tentativas

1. **Tentativa 1**: Regenerar Prisma Client → Falhou (cache)
2. **Tentativa 2**: Limpar cache Prisma → Falhou (schema desatualizado)
3. **Tentativa 3**: `prisma db pull` → Falhou (código ainda com erro)
4. **Tentativa 4**: Rebuild no servidor → Falhou (TypeScript error em upload.ts)
5. **Tentativa 5**: Fix TypeScript + rebuild → Falhou (adminNotes ainda presente)
6. **Tentativa 6**: Identificar modelo correto → ✅ **SUCESSO**

**Lição aprendida**: Sempre verificar em qual modelo o campo existe antes de usar.

---

## ✅ Status Final

- Backend: 🟢 Online (PM2 restart #371)
- Endpoint DELETE: 🟢 Funcionando
- Endpoint PUT /pause: 🟢 Funcionando
- Endpoint PUT /resume: 🟢 Funcionando
- Notificações: 🟢 Funcionando

---

**Última atualização**: 2026-03-18 14:49
**Commit**: 92081f5
