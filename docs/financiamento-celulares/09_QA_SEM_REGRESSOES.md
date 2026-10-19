# 09 — QA e não regressão (19/10/2026)

## Automatizado

| Verificação | Antes | Depois |
|---|---|---|
| Backend `tsc --noEmit` | ok | ok |
| Backend `vitest --run` | 81 passam / 5 falham (interestEngine) | **128 passam** / os mesmos 5 falham |
| Testes InfinitePay de empréstimos (32) | passam | passam |
| Frontend `npm run build` | ok | ok |

Testes novos: `phoneFinancing.test.ts` (14), `phonePayments.test.ts` (12), `appleMdm.test.ts` (12), `serviceKnowledge.test.ts` (6), `phoneCollection.test.ts` (3).

## Migração (Postgres descartável com o schema real de produção)

- Aplica sem erro, cria 22 tabelas, catálogo com 6 serviços e celular desligado.
- Nenhum `DROP`, `TRUNCATE` ou `ALTER` em tabela existente.
- `rollback.sql` remove só as tabelas novas; as 60 tabelas originais permanecem.

## Ponta a ponta (`backend/scripts/phone-financing-e2e.ts`, banco descartável)

13 cenários passaram: catálogo; oferta bloqueada sem jurídico; estoque com serial duplicado recusado e IMEI mascarado; import CSV com dry-run; vitrine sem custo; simulação; proposta com protocolo e bloqueio de 2ª proposta; máquina de estados; reserva simultânea (uma vence); venda com cronograma; entrega só após entrada; baixa manual com 2º admin; visão do cliente; MDM recusa propósito de cobrança e bloqueia tudo após transferência; RBAC; contagem de `loans`, `installments`, `loan_requests` e `payment_charges` **idêntica** antes e depois.

## Servidor completo com todas as flags desligadas (porta isolada, banco descartável)

- `/api/health` 200; `/api/loans`, `/api/loan-requests`, `/api/finance/dashboard`, `/api/customers` 200.
- Webhook InfinitePay com `order_nsu` de empréstimo e com `PH-`: 200, sem erro.
- Catálogo: 6 serviços, celular indisponível.
- Admin de celulares, MDM, nova proposta e pagamento: 404 `FEATURE_DISABLED`.
- Consultas do cliente (`my-contracts`, `my-installments`, `offer`): 200.
- Produção conferida após cada teste: `/api/health` 200; cliente Prisma de produção não foi alterado.

## Não testado (precisa de pessoa, credencial ou aparelho)

- Fluxo nas telas pelo celular (Android/iPhone) de cliente e admin.
- Pagamento real InfinitePay de parcela de celular.
- Conversa real no WhatsApp (instância desconectada).
- Todo o MDM real: ver `08_TESTES_FISICOS.md` (tudo PENDENTE).
- Smoke manual das 5 modalidades de empréstimo depois do deploy.
