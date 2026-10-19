# 01 — Auditoria e baseline (19/10/2026)

Código analisado: branch `main` em `c86a19a`, igual ao que roda na VM `tubarao-v2` (backend em `/home/ubuntu/backend`, PM2 `tubarao-backend`) e na Vercel (frontend). O ZIP antigo não foi usado como fonte.

## Baseline antes de qualquer mudança

| Verificação | Resultado |
|---|---|
| Backend `tsc --noEmit` | sem erros |
| Backend `vitest --run` | 81 passam, **5 falham** (todos `interestEngine`, já falhavam antes; sem relação com este módulo) |
| Frontend `npm run build` | passa |
| Teste do dashboard (`scripts/check-dashboard-kpis.cjs`) | passa |

## Matriz existe / reutilizar / estender / criar

| Item | Onde está | Decisão |
|---|---|---|
| Autenticação (JWT) e papéis | `backend/src/middleware/auth.ts` | **Reutilizar** (`authenticate`, `requireAdmin`) |
| Clientes | `Customer` (`customers`), `cpf` UNIQUE | **Reutilizar** por FK; modelo não alterado |
| Empréstimos | `LoanRequest`, `Loan`, `Installment` | **Não tocar**. Celulares têm tabelas próprias |
| InfinitePay | `services/infinitepay/*`, `routes/infinitepay.ts`, tabela `payment_charges` | **Reutilizar** a mesma conta, cliente HTTP e webhook. Celulares usam `order_nsu` com prefixo `PH-` e tabela própria |
| Webhook InfinitePay | `POST /api/webhooks/infinitepay` | **Estender**: desvio por prefixo `PH-`; resto inalterado |
| Stripe | `routes/checkout.ts`, `routes/webhooks/stripe.ts` | Outro fluxo (cursos/funil). **Não tocado** |
| WhatsApp (Evolution) | `routes/webhook.ts`, `services/whatsapp.ts` | **Estender** o prompt (catálogo + resumo de celular). Sem listener novo |
| Chatbot interno | `routes/chatbot.ts` | **Estender** o prompt com o mesmo catálogo |
| Régua de cobrança | `cron/collectionCron.ts` + `collectionAutomationService.ts` | **Não alterada**. Novo job separado às 9h10, com flag |
| Upload de documentos | `POST /api/upload` → R2 | **Reutilizar** |
| Push para admin | `routes/push.ts` `sendPushToRole` | **Reutilizar** |
| Wizard | `pages/client/Wizard.tsx` | **Estender** mínimo: cartão que leva a outra rota. Etapas não tocadas |
| Solicitações admin | `pages/admin/Requests.tsx` | **Estender** mínimo: botão "Celulares" que leva ao módulo |
| Catálogo de serviços | não existia | **Criar** `service_catalog_entries` |
| Celulares, estoque, vendas, parcelas | não existia | **Criar** (22 tabelas novas) |
| MDM Apple | não existia | **Criar** adaptador + NanoHUB em `infra/mdm` |

## Ambiente

- Banco: PostgreSQL 15 em container `tubarao_postgres`, banco `tubarao_db`. Migrações aplicadas manualmente por SQL (o projeto não usa `prisma migrate deploy`).
- Credenciais: só nomes listados; nenhum valor neste documento.
- Variáveis já usadas que o módulo reaproveita: `INFINITEPAY_HANDLE`, `INFINITEPAY_WEBHOOK_URL`, `INFINITEPAY_REDIRECT_URL`, `JWT_SECRET`, `EVOLUTION_*`, `FRONTEND_URL`.
- Variáveis novas (todas opcionais, tudo desligado sem elas): `PHONE_FINANCING_ENABLED`, `PHONE_FINANCING_ADMIN_ENABLED`, `PHONE_FINANCING_WHATSAPP_ENABLED`, `PHONE_FINANCING_PAYMENT_ENABLED`, `APPLE_MDM_ENABLED`, `APPLE_MDM_REAL_COMMANDS_ENABLED`, `APPLE_MDM_LAB_MODE`, `NANOHUB_URL`, `NANOHUB_API_KEY`, `MDM_WEBHOOK_TOKEN`, `MDM_PUSH_TOPIC`.

## Observação encontrada na auditoria (não corrigida aqui)

A baixa de empréstimos tem pontos frágeis (quitação em lote marca várias parcelas pagas com um único valor; baixa manual aceita valor diferente da parcela). Por isso o módulo de celulares **não reutiliza** `applyApprovedPayment`: aloca o pagamento só na parcela certa e manda excedente para revisão.
