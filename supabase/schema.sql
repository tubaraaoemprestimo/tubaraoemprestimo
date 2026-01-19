-- Tubarão Empréstimos - Schema do Banco de Dados
-- Criado para Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'CLIENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM ('PENDING', 'WAITING_DOCS', 'APPROVED', 'REJECTED', 'PAID', 'DEFAULTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE customer_status AS ENUM ('ACTIVE', 'BLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE installment_status AS ENUM ('OPEN', 'PAID', 'LATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('IN', 'OUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_category AS ENUM ('LOAN', 'PAYMENT', 'FEE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE collection_rule_type AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_category AS ENUM ('REMINDER', 'COLLECTION', 'WELCOME', 'APPROVAL', 'REJECTION', 'PAYMENT', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE campaign_frequency AS ENUM ('ONCE', 'DAILY', 'ALWAYS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role user_role DEFAULT 'CLIENT',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    status customer_status DEFAULT 'ACTIVE',
    internal_score INTEGER DEFAULT 500,
    total_debt DECIMAL(15,2) DEFAULT 0,
    active_loans_count INTEGER DEFAULT 0,
    address TEXT,
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    monthly_income DECIMAL(15,2),
    pre_approved_amount DECIMAL(15,2),
    pre_approved_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loan Requests table
CREATE TABLE IF NOT EXISTS loan_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    amount DECIMAL(15,2) NOT NULL,
    installments INTEGER NOT NULL,
    status loan_status DEFAULT 'PENDING',
    -- References
    father_phone VARCHAR(20),
    mother_phone VARCHAR(20),
    spouse_phone VARCHAR(20),
    -- Documents
    selfie_url TEXT,
    id_card_url TEXT,
    id_card_back_url TEXT,
    proof_of_address_url TEXT,
    proof_income_url TEXT,
    vehicle_url TEXT,
    video_selfie_url TEXT,
    video_house_url TEXT,
    video_vehicle_url TEXT,
    signature_url TEXT,
    -- Supplemental docs
    supplemental_description TEXT,
    supplemental_doc_url TEXT,
    supplemental_requested_at TIMESTAMP WITH TIME ZONE,
    supplemental_uploaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loans table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    request_id UUID REFERENCES loan_requests(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    installments_count INTEGER NOT NULL,
    remaining_amount DECIMAL(15,2) NOT NULL,
    status loan_status DEFAULT 'APPROVED',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Installments table
CREATE TABLE IF NOT EXISTS installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status installment_status DEFAULT 'OPEN',
    pix_code TEXT,
    proof_url TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type transaction_type NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category transaction_category NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collection Rules table
CREATE TABLE IF NOT EXISTS collection_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    days_offset INTEGER NOT NULL,
    type collection_rule_type NOT NULL,
    message_template TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message Templates table
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category message_category NOT NULL,
    content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    link TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    frequency campaign_frequency DEFAULT 'ONCE',
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blacklist table
CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cpf VARCHAR(14) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    added_by VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID,
    details TEXT,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Settings table (key-value store)
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brand Settings table
CREATE TABLE IF NOT EXISTS brand_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_name VARCHAR(255) DEFAULT 'TUBARÃO EMPRÉSTIMO',
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#FF0000',
    secondary_color VARCHAR(7) DEFAULT '#D4AF37',
    background_color VARCHAR(7) DEFAULT '#000000',
    company_name VARCHAR(255) DEFAULT 'Tubarão Empréstimos S.A.',
    cnpj VARCHAR(18) DEFAULT '00.000.000/0001-00',
    address TEXT DEFAULT 'Av. Paulista, 1000 - São Paulo, SP',
    phone VARCHAR(20) DEFAULT '(11) 99999-9999',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Config table
CREATE TABLE IF NOT EXISTS whatsapp_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_url TEXT,
    api_key TEXT,
    instance_name VARCHAR(255),
    is_connected BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goals Settings table
CREATE TABLE IF NOT EXISTS goals_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monthly_loan_goal DECIMAL(15,2) DEFAULT 600000,
    monthly_client_goal INTEGER DEFAULT 60,
    monthly_approval_rate_goal INTEGER DEFAULT 75,
    projections JSONB DEFAULT '[]',
    expected_growth_rate DECIMAL(5,2) DEFAULT 12,
    goal_period VARCHAR(10) DEFAULT '01/2026',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loan Packages table
CREATE TABLE IF NOT EXISTS loan_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    min_value DECIMAL(15,2) NOT NULL,
    max_value DECIMAL(15,2) NOT NULL,
    min_installments INTEGER NOT NULL,
    max_installments INTEGER NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON loan_requests(status);
CREATE INDEX IF NOT EXISTS idx_loan_requests_customer ON loan_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_installments_loan ON installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_blacklist_cpf ON blacklist(cpf);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_packages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE auth_id = auth.uid() 
        AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's customer_id
CREATE OR REPLACE FUNCTION get_my_customer_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT c.id FROM customers c
        JOIN users u ON c.user_id = u.id
        WHERE u.auth_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage users" ON users
    FOR ALL USING (is_admin());

-- Customers policies
CREATE POLICY "Customers can view own data" ON customers
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR is_admin());

CREATE POLICY "Admins can manage customers" ON customers
    FOR ALL USING (is_admin());

CREATE POLICY "Allow insert for authenticated" ON customers
    FOR INSERT WITH CHECK (true);

-- Loan Requests policies
CREATE POLICY "Clients can view own requests" ON loan_requests
    FOR SELECT USING (customer_id = get_my_customer_id() OR is_admin());

CREATE POLICY "Clients can create requests" ON loan_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage requests" ON loan_requests
    FOR ALL USING (is_admin());

-- Loans policies
CREATE POLICY "Clients can view own loans" ON loans
    FOR SELECT USING (customer_id = get_my_customer_id() OR is_admin());

CREATE POLICY "Admins can manage loans" ON loans
    FOR ALL USING (is_admin());

-- Installments policies
CREATE POLICY "Clients can view own installments" ON installments
    FOR SELECT USING (
        loan_id IN (SELECT id FROM loans WHERE customer_id = get_my_customer_id())
        OR is_admin()
    );

CREATE POLICY "Clients can update own installments" ON installments
    FOR UPDATE USING (
        loan_id IN (SELECT id FROM loans WHERE customer_id = get_my_customer_id())
    );

CREATE POLICY "Admins can manage installments" ON installments
    FOR ALL USING (is_admin());

-- Transactions - Admin only
CREATE POLICY "Admins can manage transactions" ON transactions
    FOR ALL USING (is_admin());

-- Collection Rules - Admin only
CREATE POLICY "Admins can manage collection rules" ON collection_rules
    FOR ALL USING (is_admin());

-- Message Templates - Admin only
CREATE POLICY "Admins can manage templates" ON message_templates
    FOR ALL USING (is_admin());

-- Campaigns - Public read, admin write
CREATE POLICY "Anyone can view active campaigns" ON campaigns
    FOR SELECT USING (active = true AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE);

CREATE POLICY "Admins can manage campaigns" ON campaigns
    FOR ALL USING (is_admin());

-- Blacklist - Admin only
CREATE POLICY "Admins can manage blacklist" ON blacklist
    FOR ALL USING (is_admin());

-- Audit Logs - Admin only
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (is_admin());

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- System Settings - Admin only
CREATE POLICY "Everyone can read settings" ON system_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON system_settings
    FOR ALL USING (is_admin());

-- Brand Settings - Public read, admin write
CREATE POLICY "Anyone can read brand settings" ON brand_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage brand settings" ON brand_settings
    FOR ALL USING (is_admin());

-- WhatsApp Config - Admin only
CREATE POLICY "Admins can manage whatsapp config" ON whatsapp_config
    FOR ALL USING (is_admin());

-- Goals Settings - Admin only
CREATE POLICY "Admins can manage goals" ON goals_settings
    FOR ALL USING (is_admin());

CREATE POLICY "Anyone can read goals" ON goals_settings
    FOR SELECT USING (true);

-- Loan Packages - Public read, admin write
CREATE POLICY "Anyone can read packages" ON loan_packages
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage packages" ON loan_packages
    FOR ALL USING (is_admin());

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default brand settings
INSERT INTO brand_settings (id, system_name, primary_color, secondary_color, background_color, company_name, cnpj, address, phone)
VALUES (uuid_generate_v4(), 'TUBARÃO EMPRÉSTIMO', '#FF0000', '#D4AF37', '#000000', 'Tubarão Empréstimos S.A.', '00.000.000/0001-00', 'Av. Paulista, 1000 - São Paulo, SP', '(11) 99999-9999')
ON CONFLICT DO NOTHING;

-- Insert default goals settings
INSERT INTO goals_settings (id, monthly_loan_goal, monthly_client_goal, monthly_approval_rate_goal, expected_growth_rate, goal_period, projections)
VALUES (
    uuid_generate_v4(), 
    600000, 
    60, 
    75, 
    12, 
    '01/2026',
    '[{"month":"Jan","target":80000},{"month":"Fev","target":95000},{"month":"Mar","target":110000},{"month":"Abr","target":125000},{"month":"Mai","target":140000},{"month":"Jun","target":155000},{"month":"Jul","target":170000},{"month":"Ago","target":185000},{"month":"Set","target":200000},{"month":"Out","target":215000},{"month":"Nov","target":230000},{"month":"Dez","target":250000}]'
)
ON CONFLICT DO NOTHING;

-- Insert default system settings
INSERT INTO system_settings (id, key, value)
VALUES 
    (uuid_generate_v4(), 'monthlyInterestRate', '5'),
    (uuid_generate_v4(), 'lateFeeRate', '2')
ON CONFLICT (key) DO NOTHING;

-- Insert default whatsapp config
INSERT INTO whatsapp_config (id, api_url, api_key, instance_name, is_connected)
VALUES (uuid_generate_v4(), '', '', '', false)
ON CONFLICT DO NOTHING;

-- Insert default admin user (will be linked to auth user later)
-- Password: admin (need to create via Supabase Auth)

-- ============================================
-- STORAGE BUCKETS (run in Supabase Dashboard)
-- ============================================
-- Note: These need to be created via Supabase Dashboard or API
-- Buckets needed:
-- - documents (for ID cards, proof of address, etc.)
-- - selfies (for selfie photos/videos)
-- - contracts (for generated contracts)
-- - signatures (for digital signatures)
