# 07 — Deploy (24/11/2026)

Ordem: backend primeiro (o frontend novo só usa rotas que já existiam; o backend novo só restringe acesso), depois frontend.

| Etapa | Resultado |
|---|---|
| Preview Vercel da branch (`e38682a`) | success |
| Backup do build do backend | `/home/ubuntu/dist-backup-pre-manut-20261124-134351` (commit anterior `148574e` no arquivo `COMMIT`) |
| Banco | **sem alteração** (nenhuma migração, nenhum `db push`) |
| Backend: build + `pm2 restart tubarao-backend` (só ele; Evolution e demais intocados) | online, `/api/health` 200, app-api público 200 |
| Smoke test de permissões (token de cliente e de admin gerados na VM, só GET) | cliente 403 em `/api/customers` e `/api/customers/:id`; admin 200; contratos e comprovantes admin 200; `/api/loans` do cliente 200 |
| `main` fast-forward para `e38682a` (sem force) | ok; VM alinhada no `main` |
| Vercel produção | success; bundle publicado contém o código novo |

Observação: o comando de deploy terminou com código 7 (`curl` sem conexão durante o restart, com `set -e`). O build e o restart já tinham concluído; conferido em seguida (código novo carregado, health 200, 0 restarts instáveis).
