-- Legacy compatibility tables from Supabase schema
-- Adapted for current PostgreSQL (TEXT ids used across backend models)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS investor_requests (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    customer_id TEXT,
    full_name VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20) NOT NULL,
    rg_cnh VARCHAR(50),
    birth_date DATE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    bank_name VARCHAR(255),
    pix_key TEXT,
    pix_key_type VARCHAR(20) DEFAULT 'cpf',
    account_holder_name VARCHAR(255),
    investment_amount DECIMAL(15,2) NOT NULL,
    investment_tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    payout_mode VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    monthly_rate DECIMAL(5,2) NOT NULL,
    contract_months INTEGER NOT NULL DEFAULT 12,
    auto_renew BOOLEAN DEFAULT true,
    withdrawal_notice_months INTEGER DEFAULT 3,
    terms_accepted BOOLEAN DEFAULT false,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    signature_url TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    admin_notes TEXT,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    id_card_url TEXT,
    id_card_back_url TEXT,
    proof_of_address_url TEXT,
    selfie_url TEXT,
    profile_type VARCHAR(20) DEFAULT 'INVESTIDOR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_documents (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    type VARCHAR(50) NOT NULL,
    customer_id TEXT,
    customer_name VARCHAR(255) NOT NULL,
    loan_id TEXT,
    title VARCHAR(255) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    qr_code VARCHAR(500),
    content TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    signed_at TIMESTAMP WITH TIME ZONE,
    signature_data TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT',
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    customer_id TEXT,
    customer_name VARCHAR(255) NOT NULL,
    loan_id TEXT,
    installment_id TEXT,
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(100),
    description TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discharge_declarations (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    customer_id TEXT,
    customer_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    loan_id TEXT,
    original_amount DECIMAL(12,2) NOT NULL,
    total_paid DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS openfinance_analyses (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    customer_id TEXT,
    cpf VARCHAR(14) NOT NULL,
    provider VARCHAR(100),
    score INTEGER,
    risk_level VARCHAR(50),
    monthly_income DECIMAL(12,2),
    monthly_expenses DECIMAL(12,2),
    debt_ratio DECIMAL(5,2),
    credit_limit_suggested DECIMAL(12,2),
    analysis_data JSONB,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    user_id TEXT UNIQUE,
    level VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    can_approve_loans BOOLEAN DEFAULT FALSE,
    can_reject_loans BOOLEAN DEFAULT FALSE,
    can_view_reports BOOLEAN DEFAULT TRUE,
    can_export_data BOOLEAN DEFAULT FALSE,
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_manage_settings BOOLEAN DEFAULT FALSE,
    can_send_messages BOOLEAN DEFAULT FALSE,
    can_view_customers BOOLEAN DEFAULT TRUE,
    can_edit_customers BOOLEAN DEFAULT FALSE,
    can_view_financials BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS renegotiations (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    customer_id TEXT,
    customer_name VARCHAR(255) NOT NULL,
    original_loan_id TEXT,
    original_amount DECIMAL(12,2) NOT NULL,
    remaining_amount DECIMAL(12,2) NOT NULL,
    days_overdue INTEGER DEFAULT 0,
    new_amount DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    new_installments INTEGER NOT NULL,
    new_installment_value DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_scores (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    customer_id TEXT UNIQUE,
    score INTEGER NOT NULL DEFAULT 500,
    level VARCHAR(50) NOT NULL DEFAULT 'REGULAR',
    payment_history INTEGER DEFAULT 0,
    on_time_payments INTEGER DEFAULT 0,
    late_payments INTEGER DEFAULT 0,
    average_delay_days INTEGER DEFAULT 0,
    total_loans INTEGER DEFAULT 0,
    active_loans INTEGER DEFAULT 0,
    defaulted_loans INTEGER DEFAULT 0,
    relationship_months INTEGER DEFAULT 0,
    suggested_limit DECIMAL(12,2) DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_payments (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    request_id TEXT,
    customer_id TEXT,
    payment_type VARCHAR(50) NOT NULL DEFAULT 'JUROS',
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_month VARCHAR(7),
    reference_year INTEGER,
    proof_url TEXT,
    confirmed BOOLEAN DEFAULT false,
    confirmed_by VARCHAR(255),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_receipts (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    customer_id TEXT,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    cpf VARCHAR(14),
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(100) DEFAULT 'PIX',
    transaction_id VARCHAR(255),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date DATE,
    month_reference VARCHAR(20),
    notes TEXT,
    proof_url TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_requests_status ON investor_requests(status);
CREATE INDEX IF NOT EXISTS idx_generated_documents_customer_id ON generated_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_customer_id ON receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_discharge_customer_id ON discharge_declarations(customer_id);
CREATE INDEX IF NOT EXISTS idx_openfinance_customer ON openfinance_analyses(customer_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_renegotiations_customer ON renegotiations(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_scores_customer ON client_scores(customer_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_request ON loan_payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_customer ON payment_receipts(customer_id);
