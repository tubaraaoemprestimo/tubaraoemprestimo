# 🔧 GUIA DE MIGRAÇÃO DO SCHEMA PRISMA

**Data:** 2026-03-14
**Objetivo:** Atualizar banco de dados para suportar sistema completo de pós-aprovação

---

## ⚠️ ATENÇÃO: BACKUP OBRIGATÓRIO

Antes de qualquer alteração, faça backup do banco de dados:

```bash
# No servidor de produção
ssh -i "ssh-key-2026-02-12.key" ubuntu@136.248.115.113

# Criar backup
pg_dump -U postgres -d tubarao_db > /home/ubuntu/backups/backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Verificar se o backup foi criado
ls -lh /home/ubuntu/backups/
```

---

## 📋 PASSO A PASSO DA MIGRAÇÃO

### 1. Ler o arquivo SCHEMA_UPDATE.prisma

O arquivo `SCHEMA_UPDATE.prisma` contém APENAS as alterações necessárias. Você precisa mesclar manualmente com o `schema.prisma` existente.

### 2. Principais alterações a fazer

#### A) No modelo `Customer` (linha ~151):

**ADICIONAR** estes campos após `contractTermsAccepted`:

```prisma
// ===== NOVOS CAMPOS PARA INADIMPLÊNCIA =====
isDefaulting        Boolean        @default(false) @map("is_defaulting")
defaultingSince     DateTime?      @map("defaulting_since")
daysOverdue         Int            @default(0) @map("days_overdue")
totalOverdueAmount  Float          @default(0) @map("total_overdue_amount")
lastContactDate     DateTime?      @map("last_contact_date")
assignedCollectorId String?        @map("assigned_collector_id")
collectionNotes     String?        @map("collection_notes")
```

**ADICIONAR** estes relacionamentos após `referralsReceived`:

```prisma
assignedCollector   User?          @relation(fields: [assignedCollectorId], references: [id], name: "CustomerCollector")
collectionHistory   CollectionHistory[]
agreements          Agreement[]
```

#### B) No modelo `LoanRequest` (linha ~246):

**ADICIONAR** estes campos após `counterOfferAcceptedAt`:

```prisma
// ===== PARÂMETROS DE COBRANÇA (DEFINIDOS NA APROVAÇÃO) =====
chargeType              String?   @map("charge_type") // DAILY, WEEKLY, MONTHLY, CUSTOM
chargePeriod            Int?      @map("charge_period")
interestRate            Float?    @map("interest_rate")
totalDebtAmount         Float?    @map("total_debt_amount")
installmentAmount       Float?    @map("installment_amount")
firstPaymentDate        DateTime? @map("first_payment_date")
```

#### C) No modelo `Loan` (linha ~344):

**ADICIONAR** estes campos após os campos existentes:

```prisma
// ===== VALORES =====
totalDebtAmount         Float @map("total_debt_amount")
paidAmount              Float @default(0) @map("paid_amount")

// ===== PARCELAS/DIÁRIAS =====
paidInstallments        Int @default(0) @map("paid_installments")
overdueInstallments     Int @default(0) @map("overdue_installments")

// ===== TIPO DE COBRANÇA =====
chargeType              String @map("charge_type")
chargePeriod            Int @map("charge_period")

// ===== LIBERAÇÃO DO EMPRÉSTIMO (ETAPA 4) =====
releasedAmount          Float? @map("released_amount")
releasedAt              DateTime? @map("released_at")
releaseMethod           String? @map("release_method")
pixReceiptUrl           String? @map("pix_receipt_url") // ⚠️ OBRIGATÓRIO
releaseNotes            String? @map("release_notes")
releasedById            String? @map("released_by_id")

// ===== STATUS E INADIMPLÊNCIA =====
isDefaulting            Boolean @default(false) @map("is_defaulting")
defaultingSince         DateTime? @map("defaulting_since")
```

**ALTERAR** o campo `status` para incluir novos valores:

```prisma
status String @default("PENDING_RELEASE") // PENDING_RELEASE, ACTIVE, DEFAULTING, IN_AGREEMENT, COMPLETED, CANCELLED
```

**ADICIONAR** estes relacionamentos:

```prisma
payments                Payment[]
releasedBy              User? @relation(fields: [releasedById], references: [id], name: "LoanReleasedBy")
agreements              Agreement[]
collectionHistory       CollectionHistory[]
```

**ADICIONAR** este índice:

```prisma
@@index([isDefaulting])
```

#### D) No modelo `Installment` (linha ~218):

**ADICIONAR** estes campos:

```prisma
installmentNumber Int     @map("installment_number")
principalAmount Float @map("principal_amount")
interestAmount  Float @map("interest_amount")
remainingAmount Float @map("remaining_amount")
daysOverdue     Int @default(0) @map("days_overdue")
paidAmount      Float @default(0) @map("paid_amount")
```

**ADICIONAR** este relacionamento:

```prisma
payments        Payment[]
```

**ADICIONAR** estes índices:

```prisma
@@index([loanId])
@@index([status])
@@index([dueDate])
```

#### E) No modelo `User` (linha ~602):

**ADICIONAR** estes relacionamentos após `trackflowQueries`:

```prisma
// ===== NOVOS RELACIONAMENTOS =====
assignedCustomers   Customer[]           @relation("CustomerCollector")
releasedLoans       Loan[]               @relation("LoanReleasedBy")
registeredPayments  Payment[]            @relation("PaymentRegisteredBy")
createdAgreements   Agreement[]          @relation("AgreementCreatedBy")
collectionActions   CollectionHistory[]  @relation("CollectionCollector")
```

#### F) CRIAR NOVOS MODELOS

**ADICIONAR** ao final do arquivo (antes de `TrackFlowQuery`):

```prisma
model Payment {
  id              String    @id @default(uuid())
  loanId          String    @map("loan_id")
  installmentId   String?   @map("installment_id")
  customerId      String    @map("customer_id")
  amount          Float
  principalAmount Float @map("principal_amount")
  interestAmount  Float @default(0) @map("interest_amount")
  feeAmount       Float @default(0) @map("fee_amount")
  paymentDate     DateTime @map("payment_date")
  registeredAt    DateTime @default(now()) @map("registered_at")
  paymentMethod   String @map("payment_method")
  proofUrl        String? @map("proof_url")
  registeredById  String @map("registered_by_id")
  notes           String?
  status          String @default("CONFIRMED")
  loan            Loan @relation(fields: [loanId], references: [id])
  installment     Installment? @relation(fields: [installmentId], references: [id])
  registeredBy    User @relation(fields: [registeredById], references: [id], name: "PaymentRegisteredBy")

  @@map("payments")
  @@index([loanId])
  @@index([customerId])
  @@index([paymentDate])
}

model Agreement {
  id                String    @id @default(uuid())
  loanId            String    @map("loan_id")
  customerId        String    @map("customer_id")
  originalDebt      Float     @map("original_debt")
  agreedAmount      Float     @map("agreed_amount")
  discount          Float     @default(0)
  newInstallments   Int       @map("new_installments")
  installmentAmount Float     @map("installment_amount")
  firstPaymentDate  DateTime  @map("first_payment_date")
  createdAt         DateTime  @default(now()) @map("created_at")
  status            String    @default("ACTIVE")
  createdById       String    @map("created_by_id")
  notes             String?
  loan              Loan      @relation(fields: [loanId], references: [id])
  customer          Customer  @relation(fields: [customerId], references: [id])
  createdBy         User      @relation(fields: [createdById], references: [id], name: "AgreementCreatedBy")

  @@map("agreements")
  @@index([loanId])
  @@index([customerId])
  @@index([status])
}

model CollectionHistory {
  id              String    @id @default(uuid())
  loanId          String    @map("loan_id")
  customerId      String    @map("customer_id")
  contactDate     DateTime  @map("contact_date")
  contactMethod   String    @map("contact_method")
  contactResult   String    @map("contact_result")
  promisedDate    DateTime? @map("promised_date")
  notes           String?
  collectorId     String    @map("collector_id")
  loan            Loan      @relation(fields: [loanId], references: [id])
  customer        Customer  @relation(fields: [customerId], references: [id])
  collector       User      @relation(fields: [collectorId], references: [id], name: "CollectionCollector")

  @@map("collection_history")
  @@index([loanId])
  @@index([customerId])
  @@index([contactDate])
}
```

---

## 🚀 EXECUTAR MIGRAÇÃO

Após fazer todas as alterações no `schema.prisma`:

```bash
# 1. Validar o schema
npx prisma validate

# 2. Criar a migração
npx prisma migrate dev --name add_post_approval_system

# 3. Gerar o Prisma Client
npx prisma generate

# 4. Verificar se tudo está OK
npx prisma studio
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

Após a migração, verifique:

- [ ] Tabela `payments` foi criada
- [ ] Tabela `agreements` foi criada
- [ ] Tabela `collection_history` foi criada
- [ ] Campo `pixReceiptUrl` existe em `loans`
- [ ] Campo `chargeType` existe em `loan_requests`
- [ ] Campo `isDefaulting` existe em `customers`
- [ ] Relacionamentos estão corretos (sem erros no Prisma Studio)

---

## 🔄 ROLLBACK (SE NECESSÁRIO)

Se algo der errado:

```bash
# Restaurar backup
psql -U postgres -d tubarao_db < /home/ubuntu/backups/backup_pre_migration_YYYYMMDD_HHMMSS.sql

# Reverter migração
npx prisma migrate resolve --rolled-back add_post_approval_system
```

---

## 📞 SUPORTE

Em caso de dúvidas ou erros, consulte:
- Logs do Prisma: `npx prisma migrate status`
- Logs do PostgreSQL: `sudo tail -f /var/log/postgresql/postgresql-*.log`
