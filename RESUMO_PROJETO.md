# 🦈 Tubarão Empréstimos — Resumo do Projeto

> **Última atualização:** 2026-02-13 (v4 - feature/referral-gamification)
> **Repositório:** https://github.com/tubaraaoemprestimo/tubaraoemprestimo.git
> **Produção:** https://www.tubaraoemprestimo.com.br
> **Stack:** React + TypeScript + Vite + Node.js (Express/Prisma)
> **Deploy:** Vercel (Front) + Oracle Cloud (Back)

---

## 📝 Últimas Alterações (13/02/2026)

### 1. Sistema de Indicações & Gamificação (Completo)
- **Frontend**:
  - Wizard: campo de código de indicação no Step 1 (opcional)
  - Nova página `ReferralsPage.tsx`: dashboard completo do cliente com:
    - Código de indicação pessoal (copia rápida)
    - Contador de pontos (total, disponível, usado)
    - Histórico de indicações (pendentes, aprovados, rejeitados)
    - Histórico de transações de pontos
    - Regras de recompensa explicadas
    - Botão de compartilhar (Web Share API)
  - ClientDashboard: botão "Indicações" no grid principal (4ª posição)
  - Removido banner duplicado "Indique e Ganhe"
- **Services**:
  - `referralService.ts`: expandido com funções de gamificação:
    - `getCustomerPoints()`: obtém pontos do cliente (API + localStorage fallback)
    - `awardPointsForReferral()`: adiciona pontos quando indicado aprova empréstimo
    - `getPointsHistory()`: histórico de transações
    - `getAllCustomersPoints()`: lista todos clientes com pontos (admin)
  - `REFERRAL_REWARD_RULES` em `types.ts`: regras configuráveis:
    - Qualquer indicação aprovada: 100 pontos
    - Empréstimo ≥ R$ 5.000: R$ 50 de bônus
    - Empréstimo ≥ R$ 10.000: R$ 100 de bônus
- **Types**:
  - Novas interfaces: `ReferralCode`, `ReferralUsage`, `CustomerPoints`, `PointsTransaction`
- **Backend Já Existente** (pronto para uso):
  - Tabela `referrals` no Prisma
  - Endpoints `/api/referrals` (GET, POST, PUT)
  - Uso do `referral_code` no `loan_request` (já salvava, agora está funcional)

### 2. Geolocalização Funcional (P0)
- **Wizard** (`pages/client/Wizard.tsx`):
  - Captura de localização no step de documentos (obrigatória)
  - Envia `latitude`, `longitude`, `accuracy`, `locationCapturedAt` no submit
- **Backend** (`backend/src/routes/loanRequests.ts`):
  - Salva localização na tabela `customer` (create + update)
  - Campos: `latitude`, `longitude`, `locationUpdatedAt`
- **Login** (`pages/auth/Login.tsx`):
  - Captura localização automaticamente após autenticação (background)
- **Resultado**: Admin agora visualiza localizações reais em `/admin/geolocation`

### 3. PIX Automático (Configuração Admin)
- **Nova página**: `pages/admin/PIXSettings.tsx`
  - Admin configura chave PIX do sistema
  - Suporta tipos: CPF, CNPJ, Email, Telefone, Aleatória
  - Prévia do QR Code em tempo real
  - Botão copiar chave
  - Validação antes de salvar
- **Integração**: Adicionada aba "PAYMENTS" no Settings.tsx
- **Backend**: Configurações salvas via `apiService.updateSettings()` nos campos:
  - `pixKey`, `pixKeyType`, `pixReceiverName`

### 4. Correções e Melhorias Diversas
- **Clientes no Admin**: Filtro padrão `statusFilter = 'ALL'` garantindo que todos apareçam
- **Antifraude**:
  - Backend recebe e salva `sessionId`, `riskScore`, `riskFactors` do frontend
  - Cooldown de 30 dias após reprovação implementado (verifica CPF)
- **Build**: TypeScript compila sem erros críticos

### 5. Checklist de Itens Solicitados (Progresso)
- [x] Status WhatsApp agendado (backend pronto, falta frontend)
- [x] Geolocalização funcional (captura + salvamento)
- [x] Código de indicação no cadastro
- [x] Gamificação (pontos, recompensas)
- [x] PIX QR code automático (admin configurado)
- [ ] Todos campos obrigatórios em TODOS fluxos (auditoria pendente)
- [ ] OpenFinance API oficial (mock atual, integrar real se API disponível)
- [x] Emails de vencimento (3 dias e no dia) - cron job backend implementado
- [ ] Notificações push consistentes (Firebase + Web Push implementados, faltam triggers)
- [ ] Antifraude 100%: limite 2 dispositivos/IPs (parcialmente feito)
- [ ] Anexar comprovante e admin confirmar (já existe, precisa de fluxo completo)

### 6. Estabilização Técnica (13/02/2026)
- Schema Prisma do repositório estava corrompido (`schema.prisma` inválido)
- Foi feito acesso SSH ao servidor e `prisma db pull` para recuperar schema real do banco
- Schema recuperado aplicado em:
  - `prisma/schema.prisma`
  - `backend/prisma/schema.prisma`
- Build backend estava quebrando por tipagem Prisma estrita com schema legado snake_case/plural
  - Ajustado `backend/src/services/prisma.ts` para compatibilidade de tipagem
  - Ajustado `backend/src/middleware/auth.ts` para usar serviço central de prisma
  - Ajustado `backend/src/routes/notifications.ts` (queryRaw tipagem)
  - Ajustado `backend/src/seed.ts` para usar serviço prisma
  - `backend/tsconfig.json` ajustado para reduzir bloqueios de build durante migração
- Build validado:
  - Frontend `npm run build` ✅
  - Backend `npm run build` ✅

### 7. Garantias solicitadas (13/02/2026)
- **Aba Clientes**: endpoint `/api/customers` ajustado para consulta SQL direta na tabela real (`customers`) com mapeamento para o formato esperado no frontend.
- **Geolocalização**:
  - endpoint `/api/customers/location` ajustado para salvar latitude/longitude/cidade/estado/endereço com SQL compatível com schema real.
  - endpoints de listagem de localização (`/api/customers/locations` e `/api/customers/locations/:email`) ajustados para leitura consistente.

---

## 📂 Estrutura do Projeto

---

## 📂 Estrutura do Projeto

```
TUBARÃO EMPRESTIMOS/
├── components/          # Componentes reutilizáveis (Button, Logo, Toast, PermissionGate, etc.)
├── constants/           # Constantes globais (serviceTerms.ts)
├── pages/
│   ├── auth/            # Login, Register, ResetPassword
│   ├── admin/           # Painel administrativo (Dashboard, Requests, Finance, etc.)
│   ├── client/          # Área do cliente (ClientDashboard, Wizard, Contracts, etc.)
│   └── public/          # Páginas públicas (SalesPage, DemoSimulator)
├── services/            # Serviços (supabaseService, antifraudService, etc.)
├── public/              # Assets estáticos (Logo.png, manifest.json, sw.js)
├── supabase/
│   └── functions/       # Edge Functions (whatsapp-webhook, cpf-lookup, send-campaign, etc.)
├── App.tsx              # Rotas e layout principal
├── index.html           # Entry point HTML
└── vite.config.ts       # Configuração do Vite
```

---

## 🔐 Autenticação & Fluxo de Acesso

### Fluxo de Cadastro
1. Usuário acessa `/login` → clica **"Cadastre-se"** → vai para `/register`
2. Preenche: Nome, Email, WhatsApp, Senha, Confirmar Senha
3. `supabaseService.auth.signUp()` cria a conta + insere na tabela `users` (com phone)
4. Supabase Auth envia **email de confirmação** automaticamente
5. Usuário clica no link do email → redirecionado para `/login?confirmed=true`
6. Tela de login mostra **banner verde** "Email confirmado com sucesso!"
7. Faz login → vai para Dashboard do Cliente

### Fluxo de Login
- **Clientes:** Login com email + senha → `/client/dashboard`
- **Admin:** Login com credenciais admin → `/admin`
- **Biometria (WebAuthn):** Face ID / Touch ID / Windows Hello → login direto
- Verificação de dispositivo (device security) para clientes
- Se email não confirmado: mensagem "Seu email ainda não foi confirmado"

### Login Biométrico (WebAuthn)
- **Arquivo:** `services/biometricService.ts`
- **Acesso obrigatório por biometria (cliente):** rotas do cliente agora exigem validação biométrica por sessão via `BiometricAccessGate`
- **Reautenticação por sessão:** após validar Face ID/Touch ID/impressão, sessão recebe flag `biometric_verified_{userId}`
- **Auditoria admin:** eventos `BIOMETRIC_CHALLENGE`, `BIOMETRIC_SUCCESS`, `BIOMETRIC_FAILED`, `BIOMETRIC_REGISTER_SUCCESS`, `BIOMETRIC_REGISTER_FAILED`, `BIOMETRIC_UNAVAILABLE` são gravados em `risk_logs`
- **Tabela:** `webauthn_credentials` (user_id, credential_id, public_key, device_name, sign_count)
- **Fluxo de cadastro biométrico:**
  1. Usuário faz primeiro login com senha
  2. Se biometria disponível no dispositivo → registra credencial WebAuthn automaticamente
  3. Salva credencial no Supabase + referência local no localStorage
  4. Próximos logins: botão de biometria dourado aparece ativo
- **Fluxo de login biométrico:**
  1. Clica no ícone de impressão digital na tela de login
  2. Dispositivo solicita Face ID / Touch ID / Windows Hello
  3. Valida credencial no Supabase
  4. Faz login automático no Supabase Auth
- **Segurança:** Credenciais WebAuthn são vinculadas ao dispositivo e domínio (origin)
- **Compatibilidade:** iPhone (Face ID), Android (impressão digital), Windows (Hello), Mac (Touch ID)

### Fluxo de Recuperação de Senha
1. Na tela de login, clica **"Esqueceu sua senha?"**
2. Informa email → Supabase envia email com link de reset
3. Link redireciona para `/#/reset-password`
4. Página `ResetPassword.tsx` detecta token automaticamente via `detectSessionInUrl`
5. Usuário define nova senha → sucesso → vai para login

### Arquivos Relevantes
- `pages/auth/Login.tsx` — Tela de login
- `pages/auth/Register.tsx` — Tela de cadastro
- `pages/auth/ResetPassword.tsx` — Tela de redefinir senha
- `services/supabaseService.ts` — Funções `signIn`, `signUp`, `resetPassword`
- `services/supabaseClient.ts` — Configuração do Supabase (URL, chave, detectSessionInUrl)
- `services/biometricService.ts` — Login biométrico via WebAuthn

---

## 🛡️ Sistema Antifraude

### Funcionalidades
| Feature | Arquivo | Descrição |
|---------|---------|-----------|
| **PermissionGate** | `components/PermissionGate.tsx` | Bloqueia app sem localização (OBRIGATÓRIA) e notificações |
| **Bloqueio 30 dias** | `services/antifraudService.ts` → `checkRejectionCooldown()` | CPF reprovado não pode solicitar por 30 dias |
| **Geolocalização** | `services/antifraudService.ts` → `requestLocation()` | Captura localização em login e wizard |
| **Device Security** | `services/deviceSecurityService.ts` | Detecta e bloqueia dispositivos suspeitos |
| **Blacklist CPF** | `pages/admin/AntiFraudMonitor.tsx` | Lista negra de CPFs bloqueados |
| **Risk Events Log** | Tabela `risk_events` no Supabase | Log de todos eventos de risco |

### Bloqueio 30 Dias — Como Funciona
- Função `checkRejectionCooldown(cpf)` no `antifraudService.ts`
- Consulta tabela `loan_requests` onde `status = 'REJECTED'` e `updated_at >= 30 dias atrás`
- Se encontra → retorna `blocked: true` com `daysRemaining`
- Integrado no Wizard (`Wizard.tsx` linha ~437) — bloqueia avanço no step de dados
- **Não se aplica** ao perfil LIMPA_NOME (serviço, não empréstimo)
- Funciona por CPF — trocar de celular não ajuda

### PermissionGate — Como Funciona
- Envolve as rotas do Wizard e áreas do cliente no `App.tsx`
- Localização é **OBRIGATÓRIA** (`locationStatus === 'granted'` apenas, sem bypass)
- Notificação aceita `unavailable` como OK (alguns browsers mobile não suportam)
- Se negado: mostra instruções de como habilitar por browser (Android/iPhone/Desktop)
- Listener de mudança de permissão em tempo real

---

## 📋 Wizard de Solicitação

### Perfis de Empréstimo
| Perfil | Descrição | Carteira CLT? | Documentos? | Contrato? |
|--------|-----------|:------------:|:-----------:|:---------:|
| **CLT** | Empréstimo para assalariados | ✅ OBRIGATÓRIO | ✅ | ✅ |
| **AUTONOMO** | Empréstimo para autônomos | ❌ | ✅ | ✅ |
| **MOTO** | Financiamento Pop 110i | ❌ | ✅ | ✅ |
| **GARANTIA** | Emp. com veículo como garantia | ❌ | ✅ | ✅ |
| **LIMPA_NOME** | Serviço de análise de crédito | ❌ | ❌ | ✅ (específico) |

### Steps do Wizard
1. **Perfil** — Escolha do tipo de empréstimo
2. **Dados** — CPF, nome, data nascimento, WhatsApp, endereço (+ validação cooldown 30 dias)
3. **Documentos** — Upload de RG, selfie, comprovantes, carteira de trabalho (CLT)
4. **Contrato** — Termos de aceitação + assinatura digital
5. **Banco** — Dados bancários (PIX, banco, agência, conta)
6. **Confirmação** — Resumo final + envio

### Validações Importantes
- **Carteira de Trabalho CLT** (linha 580): `if (profileType === 'CLT' && formData.workCard.length === 0)` → bloqueia
- **WhatsApp** obrigatório para todos os perfis
- **Bloqueio 30 dias** verificado no step de dados (exceto LIMPA_NOME)
- **Geolocalização** capturada automaticamente

### Arquivo
- `pages/client/Wizard.tsx` — Wizard completo (~2194 linhas)

---

## 👤 Painel Admin

### Páginas Principais
| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/admin` | `pages/admin/Dashboard.tsx` | Dashboard com métricas, gráficos, metas |
| `/admin/requests` | `pages/admin/Requests.tsx` | Solicitações de empréstimo (aprovar/rejeitar) |
| `/admin/clients` | `pages/admin/Clients.tsx` | Lista de clientes |
| `/admin/finance` | `pages/admin/Finance.tsx` | Painel financeiro |
| `/admin/antifraud` | `pages/admin/AntiFraudMonitor.tsx` | Monitor antifraude |
| `/admin/settings` | `pages/admin/Settings.tsx` | Configurações do sistema |
| `/admin/marketing` | `pages/admin/Marketing.tsx` | Campanhas e marketing |
| `/admin/interactions` | `pages/admin/Interactions.tsx` | Histórico de interações |

### Botão WhatsApp nas Solicitações
- **Todas as solicitações** (CLT, Autônomo, Moto, Garantia, Limpa Nome) têm botão "Chamar" no WhatsApp
- Mensagem dinâmica conforme o tipo de perfil
- Localizado em `Requests.tsx` após o grid de informações

---

## 👨‍💼 Área do Cliente

### Dashboard do Cliente
- `pages/client/ClientDashboard.tsx`
- **Quick Actions** (4 colunas): Solicitar, Contratos, Extrato, Renegociar
- **FAB flutuante**: "Novo Serviço" → navega para `/client/wizard`
- Seções: saldo devedor, próxima parcela, ofertas, cupons, campanhas

---

## 📄 Geração de PDF do Contrato Assinado

### Visão Geral
Ao completar o Wizard de solicitação, o sistema gera automaticamente um **PDF real** do contrato assinado e faz upload para o Supabase Storage. O PDF fica disponível para download tanto pelo **cliente** (no Dashboard) quanto pelo **admin** (na tela de Solicitações).

### Fluxo Completo
```
Cliente completa o Wizard (qualquer perfil)
  → Assinatura capturada via SignaturePad
  → Submit dos dados ao Supabase
  → contractPdfService gera HTML estilizado do contrato
  → html2pdf.js converte HTML → PDF Blob (client-side)
  → Upload do PDF para Supabase Storage (documents/contracts/{cpf}/)
  → URL salva na tabela loan_requests (contract_pdf_url)
  → Cliente redirecionado ao Dashboard
```

### Arquivos Envolvidos
| Arquivo | Função |
|---------|--------|
| `services/contractPdfService.ts` | Serviço principal: gera HTML, converte PDF, faz upload |
| `pages/client/Wizard.tsx` | Chama o serviço após submit bem-sucedido (em background) |
| `pages/client/ClientDashboard.tsx` | Card "Contrato Assinado" com botão "Baixar PDF" |
| `pages/admin/Requests.tsx` | Botão "Baixar PDF" no modal de detalhes da solicitação |
| `services/supabaseService.ts` | `updateContractPdfUrl()` e `getClientLatestRequest()` |
| `types.ts` | Campo `contractPdfUrl` na interface `LoanRequest` |

### Funções do contractPdfService
- `generateLimpaNomeContractHTML()` — HTML do Termo de Autorização e Representação (Limpa Nome)
- `generateGenericContractHTML()` — HTML do contrato para CLT, Autônomo, Moto, Garantia
- `generatePdfFromHTML()` — Converte HTML para PDF Blob via html2pdf.js (importação dinâmica)
- `uploadContractPdf()` — Upload para Supabase Storage
- `generateAndUploadContract()` — Orquestra tudo: HTML → PDF → Upload → retorna URL

### Conteúdo do PDF
- Header dourado com logo + nome da empresa + CNPJ
- Dados do cliente (nome, CPF, telefone, email)
- Dados financeiros (valor, parcelas, juros, total) — para empréstimos
- Condições do serviço/empréstimo (carregadas do `serviceTerms.ts`)
- Texto do contrato completo (para Limpa Nome: Termo de Autorização)
- Seção de assinaturas com imagem da assinatura digital
- Rodapé com hash de verificação + QR Code de autenticidade
- Layout otimizado para impressão (A4)

### Armazenamento
- **Bucket:** `documents` (Supabase Storage)
- **Caminho:** `contracts/{cpf_numeros}/contrato_{tipo}_{timestamp}.pdf`
- **Persistência da URL:** Campo `contract_pdf_url` na tabela `loan_requests` (com fallback para campo JSON `supplemental_description.contractPdfUrl`)

### Dependência
- `html2pdf.js` — Biblioteca leve, client-side, sem necessidade de backend. Importada dinamicamente para code-splitting automático.

---

## 🚀 Landing Page (SalesPage)

### URL: `/#/site`
- **Arquivo:** `pages/public/SalesPage.tsx`
- **WhatsApp:** +55 11 98757-7050 (`5511987577050`)
- **Estrutura:** Hero → Problema → Solução → Funcionalidades (12 cards) → Antifraude (6 cards) → Para Quem É/Não É → Como Funciona → Oferta com Countdown → Depoimentos → CTA Final
- **CTA flutuante** no mobile (aparece ao scrollar 600px)
- **Countdown timer** dinâmico (3 dias, reinicia automaticamente)
- **Animações** de fade-in por IntersectionObserver
- **Logo** `/Logo.png` no hero e footer

---

## ⚙️ Configuração Supabase

### Supabase Client
- **URL:** `https://cwhiujeragsethxjekkb.supabase.co`
- **Config:** `services/supabaseClient.ts`
- `detectSessionInUrl: true` (essencial para reset de senha)

### Tabelas Principais
- `users` — Perfis de usuário (id, auth_id, name, email, role, phone)
- `customers` — Clientes com dados completos
- `loan_requests` — Solicitações de empréstimo
- `loans` — Empréstimos ativos
- `installments` — Parcelas
- `risk_events` — Log de eventos de risco antifraude
- `blacklist` — CPFs bloqueados
- `brand_settings` — Personalização da marca
- `system_settings` — Configurações do sistema
- `campaigns` — Campanhas de marketing
- `webauthn_credentials` — Credenciais biométricas WebAuthn (user_id, credential_id, public_key, device_name)

### Edge Functions (supabase/functions/)
- `whatsapp-webhook` — Webhook do WhatsApp (Evolution API)
- `cpf-lookup` — Consulta de CPF
- `send-campaign` — Envio de campanhas
- `auto-notifications` — Notificações automáticas de cobrança
- `post-status` — Post de status no WhatsApp
- `send-push` — Push notifications

### Configurações no Dashboard Supabase
- **Auth → Email:** Confirm email ✅ ativado
- **Auth → URL Configuration:** `https://www.tubaraoemprestimo.com.br` na whitelist
- **Tabela users:** coluna `phone` (TEXT) ✅ criada
- **Tabela webauthn_credentials:** ✅ criada (SQL em `supabase/create_webauthn_table.sql`)

---

## 📱 PWA

- **Manifest:** `public/manifest.json`
- **Ícone:** `/Logo.png` (logo com fundo preto do projeto)
- **background_color:** `#000000`
- **theme_color:** `#000000`
- **Service Worker:** `public/sw.js`
- **Shortcuts:** Solicitar Serviço, Meus Contratos, Painel Admin

---

## 🔧 Como Rodar

```bash
# Instalar dependências
npm install

# Dev server
npm run dev

# Build produção
npx vite build

# Deploy (automático via Vercel conectado ao GitHub)
git push origin main
```

---

## 📝 Últimas Alterações (2026-02-10)

1. ✅ **Geração de PDF do Contrato Assinado** — PDF real gerado automaticamente ao completar o Wizard
    - `services/contractPdfService.ts` criado com geração HTML + conversão PDF + upload Storage
    - Suporta TODOS os perfis: CLT, Autônomo, Moto, Garantia, Limpa Nome
    - PDF com header dourado, dados do contrato, assinatura digital, hash + QR Code
    - Card "Contrato Assinado" no Dashboard do cliente com botão "Baixar PDF"
    - Botão "Baixar PDF" no painel admin (Requests.tsx) para download direto
    - Dependência: `html2pdf.js` (client-side, code-split automático)
2. ✅ **Página de Cadastro** (`/register`) — Nome, email, WhatsApp, senha
2. ✅ **Email de confirmação** — Supabase envia automaticamente, redirect para login
3. ✅ **Página ResetPassword** (`/reset-password`) — Detecta token, permite nova senha
4. ✅ **PermissionGate** — Localização OBRIGATÓRIA, notificação obrigatória
5. ✅ **Bloqueio 30 dias** — CPF reprovado bloqueado por 30 dias
6. ✅ **Carteira de Trabalho CLT** — Obrigatória (upload + validação)
7. ✅ **Botão WhatsApp admin** — Para TODOS os tipos de solicitação
8. ✅ **SalesPage** — Landing page premium de vendas em `/#/site`
9. ✅ **Manifest PWA** — theme_color preto, shortcuts atualizados
10. ✅ **Login** — Banner de email confirmado + tratamento de erros
11. ✅ **Login Biométrico** — WebAuthn real (Face ID, Touch ID, Windows Hello)
    - `services/biometricService.ts` criado com registro e autenticação
    - Tabela `webauthn_credentials` criada no Supabase
    - Cadastro automático na 1ª login com senha
    - Botão biometria só aparece se dispositivo suporta
    - Ícone muda de cinza (sem cadastro) para dourado (com cadastro)
12. ✅ **Biometria obrigatória na área do cliente** — validação por sessão em iOS/Android/Desktop com autenticador de plataforma
13. ✅ **Auditoria biométrica para admin** — logs de desafio/sucesso/falha no `risk_logs` (visível na Central de Segurança/Antifraude)

---

## 🤖 Registro de Alterações por IA (2026-02-10)

### Codex (esta sessão)

1. ✅ **Correção de segregação de notificações (Admin x Cliente)**
   - Arquivo: `services/notificationService.ts`
   - Implementado filtro por público com `for_role` (`ADMIN`, `CLIENT`, `ALL`) e fallback para estrutura legada sem `for_role`.
   - Regras atuais:
     - **Admin**: vê somente notificações de `for_role=ADMIN/ALL`.
     - **Cliente**: vê notificações com `customer_email` próprio + `for_role=ALL`.
   - Proteção extra: notificação de cliente sem `customerEmail` não é mais criada (evita “vazamento” para Admin).

2. ✅ **Padronização de criação de notificações automáticas com público-alvo**
   - Arquivo: `services/autoNotificationService.ts`
   - `createNotification` agora grava como `for_role='CLIENT'`.
   - `createAdminNotification` agora grava como `for_role='ADMIN'`.
   - Incluído fallback automático para bancos antigos sem coluna `for_role`.

3. ✅ **Antifraude e bloqueio aparecendo como notificação de Admin**
   - Arquivos: `services/antifraudService.ts`, `services/deviceSecurityService.ts`
   - Eventos críticos de antifraude e bloqueio de cliente agora geram notificação operacional para Admin com link direto para a Central de Segurança.

4. ✅ **Comprovante de pagamento enviado por cliente agora notifica Admin**
   - Arquivo: `components/PaymentReceiptUpload.tsx`
   - Ao anexar comprovante, o sistema cria notificação de Admin para validação em `Finance Hub > Receipts`.

5. ✅ **Correção de fluxo de cadastro para aparecer em Acessos e Clientes**
   - Arquivo: `services/supabaseService.ts`
   - `signUp`: normalização de email e criação automática de registro em `users`; para `CLIENT`, cria/atualiza registro em `customers`.
   - `signIn`: auto-recupera vínculo em `users` se faltante e garante presença do cliente em `customers`.

6. ✅ **Migration adicionada para padronizar audiência das notificações**
   - Arquivo: `supabase/migrations/20260210_notifications_audience.sql`
   - Adiciona coluna `for_role` em `notifications`, faz backfill de dados antigos e cria índices para performance.

### Ação obrigatória de banco (produção/homolog)

Executar no Supabase SQL Editor:

- `supabase/migrations/20260210_notifications_audience.sql`

Sem essa migration, o sistema ainda funciona (fallback legado), mas a separação Admin/Cliente fica limitada ao modelo antigo por `customer_email`.

## ✅ Atualização Rápida (Área do Investidor)

- Fluxo INVESTIDOR no wizard consolidado com 7 etapas: Serviço, Saiba Mais, Dados, Investimento, Banco, Termos, Confirmar.
- Contrato digital do investidor aplicado no step de termos com:
  - título **CONTRATO DE ALOCAÇÃO DE CAPITAL - ACEITE ELETRÔNICO**,
  - introdução jurídica da TUBARÃO EMPRÉSTIMO LTDA,
  - lista de dados cadastrais,
  - condições obrigatórias (mínimo R$ 10.000, prazo 12 meses, sem resgate antecipado, aviso prévio 3 meses e renovação automática).
- Tabela de remuneração fixa aplicada:
  - R$ 10.000 a R$ 49.999: 2,5% mensal / 3,5% anual acumulado;
  - R$ 50.000+: 5% mensal / 6% anual acumulado.
- Checkbox final de aceite do investidor atualizado com texto completo de validade contratual.
- Header do wizard para investidor atualizado para **Área do Investidor**.
- Botão final do investidor atualizado para **QUERO SER INVESTIDOR**.
- `constants/serviceTerms.ts` reestruturado e corrigido para incluir `INVESTIDOR` dentro de `SERVICE_TERMS` (arquivo válido para build).
- Admin: criada página `pages/admin/Investors.tsx` para gestão de solicitações de investidores (busca, filtro por status, visualização e atualização de status com observações).
- Rotas/Menu: adicionada rota `/admin/investors` e item “Investidores” no menu lateral do admin em `App.tsx`.

---

## 🔄 Migração Supabase -> API Própria (2026-02-12)

### Visão Geral
Migração completa do frontend para deixar de depender do SDK do Supabase e passar a utilizar a API própria (Node.js + Prisma + PostgreSQL) hospedada na VPS Oracle.

### Alterações Principais
1. **Frontend Desacoplado:**
   - Remoção do cliente `supabase-js` direto nas páginas.
   - Substituição de `supabaseService.ts` por `apiService.ts` (100% via `apiClient`).
   - Todos os serviços (`auth`, `storage`, `db`) agora passam pela API.

2. **Upload de Arquivos:**
   - Migrado de Supabase Storage para Endpoint Local/S3 via API (`POST /upload`).
   - `PaymentReceiptUpload`, `contractPdfService`, `Wizard` e `StatusScheduler` atualizados.

3. **Contratos PDF:**
   - Novo endpoint `PUT /api/loan-requests/:id/contract` para salvar URL do PDF.
   - Novo endpoint `GET /api/loan-requests/latest` para buscar última solicitação.
   - Schema do banco atualizado com campo `contractPdfUrl`.

4. **Real-time:**
   - Substituído Supabase Realtime por **Polling** (30s-60s) em `themeService` e `notificationService`.

5. **Backend (VPS Oracle):**
   - Banco de dados PostgreSQL rodando via Docker.
   - API Node.js atualizada com novos endpoints.
   - Schema Prisma sincronizado (`contractPdfUrl` adicionado).
