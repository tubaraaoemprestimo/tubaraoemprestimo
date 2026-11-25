# 05 — Banco de dados (só acréscimos, autorizado pelo dono em 25/11/2026)

Migração: `backend/prisma/migrations/20261125000000_clientes_antigos/migration.sql` (idempotente, `IF NOT EXISTS`, numa transação).

| Tabela | Acréscimo |
|---|---|
| `customers` | `activation_status TEXT NULL`, `is_legacy BOOL DEFAULT false`, `whatsapp_opt_out BOOL DEFAULT false`, índice parcial |
| `loans` | `is_legacy`, `legacy_reference`, `legacy_original_date`, `legacy_paid_amount`, `legacy_balance_date`, `legacy_balance_confirmed`, `collection_suspended` (defaults false/NULL) + índice único parcial `(customer_id, legacy_reference)` |
| `activation_invites` | tabela nova (hash do token, status, validade, tentativas, datas) |
| `message_templates` | +2 linhas `INSTALLMENT_DUE_5_DAYS` (cópia do aviso de 7 dias com "5 dias"), inertes sem a flag |

Nenhuma coluna alterada ou removida, nenhum dado existente modificado. Os registros atuais ficam com `is_legacy=false` e `collection_suspended=false`, então o comportamento é idêntico ao de hoje.

**Ensaio:** backup de 25/11 03:00 restaurado num Postgres descartável; migração aplicada 2× (a segunda sem efeito); a régua conta 151 cobranças abertas e considera 148 (151 − 3 legadas suspensas do teste).
