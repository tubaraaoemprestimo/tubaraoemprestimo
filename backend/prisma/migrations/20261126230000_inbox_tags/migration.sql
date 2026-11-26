-- Etiquetas da Central WhatsApp. Aditiva: só tabelas novas + etiquetas iniciais.
BEGIN;
CREATE TABLE IF NOT EXISTS "wa_tags" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#D4AF37',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "wa_tags_name_key" ON "wa_tags"("name");
CREATE TABLE IF NOT EXISTS "wa_conversation_tags" (
  "conversation_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("conversation_id", "tag_id")
);
CREATE INDEX IF NOT EXISTS "wa_conversation_tags_tag_id_idx" ON "wa_conversation_tags"("tag_id");
INSERT INTO "wa_tags" ("id", "name", "color") VALUES
  (gen_random_uuid()::text, 'Interessado', '#22c55e'),
  (gen_random_uuid()::text, 'Lead novo', '#3b82f6'),
  (gen_random_uuid()::text, 'Documentação pendente', '#f59e0b'),
  (gen_random_uuid()::text, 'Aguardando pagamento', '#eab308'),
  (gen_random_uuid()::text, 'Negociando', '#a855f7'),
  (gen_random_uuid()::text, 'Cliente ativo', '#10b981'),
  (gen_random_uuid()::text, 'Não atende', '#6b7280'),
  (gen_random_uuid()::text, 'Sem interesse', '#ef4444')
ON CONFLICT ("name") DO NOTHING;
COMMIT;
