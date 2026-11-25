# 09 — Rollback

## Código
- Frontend: reverter o merge na `main` (Vercel publica o anterior) ou "Promote" do deploy anterior na Vercel.
- Backend: `cd /home/ubuntu/backend && git checkout 2d30224 -- . && cd backend && npm run build && pm2 restart tubarao-backend`.
  O código antigo ignora as colunas novas, então pode voltar **sem** desfazer o banco.

## Banco
`backend/prisma/migrations/20261125000000_clientes_antigos/rollback.sql`:
- remove as colunas, a tabela e os 2 templates de 5 dias;
- **aborta sozinho** se já houver cliente antigo, contrato legado/suspenso ou convite gravado (nesse caso, use o backup feito antes da implantação).

Ensaio: backup de 25/11 → migração → rollback → `pg_dump -s` idêntico ao original (a única diferença é o token aleatório `\restrict` que o `pg_dump` gera a cada execução). Na cópia com dados de teste, o rollback abortou como esperado.
