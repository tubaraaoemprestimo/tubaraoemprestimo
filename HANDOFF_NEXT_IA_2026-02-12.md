# HANDOFF - Estado Atual (12/02/2026)

## 1) Objetivo e contexto
Projeto migrado de Supabase para backend Node.js + Prisma + PostgreSQL (Oracle/VPS).
Frontend em Vite/React publicado no Vercel.

Problemas tratados nesta rodada:
- Cadastro criava usuário, mas login retornava "credenciais inválidas".
- Chamadas públicas pré-login retornavam 401 (theme/brand/antifraud).
- Necessidade de conta admin padrão fixa.

---

## 2) Causas raiz identificadas

### 2.1 Login quebrando
- `apiService.auth.signIn` enviava payload no formato errado para `/auth/login`.
- O frontend esperava retorno em shape `{ user, accessToken, refreshToken }`, mas o service retornava `{ data, error }`.
- Resultado: fluxo de login tratava como falha mesmo com backend funcional.

### 2.2 401 no tema/marca antes do login
- Router de settings estava protegido por `settingsRouter.use(authenticate)` global.
- Tela de login/carregamento chama `/api/settings/theme` e `/api/settings/brand` sem token.
- Resultado: 401 no bootstrap visual.

### 2.3 401 no antifraude antes do login
- Front chama `/api/antifraud/risk-count` e `/api/antifraud/risk-event` antes de autenticar.
- Backend não tinha esses endpoints em modo público (compatibilidade pós-migração).

### 2.4 Conta admin padrão
- Seed padrão estava diferente do solicitado pelo dono do projeto.

---

## 3) Correções aplicadas

### 3.1 Auth frontend
Arquivo: `services/apiService.ts`
- `auth.signIn` agora:
  - envia `{ identifier, password }` para `/auth/login`;
  - normaliza retorno para `{ user, accessToken, refreshToken, error }`;
  - salva usuário em `localStorage` quando login OK.

### 3.2 Auth backend
Arquivo: `backend/src/routes/auth.ts`
- Registro passa a criar usuário já ativo (`authId: null`) para compatibilidade com fluxo atual.
- Login aceita `identifier` e fallback `email` no body.
- Removido bloqueio de email não confirmado no login (compatibilidade operacional).

### 3.3 Settings backend
Arquivo: `backend/src/routes/settings.ts`
- Removido bloqueio global do router.
- Leituras públicas liberadas:
  - `GET /api/settings/brand`
  - `GET /api/settings/theme`
- Escritas permanecem protegidas com `authenticate + requireAdmin`.
- Adicionado persistência de tema via `system_settings.key = 'theme'`.

### 3.4 Antifraude backend (compatibilidade)
Arquivo: `backend/src/routes/antifraud.ts`
- Endpoints públicos adicionados:
  - `GET /api/antifraud/risk-count?ip=...`
  - `POST /api/antifraud/risk-event`
- Endpoints sensíveis continuam com `authenticate`:
  - `POST /api/antifraud/log`
  - `POST /api/antifraud/device/check`

### 3.5 Login UI
Arquivo: `pages/auth/Login.tsx`
- Campo identificador ajustado para email.
- `autocomplete` adicionado para reduzir warnings:
  - `username`, `current-password`, `email`.

### 3.6 Admin padrão solicitado
Arquivos:
- `backend/src/seed.ts`
- `pages/auth/Login.tsx` (atalho admin)

Credenciais padrão aplicadas:
- Email: `admin@tubarao.local`
- Senha: `tubarao2026*`

---

## 4) Uploads, buckets e "políticas"

### Situação atual
- Não usa mais Supabase Storage nem buckets com RLS.
- Upload agora é via backend em:
  - `POST /api/upload`
  - `POST /api/upload/base64`
- Arquivos ficam em disco local do backend (`UPLOAD_DIR`, padrão `./uploads`).
- Servidos estaticamente por `GET /uploads/...` via `backend/src/server.ts`.

### Impacto
- "Políticas de bucket" do Supabase não se aplicam mais neste modelo.
- O controle de acesso está no backend/rotas e no ambiente da VPS (Nginx/Cloudflare/firewall).

### Ponto de operação em produção
- Garantir persistência do diretório de uploads no servidor.
- Garantir backup do diretório de uploads + banco.

---

## 5) Validações executadas
- `npm run build` (frontend) -> OK
- `npm run build` em `backend/` -> OK

---

## 6) Pendências e observações não bloqueantes

1. Warning `cdn.tailwindcss.com should not be used in production`
- Hoje a UI depende do Tailwind via CDN em `index.html`.
- Funciona, mas recomendado migrar para pipeline Tailwind local (PostCSS/Tailwind CLI).

2. Permissão de notificação ("Only request notification permission in response to a user gesture")
- Investigar se existe algum fluxo chamando `Notification.requestPermission()` fora de clique.
- Pontos para revisar: `PermissionGate`, `PushPermissionBanner`, `notificationService`.

3. Serviço Worker
- Versão de cache já foi incrementada para evitar cache antigo.

---

## 7) Checklist para próxima IA

1. Deploy backend atualizado na VPS (pull + build + restart PM2).
2. Rodar seed em produção para garantir admin padrão:
   - `npm run db:seed` em `backend/`.
3. Testar fim-a-fim em produção:
   - cadastro novo;
   - login com conta recém-criada;
   - login admin com `admin@tubarao.local` / `tubarao2026*`;
   - carga da tela de login sem 401 para theme/brand;
   - eventos de antifraude sem 401 pré-login;
   - upload de imagem/documento em wizard.
4. Se necessário, revisar CORS na VPS para domínio final do frontend.

---

## 8) Arquivos modificados nesta etapa
- `services/apiService.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/settings.ts`
- `backend/src/routes/antifraud.ts`
- `pages/auth/Login.tsx`
- `backend/src/seed.ts`
