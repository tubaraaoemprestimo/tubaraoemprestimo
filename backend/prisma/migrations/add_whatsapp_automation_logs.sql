-- CreateTable: WhatsApp Automation Logs
CREATE TABLE "whatsapp_automations" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "lead_status" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message_id" TEXT,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_automations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_automations_lead_id_idx" ON "whatsapp_automations"("lead_id");
CREATE INDEX "whatsapp_automations_status_idx" ON "whatsapp_automations"("status");
CREATE INDEX "whatsapp_automations_created_at_idx" ON "whatsapp_automations"("created_at");
