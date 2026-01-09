-- ============================================
-- TABELAS ADICIONAIS PARA TUBARÃO EMPRÉSTIMOS
-- Execute no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. NOTIFICAÇÕES (notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO', -- INFO, SUCCESS, WARNING, ERROR
    read BOOLEAN DEFAULT FALSE,
    link VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- RLS para notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR is_admin());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR is_admin());

CREATE POLICY "Admins can insert notifications" ON notifications
    FOR INSERT WITH CHECK (is_admin());

-- ============================================
-- 2. DOCUMENTOS GERADOS (generated_documents)
-- ============================================
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- CONTRACT, RECEIPT, DISCHARGE
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    qr_code VARCHAR(500),
    content TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    signed_at TIMESTAMP WITH TIME ZONE,
    signature_data TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, SIGNED, EXPIRED, CANCELLED
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_customer_id ON generated_documents(customer_id);
CREATE INDEX idx_documents_hash ON generated_documents(hash);

-- RLS para generated_documents
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own documents" ON generated_documents
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Admins can manage documents" ON generated_documents
    FOR ALL USING (is_admin());

-- ============================================
-- 3. RECIBOS (receipts)
-- ============================================
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    installment_id UUID REFERENCES installments(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(100),
    description TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_receipts_customer_id ON receipts(customer_id);

-- RLS para receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own receipts" ON receipts
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Admins can manage receipts" ON receipts
    FOR ALL USING (is_admin());

-- ============================================
-- 4. DECLARAÇÕES DE QUITAÇÃO (discharge_declarations)
-- ============================================
CREATE TABLE IF NOT EXISTS discharge_declarations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    original_amount DECIMAL(12,2) NOT NULL,
    total_paid DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_declarations_customer_id ON discharge_declarations(customer_id);

-- RLS
ALTER TABLE discharge_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own declarations" ON discharge_declarations
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Admins can manage declarations" ON discharge_declarations
    FOR ALL USING (is_admin());

-- ============================================
-- 5. ROTAS DE COBRANÇA (collection_routes)
-- ============================================
CREATE TABLE IF NOT EXISTS collection_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    collector_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PLANNED', -- PLANNED, IN_PROGRESS, COMPLETED
    customers JSONB DEFAULT '[]', -- Array de customer_ids com ordem
    total_distance DECIMAL(10,2),
    estimated_duration INTEGER, -- em minutos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_routes_date ON collection_routes(date);
CREATE INDEX idx_routes_status ON collection_routes(status);

-- RLS
ALTER TABLE collection_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage routes" ON collection_routes
    FOR ALL USING (is_admin());

-- ============================================
-- 6. INDICAÇÕES (referrals)
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    referrer_name VARCHAR(255) NOT NULL,
    referred_name VARCHAR(255) NOT NULL,
    referred_cpf VARCHAR(14) NOT NULL,
    referred_phone VARCHAR(20),
    referred_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CONVERTED
    reward_amount DECIMAL(10,2) DEFAULT 0,
    reward_paid BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_customer_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own referrals" ON referrals
    FOR SELECT USING (
        referrer_customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Customers can create referrals" ON referrals
    FOR INSERT WITH CHECK (
        referrer_customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Admins can manage referrals" ON referrals
    FOR ALL USING (is_admin());

-- ============================================
-- 7. ANÁLISES OPEN FINANCE (openfinance_analyses)
-- ============================================
CREATE TABLE IF NOT EXISTS openfinance_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    cpf VARCHAR(14) NOT NULL,
    provider VARCHAR(100),
    score INTEGER,
    risk_level VARCHAR(50), -- LOW, MEDIUM, HIGH, VERY_HIGH
    monthly_income DECIMAL(12,2),
    monthly_expenses DECIMAL(12,2),
    debt_ratio DECIMAL(5,2),
    credit_limit_suggested DECIMAL(12,2),
    analysis_data JSONB,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_openfinance_customer ON openfinance_analyses(customer_id);
CREATE INDEX idx_openfinance_cpf ON openfinance_analyses(cpf);

-- RLS
ALTER TABLE openfinance_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own analyses" ON openfinance_analyses
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Admins can manage analyses" ON openfinance_analyses
    FOR ALL USING (is_admin());

-- ============================================
-- 8. PERMISSÕES DE USUÁRIO (user_permissions)
-- ============================================
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    level VARCHAR(50) NOT NULL DEFAULT 'VIEWER', -- ADMIN, MANAGER, OPERATOR, VIEWER
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

CREATE INDEX idx_permissions_user ON user_permissions(user_id);

-- RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions" ON user_permissions
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR is_admin());

CREATE POLICY "Admins can manage permissions" ON user_permissions
    FOR ALL USING (is_admin());

-- ============================================
-- 9. RENEGOCIAÇÕES (renegotiations)
-- ============================================
CREATE TABLE IF NOT EXISTS renegotiations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    original_loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    original_amount DECIMAL(12,2) NOT NULL,
    remaining_amount DECIMAL(12,2) NOT NULL,
    days_overdue INTEGER DEFAULT 0,
    new_amount DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    new_installments INTEGER NOT NULL,
    new_installment_value DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED, EXPIRED
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_renegotiations_customer ON renegotiations(customer_id);
CREATE INDEX idx_renegotiations_status ON renegotiations(status);

-- RLS
ALTER TABLE renegotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own renegotiations" ON renegotiations
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Admins can manage renegotiations" ON renegotiations
    FOR ALL USING (is_admin());

-- ============================================
-- 10. CLIENTE SCORES (client_scores)
-- ============================================
CREATE TABLE IF NOT EXISTS client_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
    score INTEGER NOT NULL DEFAULT 500,
    level VARCHAR(50) NOT NULL DEFAULT 'REGULAR', -- EXCELLENT, GOOD, REGULAR, BAD, CRITICAL
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

CREATE INDEX idx_scores_customer ON client_scores(customer_id);

-- RLS
ALTER TABLE client_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own score" ON client_scores
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR is_admin()
    );

CREATE POLICY "Admins can manage scores" ON client_scores
    FOR ALL USING (is_admin());

-- ============================================
-- SUCESSO!
-- ============================================
SELECT 'Todas as tabelas adicionais criadas com sucesso!' as resultado;
