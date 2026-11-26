# 02 — Arquitetura

```
WhatsApp ⇄ Evolution (instância Tubarao)
              │ webhook (x-inbox-secret)
              ▼
  POST /api/webhook/whatsapp ──► handleWebhookEvent (services/inbox.ts)
              │                      ├─ grava wa_conversations / wa_messages (transação, idempotente)
              │                      └─ publica evento (inboxBus, em memória)
              │ 200 só depois de gravar
              ▼
  chatbot existente (só se mensagem nova, recente e conversa em AI_ACTIVE)

Painel (React) ──fetch SSE──► GET /api/inbox/stream   (eventos ao vivo)
               ──cursor─────► GET /api/inbox/changes  (recupera perdidos após reconexão)
               ──REST───────► /api/inbox/*            (listar, enviar, assumir, ficha 360°)
                                   │
                                   └─► Evolution (sempre pelo backend; chave nunca no navegador)
```

## Componentes

| Arquivo | Papel |
|---|---|
| `backend/src/services/inbox.ts` | Normalização, gravação idempotente, status, saúde, `aiAllowed`, barramento. |
| `backend/src/services/inboxHandoff.ts` | Assumir / transferir / liberar / devolver à IA / finalizar / reabrir com versão otimista e auditoria. |
| `backend/src/services/inboxBoundary.ts` | Autenticação do webhook (tempo constante) e ocultação de segredos em texto. |
| `backend/src/routes/inbox.ts` | API `/api/inbox` (admin). |
| `backend/src/routes/webhook.ts` | Webhook existente, agora grava na central e respeita o modo da conversa. |
| `services/inboxRealtime.ts` | Cliente SSE com reconexão, cursor e fallback por polling. |
| `components/admin/WhatsAppInbox.tsx` | Interface (lista, conversa, ficha, configurações). |

## Decisões

- **Reuso**: mesma instância, mesmo webhook (URL inalterada), mesmo chatbot. Nenhuma integração Evolution paralela.
- **SSE em vez de socket**: unidirecional basta; passa pelo túnel Cloudflare sem configuração extra.
- **Barramento em memória** (ponytail): vale para PM2 fork 1 instância. Se virar cluster, trocar por `LISTEN/NOTIFY` do PostgreSQL. O cursor `/changes` garante que nada depende só da memória.
- **Mídia sob demanda**: só metadados no banco; o binário é buscado na Evolution quando o operador abre (proxy autenticado, sem cache).
