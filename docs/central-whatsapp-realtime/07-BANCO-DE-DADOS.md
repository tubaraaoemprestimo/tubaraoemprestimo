# 07 — Banco de dados

Migração **aditiva**: `backend/prisma/migrations/20261125030000_central_whatsapp/migration.sql` (tudo `IF NOT EXISTS`, em transação). Nenhuma tabela existente alterada. Testada duas vezes em container PostgreSQL 15 isolado (sem rede).

| Tabela | Conteúdo | Chaves/índices |
|---|---|---|
| `wa_conversations` | Uma por (instância, JID): modo, responsável, não lidas, prévia, vínculo de cliente confirmado, `version` | único `(instance, remote_jid)`; `last_message_at DESC`; `(mode, assigned_to)`; `updated_at`; `phone` |
| `wa_messages` | Mensagens (texto, metadados de mídia, origem, status, importada) | único `(instance, external_id)`; único parcial `client_request_id`; `(conversation_id, timestamp DESC)`; `updated_at`; `timestamp` |
| `wa_quick_replies` | Respostas rápidas | — |

Configurações em `system_settings`: `inbox_settings`, `inbox_import`.

- Sem base64 no banco (só MIME e nome).
- `ai_chat_history` preservada intacta (a aba antiga deixou de exibi-la, os dados continuam).
- FK `wa_messages → wa_conversations` com `RESTRICT` (nada apaga histórico em cascata).

Rollback: `rollback.sql` na mesma pasta (remove só as 3 tabelas novas e as chaves `inbox_*`).
