-- ===========================================================
-- 🔐 Tabela para credenciais biométricas (WebAuthn)
-- Execute este SQL no Supabase SQL Editor
-- ===========================================================

CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT,
    attestation_object TEXT,
    device_name TEXT DEFAULT 'Desconhecido',
    sign_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id);

-- RLS (Row Level Security) - Permitir acesso anônimo para login biométrico
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode ler (necessário para login biométrico sem sessão)
CREATE POLICY "allow_read_webauthn" ON webauthn_credentials
    FOR SELECT USING (true);

-- Política: qualquer um pode inserir (registro durante cadastro)
CREATE POLICY "allow_insert_webauthn" ON webauthn_credentials
    FOR INSERT WITH CHECK (true);

-- Política: qualquer um pode atualizar (atualizar sign_count)
CREATE POLICY "allow_update_webauthn" ON webauthn_credentials
    FOR UPDATE USING (true);

-- Política: qualquer um pode deletar (remover credencial)
CREATE POLICY "allow_delete_webauthn" ON webauthn_credentials
    FOR DELETE USING (true);
