-- Clientes antigos: pré-cadastro administrativo, contratos legados e convite de ativação.
-- SOMENTE ACRÉSCIMOS (autorizado pelo dono em 25/11/2026). Nada é alterado nem apagado.
-- Aplicar: docker exec -i tubarao_postgres psql -v ON_ERROR_STOP=1 -U postgres -d tubarao_db < migration.sql
-- Rollback (só se nada novo tiver sido gravado): ver docs/clientes-legados/09-ROLLBACK.md
BEGIN;

-- Cliente: situação da ativação da conta (independente da situação financeira).
--   PRE_CADASTRO | CONVITE_ENVIADO | CONTA_ATIVA | TELEFONE_INVALIDO | SEM_CONTATO
-- NULL = cliente normal (já cadastrado pelo app); nada muda para os 2.6 mil atuais.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS activation_status TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;
-- Cliente pediu para não receber cobrança/convite por WhatsApp.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_opt_out BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_customers_is_legacy ON customers (is_legacy) WHERE is_legacy;

-- Contrato: marca de legado. Contrato legado NÃO gera desembolso nem lançamento de caixa.
--   legacy_balance_confirmed = saldo conferido pelo admin; sem isso não entra na régua.
ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS legacy_reference TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS legacy_original_date TIMESTAMP(3);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS legacy_paid_amount DOUBLE PRECISION;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS legacy_balance_date TIMESTAMP(3);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS legacy_balance_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS collection_suspended BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_loans_legacy_reference ON loans (customer_id, legacy_reference) WHERE legacy_reference IS NOT NULL;

-- Convite de ativação: guarda só o HASH do token (o token não fica no banco nem em log).
CREATE TABLE IF NOT EXISTS activation_invites (
    id           TEXT PRIMARY KEY,
    customer_id  TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    status       TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | USED | REVOKED | EXPIRED
    expires_at   TIMESTAMP(3) NOT NULL,
    created_by   TEXT NOT NULL,
    created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at      TIMESTAMP(3),
    revoked_at   TIMESTAMP(3),
    attempts     INTEGER NOT NULL DEFAULT 0,
    sent_at      TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS idx_activation_invites_customer ON activation_invites (customer_id, created_at);

-- Aviso de 5 dias (pedido do dono em 25/11): mesmos textos do aviso de 7 dias, trocando o prazo.
-- Só é disparado com COLLECTION_DUE_5_DAYS_ENABLED=true no backend.
INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT gen_random_uuid()::text, replace(name, '7 dias', '5 dias'), category, 'INSTALLMENT_DUE_5_DAYS', channel,
       replace(subject, '7 dias', '5 dias'), replace(content, '7 dias', '5 dias'), variables, true, CURRENT_TIMESTAMP
  FROM message_templates t
 WHERE t.trigger_event = 'INSTALLMENT_DUE_7_DAYS' AND t.is_active
   AND NOT EXISTS (SELECT 1 FROM message_templates x WHERE x.trigger_event = 'INSTALLMENT_DUE_5_DAYS' AND x.channel IS NOT DISTINCT FROM t.channel);

COMMIT;
