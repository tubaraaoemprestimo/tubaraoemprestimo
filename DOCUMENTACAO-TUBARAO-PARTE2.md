---
## 3️⃣ MODELOS DE DADOS (PRISMA SCHEMA)

Abaixo estão os principais modelos do banco de dados (esquema reduzido para as partes críticas):

**`User`**: Conta do sistema (Admin, Afiliado).
- `id`, `name`, `email`, `password`, `role` (ADMIN, CLIENT).
- `isPartner`, `partnerScore`, `referralCode`.

**`Customer`**: O Cliente Final.
- `id`, `userId` (FK), `name`, `cpf` (UK), `rg`, `email`, `phone`.
- `status` (ACTIVE, BLOCKED).
- `internalScore`, `totalDebt`, `activeLoansCount`.
- Personalizações financeiras: `monthlyInterestRate`, `lateFixedFee`.

**`LoanRequest`**: Solicitações feitas via Wizard.
- `id`, `customerId`, `cpf`, `amount`, `installments`.
- `status` (PENDING, WAITING_DOCS, PENDING_ACCEPTANCE, APPROVED, REJECTED, CANCELLED, PAUSED).
- `profileType` (CLT, AUTONOMO, MOTO, GARANTIA, LIMPA_NOME, INVESTIDOR).
- Anexos e Vídeos (ex: `selfieUrl`, `videoSelfieUrl`, `idCardUrl`).
- Referências cruzadas: `reference1Name`, `fatherPhone`.
- Campos CLT: `companyName`, `companyIncome`, `companyPaymentDay`.

**`Loan`**: Contrato Ativado.
- `id`, `customerId`, `requestId` (FK), `amount` (Principal).
- `installmentsCount`, `remainingAmount`.
- `status` (ACTIVE, DEFAULT, PAID, CANCELLED).
- Controle: `dailyInstallmentAmount`, `firstPaymentDate`, `dueDay`.
- Classificações: `isService`, `isInvestment`.

**`Installment`**: Parcelas do Contrato.
- `id`, `loanId` (FK), `dueDate`, `amount`, `status` (OPEN, PAID, LATE).
- `pixCode`, `proofUrl` (Comprovante PDF/Imagem).

**`Notification`**: Sistema de alertas (Sino no header).
- `id`, `title`, `message`, `type` (INFO, WARNING, SUCCESS), `isRead`.

**`ScheduledStatus`**: Posts automatizados para WhatsApp.
- `id`, `imageUrl`, `caption`, `status` (PENDING, POSTED), `scheduledAt`.

**`TrackFlowQuery`**: Histórico da Busca de Dados.
- `id`, `apiType` (cpf, cnpj, contatos), `queryParams` (JSON), `response` (JSON), `success`.

**`PartnerCommission`**: Comissionamento de parceiros.
- `id`, `partnerId`, `loanRequestId`, `totalCommission`, `commissionRate`.
- Liberação fatiada: `release1Amount` (40%), `release2Amount` (30%).

---

## 4️⃣ ROTAS DE API (BACKEND)

Todas as rotas começam com `http://localhost:3001/api` ou `https://www.tubaraoemprestimo.com.br/api`.

### Autenticação (`/auth`)
- `POST /register`: Cria conta de usuário (`User`).
- `POST /login`: Valida senha com bcrypt e retorna JWT `eyJhbGc...`.
- `GET /me`: Valida token via cabeçalho `Authorization: Bearer` e retorna dados.

### Solicitações (`/loan-requests`)
- `POST /`: O Wizard cria a solicitação, faz upload de todos os anexos no Cloudflare R2 antes e envia as URLs finais no body JSON.
- `GET /`: Traz a lista de solicitações. Admin vê tudo, Cliente vê as dele.
- `GET /pending`: Retorna a última solicitação em andamento do usuário logado.
- `PUT /:id/approve`: Admin aprova e gera contraproposta (`PENDING_ACCEPTANCE`).
- `PUT /:id/reject`: Admin recusa (motivo opcional), altera status para `REJECTED`.
- `PUT /:id/activate`: Admin ativa, cria o `Loan` e as `Installment` (parcelas) com base no valor de `installments` aprovado.
- `PUT /:id/counter-offer` e `PUT /:id/accept-counter-offer`: Fluxo de negociação do cliente.
- `DELETE /:id` e `PUT /:id/pause`: Soft-delete/Pausar, com mudança de status para `CANCELLED`/`PAUSED` e adição em `adminNotes`.

### Documentos e Anexos (`/upload`)
- `POST /`: Envio de arquivos via `multer`. Armazena no disco local temporariamente (ou direto no S3), renomeia com timestamp e envia para Cloudflare R2, retornando a URL pública.
- Validações rígidas (`fileFilter` limitando a imagens e PDFs).

### Notificações (`/notifications`)
- `GET /admin`: Traz o polling de 30s de todas as notificações destinadas aos administradores (novas solicitações, cliente aceitou contraproposta, pagamento de parcela enviado).
- `PUT /:id/read`: Marca `isRead = true`.

### WhatsApp Evolution (`/whatsapp` e `/whatsapp/status`)
- `POST /whatsapp/message`: Envio manual de mensagens de texto/imagem/documento.
- `POST /whatsapp/status-now/:id`: Requisição direta para o PostgreSQL da Evolution para extrair até 50 contatos da tabela `"Contact"` que terminem em `@s.whatsapp.net`, enviando um JSON com `statusJidList` para o endpoint `/message/sendStatus` da API.

### Consultas TrackFlow (`/trackflow`)
- `POST /query`: Recebe `apiType` e executa requisição Axios externa usando o Bearer Token de integração. Faz cache local em `trackflow_queries` para não cobrar 2x a mesma consulta num intervalo de 24h.
- `GET /history`: Lista as consultas do Admin paginadas.

---