# 09 — Testes

## Automatizados (executados 26/11/2026)

| Verificação | Resultado |
|---|---|
| Backend `tsc -p tsconfig.json` | OK, 0 erros |
| `prisma validate` / `generate` | OK |
| `inbox.test.ts` (18 testes novos) | **18/18** |
| Suíte backend completa | **176 aprovados / 5 falhas preexistentes** |
| Frontend `vite build` | OK |
| Migração em PostgreSQL 15 isolado (2×) | OK, 3 tabelas, idempotente |

As 5 falhas são `interestEngine.bug.test.ts` / `interestEngine.fix.test.ts` (fórmula AUTONOMO). Já falhavam antes desta manutenção, não tocam código alterado aqui e **não foram modificadas** (regra: não ajustar testes financeiros do Autônomo para aprovar).

### Cobertura de `inbox.test.ts`

- Webhook recusa segredo ausente/curto/errado e instância diferente (`'OPEN'`, `''`, `false`, `null`).
- `@lid` não vira telefone; grupo, broadcast, newsletter e JID inválido ignorados.
- Mídia guarda só id/MIME (sem binário); visualização única detectada em todas as variantes.
- Status nunca regride; falha só antes de sair do aparelho.
- Tokens/senhas mascarados.
- `aiAllowed` falso para `WAITING_HUMAN`, `HUMAN_ACTIVE`, `CLOSED` e conversa inexistente.

## Interface (Playwright, dados fictícios do modo demo)

7 larguras: 1920, 1440, 1280, 768, 430, 390, 360. 7 telas cada = **49 prints** em `prints/`.

Verificado em todas: lista visível, campo de mensagem visível, assumir, envio aparece, transferir, rótulos de origem, ficha 360°, **sem rolagem lateral**, 0 erros de console.

## Não executado

- **Envio real de WhatsApp**: sem número autorizado. Nenhuma mensagem real foi enviada nos testes.
- Login cliente / contratos / pagamentos: código financeiro não alterado nesta entrega; cobertos pela suíte existente.
