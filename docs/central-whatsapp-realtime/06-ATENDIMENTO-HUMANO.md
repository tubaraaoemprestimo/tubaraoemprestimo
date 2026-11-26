# 06 — Atendimento humano e IA

## Modos

| Modo | IA responde? | Quem atende |
|---|---|---|
| `AI_ACTIVE` | Sim | IA |
| `WAITING_HUMAN` | Não | Fila (sem responsável) |
| `HUMAN_ACTIVE` | Não | Operador responsável |
| `CLOSED` | Não | — (reabre na próxima mensagem conforme configuração) |

A pausa é **no backend**: `aiAllowed()` relê o modo antes de processar e de novo antes de enviar a resposta. Sem registro de conversa → não responde (falha fechada). As demais conversas seguem com a IA normalmente.

## Ações

| Ação | Regra |
|---|---|
| Assumir | Bloqueada se outro operador já atende. Enviar pelo painel assume automaticamente. |
| Transferir | Destino precisa ser administrador. |
| Liberar para a fila | Volta para `WAITING_HUMAN`. |
| Devolver para IA | `AI_ACTIVE`. A IA **não** responde retroativamente; age só na próxima mensagem. |
| Finalizar | `CLOSED`, arquiva, zera não lidas. |
| Reabrir | `HUMAN_ACTIVE` para quem reabriu. |

Todas usam versão otimista (`version`): se duas pessoas agem ao mesmo tempo, a segunda recebe conflito (409) e a tela recarrega. Cada ação gera auditoria (`WA_*`).

## Pedido de atendente pelo cliente

Palavra-chave de transferência do chatbot → mensagem configurável (`handoffMessage`) + conversa vai para `WAITING_HUMAN` + notificação no painel.

## Réguas de cobrança

Continuam iguais. Opção `pauseRemindersDuringHuman` (padrão **desligada**) permite pular lembretes `INSTALLMENT_DUE_*` enquanto a conversa está em atendimento humano (motivo `EM_ATENDIMENTO_HUMANO`).

## Origem das mensagens

`CLIENTE`, `IA`, `HUMANO` (com operador), `AUTOMACAO` (réguas/templates), `DISPOSITIVO_EXTERNO` (enviada pelo celular/app), `ORIGEM_DESCONHECIDA` (sem prova de origem). Nunca se atribui à IA ou a operador sem registro do próprio sistema.
