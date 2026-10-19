# 02 — Arquitetura

```
App cliente / Admin (React, Vercel)
        │  /api (JWT)
Backend Express (VM, PM2)
  ├─ módulos existentes (empréstimos, cobrança, WhatsApp, InfinitePay)  ← intactos
  └─ NOVO
     ├─ routes/phoneFinancing.ts   catálogo, cliente, admin
     ├─ services/phoneFinancing/   regras puras, pagamentos, régua, catálogo p/ IA, flags
     ├─ routes/appleMdm.ts         admin MDM + webhook do NanoHUB
     └─ services/appleMdm/         adaptador (mock | NanoHUB) e fila de comandos
                │ HTTP Basic, só 127.0.0.1
        NanoHUB + SCEP (Docker, infra/mdm) ── Apple APNs ── iPhone da empresa
```

## Fronteiras

- **Financeiro × MDM**: nenhum código liga parcela/atraso/pagamento a comando MDM. O serviço de comandos não recebe contrato nem parcela, e recusa propósitos com termos de cobrança. Teste: `appleMdm.test.ts`.
- **Empréstimo × Celular**: tabelas, parcelas, pagamentos, régua e dashboard separados. Teste ponta a ponta confirma que `loans`, `installments`, `loan_requests` e `payment_charges` não mudam.
- **Propriedade**: `ownership=ORG_OWNED` permite comandos; ao registrar a transferência de titularidade vira `RELEASED` e todos os comandos ficam bloqueados.

## Estados

Proposta: `submitted → under_review → approved → contract_pending → (awaiting_down_payment) → ready_for_handover → active → closed`, com `awaiting_documents`, `rejected` e `cancelled`. Transições validadas em `rules.ts`.

Comando MDM: `requested → authorized → queued → dispatched → acknowledged`, ou `failed`/`expired`/`unknown`. Mock para em `queued`. "Acknowledged" só vem do webhook do aparelho.

## Datas separadas na venda

`physicalDeliveryDate` (entrega), `paidOffAt` (quitação financeira), `legalTitleTransferDate` (transferência legal, registrada pelo admin) e `mdmReleasedAt` (checklist de liberação concluído). Pagar 100% **não** transfere a titularidade nem libera o MDM automaticamente.

## Feature flags

Todas desligadas por padrão; só a string `true` liga.

| Flag | Liga |
|---|---|
| `PHONE_FINANCING_ENABLED` | novas propostas e simulação no app |
| `PHONE_FINANCING_ADMIN_ENABLED` | módulo no Admin |
| `PHONE_FINANCING_WHATSAPP_ENABLED` | IA anuncia o serviço como disponível e lê o resumo de celular do cliente |
| `PHONE_FINANCING_PAYMENT_ENABLED` | botão pagar (InfinitePay) e régua de cobrança |
| `APPLE_MDM_ENABLED` | painel MDM (mock) e webhook |
| `APPLE_MDM_REAL_COMMANDS_ENABLED` | comandos reais ao NanoHUB (exige `APPLE_MDM_ENABLED`) |
| `APPLE_MDM_LAB_MODE` | todo comando exige 2º admin |

Mesmo ligadas, o serviço só aparece para o cliente quando o admin liga a oferta, e isso exige juros, prazo, entrada **e** contrato com status jurídico `approved`.

Consultas do cliente (`my-contracts`, `my-installments`, `my-applications`) **não dependem de flag**: desligar nunca esconde contrato ou parcela existente.
