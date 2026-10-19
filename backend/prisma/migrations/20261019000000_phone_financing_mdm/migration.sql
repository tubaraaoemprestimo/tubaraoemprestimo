-- Financiamento de Celulares + Apple MDM. SOMENTE ADITIVO: cria tabelas novas.
-- Nao altera nem remove nada existente. Rodar em transacao, apos backup.
BEGIN;
-- CreateTable
CREATE TABLE "service_catalog_entries" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "visible_in_client" BOOLEAN NOT NULL DEFAULT true,
    "visible_in_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "application_route" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'COMMERCIAL',
    "terms_version" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_catalog_entries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "phone_financing_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "offer_enabled" BOOLEAN NOT NULL DEFAULT false,
    "legal_template_status" TEXT NOT NULL DEFAULT 'legal_template_pending',
    "monthly_interest_bps" INTEGER,
    "min_down_payment_bps" INTEGER,
    "max_installments" INTEGER,
    "late_fee_bps" INTEGER,
    "daily_late_interest_bps" INTEGER,
    "manual_payment_second_approval_cents" INTEGER NOT NULL DEFAULT 50000,
    "reminder_days_before" INTEGER NOT NULL DEFAULT 2,
    "grace_days_after_due" INTEGER NOT NULL DEFAULT 3,
    "contact_hour" INTEGER NOT NULL DEFAULT 9,
    "commercial_terms" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_financing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_products" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "line" TEXT,
    "model" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_skus" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "storage" TEXT,
    "color" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'NEW',
    "cost_cents" INTEGER NOT NULL,
    "cash_price_cents" INTEGER NOT NULL,
    "financed_price_cents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_inventory_units" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "imei" TEXT,
    "imei2" TEXT,
    "asset_tag" TEXT,
    "supplier" TEXT,
    "invoice_number" TEXT,
    "invoice_url" TEXT,
    "purchased_at" TIMESTAMP(3),
    "storage_location" TEXT,
    "physical_condition" TEXT,
    "legal_owner" TEXT,
    "custodian" TEXT,
    "commercial_status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "mdm_status" TEXT NOT NULL DEFAULT 'registered_local',
    "mdm_status_source" TEXT NOT NULL DEFAULT 'LOCAL',
    "mdm_status_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_financing_applications" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sku_id" TEXT,
    "wants_quote" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'CLIENT_APP',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "requested_installments" INTEGER,
    "requested_down_payment_cents" INTEGER,
    "monthly_income_cents" INTEGER,
    "occupation" TEXT,
    "notes" TEXT,
    "lgpd_consent_at" TIMESTAMP(3) NOT NULL,
    "terms_version" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_financing_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_application_documents" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_application_audits" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_application_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_device_reservations" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_device_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_sales" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "cash_price_cents" INTEGER NOT NULL,
    "down_payment_cents" INTEGER NOT NULL,
    "financed_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "installments_count" INTEGER NOT NULL,
    "monthly_interest_bps" INTEGER NOT NULL,
    "first_due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_contract',
    "physical_delivery_date" TIMESTAMP(3),
    "legal_title_transfer_date" TIMESTAMP(3),
    "paid_off_at" TIMESTAMP(3),
    "mdm_released_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_sale_installments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INSTALLMENT',
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "paid_cents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "paid_at" TIMESTAMP(3),
    "collection_paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_sale_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_sale_payments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "order_nsu" TEXT,
    "transaction_nsu" TEXT,
    "installment_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "paid_amount_cents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checkout_url" TEXT,
    "invoice_slug" TEXT,
    "receipt_url" TEXT,
    "payment_method" TEXT,
    "note" TEXT,
    "error_message" TEXT,
    "recorded_by" TEXT,
    "second_approved_by" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "installment_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_contracts" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "template_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'legal_template_pending',
    "pdf_url" TEXT,
    "signed_at" TIMESTAMP(3),
    "signature_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_delivery_receipts" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL,
    "delivered_by" TEXT NOT NULL,
    "received_by" TEXT NOT NULL,
    "receipt_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_delivery_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_release_cases" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reason" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_release_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_release_steps" (
    "id" TEXT NOT NULL,
    "release_case_id" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "evidence" TEXT,
    "done_by" TEXT,
    "done_at" TIMESTAMP(3),

    CONSTRAINT "device_release_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_collection_events" (
    "id" TEXT NOT NULL,
    "installment_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_on" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_collection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apple_mdm_devices" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "enrollment_id" TEXT,
    "serial_number" TEXT NOT NULL,
    "abm_assigned" BOOLEAN NOT NULL DEFAULT false,
    "supervised" BOOLEAN,
    "os_version" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "last_inventory_at" TIMESTAMP(3),
    "ownership" TEXT NOT NULL DEFAULT 'ORG_OWNED',
    "state_source" TEXT NOT NULL DEFAULT 'LOCAL',
    "raw_inventory" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_mdm_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdm_commands" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "command_uuid" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "purpose" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "response_status" TEXT,
    "response_summary" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdm_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdm_command_events" (
    "id" TEXT NOT NULL,
    "command_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdm_command_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_custody_events" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "phone_skus_sku_key" ON "phone_skus"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "phone_inventory_units_serial_number_key" ON "phone_inventory_units"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_inventory_units_imei_key" ON "phone_inventory_units"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "phone_inventory_units_imei2_key" ON "phone_inventory_units"("imei2");

-- CreateIndex
CREATE INDEX "phone_inventory_units_commercial_status_idx" ON "phone_inventory_units"("commercial_status");

-- CreateIndex
CREATE INDEX "phone_inventory_units_mdm_status_idx" ON "phone_inventory_units"("mdm_status");

-- CreateIndex
CREATE UNIQUE INDEX "phone_financing_applications_protocol_key" ON "phone_financing_applications"("protocol");

-- CreateIndex
CREATE INDEX "phone_financing_applications_customer_id_idx" ON "phone_financing_applications"("customer_id");

-- CreateIndex
CREATE INDEX "phone_financing_applications_status_idx" ON "phone_financing_applications"("status");

-- CreateIndex
CREATE INDEX "phone_device_reservations_unit_id_status_idx" ON "phone_device_reservations"("unit_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "phone_sales_application_id_key" ON "phone_sales"("application_id");

-- CreateIndex
CREATE INDEX "phone_sales_customer_id_idx" ON "phone_sales"("customer_id");

-- CreateIndex
CREATE INDEX "phone_sales_status_idx" ON "phone_sales"("status");

-- CreateIndex
CREATE INDEX "phone_sale_installments_status_due_date_idx" ON "phone_sale_installments"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "phone_sale_installments_sale_id_number_key" ON "phone_sale_installments"("sale_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "phone_sale_payments_order_nsu_key" ON "phone_sale_payments"("order_nsu");

-- CreateIndex
CREATE UNIQUE INDEX "phone_sale_payments_transaction_nsu_key" ON "phone_sale_payments"("transaction_nsu");

-- CreateIndex
CREATE INDEX "phone_sale_payments_sale_id_status_idx" ON "phone_sale_payments"("sale_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "phone_payment_allocations_payment_id_installment_id_key" ON "phone_payment_allocations"("payment_id", "installment_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_contracts_sale_id_key" ON "phone_contracts"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_release_cases_sale_id_key" ON "phone_release_cases"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_release_steps_release_case_id_step_key" ON "device_release_steps"("release_case_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "phone_collection_events_installment_id_stage_sent_on_key" ON "phone_collection_events"("installment_id", "stage", "sent_on");

-- CreateIndex
CREATE UNIQUE INDEX "apple_mdm_devices_unit_id_key" ON "apple_mdm_devices"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "apple_mdm_devices_enrollment_id_key" ON "apple_mdm_devices"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "apple_mdm_devices_serial_number_key" ON "apple_mdm_devices"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "mdm_commands_command_uuid_key" ON "mdm_commands"("command_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "mdm_commands_idempotency_key_key" ON "mdm_commands"("idempotency_key");

-- CreateIndex
CREATE INDEX "mdm_commands_device_id_created_at_idx" ON "mdm_commands"("device_id", "created_at");

-- AddForeignKey
ALTER TABLE "phone_skus" ADD CONSTRAINT "phone_skus_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "phone_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_inventory_units" ADD CONSTRAINT "phone_inventory_units_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "phone_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_financing_applications" ADD CONSTRAINT "phone_financing_applications_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "phone_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_application_documents" ADD CONSTRAINT "phone_application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "phone_financing_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_application_audits" ADD CONSTRAINT "phone_application_audits_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "phone_financing_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_device_reservations" ADD CONSTRAINT "phone_device_reservations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "phone_inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_device_reservations" ADD CONSTRAINT "phone_device_reservations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "phone_financing_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_sales" ADD CONSTRAINT "phone_sales_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "phone_financing_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_sales" ADD CONSTRAINT "phone_sales_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "phone_inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_sale_installments" ADD CONSTRAINT "phone_sale_installments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "phone_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_sale_payments" ADD CONSTRAINT "phone_sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "phone_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_payment_allocations" ADD CONSTRAINT "phone_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "phone_sale_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_payment_allocations" ADD CONSTRAINT "phone_payment_allocations_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "phone_sale_installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_contracts" ADD CONSTRAINT "phone_contracts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "phone_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_delivery_receipts" ADD CONSTRAINT "phone_delivery_receipts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "phone_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_release_cases" ADD CONSTRAINT "phone_release_cases_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "phone_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_release_steps" ADD CONSTRAINT "device_release_steps_release_case_id_fkey" FOREIGN KEY ("release_case_id") REFERENCES "phone_release_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_collection_events" ADD CONSTRAINT "phone_collection_events_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "phone_sale_installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_mdm_devices" ADD CONSTRAINT "apple_mdm_devices_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "phone_inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdm_commands" ADD CONSTRAINT "mdm_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "apple_mdm_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdm_command_events" ADD CONSTRAINT "mdm_command_events_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "mdm_commands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_custody_events" ADD CONSTRAINT "device_custody_events_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "phone_inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- FKs para tabelas legadas (sem relacao Prisma, para nao tocar Customer/User)
ALTER TABLE "phone_financing_applications" ADD CONSTRAINT "phone_fin_app_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phone_financing_applications" ADD CONSTRAINT "phone_fin_app_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phone_sales" ADD CONSTRAINT "phone_sales_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Um aparelho nunca tem duas reservas ativas ao mesmo tempo
CREATE UNIQUE INDEX "phone_device_reservations_one_active" ON "phone_device_reservations"("unit_id") WHERE "status" = 'ACTIVE';
-- Um aparelho so pode estar em uma venda nao cancelada
CREATE UNIQUE INDEX "phone_sales_one_live_per_unit" ON "phone_sales"("unit_id") WHERE "status" <> 'cancelled';
-- Valores monetarios nunca negativos
ALTER TABLE "phone_sale_installments" ADD CONSTRAINT "phone_inst_amount_chk" CHECK ("amount_cents" > 0 AND "paid_cents" >= 0 AND "paid_cents" <= "amount_cents");
ALTER TABLE "phone_sale_payments" ADD CONSTRAINT "phone_pay_amount_chk" CHECK ("amount_cents" > 0);
ALTER TABLE "phone_sales" ADD CONSTRAINT "phone_sales_amount_chk" CHECK ("cash_price_cents" > 0 AND "down_payment_cents" >= 0 AND "financed_cents" >= 0 AND "installments_count" > 0);

-- Catalogo inicial: 5 servicos atuais (codigos preservados) + novo, oferta desligada
INSERT INTO "service_catalog_entries" ("code","label","description","icon","sort_order","active","visible_in_client","visible_in_whatsapp","application_route","category","updated_at") VALUES
 ('CLT','Empréstimo CLT','Empréstimo pessoal para quem tem carteira assinada.','Briefcase',1,true,true,true,'/wizard?profile=CLT','COMMERCIAL',now()),
 ('AUTONOMO','Capital de giro para comércio','Capital de giro com pagamento em diárias.','Store',2,true,true,true,'/wizard?profile=AUTONOMO','COMMERCIAL',now()),
 ('GARANTIA','Empréstimo com garantia','Deixe um bem como garantia.','Car',3,true,true,true,'/wizard?profile=GARANTIA','COMMERCIAL',now()),
 ('MOTO','Financiamento de moto','Compre sua moto parcelada.','Bike',4,true,true,true,'/wizard?profile=MOTO','COMMERCIAL',now()),
 ('LIMPA_NOME','Limpar nome','Contestação administrativa de negativação.','CreditCard',5,true,true,true,'/wizard?profile=LIMPA_NOME','COMMERCIAL',now()),
 ('FINANCIAMENTO_CELULAR','Financiamento de Celulares','Compre seu celular em parcelas, com análise da Tubarão.','Smartphone',6,false,true,true,'/client/financiamento-celulares/solicitar','COMMERCIAL',now())
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "phone_financing_settings" ("id","updated_at") VALUES ('default', now()) ON CONFLICT ("id") DO NOTHING;
COMMIT;
