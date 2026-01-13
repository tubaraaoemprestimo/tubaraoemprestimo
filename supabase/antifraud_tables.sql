-- ============================================
-- TABELAS DE ANTIFRAUDE E SEGURANÇA
-- Execute este SQL no Supabase
-- ============================================

-- 1. LOGS DE RISCO (captura silenciosa de dados)
CREATE TABLE IF NOT EXISTS risk_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    platform TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    action TEXT NOT NULL, -- 'page_view', 'form_start', 'form_submit', 'login', etc
    risk_score INTEGER DEFAULT 0,
    risk_factors TEXT[] DEFAULT '{}',
    additional_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_risk_logs_ip ON risk_logs(ip);
CREATE INDEX IF NOT EXISTS idx_risk_logs_user ON risk_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_logs_session ON risk_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_risk_logs_created ON risk_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_logs_score ON risk_logs(risk_score);

-- 2. LINKS TEMPORÁRIOS (expiráveis)
CREATE TABLE IF NOT EXISTS temporary_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'contract', 'document', 'payment', 'otp'
    reference_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_links_token ON temporary_links(token);
CREATE INDEX IF NOT EXISTS idx_temp_links_expires ON temporary_links(expires_at);

-- 3. ASSINATURAS DE CONTRATO (prova jurídica)
CREATE TABLE IF NOT EXISTS contract_signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT NOT NULL,
    signature_image TEXT, -- Base64 da assinatura
    accepted_terms BOOLEAN DEFAULT FALSE,
    
    -- Dados de identificação para prova jurídica
    ip_address TEXT,
    user_agent TEXT,
    platform TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Verificações completadas
    facial_verified BOOLEAN DEFAULT FALSE,
    document_verified BOOLEAN DEFAULT FALSE,
    liveness_verified BOOLEAN DEFAULT FALSE,
    otp_verified BOOLEAN DEFAULT FALSE,
    
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_sig_contract ON contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_sig_user ON contract_signatures(user_id);

-- 4. LIVENESS CHALLENGES (prova de vida)
CREATE TABLE IF NOT EXISTS liveness_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT NOT NULL,
    
    challenge_type TEXT NOT NULL, -- 'blink', 'smile', 'turn_left', 'turn_right', 'nod'
    completed BOOLEAN DEFAULT FALSE,
    image_capture TEXT, -- Base64 da captura
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 5. OTP (códigos de verificação)
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    phone TEXT,
    email TEXT,
    code TEXT NOT NULL,
    type TEXT DEFAULT 'whatsapp', -- 'sms', 'whatsapp', 'email'
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_code ON otp_codes(code);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- 6. SESSÕES DE USUÁRIO (controle de expiração)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE risk_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE liveness_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para risk_logs
CREATE POLICY "Admins can view all risk logs" ON risk_logs
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "System can insert risk logs" ON risk_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Políticas para temporary_links
CREATE POLICY "Anyone can validate links" ON temporary_links
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "System can manage links" ON temporary_links
    FOR ALL TO authenticated
    USING (true);

-- Políticas para contract_signatures
CREATE POLICY "Users can view own signatures" ON contract_signatures
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "Users can insert own signatures" ON contract_signatures
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Políticas para liveness_verifications
CREATE POLICY "Users can manage own liveness" ON liveness_verifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- Políticas para otp_codes
CREATE POLICY "Users can view own OTP" ON otp_codes
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "System can manage OTP" ON otp_codes
    FOR ALL TO authenticated
    USING (true);

-- Políticas para user_sessions
CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- ============================================
-- FUNÇÃO: Limpar dados expirados
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Excluir links expirados há mais de 7 dias
    DELETE FROM temporary_links 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    -- Excluir OTPs expirados há mais de 1 dia
    DELETE FROM otp_codes 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Desativar sessões expiradas
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Excluir logs de risco antigos (mais de 90 dias)
    DELETE FROM risk_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICAR CRIAÇÃO
-- ============================================
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('risk_logs', 'temporary_links', 'contract_signatures', 'liveness_verifications', 'otp_codes', 'user_sessions');
