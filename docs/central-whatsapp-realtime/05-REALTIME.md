# 05 — Tempo real

- **Canal**: `GET /api/inbox/stream` (Server-Sent Events) aberto com `fetch` + `Authorization: Bearer` (token não vai na URL).
- **Heartbeat**: comentário a cada 20 s (mantém o túnel Cloudflare aberto). `retry: 5000`.
- **Reconexão**: backoff no cliente; ao reconectar chama `GET /api/inbox/changes?since=<cursor>` e aplica o que perdeu.
- **Fallback**: se o SSE falhar repetidamente, polling a cada 45 s. Barra de status mostra "Tempo real" / "Reconectando" / "Atualização periódica".

| Evento | Uso no painel |
|---|---|
| `message.created` | Nova mensagem na conversa aberta / sobe a conversa na lista |
| `message.updated` / `message.status` | Atualiza status (enviado, entregue, lido) |
| `conversation.updated` / `conversation.assigned` | Modo, responsável, não lidas |
| `notify.human_requested` | Som + destaque "aguardando humano" |
| `instance.connection` | Estado do WhatsApp |

Eventos só são publicados **depois do commit** da transação. Somente administradores autenticados recebem o stream; CORS restrito aos domínios do sistema.
