# 11 — Rollback

Executar na ordem. Nada aqui apaga dados de clientes, contratos ou histórico da Evolution.

1. **Backend** (VM, `/home/ubuntu/backend`):
   ```bash
   git checkout manutencao/pendencias-legados-2026-11-25   # 8ba9dfa, versão anterior
   cd backend && npm run build && pm2 restart tubarao-backend
   ```
   O código anterior ignora o cabeçalho `x-inbox-secret` e os eventos extras (responde 200 e só processa `messages.upsert`), então a Evolution pode ficar como está.
2. **Webhook Evolution** (opcional, para voltar 100%): `POST /webhook/set/Tubarao` com a mesma URL, `events: ["MESSAGES_UPSERT"]`, sem `headers`. Cópia do JSON original: `/home/ubuntu/backups/<pasta-do-deploy>/webhook-antes.json`.
3. **Frontend**: Vercel → Deployments → promover o deploy de `de40933`, ou `git revert` do merge em `main`.
4. **Banco** (só se precisar remover as tabelas novas — não é necessário para o rollback funcional):
   ```bash
   docker exec -i tubarao_postgres psql -v ON_ERROR_STOP=1 -U postgres -d tubarao_db \
     < backend/prisma/migrations/20261125030000_central_whatsapp/rollback.sql
   ```
   Remove só `wa_conversations`, `wa_messages`, `wa_quick_replies` e as chaves `inbox_*` de `system_settings`.
5. **Restauração total** (último recurso): dump `tubarao_db.dump` da pasta de backup do deploy, com `pg_restore` em banco novo e troca controlada.
