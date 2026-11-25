-- Pendências dos clientes antigos (25/11/2026). SOMENTE ACRÉSCIMOS (autorizado pelo dono).
-- Aplicar: docker exec -i tubarao_postgres psql -v ON_ERROR_STOP=1 -U postgres -d tubarao_db < migration.sql
BEGIN;

-- Preferências de comunicação do titular (Central 360°). Padrões preservam o comportamento atual.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS invite_opt_out BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS promo_opt_out BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS comm_suspended_until TIMESTAMP(3);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS comm_suspended_reason TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS comm_prefs_updated_at TIMESTAMP(3);

-- Contrato original anexado (qualquer serviço legado).
ALTER TABLE loans ADD COLUMN IF NOT EXISTS legacy_document_url TEXT;

-- Celular vendido antes do sistema: dados do aparelho e da venda original, ligados ao contrato legado.
-- Não usa phone_sales/phone_inventory_units: não há venda nova nem baixa de estoque.
CREATE TABLE IF NOT EXISTS legacy_device_financings (
    id                    TEXT PRIMARY KEY,
    loan_id               TEXT NOT NULL UNIQUE REFERENCES loans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    brand                 TEXT,
    model                 TEXT,
    device_identifier     TEXT,
    original_sale_date    TIMESTAMP(3),
    original_price        DOUBLE PRECISION,
    down_payment          DOUBLE PRECISION,
    financed_amount       DOUBLE PRECISION,
    original_installments INTEGER,
    paid_installments     INTEGER,
    position_date         TIMESTAMP(3),
    created_at            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Investimento antigo: natureza diferente de dívida (a empresa deve ao investidor). Fora da régua.
CREATE TABLE IF NOT EXISTS investment_records (
    id                  TEXT PRIMARY KEY,
    customer_id         TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    is_legacy           BOOLEAN NOT NULL DEFAULT true,
    reference           TEXT,
    original_date       TIMESTAMP(3),
    amount              DOUBLE PRECISION NOT NULL,
    yield_terms         TEXT,                 -- condições contratadas, como estão no contrato
    monthly_rate        DOUBLE PRECISION,     -- % ao mês, só se estiver no contrato
    payout_frequency    TEXT,                 -- MONTHLY | QUARTERLY | AT_MATURITY | OTHER
    paid_yields_total   DOUBLE PRECISION,     -- rendimentos comprovadamente já pagos (informativo)
    pending_confirmed   DOUBLE PRECISION,     -- valor pendente conferido
    next_payout_date    TIMESTAMP(3),
    maturity_date       TIMESTAMP(3),
    status              TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | PENDING_REVIEW | REDEEMED | CANCELLED
    contract_url        TEXT,
    notes               TEXT,
    created_by          TEXT NOT NULL,
    created_at          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_investment_reference ON investment_records (customer_id, reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investment_customer ON investment_records (customer_id);

-- Repasses ao investidor registrados pelo admin (lançamento de caixa só quando é repasse novo, feito agora).
CREATE TABLE IF NOT EXISTS investment_payouts (
    id             TEXT PRIMARY KEY,
    investment_id  TEXT NOT NULL REFERENCES investment_records(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    paid_at        TIMESTAMP(3) NOT NULL,
    amount         DOUBLE PRECISION NOT NULL,
    receipt_url    TEXT,
    transaction_id TEXT,
    notes          TEXT,
    created_by     TEXT NOT NULL,
    created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_investment_payouts ON investment_payouts (investment_id, paid_at);

-- Contestações: suspendem lembretes/cobranças da obrigação enquanto abertas. Não mexem em saldo.
CREATE TABLE IF NOT EXISTS disputes (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    loan_id         TEXT NOT NULL REFERENCES loans(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    installment_id  TEXT,                       -- vazio = contrato inteiro
    receipt_id      TEXT,
    reason          TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'OPEN',  -- OPEN | IN_REVIEW | WAITING_DOCS | RESOLVED
    opened_by       TEXT NOT NULL,
    opened_by_role  TEXT NOT NULL,              -- ADMIN | CLIENT
    document_urls   JSONB,
    history         JSONB,
    resolution      TEXT,
    resolved_by     TEXT,
    resolved_at     TIMESTAMP(3),
    created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_disputes_loan_status ON disputes (loan_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status, created_at);

COMMIT;
