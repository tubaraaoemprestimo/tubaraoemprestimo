# 10 — Plano de deploy e rollback

## Ordem segura de deploy (não executada ainda)

1. Backup do banco: `docker exec tubarao_postgres pg_dump -U postgres -Fc tubarao_db > /home/ubuntu/backups/pre_celulares_$(date +%F).dump` e conferir tamanho > 0.
2. Backup do build: `cp -r /home/ubuntu/backend/backend/dist /home/ubuntu/dist-backup-pre-celulares`.
3. Aplicar a migração: `docker exec -i tubarao_postgres psql -v ON_ERROR_STOP=1 -U postgres -d tubarao_db < backend/prisma/migrations/20261019000000_phone_financing_mdm/migration.sql`. É uma transação: se falhar, nada fica aplicado.
4. Deploy do backend (pull, `npm run build`, `pm2 restart tubarao-backend`) **sem** nenhuma flag nova no `.env`.
5. Conferir `/api/health`, uma solicitação de empréstimo e o webhook InfinitePay.
6. Push do frontend na `main` (Vercel). Com a oferta desligada, o cliente não vê nada novo; o admin só vê o menu.
7. Ligar flags aos poucos: `PHONE_FINANCING_ADMIN_ENABLED` → cadastrar estoque/condições → revisão jurídica → `PHONE_FINANCING_ENABLED` + ligar oferta → `PHONE_FINANCING_PAYMENT_ENABLED` → `PHONE_FINANCING_WHATSAPP_ENABLED`. MDM só depois da homologação física.

## Rollback

| Nível | Ação | Efeito |
|---|---|---|
| 1. Desligar | remover/zerar as flags no `.env` e `pm2 restart tubarao-backend --update-env` | serviço some; dados e contratos ficam; consultas do cliente continuam |
| 2. Fechar oferta | Admin → Configurações → desligar oferta | some do catálogo, sem reiniciar |
| 3. Código | `mv dist dist-ruim && cp -r /home/ubuntu/dist-backup-pre-celulares dist && pm2 restart tubarao-backend`; no frontend, reverter o commit na Vercel | volta ao código anterior; tabelas novas ficam paradas, sem efeito |
| 4. Banco | `rollback.sql` (mesma pasta da migração) | apaga **só** as tabelas novas. Use apenas sem dados reais de celular, e com backup |

O código antigo funciona com as tabelas novas presentes, e o código novo funciona antes da migração (o catálogo cai no padrão e as rotas de celular respondem desligadas).
