# 03 — Arquitetura

- **Backend:** `backend/src/routes/legacyClients.ts`, com dois routers:
  - `legacyClientsRouter` → `/api/legacy-clients` (`authenticate` + `requireAdmin` em tudo).
  - `legacyActivationRouter` → `/api/activation` (público; só `check` e `complete`, protegidos pelo token).
- **Régua:** `collectionAutomationService.ts`:
  - filtro `collectionSuspended: false` em todas as etapas (inclusive rollover, auto-heal e multas);
  - `processDueIn7Days`/`processDueIn3Days` (idênticas) unificadas em `processDueInDays(n)`;
  - etapa de 5 dias atrás de flag;
  - opt-out de WhatsApp.
- **Frontend:** `pages/admin/LegacyClients.tsx` (menu "Clientes Antigos", `/#/admin/legacy-clients`) e `pages/ActivateAccount.tsx` (`/#/ativar?c=…`). Reaproveita `apiClient`, os estilos e o mock do modo demo.
- **Reuso:** auth/JWT, `bcryptjs`, `audit_logs`, `sendWhatsAppMessage` (Evolution), catálogo de serviços, `Loan`/`Installment` existentes. Nenhuma dependência nova.
