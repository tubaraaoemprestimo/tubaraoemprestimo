# 🧪 ROTEIRO DE VALIDAÇÃO QA - Tubarão Empréstimos

**Data:** 17/03/2026 17:35
**Versão:** 1.0
**Desenvolvedor:** Deve executar TODOS os testes e documentar com vídeo ou prints
**Objetivo:** Provar que as funcionalidades estão 100% operacionais, sem erros 500 ou falsos positivos

---

## 📋 ÍNDICE DE TESTES

1. [TESTE 1: Ciclo de Vida do Documento Pendente](#teste-1-ciclo-de-vida-do-documento-pendente)
2. [TESTE 2: Prova de Fogo da Contraproposta](#teste-2-prova-de-fogo-da-contraproposta)
3. [TESTE 3: Handoff Final - Modal de Liberação](#teste-3-handoff-final---modal-de-liberação)
4. [TESTE 4: WhatsApp Onboarding - Confirmação Manual](#teste-4-whatsapp-onboarding---confirmação-manual)

---

## TESTE 1: Ciclo de Vida do Documento Pendente

### 🎯 Objetivo
Validar que o fluxo completo de solicitação e envio de documentos funciona sem erros, com notificações corretas e documentos visíveis no admin.

### 📍 Arquivos Envolvidos
- **Backend:** `backend/src/routes/loanRequests.ts` (linhas 1688-1745)
- **Frontend Cliente:** `pages/client/ClientDashboard.tsx` (linhas 267-291, 398-408)
- **Frontend Admin:** `pages/admin/Requests.tsx` (linhas 889-945, 1889-1962, 1824-1887)

### 🔧 Pré-requisitos
- Cliente com solicitação em status `PENDING`
- Admin logado no painel
- Cliente logado no app

---

### PASSO 1: Admin Solicita Documento

**Ação:**
1. Admin acessa `/admin/solicitacoes`
2. Clica em uma solicitação PENDING
3. Na seção "Solicitar Documento Extra", preenche:
   - Descrição: "Envie foto da CNH atualizada"
4. Clica em "Solicitar Documento"

**Validação Backend:**
```bash
# Verificar logs do PM2
ssh ubuntu@136.248.115.113
pm2 logs tubarao-backend --lines 50
```

**Esperado:**
- ✅ Status HTTP: `200 OK`
- ✅ Resposta JSON: `{ "message": "Documento solicitado com sucesso" }`
- ✅ Log no servidor: `"Documento solicitado para request [ID]"`
- ✅ Sem erros 500

**Validação Database:**
```sql
SELECT id, status, supplemental_description, supplemental_requested_at
FROM loan_requests
WHERE id = '[ID_DA_SOLICITACAO]';
```

**Esperado:**
- ✅ `status` = `'WAITING_DOCS'`
- ✅ `supplemental_description` = `'Envie foto da CNH atualizada'`
- ✅ `supplemental_requested_at` = timestamp atual

**Validação Frontend Admin:**
- ✅ Toast de sucesso aparece
- ✅ Status da solicitação muda para "Aguardando Documentos"
- ✅ Seção "Documento Solicitado" aparece com a descrição

---

### PASSO 2: Cliente Recebe Notificação

**Ação:**
1. Cliente acessa o app (refresh da página)
2. Verifica se aparece card de "Documentos Pendentes"

**Validação Frontend Cliente:**
- ✅ Card vermelho/laranja aparece com texto: "📄 Documentos Pendentes"
- ✅ Descrição exibida: "Envie foto da CNH atualizada"
- ✅ Botão "Enviar Documentos" visível

---

### PASSO 3: Cliente Faz Upload

**Ação:**
1. Cliente clica em "Enviar Documentos"
2. Seleciona arquivo (imagem JPG ou PDF)
3. Clica em "Enviar"

**Validação Backend:**
```bash
# Verificar logs
pm2 logs tubarao-backend --lines 50 | grep "supplemental-upload"
```

**Esperado:**
- ✅ Status HTTP: `200 OK`
- ✅ Log: `"Documento suplementar enviado para request [ID]"`
- ✅ Notificação push enviada para admin
- ✅ Sem erros 500

**Validação Database:**
```sql
SELECT id, status, supplemental_doc_url, supplemental_uploaded_at
FROM loan_requests
WHERE id = '[ID_DA_SOLICITACAO]';
```

**Esperado:**
- ✅ `status` = `'PENDING'` (voltou para análise)
- ✅ `supplemental_doc_url` = URL do Cloudinary (array JSON)
- ✅ `supplemental_uploaded_at` = timestamp atual

**Validação Notificação:**
```sql
SELECT * FROM notifications
WHERE customer_id = '[ID_ADMIN]'
ORDER BY created_at DESC
LIMIT 1;
```

**Esperado:**
- ✅ `title` = `'📄 Documentos Adicionais Enviados'`
- ✅ `message` contém nome do cliente
- ✅ `read` = `false`

---

### PASSO 4: Admin Visualiza Documentos

**Ação:**
1. Admin acessa `/admin/solicitacoes`
2. Clica na solicitação que estava WAITING_DOCS
3. Verifica seção "Solicitação de Documento Extra"

**Validação Frontend Admin:**
- ✅ Seção "Documentos Enviados pelo Cliente" aparece
- ✅ Se imagem: DocCard com preview e botão "Ampliar"
- ✅ Se PDF: DocCard com botão "Abrir PDF"
- ✅ Se vídeo: VideoCard com player inline
- ✅ Clicar em "Ampliar" abre modal de zoom (imagens)
- ✅ Clicar em "Abrir PDF" abre em nova aba
- ✅ Vídeo reproduz inline com controles

**Código de Referência:**
- DocCard: `pages/admin/Requests.tsx` linhas 1889-1962
- VideoCard: `pages/admin/Requests.tsx` linhas 1824-1887

---

### ✅ CHECKLIST TESTE 1

- [ ] Admin solicitou documento sem erro 500
- [ ] Status mudou para WAITING_DOCS no banco
- [ ] Cliente viu card de documentos pendentes
- [ ] Cliente fez upload sem erro 500
- [ ] Status voltou para PENDING no banco
- [ ] URL do documento foi salva no banco
- [ ] Admin recebeu notificação push
- [ ] Notificação apareceu no sino do admin
- [ ] Documentos aparecem na UI do admin
- [ ] Imagens abrem com zoom
- [ ] PDFs abrem em nova aba
- [ ] Vídeos reproduzem inline

---

## TESTE 2: Prova de Fogo da Contraproposta

### 🎯 Objetivo
Validar que o cliente consegue aceitar contraproposta sem erro, com criação correta do Loan e sincronização de dados.

### 📍 Arquivos Envolvidos
- **Backend:** `backend/src/routes/loanRequests.ts` (linhas 1304-1556)
- **Frontend Cliente:** `pages/client/ClientDashboard.tsx` (linhas 466-484)

### 🔧 Pré-requisitos
- Cliente com solicitação em status `PENDING_ACCEPTANCE`
- Contraproposta já enviada pelo admin (approvedAmount, installments definidos)

---

### PASSO 1: Cliente Visualiza Contraproposta

**Ação:**
1. Cliente acessa o app
2. Verifica card de "Contraproposta Recebida"

**Validação Frontend:**
- ✅ Card amarelo/laranja aparece
- ✅ Exibe valor aprovado: "R$ X.XXX,XX"
- ✅ Exibe parcelas corretamente:
  - Se `installmentType = 'DAILY'`: "30 diárias de R$ X.XX"
  - Se `installmentType = 'MONTHLY'`: "12x de R$ X.XX"
- ✅ Botão "Aceitar Contrato" visível

**Código de Referência:**
- `pages/client/ClientDashboard.tsx` linhas 437-447

---

### PASSO 2: Cliente Aceita Contrato

**Ação:**
1. Cliente clica em "Aceitar Contrato"
2. Aguarda resposta

**Validação Backend:**
```bash
# Verificar logs
pm2 logs tubarao-backend --lines 100 | grep "accept-counteroffer"
```

**Esperado:**
- ✅ Status HTTP: `200 OK`
- ✅ Log: `"Contraproposta aceita para request [ID]"`
- ✅ Log: `"Loan criado com ID [LOAN_ID]"`
- ✅ Sem erro: `"Argument principalAmount is missing"`
- ✅ Sem erro: `"Argument totalInstallments is missing"`
- ✅ Sem erros 500

**Validação Database - LoanRequest:**
```sql
SELECT id, status, counter_offer_accepted, counter_offer_accepted_at
FROM loan_requests
WHERE id = '[ID_DA_SOLICITACAO]';
```

**Esperado:**
- ✅ `status` = `'APPROVED'`
- ✅ `counter_offer_accepted` = `true`
- ✅ `counter_offer_accepted_at` = timestamp atual

**Validação Database - Loan:**
```sql
SELECT id, customer_id, request_id, amount, principal_amount,
       installments_count, total_installments, remaining_amount, status
FROM loans
WHERE request_id = '[ID_DA_SOLICITACAO]';
```

**Esperado:**
- ✅ `amount` = valor aprovado
- ✅ `principal_amount` = valor aprovado (CAMPO OBRIGATÓRIO)
- ✅ `installments_count` = número de parcelas
- ✅ `total_installments` = número de parcelas (CAMPO OBRIGATÓRIO)
- ✅ `remaining_amount` = valor aprovado
- ✅ `status` = `'APPROVED'`

**Validação Database - Customer (Sincronização):**
```sql
SELECT id, active_loans_count, total_debt, instagram, street, city, state, zip_code
FROM customers
WHERE id = '[ID_DO_CLIENTE]';
```

**Esperado:**
- ✅ `active_loans_count` incrementado em 1
- ✅ `total_debt` incrementado com valor aprovado
- ✅ `instagram` = valor da solicitação (se preenchido)
- ✅ `street`, `city`, `state`, `zip_code` = valores da solicitação

**Código de Referência:**
- Backend: `backend/src/routes/loanRequests.ts` linhas 1344-1390

---

### PASSO 3: Validação Frontend Pós-Aceite

**Ação:**
1. Verificar se solicitação desapareceu da tela
2. Verificar se toast de sucesso apareceu

**Validação Frontend:**
- ✅ Toast verde: "Contrato aceito! Seu crédito está sendo processado."
- ✅ Card de contraproposta desaparece
- ✅ Página recarrega dados automaticamente (finally block)
- ✅ Se houver erro, solicitação NÃO desaparece (cliente pode tentar novamente)

**Código de Referência:**
- `pages/client/ClientDashboard.tsx` linhas 466-484

---

### ✅ CHECKLIST TESTE 2

- [ ] Cliente viu contraproposta com valores corretos
- [ ] Parcelas exibidas no formato correto (diárias/mensais)
- [ ] Cliente clicou em "Aceitar Contrato"
- [ ] Backend retornou 200 OK (sem erro 500)
- [ ] Loan foi criado com `principalAmount` e `totalInstallments`
- [ ] LoanRequest mudou para status APPROVED
- [ ] Customer teve `activeLoansCount` e `totalDebt` atualizados
- [ ] Dados do cliente foram sincronizados (Instagram, endereço)
- [ ] Toast de sucesso apareceu
- [ ] Solicitação desapareceu da tela
- [ ] Admin recebeu notificação de aceite

---

## TESTE 3: Handoff Final - Modal de Liberação

### 🎯 Objetivo
Validar que o admin consegue ativar contrato, configurar parcelas, fazer upload de comprovante PIX e completar o dossiê sem erros.

### 📍 Arquivos Envolvidos
- **Backend:** `backend/src/routes/loanRequests.ts` (linhas 858-1130)
- **Frontend Admin:** `pages/admin/Requests.tsx` (linhas 200-257, 1590-1800)

### 🔧 Pré-requisitos
- Solicitação em status `APPROVED` (contrato aceito pelo cliente)
- Admin logado no painel

---

### PASSO 1: Admin Abre Modal de Ativação

**Ação:**
1. Admin acessa `/admin/solicitacoes`
2. Clica em solicitação APPROVED
3. Clica em botão "Ativar Contrato"

**Validação Frontend:**
- ✅ Modal "Ativar Contrato" abre
- ✅ Campos visíveis:
  - Tipo de Parcelamento (DAILY/MONTHLY)
  - Número de Parcelas
  - Data do Primeiro Pagamento
  - Upload de Comprovante PIX
  - Checkbox "Dossiê Completo"
- ✅ Valores pré-preenchidos da contraproposta

**Código de Referência:**
- `pages/admin/Requests.tsx` linhas 200-257

---

### PASSO 2: Admin Configura e Ativa

**Ação:**
1. Seleciona tipo de parcelamento: "DAILY"
2. Define parcelas: 30
3. Seleciona data: hoje + 1 dia
4. Faz upload de comprovante PIX (imagem)
5. Marca checkbox "Dossiê Completo"
6. Clica em "Ativar Contrato"

**Validação Backend:**
```bash
# Verificar logs
pm2 logs tubarao-backend --lines 100 | grep "activate-contract"
```

**Esperado:**
- ✅ Status HTTP: `200 OK`
- ✅ Log: `"Contrato ativado para request [ID]"`
- ✅ Log: `"Parcelas criadas: 30"`
- ✅ Log: `"Comprovante PIX salvo"`
- ✅ Sem erros 500

**Validação Database - LoanRequest:**
```sql
SELECT id, status, installment_type, installments, pix_receipt_url, dossier_complete
FROM loan_requests
WHERE id = '[ID_DA_SOLICITACAO]';
```

**Esperado:**
- ✅ `status` = `'APPROVED'` (permanece)
- ✅ `installment_type` = `'DAILY'`
- ✅ `installments` = `30`
- ✅ `pix_receipt_url` = URL do Cloudinary
- ✅ `dossier_complete` = `true`

**Validação Database - Loan:**
```sql
SELECT id, status, start_date FROM loans WHERE request_id = '[ID_DA_SOLICITACAO]';
```

**Esperado:**
- ✅ `status` = `'ACTIVE'`
- ✅ `start_date` = data atual

**Validação Database - Installments:**
```sql
SELECT id, installment_number, due_date, amount, status
FROM installments
WHERE loan_id = '[LOAN_ID]'
ORDER BY installment_number;
```

**Esperado:**
- ✅ 30 parcelas criadas
- ✅ `installment_number` de 1 a 30
- ✅ `due_date` sequencial (diário)
- ✅ `amount` = valor total / 30
- ✅ `status` = `'OPEN'`

---

### PASSO 3: Cliente Recebe Notificação

**Validação Database - Notification:**
```sql
SELECT * FROM notifications
WHERE customer_id = '[ID_DO_CLIENTE]'
ORDER BY created_at DESC
LIMIT 1;
```

**Esperado:**
- ✅ `title` = `'✅ Contrato Ativado'`
- ✅ `message` contém valor e parcelas
- ✅ `type` = `'SUCCESS'`

**Validação Frontend Cliente:**
1. Cliente acessa o app
2. Verifica notificação no sino
3. Acessa "Meus Empréstimos"

**Esperado:**
- ✅ Notificação aparece no sino
- ✅ Empréstimo ativo aparece na lista
- ✅ Exibe valor, parcelas e próximo vencimento

---

### ✅ CHECKLIST TESTE 3

- [ ] Modal de ativação abriu sem erros
- [ ] Campos pré-preenchidos corretamente
- [ ] Admin configurou tipo de parcelamento
- [ ] Admin fez upload de comprovante PIX
- [ ] Admin marcou "Dossiê Completo"
- [ ] Backend retornou 200 OK (sem erro 500)
- [ ] Loan mudou para status ACTIVE
- [ ] 30 parcelas foram criadas no banco
- [ ] Datas de vencimento estão sequenciais
- [ ] Comprovante PIX foi salvo
- [ ] Cliente recebeu notificação
- [ ] Empréstimo aparece no app do cliente

---

## TESTE 4: WhatsApp Onboarding - Confirmação Manual

### 🎯 Objetivo
Validar que clientes via WhatsApp NÃO criam solicitações automaticamente, apenas informam que têm empréstimo e aguardam confirmação do admin.

### 📍 Arquivos Envolvidos
- **Backend:** `backend/src/routes/whatsappOnboarding.ts` (linhas 121-217, 374-497)

### 🔧 Pré-requisitos
- WhatsApp conectado via Evolution API
- Admin logado no painel

---

### PASSO 1: Cliente Completa Onboarding

**Ação:**
1. Cliente envia mensagem no WhatsApp: "Oi"
2. Responde todas as perguntas (nome, CPF, email, etc)
3. Aguarda resposta final

**Validação Backend:**
```bash
pm2 logs tubarao-backend --lines 100 | grep "completeOnboarding"
```

**Esperado:**
- ✅ Log: `"Onboarding completo para [PHONE]"`
- ✅ Log: `"Notificação enviada para admin"`
- ✅ Sem log: `"LoanRequest criado"` (NÃO deve criar)
- ✅ Sem log: `"Loan criado"` (NÃO deve criar)

**Validação Database - Session:**
```sql
SELECT phone, status, data FROM whatsapp_onboarding_sessions
WHERE phone = '[PHONE]'
ORDER BY created_at DESC
LIMIT 1;
```

**Esperado:**
- ✅ `status` = `'PENDING_ADMIN'`
- ✅ `data` contém nome, CPF, email

**Validação Database - User/Customer:**
```sql
SELECT u.id, u.email, c.name, c.cpf
FROM users u
JOIN customers c ON c.user_id = u.id
WHERE u.email = '[EMAIL_DO_CLIENTE]';
```

**Esperado:**
- ✅ User criado com senha temporária
- ✅ Customer criado
- ✅ Sem LoanRequest criado
- ✅ Sem Loan criado

**Validação WhatsApp:**
- ✅ Cliente recebe: "Cadastro recebido! Aguarde confirmação do admin."
- ✅ Cliente NÃO recebe senha de login
- ✅ Cliente NÃO recebe link do app

---

### PASSO 2: Admin Confirma Cadastro

**Ação:**
1. Admin acessa `/admin/whatsapp-onboarding/pending`
2. Vê lista de cadastros pendentes
3. Clica em "Confirmar" no cadastro do cliente

**Validação Backend:**
```bash
pm2 logs tubarao-backend --lines 100 | grep "confirm"
```

**Esperado:**
- ✅ Status HTTP: `200 OK`
- ✅ Log: `"Cadastro confirmado para [PHONE]"`
- ✅ Log: `"LoanRequest criado com status APPROVED"`
- ✅ Log: `"Loan criado com status ACTIVE"`
- ✅ Log: `"WhatsApp enviado com credenciais"`

**Validação Database - Session:**
```sql
SELECT status FROM whatsapp_onboarding_sessions WHERE phone = '[PHONE]';
```

**Esperado:**
- ✅ `status` = `'COMPLETED'`

**Validação Database - LoanRequest:**
```sql
SELECT id, status, client_name, cpf, email
FROM loan_requests
WHERE cpf = '[CPF_DO_CLIENTE]'
ORDER BY created_at DESC
LIMIT 1;
```

**Esperado:**
- ✅ LoanRequest criado AGORA (não antes)
- ✅ `status` = `'APPROVED'`
- ✅ `client_name` = nome correto (não "Falar com atendente")

**Validação Database - Loan:**
```sql
SELECT id, status FROM loans WHERE request_id = '[REQUEST_ID]';
```

**Esperado:**
- ✅ Loan criado AGORA (não antes)
- ✅ `status` = `'ACTIVE'`

**Validação WhatsApp:**
- ✅ Cliente recebe mensagem com:
  - Email de login
  - Senha gerada
  - Link do app
  - Instruções de acesso

---

### PASSO 3: Admin Rejeita Cadastro (Teste Alternativo)

**Ação:**
1. Admin acessa `/admin/whatsapp-onboarding/pending`
2. Clica em "Rejeitar" em outro cadastro
3. Informa motivo: "Dados inconsistentes"

**Validação Backend:**
```bash
pm2 logs tubarao-backend --lines 50 | grep "reject"
```

**Esperado:**
- ✅ Status HTTP: `200 OK`
- ✅ Log: `"Cadastro rejeitado para [PHONE]"`

**Validação Database:**
```sql
SELECT status, rejection_reason FROM whatsapp_onboarding_sessions WHERE phone = '[PHONE]';
```

**Esperado:**
- ✅ `status` = `'REJECTED'`
- ✅ `rejection_reason` = `'Dados inconsistentes'`

**Validação WhatsApp:**
- ✅ Cliente recebe: "Cadastro recusado. Motivo: Dados inconsistentes"

---

### ✅ CHECKLIST TESTE 4

- [ ] Cliente completou onboarding via WhatsApp
- [ ] Session ficou com status PENDING_ADMIN
- [ ] User e Customer foram criados
- [ ] LoanRequest NÃO foi criado automaticamente
- [ ] Loan NÃO foi criado automaticamente
- [ ] Cliente recebeu mensagem de aguardo
- [ ] Cliente NÃO recebeu senha ainda
- [ ] Admin viu cadastro na lista de pendentes
- [ ] Admin confirmou cadastro
- [ ] LoanRequest foi criado APÓS confirmação
- [ ] Loan foi criado APÓS confirmação
- [ ] Cliente recebeu credenciais de acesso
- [ ] Nome do cliente está correto (não "Falar com atendente")
- [ ] Admin conseguiu rejeitar outro cadastro
- [ ] Cliente rejeitado recebeu mensagem de recusa

---

## 📊 RELATÓRIO FINAL

### Formato do Relatório

O desenvolvedor deve entregar:

**OPÇÃO 1: Vídeo (Recomendado)**
- Gravação de tela executando TODOS os 4 testes
- Mostrar cada passo sendo executado
- Mostrar logs do backend em tempo real
- Mostrar queries no banco de dados
- Mostrar UI do cliente e admin
- Duração estimada: 15-20 minutos

**OPÇÃO 2: Documento com Prints**
- Screenshot de cada passo
- Screenshot dos logs do backend
- Screenshot das queries no banco
- Screenshot da UI (cliente e admin)
- Anotar timestamps de cada ação

### Critérios de Aprovação

✅ **APROVADO** se:
- Todos os 4 testes passaram 100%
- Nenhum erro 500 ocorreu
- Todos os dados foram salvos corretamente no banco
- Todas as notificações foram enviadas
- Todas as UIs exibiram informações corretas

❌ **REPROVADO** se:
- Qualquer erro 500 ocorreu
- Dados não foram salvos no banco
- Notificações não foram enviadas
- UI exibiu informações incorretas
- Funcionalidade não funcionou como esperado

---

## 🚨 PROBLEMAS CONHECIDOS (Histórico)

### BUG 1: Erro ao Aceitar Contraproposta ✅ CORRIGIDO
- **Sintoma:** Erro "Argument principalAmount is missing"
- **Causa:** Campos obrigatórios não preenchidos na criação do Loan
- **Correção:** Adicionado `principalAmount` e `totalInstallments` (commit ca992a0)
- **Validação:** TESTE 2 deve passar sem este erro

### BUG 2: Parcelas Estáticas ✅ CORRIGIDO
- **Sintoma:** Sempre exibia "Nx de R$ X.XX" (formato mensal)
- **Causa:** Não verificava campo `installmentType`
- **Correção:** Renderização condicional baseada em DAILY/MONTHLY (commit ca992a0)
- **Validação:** TESTE 2 deve exibir formato correto

### BUG 3: WhatsApp Auto-Aprovação ✅ CORRIGIDO
- **Sintoma:** Clientes via WhatsApp criavam contratos automaticamente
- **Causa:** `completeOnboarding()` criava LoanRequest e Loan imediatamente
- **Correção:** Reescrita completa do fluxo com confirmação manual (commit a35cd2f)
- **Validação:** TESTE 4 deve exigir confirmação do admin

### BUG 4: Nome "Falar com atendente" ✅ CORRIGIDO
- **Sintoma:** Clientes com nome inválido passavam pela validação
- **Causa:** Sem validação de nomes proibidos
- **Correção:** Lista de nomes inválidos + validação de 2+ palavras (commit a35cd2f)
- **Validação:** TESTE 4 deve rejeitar nomes inválidos

---

## 📝 NOTAS FINAIS

- Todos os testes devem ser executados em **PRODUÇÃO** (não em desenvolvimento)
- Usar dados reais (não mock)
- Documentar TODOS os erros encontrados
- Se algum teste falhar, NÃO prosseguir para o próximo
- Reportar imediatamente qualquer erro 500

---

**Desenvolvedor:** _______________________
**Data de Execução:** _______________________
**Status:** [ ] APROVADO [ ] REPROVADO
**Observações:** _______________________
