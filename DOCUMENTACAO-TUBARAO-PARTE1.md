# 🦈 SISTEMA TUBARÃO EMPRÉSTIMOS - DOCUMENTAÇÃO COMPLETA

Este documento é um guia arquitetural e funcional completo do sistema Tubarão Empréstimos. Ele serve tanto como documentação técnica quanto como "prompt mestre" caso seja necessário recriar ou entender o sistema do zero.

---

## 1️⃣ VISÃO GERAL DO SISTEMA

### Propósito e Objetivo
O Tubarão Empréstimos é uma plataforma fintech (Progressive Web App - PWA) desenhada para operar de forma 100% digital. O objetivo é receber, processar, analisar e gerenciar solicitações de crédito, com foco em segurança, automação e análise de risco.

### Arquitetura Geral
- **Frontend (PWA)**: React 18 + Vite + TailwindCSS. Interface responsiva, dividida entre área pública/cliente (assistente wizard) e Painel Administrativo.
- **Backend (API REST)**: Node.js + Express + TypeScript. Responsável por regras de negócio, integrações e segurança.
- **Banco de Dados**: PostgreSQL gerenciado via Prisma ORM.
- **Infraestrutura**: Servidor Ubuntu (136.248.115.113) gerenciado via PM2. Backups automáticos via Cron.

### Stack Tecnológica Completa
- **Frontend**: React 18.3.1, TypeScript 5.8, Vite 6.2, Tailwind CSS 3.4, React Router DOM 6.22, Recharts (gráficos), Lucide React (ícones), TipTap (editor HTML), Tesseract.js (OCR), Firebase (Push Notifications).
- **Backend**: Node.js, Express 4.21, TypeScript 5.7, Prisma ORM 6.3, jsonwebtoken (Auth JWT), bcryptjs (Hash), cron (Agendamentos), multer/busboy (Uploads).
- **Integrações**:
  - **Evolution API (v2.3.7)**: Disparo de WhatsApp, Status/Stories.
  - **TrackFlow API**: Consultas de background (CPF, CNPJ, Contatos, Veículos).
  - **Cloudflare R2 (S3)**: Armazenamento de arquivos e documentos.
  - **Resend**: Disparo de e-mails transacionais.
  - **Stripe**: Pagamentos para funis específicos (cursos/taxas).
  - **Gemini AI / Perplexity**: Chatbots e análise de IA.

---

## 2️⃣ FUNCIONALIDADES COMPLETAS

### 2.1. Sistema de Solicitações (Wizard)
**Descrição**: O cliente acessa o site e passa por um assistente passo-a-passo para solicitar serviços.
**Tipos de Perfil**:
1. `CLT`: Empréstimo pessoal com desconto em folha/boleto. Exige holerite e dados da empresa.
2. `AUTONOMO`: Capital de giro para comércio. Foco em recebimentos diários/semanais.
3. `GARANTIA` / `GARANTIA_VEICULO`: Empréstimo com bem em garantia.
4. `MOTO`: Financiamento específico para motocicletas.
5. `LIMPA_NOME`: Serviço de reabilitação de crédito (isService = true).

**Regras Críticas de Solicitação**:
- Verificação de duplicidade: O sistema bloqueia se o cliente já tiver uma solicitação `PENDING` ou `APPROVED` ativa.
- Validação de geolocalização obrigatória no momento da assinatura.
- Captura de vídeos: Selfie em vídeo, vídeo da residência e vídeo do veículo (se aplicável).
- Coleta de 2 Referências (nome e telefone obrigatoriamente).
- Assinatura digital gerada em Base64/Canvas e enviada como imagem.

### 2.2. Fluxo de Aprovação e Contratos
**Fluxo (Status)**:
`PENDING` ➔ `WAITING_DOCS` (opcional) ➔ `PENDING_ACCEPTANCE` (Contraproposta) ➔ `APPROVED` ➔ `ACTIVE` (Contrato Gerado).

**Contraproposta**:
- O admin pode alterar o valor solicitado, parcelas e taxa de juros.
- O cliente recebe um link (WhatsApp/Email) para aprovar os novos termos.
- Ao aprovar, o status muda para `APPROVED` e o admin recebe uma notificação vermelha no painel.

**Ativação (Criação do Loan)**:
- O admin clica em "Ativar Contrato".
- Define a data do primeiro pagamento, dia de vencimento e envia o comprovante de PIX transferido para o cliente.
- A entidade `Loan` e suas respectivas `Installment` (parcelas) são geradas no banco.

### 2.3. Gestão de Recebimentos e Inadimplência
- **Parcelas (`Installment`)**: Possuem status `OPEN`, `LATE`, `PAID`.
- O cliente faz o PIX, anexa o comprovante na área do cliente.
- A parcela vai para o status de "Aguardando Revisão".
- O admin revisa o comprovante e confirma. A parcela vira `PAID`. O sistema atualiza o saldo devedor e os totais do contrato.

### 2.4. Réguas de Cobrança Automatizadas
- **Descrição**: Sistema que roda diariamente (Cron Job) para cobrar parcelas.
- **Tipos de Lembrete**: 7 dias antes, 3 dias antes, Vence Hoje.
- **Cobranças de Atraso**: 1 dia, 3 dias, 7 dias, 15 dias e 30 dias de atraso.
- **Canais**: WhatsApp (via Evolution API), Email e Push Notification.
- **Juros e Multas**: O sistema aplica automaticamente (ex: Multa fixa 2% + Juros diário 0.33%) se configurado globalmente ou por cliente.

### 2.5. Integração TrackFlow (Data Search)
- **Painel Admin**: Ferramenta de "Busca de Dados" integrada via API.
- **Consultas**: CPF (dados base e SERASA), CNPJ, Contatos (telefones vinculados a um CPF/Telefone), Nome/Endereço e Histórico Veicular.
- **Histórico**: Toda consulta é salva na tabela `TrackFlowQuery` com `userId` do admin que a fez, para auditoria e economia de créditos (cache visual).

### 2.6. WhatsApp Status Automatizado
- O admin faz upload de uma imagem e agenda um Status do WhatsApp.
- Um Cron Job roda de minuto em minuto, pega os agendamentos pendentes.
- Comunica com a Evolution API e o banco PostgreSQL da própria Evolution (`evolution_postgres` 172.18.0.2) para buscar todos os JIDs dos contatos do celular conectado.
- Posta o status para todos os contatos simultaneamente.

### 2.7. Outras Funcionalidades
- **Blacklist**: Bloqueio de CPFs. Se um CPF na blacklist tentar solicitar, é recusado automaticamente.
- **Geolocalização (Anti-Fraude)**: Monitoramento de IPs e distâncias geográficas entre login e solicitação.
- **Investidores**: Sistema paralelo para captação de investimentos (Tiers Standard e Premium) com pagamento de dividendos mensais ou anuais.
- **Parceiros**: Afiliados geram links. Se um cliente fechar contrato via link, o parceiro ganha comissão, gerenciada no painel e liberada em etapas (ex: 40% na 1ª parcela paga, 30% na 2ª...).

---