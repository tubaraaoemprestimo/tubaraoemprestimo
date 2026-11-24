# 08 — Rollback

Não há mudança de banco, então o rollback é só de código e **não apaga nenhuma operação** feita depois do deploy. **Não restaurar backup de banco** para desfazer esta manutenção.

## Frontend (Vercel)
Painel Vercel → Deployments → deploy de `148574e` → "Promote to Production" (instantâneo).
Ou pelo Git: `git revert e38682a && git push origin main` (gera novo deploy).

## Backend (VM `tubarao-v2`)
```bash
ssh tubarao-vm
cd /home/ubuntu/backend/backend
rm -rf dist && cp -a /home/ubuntu/dist-backup-pre-manut-20261124-134351 dist
pm2 restart tubarao-backend --update-env
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/health   # 200
```
Para manter o Git coerente: `git revert e38682a` no repositório e `git pull` na VM.

## Efeito de reverter
- Volta a abertura de `/api/customers` para qualquer usuário logado (vazamento de dados de clientes).
- Volta a ser possível aprovar o mesmo comprovante duas vezes e aprovar comprovante de parcela já paga.
Reverter só em caso de quebra comprovada; preferir corrigir para frente.
