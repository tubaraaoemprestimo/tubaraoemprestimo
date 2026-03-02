-- ============================================
-- TABELAS DE ANTIFRAUDE E SEGURANÇA
-- Execute este SQL no Supabase
-- ============================================

-- 1. LOGS DE RISCO (captura silenciosa de dados)
CREATE TABLE IF NOT EXISTS risk_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    session_id TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    platform TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    action TEXT NOT NULL,
    risk_score INTEGER DEFAULT 0,
    risk_factors TEXT[] DEFAULT '{}',
    additional_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_risk_logs_ip ON risk_logs(ip);
CREATE INDEX IF NOT EXISTS idx_risk_logs_user ON risk_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_logs_session ON risk_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_logs_created ON risk_logs(created_at);

-- 2. LINKS TEMPORÁRIOS
CREATE TABLE IF NOT EXISTS temporary_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_links_token ON temporary_links(token);

-- 3. ASSINATURAS DE CONTRATO
CREATE TABLE IF NOT EXISTS contract_signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id TEXT NOT NULL,
    user_id UUID,
    session_id TEXT NOT NULL,
    signature_image TEXT,
    accepted_terms BOOLEAN DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT,
    platform TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    facial_verified BOOLEAN DEFAULT FALSE,
    document_verified BOOLEAN DEFAULT FALSE,
    liveness_verified BOOLEAN DEFAULT FALSE,
    otp_verified BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_sig_contract ON contract_signatures(contract_id);

-- 4. LIVENESS CHALLENGES
CREATE TABLE IF NOT EXISTS liveness_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    session_id TEXT NOT NULL,
    challenge_type TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    image_capture TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 5. OTP CODES
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    phone TEXT,
    email TEXT,
    code TEXT NOT NULL,
    type TEXT DEFAULT 'whatsapp',
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_code ON otp_codes(code);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

-- 6. SESSÕES DE USUÁRIO
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);

-- ============================================
-- ROW LEVEL SECURITY (Simplificado)
-- ============================================

ALTER TABLE risk_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE liveness_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para funcionamento
CREATE POLICY "Allow all for risk_logs" ON risk_logs FOR ALL USING (true);
CREATE POLICY "Allow all for temporary_links" ON temporary_links FOR ALL USING (true);
CREATE POLICY "Allow all for contract_signatures" ON contract_signatures FOR ALL USING (true);
CREATE POLICY "Allow all for liveness_verifications" ON liveness_verifications FOR ALL USING (true);
CREATE POLICY "Allow all for otp_codes" ON otp_codes FOR ALL USING (true);
CREATE POLICY "Allow all for user_sessions" ON user_sessions FOR ALL USING (true);

-- ============================================
-- VERIFICAR
-- ============================================
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('risk_logs', 'temporary_links', 'contract_signatures', 'liveness_verifications', 'otp_codes', 'user_sessions');
