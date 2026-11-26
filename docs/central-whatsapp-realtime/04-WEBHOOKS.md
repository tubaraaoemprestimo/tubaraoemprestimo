# 04 — Webhooks

## Configuração na Evolution

| Campo | Antes | Depois |
|---|---|---|
| URL | `https://app-api.tubaraoemprestimo.com.br/api/webhook/whatsapp` | **igual** |
| enabled | true | true |
| events | `MESSAGES_UPSERT` | `MESSAGES_UPSERT` (preservado) + `MESSAGES_UPDATE`, `SEND_MESSAGE`, `CONNECTION_UPDATE` |
| headers | — | `x-inbox-secret: <INBOX_WEBHOOK_SECRET>` |
| webhookByEvents / webhookBase64 | false / false | false / false |

O segredo fica só no `.env` do backend e na configuração da Evolution (servidor). Nunca em log, commit ou frontend.

## Processamento (`POST /api/webhook/whatsapp`)

1. Confere instância **e** `x-inbox-secret` (comparação em tempo constante). Falhou → `403`.
2. `handleWebhookEvent` grava (transação) antes de responder.
3. Responde `200`. Erro de gravação → `503` (Evolution reenvia).
4. Chatbot só roda se: evento de mensagem, mensagem **nova** (não duplicada), **recente** (≤ 10 min) e conversa em `AI_ACTIVE` (relido do banco na hora).

| Evento | Efeito |
|---|---|
| `messages.upsert` / `send.message` | Grava mensagem (idempotente por instância + `key.id`). |
| `messages.update` / `send.message.update` | Avança status (nunca regride). |
| `connection.update` | Atualiza saúde e avisa o painel. |

## Duplicidade

- Chave única `(instance, external_id)`.
- Envio pelo painel grava `local:…` e funde com o eco do webhook (`mergeEcho`).
- Reenvio do mesmo `clientRequestId` pelo mesmo operador devolve a mesma mensagem.
