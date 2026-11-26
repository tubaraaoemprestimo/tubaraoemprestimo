# 13 — Relatório final (26/11/2026)

**Produção**: backend `99322d2` (VM, branch `manutencao/central-whatsapp-2026-11-25`), frontend `main` = `99322d2` (Vercel). Backup validado: `/home/ubuntu/backups/pre-central-whatsapp-20261126-122315`.

## Critérios de aceite

| Critério | Status | Evidência |
|---|---|---|
| Novas mensagens chegam sem recarregar | ✅ | SSE emitiu `message.created` / `conversation.updated` no teste pela URL pública do webhook |
| Histórico unificado (enviadas + recebidas) | ✅ | Webhook + `recordOutgoing` (IA, automação, painel) + importação de 60 dias (3.172 mensagens, 377 conversas) |
| Responder pelo painel | ⚠️ código pronto, **envio real não testado** | Falta número autorizado |
| Mesma instância Evolution | ✅ | `Tubarao`, `open` durante todo o deploy; URL do webhook inalterada |
| Assumir conversa / IA para naquela conversa | ✅ | `aiAllowed` relido antes de processar e de enviar; testes 18/18 |
| IA continua nas demais | ✅ | Pausa é por conversa; 377 conversas em `AI_ACTIVE` |
| Devolver à IA | ✅ | `return-ai`, sem resposta retroativa |
| Ouvir áudios / abrir anexos | ✅ código; validar com mídia real | Proxy autenticado, limites 16 MB e MIME |
| Sem duplicidade | ✅ | Mesmo evento enviado 2× → 1 registro |
| Reconexão recupera perdidas | ✅ | `/inbox/changes` com cursor; testado em produção (200) |
| Histórico preservado | ✅ | Nada apagado; `ai_chat_history` intacta |
| Desktop e mobile | ✅ | 49 prints, 7 larguras, sem rolagem lateral |
| Réguas de cobrança | ✅ | Inalteradas; pausa durante atendimento humano opcional e **desligada** |
| Clientes antigos integrados | ✅ | Ficha usa `/legacy-clients/lookup` |
| Contratos e pagamentos íntegros | ✅ | Contagens iguais antes/depois; nenhuma regra financeira alterada |
| Testes | ✅ | Backend 176/181 (5 falhas preexistentes AUTONOMO); central 18/18; builds OK |
| Rollback | ✅ | `11-ROLLBACK.md` |

## Correções de segurança incluídas

`/api/webhook/send` e `/api/chatbot/message` estavam **públicos** → agora exigem admin. Webhook passou a exigir segredo. CORS deixou de aceitar qualquer origem. A IA deixou de receber dados financeiros e consulta por CPF.

## Mudança de comportamento a comunicar

A IA não informa mais valores, parcelas ou situação de contrato pelo WhatsApp: orienta o cliente a usar o aplicativo ou pedir atendente. Era o ponto em que alguém podia digitar o CPF de outra pessoa e obter dados dela.

## Ocorrência durante o deploy

A primeira importação parou em 832 mensagens: o corte da prévia partia emojis e o Prisma recusava o texto. Corrigido em `99322d2` (função `clip` + importação que não para por um registro ruim) e reimportado. Teste de regressão incluído.

## Limitações

- A Evolution desta instância só tem mensagens gravadas até 23/10/2026 (`DATABASE_SAVE_DATA_NEW_MESSAGE=false`). O que aconteceu entre 23/10 e 26/11 **não existe** na Evolution e não pôde ser importado. Daqui para frente o histórico fica nas tabelas da central.
- Status de leitura do histórico não existe na Evolution; o painel não mostra "lido" sem confirmação.
- Contatos `@lid` não têm telefone; vínculo só manual.
- Mensagens antigas enviadas pelo celular aparecem como "Origem desconhecida" (não há prova de quem enviou).

## Pendências

1. **Teste real de envio** (texto, áudio, arquivo, assumir/devolver) com um número autorizado pelo responsável.
2. Primeira mensagem real de cliente após o deploy: não houve tráfego entre 12:24 e 13:02 UTC; o fluxo foi validado com evento sintético pela URL pública.
