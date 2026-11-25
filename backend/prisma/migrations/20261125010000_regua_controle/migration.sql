-- Controle da régua de cobrança (25/11/2026). SOMENTE ACRÉSCIMOS (autorizado pelo dono).
-- Aplicar: docker exec -i tubarao_postgres psql -v ON_ERROR_STOP=1 -U postgres -d tubarao_db < migration.sql
BEGIN;

-- Pausa só as MENSAGENS automáticas de um contrato (multas, juros e parcelas seguem normais).
-- Diferente de collection_suspended (contrato legado com saldo não conferido: fora de tudo).
ALTER TABLE loans ADD COLUMN IF NOT EXISTS messages_suspended BOOLEAN NOT NULL DEFAULT false;

-- Registro de cada lembrete/cobrança automática: garante que o mesmo aviso não sai duas vezes
-- (mesma cobrança, mesmo gatilho, mesmo vencimento) e alimenta o histórico e as falhas no painel.
CREATE TABLE IF NOT EXISTS collection_dispatches (
    id             TEXT PRIMARY KEY,
    loan_id        TEXT NOT NULL,
    installment_id TEXT NOT NULL,
    customer_id    TEXT NOT NULL,
    trigger_event  TEXT NOT NULL,
    due_date       TIMESTAMP(3) NOT NULL,
    status         TEXT NOT NULL,            -- SENT | FAILED
    channels       JSONB,
    error          TEXT,
    attempts       INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_collection_dispatch ON collection_dispatches (installment_id, trigger_event, due_date);
CREATE INDEX IF NOT EXISTS idx_collection_dispatch_loan ON collection_dispatches (loan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_collection_dispatch_created ON collection_dispatches (created_at);

COMMIT;
