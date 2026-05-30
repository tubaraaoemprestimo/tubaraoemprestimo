# Guia de Deploy Seguro — Correção do Cálculo de Juros e Rolagem

> **Sistema em PRODUÇÃO.** Todos os passos abaixo são **MANUAIS**. Nenhum foi executado
> automaticamente. Execute fora do horário dos crons (cobrança ~9h; lembretes ~8h/9h),
> de preferência em janela de baixo movimento.
>
> **Escopo de arquivos:** todas as alterações estão na **árvore da raiz** (`pages/`,
> `services/`, `utils/`, `types.ts`) e em `backend/`. A cópia `tubaraoemprestimo-main/`
> **não** faz parte do pipeline e não deve ser usada.

---

## Visão geral das mudanças

**Backend** (`backend/`)
- `src/services/interestEngine.ts` — **NOVO**. Função central pura de cálculo de juros/multa (30% a.m., 7% CLT/Garantia, R$20/dia). Fonte única de verdade.
- `src/services/collectionAutomationService.ts` — usa o engine no cron de cobrança (antes: 10% hardcoded).
- `src/routes/loans.ts` — `generate-payment` usa o engine; gatilho de comissão conta só amortizadoras.
- `src/routes/finance.ts` — correção do ponto residual (`/receipts/:id/approve` não abate principal em rolagem).
- `src/services/templateService.ts` — terminologia por modalidade nas mensagens.
- `src/cron/installmentReminders.ts` — cobrança de atraso usa o valor do engine.
- `prisma/schema.prisma` — **coluna nova aditiva** `Installment.isInterestPayment Boolean @default(false)`.
- `scripts/audit-interest-calculation.ts` — **NOVO**, somente-leitura (auditoria).
- `scripts/backfill-interest-rollover.ts` — **NOVO**, correção de dados (dry-run por padrão).

**Frontend** (raiz)
- `utils/modalityDisplay.ts` — **NOVO**. Decisão de exibição por modalidade.
- `pages/admin/Contracts.tsx`, `pages/admin/Customers.tsx`, `pages/client/Contracts.tsx`, `pages/client/ClientDashboard.tsx` — exibição por modalidade (MOTO conta parcelas; CLT/Garantia mostram saldo + estado do juros).
- `services/reportService.ts` — `paidCount` exclui pagamentos de juros.
- `types.ts` — `isInterestPayment?: boolean` (opcional).

---

## Ordem de deploy (backend ANTES do frontend)

### 0. Backup do banco (OBRIGATÓRIO — ponto de rollback de dados)
Faça um dump/snapshot do PostgreSQL antes de qualquer coisa. Sem isso, não prossiga.

### 1. Schema aditivo
Acessar a VM e aplicar somente a coluna nova (aditiva, com default — backward-compatible):
```bash
ssh -i ssh-key-2026-02-12.key ubuntu@136.248.115.113
# no diretório do backend:
npx prisma db push        # adiciona Installment.is_interest_payment (default false)
```
Por ser aditiva com default, o código atual ignora a coluna — não quebra nada se o deploy do código ainda não tiver subido.

### 2. Deploy do backend
```bash
# ainda na VM, no diretório do backend:
git pull                  # traz o código novo (após push ao GitHub)
npm install               # caso fast-check/vitest entrem como devDeps (não afetam runtime)
npm run build             # gera Prisma Client novo + compila TS
pm2 restart all           # ou o comando específico do serviço
```
Verifique os logs do pm2 após o restart para confirmar que subiu sem erro.

### 3. Auditoria (somente leitura — não altera nada)
```bash
# no diretório do backend:
npx tsx scripts/audit-interest-calculation.ts
# opcional: --json  |  --limit 50
```
Revise o relatório: contratos com saldo amortizado indevidamente (C1), pagamentos de juros contados como pagos (C2) e divergências de cobrança (C3). Confirme o caso da Patricia na lista.

### 4. Backfill em DRY-RUN (não grava)
```bash
npx tsx scripts/backfill-interest-rollover.ts          # dry-run por padrão
```
Confira a lista de contratos que **seriam** corrigidos e os valores antes/depois (ex.: Patricia R$ 700 → R$ 1.000).

### 5. Backfill REAL (grava — só após validar o dry-run)
```bash
npx tsx scripts/backfill-interest-rollover.ts --apply
```
Gera um log em `backend/scripts/backfill-logs/<runId>.json` e imprime o comando de reversão. **Guarde o runId.**

Validação pós-backfill (deve voltar zero contratos problemáticos):
```bash
npx tsx scripts/audit-interest-calculation.ts
```

### 6. Deploy do frontend (Vercel)
```bash
# na sua máquina:
git push                  # Vercel faz redeploy automático
```
O backend já envia `isInterestPayment`; o frontend novo passa a consumir. Frontend antigo apenas ignora o campo (degradação suave).

---

## Pontos de rollback

| Etapa | Como reverter |
|-------|---------------|
| Schema (coluna) | A coluna é aditiva e inerte; pode permanecer. Não precisa remover para reverter o código. |
| Backend | `git checkout <commit-anterior>` → `npm run build` → `pm2 restart all` |
| Backfill de dados | `npx tsx scripts/backfill-interest-rollover.ts --revert <runId> --apply` |
| Frontend | Reverter o commit no GitHub → Vercel redeploy automático |
| Banco (último recurso) | Restaurar o backup do passo 0 |

---

## Checklist de validação manual (pós-deploy)

- [ ] WhatsApp: cobrança de CLT/Garantia em atraso mostra o valor correto (juros 30% + 7% + R$20/dia), não mais "R$ 306".
- [ ] WhatsApp: cobrança de Autônomo mostra juros (sem domingo) + R$20/dia, sem os 7%.
- [ ] Tela Contratos (admin): CLT/Garantia mostram saldo devedor + estado do juros (não "N/N pagas").
- [ ] Tela Contratos: Moto continua mostrando "X/Y parcelas pagas".
- [ ] Caso Patricia: saldo restante voltou para R$ 1.000 e não aparece mais "1/1 pagas".
- [ ] Painel do cliente: saldo devedor coerente com o backend.
- [ ] Pagamento de juros de rolagem: confirma sem abater o principal e gera a próxima parcela de juros.

---

## Notas de segurança

- O backup do banco (passo 0) e o `--apply` do backfill (passo 5) são as únicas ações destrutivas/irreversíveis-sem-backup. Todas as demais são reversíveis.
- A coluna `isInterestPayment` tem default `false`, então qualquer registro antigo é tratado como "não-juros" até o backfill marcar os corretos — comportamento seguro.
- A política de domingo na multa diária do Autônomo é configurável via `SystemSetting("sundayPolicyForFine")` (default `CORRIDO` = comportamento atual). Para excluir domingos, gravar `PULA_DOMINGO`. Não exige deploy.
