# 10 — Deploy (26/11/2026)

| Passo | Horário (UTC) | Resultado |
|---|---|---|
| Estado anterior registrado | 12:20 | VM na branch `manutencao/pendencias-legados-2026-11-25` (`8ba9dfa`); Vercel `main` = `de40933`; PM2 `tubarao-backend` online |
| Branch `manutencao/central-whatsapp-2026-11-25` publicada | 12:22 | `0279d4a` |
| Backup | 12:23 | `/home/ubuntu/backups/pre-central-whatsapp-20261126-122315/tubarao_db.dump` (49 MB). **Restaurado em container isolado**, contagens idênticas (customers 2666, loans 72, installments 468, payment_receipts 152, audit_logs 67330) |
| Config do webhook salva | 12:23 | `webhook-antes.json` na pasta do backup |
| Migração `20261125030000_central_whatsapp` | 12:24 | Aplicada via `psql -v ON_ERROR_STOP=1` (transação) + registro em `_prisma_migrations`. 3 tabelas criadas. Nenhuma tabela existente alterada |
| `INBOX_WEBHOOK_SECRET` | 12:24 | 64 hex gerados na VM (`openssl rand`), só no `.env`. Cópia do `.env` anterior no backup |
| Build | 12:24 | `prisma generate` + `tsc` OK |
| Webhook Evolution | 12:24 | Mesma URL, `enabled`, `MESSAGES_UPSERT` preservado + `MESSAGES_UPDATE`, `SEND_MESSAGE`, `CONNECTION_UPDATE` + cabeçalho `x-inbox-secret`. Instância continuou `open` |
| `pm2 restart tubarao-backend --update-env` | 12:24 | Só esse processo. Health OK |
| Frontend | 12:26 | `main` avançado (fast-forward) para `0279d4a`; Vercel publicou (bundle com a central confirmado) |
| Correção UTF-16 (`99322d2`) | 12:31 | Build + restart do mesmo processo; `main` atualizado |
| Importação de histórico (60 dias) | 12:31–12:33 | 16.700 lidas, 2.340 novas (+832 da tentativa anterior = 3.172), 377 conversas |

A ordem webhook → restart foi escolhida porque o código anterior ignorava o cabeçalho e os eventos extras: em nenhum momento o chatbot ficou sem receber mensagens.

## Smoke tests

| Teste | Esperado | Obtido |
|---|---|---|
| `/api/health` | 200 | 200 |
| `/api/inbox/conversations` sem token | 401 | 401 |
| Webhook sem segredo (local e público) | 403 | 403 |
| Webhook com segredo, `connection.update` | 200 | 200 |
| `/api/webhook/send` sem token | 401 | 401 (antes era público) |
| Endpoints admin (`conversations`, `health`, `dashboard`, `settings`, `quick-replies`, `operators`, `changes`) | 200 | 200 |
| `/api/inbox/stream` | `event: hello` | OK |
| CORS origem estranha | sem `Access-Control-Allow-Origin` | OK |
| Evolution `connectionState` | `open` | `open` |

## Importação × efeitos colaterais

- `ai_chat_history` desde 12:24: **0** registros (importação não acionou a IA).
- Nenhum registro de cobrança gerado pela importação.
- Diferença entre mensagens privadas na Evolution (3.891) e gravadas (3.172): a própria Evolution guarda o mesmo `key.id` mais de uma vez (só 3.189 ids distintos), e `protocolMessage` (21) não é mensagem visível. Grupos (12.757) ficam fora por regra.
