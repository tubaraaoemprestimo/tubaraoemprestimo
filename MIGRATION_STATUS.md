# Documentação da Migração - Supabase para VPS Oracle (PostgreSQL + Node.js)

**Data:** 12/02/2026
**Status:** Em andamento (Fase de deploy do backend e migração do banco)

---

## 1. Infraestrutura Configurada (Oracle Cloud - VPS)
*   **IP:** 136.248.115.113
*   **OS:** Ubuntu 24.04 LTS (Noble Numbat)
*   **Hardware:** 1 vCPU, 1 GB RAM Física + **16 GB Swap** (configurado para evitar OOM).
*   **Docker:** Instalado e rodando.
*   **Cloudflare Tunnel:** Configurado e rodando como serviço (systemd).
    *   api.tubaraoemprestimo.com.br -> http://localhost:8080 (Evolution API)
    *   db-admin.tubaraoemprestimo.com.br -> http://localhost:8888 (Adminer - Gestão do Banco)

## 2. Serviços Rodando (Docker)
Todos os serviços estão rodando via Docker na VPS.

| Serviço | Container Name | Porta Interna | Porta Exposta (Host) | URL Externa (Tunnel) | Credenciais (Padrão) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Evolution API** | `evolution_api` | 8080 | 8080 | https://api.tubaraoemprestimo.com.br | API Key no docker-compose |
| **PostgreSQL** | `tubarao_postgres` | 5432 | 5432 | - | User: `postgres` / Pass: `tubarao123` / DB: `tubarao_db` |
| **Redis** | `evolution_redis` | 6379 | 6379 | - | - |
| **Adminer** | `tubarao_adminer` | 8080 | 8888 | https://db-admin.tubaraoemprestimo.com.br | Sistema: PostgreSQL / Server: `db` |

## 3. O que foi feito nesta sessão
1.  **Acesso à VPS:** Configuramos a chave SSH (ssh-key-2026-02-12.key) e acessamos a VPS.
2.  **Instalação Docker:** Instalamos Docker e Docker Compose.
3.  **Evolution API:** Deploy da Evolution API v2 via docker-compose e configuramos o túnel Cloudflare (api.tubaraoemprestimo.com.br).
4.  **Swap:** Configuramos 16GB de Swap para suportar a carga na VPS de 1GB RAM.
5.  **PostgreSQL + Adminer:** Criamos o arquivo deploy/docker-compose.db.yml, enviamos para a VPS (pasta backend-db) e subimos os containers.
6.  **Tunnel DB Admin:** Adicionamos a rota db-admin no túnel Cloudflare para acesso seguro ao Adminer.
7.  **Backend Setup (Em andamento):**
    *   Enviamos o código do backend (backend/) para a VPS (~/backend).
    *   Instalamos Node.js v20 na VPS.
    *   Configuramos o .env do backend na VPS para apontar para o banco local (postgresql://postgres:tubarao123@localhost:5432/tubarao_db).
    *   Comando atual: estávamos rodando prisma migrate deploy para criar as tabelas no banco de dados novo.

## 4. Próximos Passos (Para a próxima IA)
A próxima IA deve continuar exatamente de onde parou:

1.  **Verificar Migração:** Confirmar se o comando prisma migrate deploy na VPS terminou com sucesso. Se sim, as tabelas foram criadas.
2.  **Iniciar Backend (Node.js):**
    *   Instalar PM2 na VPS.
    *   Rodar o backend com PM2.
    *   Melhor prática: build para JS e executar dist/server.js.
3.  **Expor Backend:**
    *   O backend roda na porta 3001 (conferido no server.ts).
    *   Adicionar rota no Cloudflare Tunnel para o backend.
4.  **Frontend:**
    *   Atualizar VITE_API_URL para a nova URL do backend.
    *   Build/deploy do frontend (Vercel).

## 5. Arquivos Importantes
*   deploy/docker-compose.db.yml: Configuração do Banco de Dados.
*   deploy/evolution-api/docker-compose.yml: Configuração da Evolution API.
*   backend/prisma/schema.prisma: Schema do banco de dados.
*   ssh-key-2026-02-12.key: Chave SSH de acesso à VPS.

---
**Observação Crítica:** A VPS tem apenas 1GB de RAM física. O Swap de 16GB está salvando o dia, mas monitore a performance. Se o backend Node.js for pesado, considere aumentar a VM para o shape ARM (4 OCPU, 24GB RAM) da Oracle se conseguir disponibilidade.

---

## 6. Atualização técnica (12/02/2026 - continuação)
1. **Diagnóstico real da migração Prisma:**
   - O comando prisma migrate status mostrava ausência de migrations em prisma/migrations.
   - O banco tinha apenas a tabela _prisma_migrations vazia.
   - Ou seja: as tabelas de negócio ainda não tinham sido criadas via migration.

2. **Ação executada para concluir schema no PostgreSQL da VPS:**
   - Comando executado na VPS: cd ~/backend && npx prisma db push
   - Resultado: schema sincronizado com sucesso e 32 tabelas criadas (users, customers, loan_requests, loans, etc.).

3. **Correções no código backend para build em produção:**
   - Ajustados tipos em backend/src/routes/chatbot.ts (params phone string/string[]).
   - Ajustados tipos em backend/src/routes/whatsappStatus.ts (params id e query status).
   - Adicionada dependência faltante axios em backend/package.json.

4. **Backend iniciado com PM2 na VPS:**
   - Processo ativo: tubarao-backend.
   - Start executado com dist/server.js.
   - Health local validado em http://127.0.0.1:3001/api/health.

5. **Cloudflare Tunnel atualizado para backend:**
   - Adicionado ingress: app-api.tubaraoemprestimo.com.br -> http://localhost:3001.
   - DNS route criada com cloudflared tunnel route dns.
   - Pode levar alguns minutos para propagação DNS externa.

6. **Estado atual das URLs:**
   - https://api.tubaraoemprestimo.com.br continua apontando para Evolution API.
   - Backend novo está preparado em app-api.tubaraoemprestimo.com.br (aguardando propagação DNS global).

7. **Próximo passo imediato (frontend):**
   - Atualizar VITE_API_URL para https://app-api.tubaraoemprestimo.com.br/api no Vercel quando o DNS resolver.
   - Rodar teste rápido de login e endpoints principais.


---

## 7. Estado atual final (12/02/2026)
- Tabelas no PostgreSQL da VPS: **51** (49 legadas do Supabase + `risk_events` + `_prisma_migrations`).
- Backend Node.js em produção: **online** via PM2 (`tubarao-backend`) na porta 3001.
- Endpoint público do backend: `https://app-api.tubaraoemprestimo.com.br/api/health` (OK).
- Frontend local atualizado para nova API em `.env` (`VITE_API_URL=https://app-api.tubaraoemprestimo.com.br/api`).
- Build frontend validado com sucesso após criação do shim `services/supabaseService.ts`.

### Sobre políticas (RLS)
- As policies do Supabase dependem de `auth.uid()`, schema `auth` e funções auxiliares (`is_admin`, `get_my_customer_id`) que não existem no PostgreSQL puro da VPS.
- Como a autenticação agora é feita no backend (JWT + middleware), foi aplicado o modelo **backend-managed auth**:
  - RLS desabilitado nas tabelas de `public`.
  - Controle de acesso feito pela API (não por acesso direto ao banco).
- Resultado: banco funcional e compatível com Prisma/API sem bloqueios por policy incompatível.
