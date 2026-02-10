# 🦈 Tubarão Empréstimos — Resumo do Projeto

> **Última atualização:** 2026-02-10
> **Repositório:** https://github.com/tubaraaoemprestimo/tubaraoemprestimo.git
> **Produção:** https://www.tubaraoemprestimo.com.br
> **Stack:** React + TypeScript + Vite + Supabase
> **Deploy:** Vercel (conectado ao GitHub, branch `main`)

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

1. ✅ **Página de Cadastro** (`/register`) — Nome, email, WhatsApp, senha
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
