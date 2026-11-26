# 01 — Diagnóstico (25/11/2026)

## Estado encontrado

| Item | Situação |
|---|---|
| Aba "Conversas" (`/#/admin/ai-hub?tab=conversations`) | Lia `ai_chat_history` (só pares pergunta/resposta da IA). Sem mensagens do operador, sem mídia, sem tempo real. |
| Espaços escuros vazios | Listas com `max-h-[500px]`/`max-h-[400px]` dentro de `grid lg:grid-cols-3`; estado vazio `h-full` sem altura no pai; página `min-h-screen pb-32` dentro do `main` rolável do AdminLayout. |
| Webhook Evolution | `POST /api/webhook/whatsapp`, respondia 200 **antes** de processar, sem autenticação. Só `MESSAGES_UPSERT`. |
| Pausa da IA | Não existia por conversa. Só o chatbot global ligado/desligado. |
| Envio pelo painel | `POST /api/webhook/send` **sem autenticação** (qualquer um podia enviar pela instância). |
| `POST /api/chatbot/message` | Sem autenticação. |
| CORS | Origem não permitida era aceita (callback `true`). |
| Prompt da IA | Recebia dados financeiros do cliente achado por CPF digitado na conversa (vazamento possível a quem digitasse CPF de terceiro). |

## Evolution real

- Imagem `evoapicloud/evolution-api:v2.3.7`, instância empresarial **Tubarao**, URL pública `api.tubaraoemprestimo.com.br` (túnel Cloudflare → `localhost:8080`).
- Banco da Evolution: 1.090 chats, 91.636 mensagens, 7.253 contatos.
- JIDs: `@s.whatsapp.net` (telefone), `@lid` (identificador sem telefone), `@g.us` (grupos).
- `DATABASE_SAVE_MESSAGE_UPDATE=false` → a Evolution **não guarda** status de entrega/leitura do histórico; `status` vem `null` nos registros antigos.
- Rotas usadas: `chat/findChats`, `chat/findMessages`, `chat/getBase64FromMediaMessage`, `message/sendText`, `message/sendMedia`, `message/sendWhatsAppAudio`, `instance/connectionState`. Webhook aceita cabeçalhos customizados (`webhook.headers`).

## Recursos da VM (tubarao-v2)

12 GB RAM (~9,6 GB livres), 2 núcleos ARM, PM2 fork 1 instância (~310 MB). Barramento de eventos em memória é suficiente; Redis **não** instalado (desnecessário).
