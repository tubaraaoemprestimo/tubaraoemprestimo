-- ============================================
-- TABELAS DE SEGURANÇA DE DISPOSITIVOS
-- Sistema inteligente de detecção de fraude
-- Execute este SQL no Supabase
-- ============================================

-- 1. DISPOSITIVOS CONFIÁVEIS (trusted devices por usuário)
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    device_fingerprint TEXT NOT NULL,  -- Hash único do dispositivo
    device_name TEXT,                   -- Nome amigável: "iPhone 14 Pro", "Samsung Galaxy S23"
    device_model TEXT,                  -- Modelo detectado
    platform TEXT,                      -- Android, iOS, Windows, etc
    browser TEXT,                       -- Chrome, Safari, Firefox
    screen_resolution TEXT,
    last_ip TEXT,
    last_location_lat DECIMAL(10, 8),
    last_location_lng DECIMAL(11, 8),
    is_verified BOOLEAN DEFAULT FALSE,  -- Se foi verificado por OTP/email
    is_primary BOOLEAN DEFAULT FALSE,   -- Dispositivo principal do usuário
    trust_score INTEGER DEFAULT 100,    -- Score de confiança (100 = máximo)
    login_count INTEGER DEFAULT 1,      -- Quantas vezes logou deste dispositivo
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_model ON trusted_devices(device_model);

-- 2. BLOQUEIOS DE SEGURANÇA
CREATE TABLE IF NOT EXISTS security_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    block_type TEXT NOT NULL,           -- 'new_device', 'suspicious_location', 'high_risk', 'multiple_devices'
    block_reason TEXT NOT NULL,
    device_fingerprint TEXT,
    ip_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    device_info JSONB,                  -- Info completa do dispositivo que tentou acessar
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,                   -- Admin que resolveu
    resolution_notes TEXT,
    expires_at TIMESTAMPTZ,             -- Bloqueio temporário expira
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_blocks_user ON security_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_security_blocks_resolved ON security_blocks(is_resolved);

-- 3. ALERTAS DE SEGURANÇA (para o admin)
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    alert_type TEXT NOT NULL,           -- 'new_device', 'blocked_access', 'high_risk_login', 'location_change'
    severity TEXT DEFAULT 'medium',     -- 'low', 'medium', 'high', 'critical'
    title TEXT NOT NULL,
    description TEXT,
    device_info JSONB,
    ip_address TEXT,
    location JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    is_actioned BOOLEAN DEFAULT FALSE,  -- Admin tomou ação
    action_taken TEXT,
    action_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_read ON security_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

-- 4. CONFIGURAÇÕES DE SEGURANÇA DO SISTEMA
CREATE TABLE IF NOT EXISTS security_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO security_settings (setting_key, setting_value, description) VALUES
    ('block_new_devices', 'true', 'Bloquear automaticamente login de dispositivos novos'),
    ('require_verification_new_device', 'true', 'Requer verificação OTP para novos dispositivos'),
    ('max_devices_per_user', '3', 'Número máximo de dispositivos confiáveis por usuário'),
    ('block_different_model', 'true', 'Bloquear se modelo do celular for diferente do registrado'),
    ('notify_admin_new_device', 'true', 'Notificar admin quando detectar dispositivo novo'),
    ('auto_block_high_risk', 'true', 'Bloquear automaticamente acessos com score > 70'),
    ('suspicious_location_radius_km', '50', 'Raio em km para considerar localização suspeita'),
    ('session_timeout_minutes', '60', 'Tempo de sessão em minutos'),
    ('max_failed_attempts', '3', 'Tentativas máximas antes de bloqueio temporário')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para funcionamento
CREATE POLICY "Allow all for trusted_devices" ON trusted_devices FOR ALL USING (true);
CREATE POLICY "Allow all for security_blocks" ON security_blocks FOR ALL USING (true);
CREATE POLICY "Allow all for security_alerts" ON security_alerts FOR ALL USING (true);
CREATE POLICY "Allow all for security_settings" ON security_settings FOR ALL USING (true);

-- ============================================
-- VERIFICAR CRIAÇÃO
-- ============================================
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('trusted_devices', 'security_blocks', 'security_alerts', 'security_settings');
