# Plano de Migracao — Supabase -> Oracle Cloud Free
## Migracao Total do Backend

> **Status:** CONCLUIDO (codigo)
> **Inicio:** 2026-02-11
> **Arquitetura Alvo:** Oracle ARM VM (4 OCPU, 24GB RAM) + PostgreSQL + Node.js API

---

## Arquitetura Nova

```
+----------------------------------------------------------+
|                 ORACLE CLOUD (Always Free)                |
|                                                          |
|  +---------------------------------------------------+   |
|  |           ARM VM (4 OCPU, 24GB RAM)               |   |
|  |                                                    |   |
|  |  +----------+  +----------+  +---------------+    |   |
|  |  |PostgreSQL|  | Node.js  |  | Evolution     |    |   |
|  |  |  (DB)    |  |   API    |  | API (WhatsApp)|    |   |
|  |  | :5432    |  | :3001    |  | :8080         |    |   |
|  |  +----------+  +----------+  +---------------+    |   |
|  |                                                    |   |
|  |  +------------------+  +------------------+        |   |
|  |  | uploads/ (files) |  | Nginx (reverse   |        |   |
|  |  | (local storage)  |  | proxy + SSL)     |        |   |
|  |  +------------------+  | :443             |        |   |
|  |                        +------------------+        |   |
|  +---------------------------------------------------+   |
+----------------------------------------------------------+

+-----------+         +--------------+
|  Vercel   | <---->  | Oracle VM    |
| (Frontend)|  HTTPS  | (API + DB)   |
+-----------+         +--------------+
```

---

## Checklist de Migracao

### Fase 1: Backend API (Node.js + Express) - CONCLUIDO
- [x] Estrutura do projeto backend
- [x] Configuracao TypeScript + Express
- [x] Prisma ORM com schema PostgreSQL (25+ modelos + 7 novos)
- [x] Auth: registro, login, logout, reset senha, managed-access
- [x] Auth: JWT tokens + refresh tokens
- [x] Auth: confirmacao de email
- [x] CRUD: users, customers, loan_requests, loans
- [x] CRUD: installments, risk_events, blacklist
- [x] CRUD: campaigns, system_settings, brand_settings
- [x] CRUD: trusted_devices, security_blocks, security_alerts
- [x] CRUD: webauthn_credentials, push_subscriptions
- [x] Upload/download de arquivos (Multer local)
- [x] Webhook WhatsApp (substitui Edge Function)
- [x] Send Push Notification (substitui Edge Function)
- [x] Send Campaign (substitui Edge Function)
- [x] Auto Notifications (substitui Edge Function)
- [x] Post Status WhatsApp (substitui Edge Function)
- [x] CPF Lookup (substitui Edge Function)
- [x] Email Service (substitui Edge Function)
- [x] AI Chatbot (substitui Edge Function)
- [x] Coupons CRUD
- [x] Collection Rules
- [x] Goals Settings
- [x] Packages
- [x] Finance dashboard + transactions + interactions

### Fase 2: Frontend - API Client - CONCLUIDO
- [x] apiClient.ts (Axios com JWT, refresh token, upload)
- [x] apiService.ts (72 funcoes, mesma interface do supabaseService)
- [x] Migrar antifraudService.ts
- [x] Migrar deviceSecurityService.ts
- [x] Migrar biometricService.ts
- [x] Migrar aiChatbotService.ts
- [x] Migrar Login.tsx / Register.tsx / ResetPassword.tsx
- [x] Migrar todos os admin pages (30 arquivos)
- [x] Migrar todos os client pages
- [x] Migrar todos os components
- [x] Migrar BrandContext.tsx
- [x] Atualizar .env e .env.example
- [x] Remover @supabase/supabase-js do package.json
- [x] Remover supabase CLI do devDependencies
- [x] Adicionar axios ao package.json

### Fase 3: Oracle Cloud Setup - SCRIPTS PRONTOS
- [ ] Criar conta Oracle Cloud
- [ ] Provisionar ARM VM (4 OCPU, 24GB RAM)
- [x] Script de setup (deploy/setup-oracle-vm.sh)
- [x] Configuracao Nginx (deploy/nginx.conf)
- [x] PM2 config (deploy/ecosystem.config.js)
- [x] Script de deploy (deploy/deploy.sh)
- [x] Guia completo (deploy/ORACLE_CLOUD_GUIA.md)
- [ ] Configurar SSL (Let's Encrypt)
- [ ] Deploy da API
- [ ] Configurar dominio (api.tubaraoemprestimo.com.br)
- [ ] Testes finais

### Fase 4: Go Live
- [ ] Apontar frontend para nova API (VITE_API_URL no Vercel)
- [ ] Testar todos os fluxos
- [ ] Monitoramento
- [ ] Desativar Supabase

---

## Rotas da API Backend (17 routers)

| Router | Arquivo | Endpoints |
|--------|---------|-----------|
| Auth | auth.ts | register, login, confirm-email, forgot-password, reset-password, refresh, me, update-password, managed-access |
| Users | users.ts | GET /, GET /:id, PUT /:id, DELETE /:id |
| Customers | customers.ts | GET /, GET /:id, PUT /:id, PUT /:id/status, PUT /:id/rates, POST /:id/pre-approval, POST /:id/installment-offer, DELETE /:id/installment-offer, POST /:id/create-user, POST /import, DELETE /bulk, DELETE /whatsapp-leads |
| Loan Requests | loanRequests.ts | GET /, GET /pending, POST /, PUT /:id/approve, PUT /:id/reject, PUT /:id/values, PUT /:id/supplemental, PUT /:id/supplemental-upload |
| Loans | loans.ts | GET /, PUT /:loanId/installments/:id/proof, GET /pre-approval, GET /installment-offer |
| Settings | settings.ts | GET /, PUT /, GET /brand, PUT /brand, GET /whatsapp, PUT /whatsapp, GET /goals, PUT /goals, GET /packages, POST /packages, DELETE /packages/:id, GET /collection-rules, POST /collection-rules, DELETE /collection-rules/:id |
| Upload | upload.ts | POST /, POST /multiple, POST /base64 |
| Webhook | webhook.ts | POST /whatsapp, POST /send |
| Campaigns | campaigns.ts | GET /, POST /, DELETE /:id, GET /active |
| Antifraud | antifraud.ts | POST /log, GET /blacklist/:cpf, POST /device/check |
| Notifications | notifications.ts | GET /, PUT /:id/read, POST /, GET /coupons, GET /coupons/all, POST /coupons, DELETE /coupons/:id |
| Finance | finance.ts | GET /dashboard, GET /transactions, POST /transactions, GET /interactions |
| Email | email.ts | POST /send, POST /test, GET /logs |
| Push | push.ts | POST /register, POST /send, GET /subscriptions, DELETE /subscriptions/:id, GET /vapid-key |
| Chatbot | chatbot.ts | GET /config, PUT /config, GET /history/:phone, POST /message, POST /transfer/:phone, POST /resume/:phone, GET /conversations |
| CPF Lookup | cpfLookup.ts | POST /lookup, POST /validate, GET /check/:cpf |
| WhatsApp Status | whatsappStatus.ts | POST /schedule-status, GET /status-queue, PUT /status/:id, DELETE /status/:id, POST /process-queue, POST /post-now/:id |

---

## Decisao: Por que NAO usar ATP ou LH

- **ATP (Autonomous Transaction Processing)** = Oracle Database, incompativel com Prisma (provider "postgresql")
- **LH (Autonomous Data Warehouse)** = Para analytics, NAO para OLTP
- **ARM VM + PostgreSQL** = Gratis para sempre, 100% compativel com Prisma, 24GB RAM
