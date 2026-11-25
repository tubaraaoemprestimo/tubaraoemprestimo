# 08 — Deploy (25/11/2026)

| Passo | Resultado |
|---|---|
| Backup de produção | `/home/ubuntu/backups/pre-clientes-antigos-20261125-092433/tubarao_db.dump` (48,8 MB, 82 tabelas com dados) |
| Validação do backup | restaurado em container descartável: customers 2661, loans 71, installments 466, transactions 296 — iguais à produção |
| Ensaio da migração | aplicada na cópia restaurada sem erro |
| Migração em produção | `RC=0`; 2 templates de 5 dias inseridos; 0 loans legados/suspensos; contagens inalteradas (2661 clientes, 71 contratos) |
| Backend | VM em `174dcba`, `npm run build` ok, **só** `pm2 restart tubarao-backend` → online, 0 restarts instáveis; `/api/health` 200 |
| Smoke test (somente leitura, token admin de 2 min) | `/api/legacy-clients` 200 (vazio), `/services` 200 (catálogo real); sem token 401 |
| Frontend | `main` = `174dcba` (fast-forward), Vercel publicou 12:30 UTC; bundle contém "Clientes Antigos" e a correção de contratos quitados |

Flags **desligadas** em produção: `LEGACY_WHATSAPP_ENABLED`, `COLLECTION_DUE_5_DAYS_ENABLED`. Nenhum WhatsApp enviado, nenhum cliente antigo cadastrado durante a implantação.

Erro preexistente (não causado por esta mudança): `GET /api/returning-clients` responde 500 porque a tabela `contract_migrations` nunca existiu. Tela antiga "Migração de Contratos" substituída na prática por "Clientes Antigos"; sugestão: remover do menu.
