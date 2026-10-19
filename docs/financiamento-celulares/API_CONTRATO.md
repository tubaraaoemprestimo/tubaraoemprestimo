# Contrato de API — Financiamento de Celulares + Apple MDM

Fonte de verdade para frontend e backend. Base: `/api`. Todas as rotas exigem JWT (`Authorization: Bearer`), exceto quando indicado. Valores monetários sempre em **centavos (inteiro)**. Datas em ISO 8601.

Erro padrão: `{ "error": "mensagem", "code": "CODIGO" }`. Quando o recurso está desligado por flag: HTTP 404 `{ "error": "Recurso indisponível", "code": "FEATURE_DISABLED" }`.

## Catálogo (público autenticado)

`GET /services/catalog?channel=client|whatsapp`
```json
{ "services": [ { "code": "CLT", "label": "Empréstimo CLT", "description": "...", "icon": "Briefcase",
  "sortOrder": 1, "applicationRoute": "/wizard?profile=CLT", "isNew": false, "available": true } ] }
```
Sempre 6 serviços comerciais na ordem: CLT, AUTONOMO, GARANTIA, MOTO, LIMPA_NOME, FINANCIAMENTO_CELULAR. `FINANCIAMENTO_CELULAR.available=false` quando a oferta está desligada (cartão pode aparecer como "Em breve" ou ficar oculto — `visible` decide). INVESTIDOR não entra nesta lista; continua no Wizard como hoje.

## Cliente

- `GET /phone-financing/offer` → `{ enabled, commercialTerms, maxInstallments, minDownPaymentBps, monthlyInterestBps, legalTemplateStatus }` (valores `null` quando o admin não configurou).
- `GET /phone-products` → `{ products: [ { id, brand, line, model, description, imageUrl, skus: [ { id, sku, storage, color, condition, cashPriceCents, financedPriceCents, availableUnits } ] } ] }` (só ativos; `costCents` nunca é exposto).
- `POST /phone-financing/simulate` body `{ skuId, downPaymentCents, installments }` → `{ cashPriceCents, downPaymentCents, financedCents, installmentCents, totalCents, monthlyInterestBps, schedule: [ { number, dueDate, amountCents } ] }`. Erro `OFFER_NOT_CONFIGURED` se não houver juros/prazo aprovados.
- `POST /phone-financing/applications` body `{ skuId?: string, wantsQuote?: boolean, requestedInstallments?: number, requestedDownPaymentCents?: number, monthlyIncomeCents?: number, occupation?: string, notes?: string, documents?: [ { kind, url } ], lgpdConsent: true, termsVersion: string }` → `201 { application: { id, protocol, status } }`. Usa o Customer do usuário logado (sem CPF duplicado). Upload de documentos usa o `POST /upload` existente; aqui só se enviam URLs.
- `GET /phone-financing/my-applications` → `{ applications: [ { id, protocol, status, createdAt, sku: {...} | null, statusLabel } ] }`
- `GET /phone-financing/my-contracts` → `{ sales: [ { id, status, device: { model, storage, color, serialMasked, imeiMasked }, cashPriceCents, downPaymentCents, financedCents, totalCents, installmentsCount, paidCents, balanceCents, nextInstallment: {...} | null, contract: { status, pdfUrl } | null, physicalDeliveryDate, paidOffAt, legalTitleTransferDate } ] }`
- `GET /phone-financing/my-installments` → `{ installments: [ { id, saleId, number, kind, dueDate, amountCents, paidCents, status } ] }`
- `POST /phone-financing/installments/:id/pay` → `{ charge: { id, status, amountCents, checkoutUrl } }` (InfinitePay; flag `PHONE_FINANCING_PAYMENT_ENABLED`).
- `GET /phone-financing/payments/:id` → `{ charge: { id, status, amountCents, paidAt, receiptUrl } }` (reconcilia com payment_check).

Status de proposta e rótulos PT-BR: draft=Rascunho, submitted=Recebida, under_review=Em análise, awaiting_documents=Documentação pendente, approved=Aprovada, rejected=Recusada, contract_pending=Contrato pendente, awaiting_down_payment=Aguardando entrada, ready_for_handover=Aguardando entrega, active=Ativa, cancelled=Cancelada, closed=Encerrada.

## Admin (role ADMIN; flag PHONE_FINANCING_ADMIN_ENABLED)

Prefixo `/admin/phone-financing`.
- `GET /dashboard` → `{ applications: { submitted, under_review, approved, rejected }, inventory: { available, reserved, sold, delivered, returned }, sales: { active, paid_off, in_collection }, receivableCents, receivedCents, overdueCents, mdm: { managed, unmanaged, releasePending } }`
- `GET /settings` / `PUT /settings` body PhoneFinancingSettings (offerEnabled só pode virar true se monthlyInterestBps, maxInstallments, minDownPaymentBps preenchidos **e** legalTemplateStatus=`approved`; senão 400 `OFFER_NOT_READY`).
- `GET /applications?status=&q=` → `{ applications: [ { id, protocol, status, createdAt, customer: { id, name, cpfMasked, phone }, sku, requestedInstallments, requestedDownPaymentCents, documents } ] }`
- `PATCH /applications/:id/status` body `{ status, reason? }` → transição validada pela máquina de estados; 409 `INVALID_TRANSITION`.
- `GET /products` / `POST /products` `{ brand, line?, model, description?, imageUrl? }` / `PATCH /products/:id`
- `POST /products/:id/skus` `{ sku, storage?, color?, condition, costCents, cashPriceCents, financedPriceCents? }` / `PATCH /skus/:id`
- `GET /inventory?status=` → unidades com `serialMasked`, `imeiMasked`, `commercialStatus`, `mdmStatus`, `mdmStatusSource`.
- `POST /inventory` `{ skuId, serialNumber, imei?, imei2?, assetTag?, supplier?, invoiceNumber?, invoiceUrl?, purchasedAt?, storageLocation?, physicalCondition?, legalOwner?, custodian? }` → 409 `DUPLICATE_SERIAL`.
- `POST /inventory/import` body `{ csv: string, dryRun: boolean }` → `{ valid: n, errors: [ { line, message } ], created: n }` (colunas: sku,serial,imei,imei2,invoice,supplier,location).
- `POST /applications/:id/reserve` `{ unitId }` → reserva (expira em 72h); 409 `UNIT_UNAVAILABLE`.
- `POST /sales` body `{ applicationId, unitId, downPaymentCents, installments, firstDueDate }` → cria venda + cronograma (transação atômica).
- `GET /sales?status=` / `GET /sales/:id` (inclui installments, payments, contract, deliveries, releaseCase).
- `POST /sales/:id/contract/generate` → `{ contract: { status: "legal_template_pending" | "generated", templateVersion } }` (bloqueado enquanto template jurídico não aprovado).
- `POST /sales/:id/delivery` `{ deliveredAt, receivedBy, receiptUrl?, notes? }`
- `POST /sales/:id/manual-payment` `{ installmentId, amountCents, receiptUrl, note }` → cria pagamento `MANUAL` aguardando 2ª conferência quando acima do limite.
- `POST /payments/:id/second-approval` → efetiva a baixa manual (outro admin).
- `POST /sales/:id/title-transfer` `{ legalTitleTransferDate }` → abre `PhoneReleaseCase`.
- `PATCH /release-cases/:id/steps/:step` `{ status, evidence }`
- `GET /collection-policy` / `PUT /collection-policy` (subset de settings: reminderDaysBefore, graceDaysAfterDue, contactHour).
- `POST /installments/:id/collection-pause` `{ paused: boolean }`

## Apple MDM (role ADMIN; flag APPLE_MDM_ENABLED)

Prefixo `/admin/mdm`.
- `GET /status` → `{ enabled, adapter: "mock" | "nanohub", realCommandsEnabled, labMode, server: { reachable, version, error? }, pushCert: { topic, notAfter } | null }`
- `GET /devices` / `GET /devices/:id` → `{ device: { id, unitId, serialMasked, enrollmentId, supervised, osVersion, lastSeenAt, ownership, stateSource, abmAssigned } }`
- `POST /devices` `{ unitId, enrollmentId? }` → vincula unidade ao registro MDM.
- `POST /devices/:id/sync` → enfileira DeviceInformation (inventário).
- `GET /devices/:id/capabilities` → `{ commands: [ { requestType, allowed, reason? } ] }`
- `POST /devices/:id/commands` `{ requestType, purpose, idempotencyKey }` → `{ command: { id, status, commandUuid } }`. Só para `ownership=ORG_OWNED`. Comandos sensíveis (EnableLostMode, DisableLostMode, DeviceLock, EraseDevice) exigem `approvedBy` de 2º admin via `POST /commands/:id/approve`. Nenhum comando aceita propósito ligado a cobrança.
- `GET /devices/:id/commands` → histórico.
- `POST /commands/:id/approve` → segundo admin autoriza.
- `POST /devices/:id/release-review` → marca para liberação.
- `POST /webhook` (**sem JWT**, HMAC `X-Hmac-Signature`) — eventos do NanoHUB.
