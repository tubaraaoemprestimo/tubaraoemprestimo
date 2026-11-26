# 03 — Evolution API

Versão: **v2.3.7**. Instância: a configurada em `whatsapp_config.instance_name` (Tubarao). Chave só no backend (`whatsapp_config` / env), nunca em `VITE_*`.

| Uso na central | Rota Evolution | Observação |
|---|---|---|
| Importar conversas | `POST /chat/findChats/{inst}` | Só leitura. |
| Importar mensagens | `POST /chat/findMessages/{inst}` | Paginado (100/página, até 400 páginas, pausa 150 ms). |
| Abrir mídia | `POST /chat/getBase64FromMediaMessage/{inst}` | Sob demanda, limite 16 MB, MIME em lista permitida. Visualização única bloqueada (403). |
| Enviar texto | `POST /message/sendText/{inst}` | Com `quoted` quando é resposta. |
| Enviar arquivo | `POST /message/sendMedia/{inst}` | |
| Enviar áudio | `POST /message/sendWhatsAppAudio/{inst}` | Gravado no navegador (MediaRecorder). |
| Saúde | `GET /instance/connectionState/{inst}` | Exibido na barra de status. |

## Limitações reais

- A Evolution só tem o que ela mesma gravou. Conversas anteriores à instância não existem.
- Status de entrega/leitura **não** é gravado no banco da Evolution (`DATABASE_SAVE_MESSAGE_UPDATE=false`). Para o histórico importado, o painel não mostra "lido" (status desconhecido). Só mensagens novas recebem status via `MESSAGES_UPDATE`.
- Contatos `@lid` não têm telefone. O painel não inventa telefone nem vincula contrato por esse identificador.
- Mensagens de visualização única aparecem só como aviso; o conteúdo não é baixado.
