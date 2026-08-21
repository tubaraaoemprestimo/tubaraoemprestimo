# Resumo da Sessão — 21/08/2026

## Contexto
Clientes reportando: não conseguem redefinir senha, enviar documentos, colocar vídeos nem telefones no wizard de solicitação de empréstimo. Investigação completa (leitura de todos os `.md` do projeto + SSH na VM Oracle + código-fonte), 4 bugs confirmados e corrigidos, 1 feature nova, 1 achado de performance documentado (não corrigido ainda).

Commit: `b5a2dd1` (branch `main`), deploy feito em produção (Vercel + PM2 na VM).

---

## Bugs corrigidos

### 1. Redefinir senha — sempre mostrava "Link Expirado"
**Causa raiz**: `pages/auth/ResetPassword.tsx` ainda usava o fluxo do **Supabase Auth antigo** (`api.auth.onAuthStateChange`, evento `PASSWORD_RECOVERY`, `api.auth.updateUser`) — código nunca migrado quando o backend trocou pra JWT próprio (Express + Prisma). `api.auth.onAuthStateChange` nem existe no `apiClient.ts` atual, então a tela nunca detectava sessão válida e caía no timeout de 5s → "Link Expirado", pra 100% dos clientes, sempre.

**Evidência**: reclamação real de cliente via WhatsApp no log de produção ("Não consigo acessar mais o meu cadastro, tento trocar a senha e não consigo trocar").

**Fix**: reescrita a tela pra ler `token` da query string (`useSearchParams`) e chamar `POST /auth/reset-password` (endpoint real, já existia e funcionava no backend — só o frontend nunca chamava ele).

### 2. Upload de vídeo (selfie/residência no wizard) — sempre rejeitado
**Causa raiz**: `components/VideoUpload.tsx` grava vídeo com `MediaRecorder`, que gera mimetype com sufixo de codec (`video/webm;codecs=vp9,opus`). `backend/src/routes/upload.ts` comparava mimetype por **igualdade exata** contra uma lista sem sufixo — nunca dava match. Log de produção tinha 47 ocorrências de `"Tipo de arquivo não permitido"`.

**Fix**: `fileFilter` agora aceita por prefixo (`mimetype === t || mimetype.startsWith(t + ';')`), e a lista ganhou `image/heic`, `image/heif` (fotos padrão de iPhone) e `video/3gpp`.

### 3. `GET /api/documents` — sempre 401 pra qualquer cliente
**Causa raiz**: `backend/src/routes/documents.ts` lia `req.user?.userId`, campo que **nunca existiu** — o middleware de auth seta `req.user.id`. Achado colateral, não reportado pelo cliente mas confirmado ativo.

**Fix**: `req.user?.userId` → `req.user?.id` (2 ocorrências).

### 4. Notificação de novo cliente quebrando no Prisma
**Causa raiz**: `backend/src/routes/auth.ts` (rota `/register`) chamava `prisma.notification.create()` com `actionUrl`, campo que não existe no model `Notification` do schema. Erro engolido silenciosamente (`.catch(() => {})`), mas rodava — e falhava — toda vez que um cliente novo se cadastrava, então admins paravam de receber a notificação interna.

**Fix**: removido o campo `actionUrl` do payload.

## Feature nova
**Busca por nome/email na aba Acessos** (`/admin/security-hub?tab=users`) — `pages/admin/SecurityHub.tsx`. Reaproveita o `searchTerm` já usado nas abas Blacklist/Antifraude do mesmo componente.

## Validação feita antes do deploy
- `tsc --noEmit` limpo nos dois lados (frontend e backend) — os erros pré-existentes em `utils/pdfBuilder.ts`/`utils/contractPdf.ts` foram confirmados como já existentes antes desta sessão (via `git stash`), não relacionados.
- `npm run build` (Vite) e `npm run build` (backend, `tsc`) rodaram limpos.
- Script standalone com 12 asserts cobrindo a lógica exata do `fileFilter` (mimetypes reais de MediaRecorder/HEIC) e do fix `req.user.id` — 12/12 passou, sem tocar em servidor/banco.
- Deploy: push em `main` (Vercel redeploya sozinho) + SSH na VM (`git pull`, `npm run build`, `pm2 restart tubarao-backend`). Health check pós-deploy: `200 OK`.

## Pendente — não resolvido nesta sessão
- **Telefone**: cliente reportou que "não consegue colocar telefone", mas revisão de código (registro, wizard, schema Prisma sem `@unique` em `phone`) não achou bug óbvio. Precisa reprodução manual (qual tela, o que acontece exatamente) pra investigar direito.
- **VM tinha um commit local nunca enviado ao GitHub** (`06a3a4b chore: restore production server routes`, em `backend/src/server.ts`). Preservado no merge do deploy desta sessão, mas ainda não está em `origin/main` — se a VM for reprovisionada do zero a partir do GitHub, esse fix se perde de novo. Recomendo `git push` desse estado da VM pro GitHub numa próxima sessão.

## Achado extra — performance/RAM da VM (não corrigido, só diagnosticado)
Sistema reportado como "lento". Banco de dados está saudável (193MB, 146GB livres em disco, sem query travada, 7 conexões). O problema é a **VM (956MB RAM, 2 vCPUs) sob pressão de memória** — `vmstat` pegou swap ativo em tempo real no momento da investigação. Detalhe completo em memória do Claude (`vm-oracle-recursos.md`) e recapeado abaixo:
- Achado processo **órfão** rodando nativo (fora do Docker): `node dist/main`, root, desde 19/03/2026, ~46MB RAM, **sem escutar em nenhuma porta**, pasta de origem (`/evolution`) nem existe mais no disco. Sobra de antes da Evolution API migrar pra Docker. Seguro de matar, ~46MB liberados — usuário pediu pra não mexer por enquanto.
- 5 containers Docker rodando: `evolution_api` (133MB), `tubarao_postgres` (113MB, é o banco de produção), `evolution_postgres` (24MB), `evolution_redis` (2MB), `tubarao_adminer` (2MB, GUI de admin de banco exposta na porta 8888 — confirmado bloqueada pelo `iptables` do host, não está acessível da internet apesar do bind em `0.0.0.0`).
- Nenhum item isolado é "gordura" óbvia pra cortar sem perder funcionalidade, exceto o processo órfão. VM está genuinamente pequena pro que roda nela.

---
*Sessão conduzida via Claude Code, acesso SSH na VM Oracle (`136.248.115.113`) e leitura de ~90 arquivos `.md` do projeto.*
