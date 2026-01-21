-- ============================================
-- FIX RLS POLICIES - Permitir que configurações sejam salvas
-- O problema é que o sistema usa autenticação customizada (localStorage)
-- e não o Supabase Auth nativo, então auth.uid() retorna NULL
-- ============================================

-- OPÇÃO 1: Desabilitar RLS temporariamente para tabelas de configuração
-- (Mais simples mas menos seguro - use apenas em ambiente controlado)

-- system_settings (taxas, PIX, etc)
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- whatsapp_config (API do WhatsApp)
ALTER TABLE whatsapp_config DISABLE ROW LEVEL SECURITY;

-- brand_settings (identidade visual)
ALTER TABLE brand_settings DISABLE ROW LEVEL SECURITY;

-- goals_settings (metas)
ALTER TABLE goals_settings DISABLE ROW LEVEL SECURITY;

-- collection_rules (régua de cobrança)
ALTER TABLE collection_rules DISABLE ROW LEVEL SECURITY;

-- loan_packages (pacotes de empréstimo)
ALTER TABLE loan_packages DISABLE ROW LEVEL SECURITY;

-- message_templates (templates de mensagens)
ALTER TABLE message_templates DISABLE ROW LEVEL SECURITY;

-- ============================================
-- OU OPÇÃO 2: Criar políticas mais permissivas
-- (Alternativa se preferir manter RLS ativo)
-- ============================================

/*
-- Remover políticas existentes e criar novas
DROP POLICY IF EXISTS "Everyone can read settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;

CREATE POLICY "Full access to settings" ON system_settings
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can manage whatsapp config" ON whatsapp_config;
CREATE POLICY "Full access to whatsapp config" ON whatsapp_config
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read brand settings" ON brand_settings;
DROP POLICY IF EXISTS "Admins can manage brand settings" ON brand_settings;
CREATE POLICY "Full access to brand settings" ON brand_settings
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can manage goals" ON goals_settings;
CREATE POLICY "Full access to goals settings" ON goals_settings
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can manage rules" ON collection_rules;
CREATE POLICY "Full access to collection rules" ON collection_rules
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read packages" ON loan_packages;
DROP POLICY IF EXISTS "Admins can manage packages" ON loan_packages;
CREATE POLICY "Full access to loan packages" ON loan_packages
    FOR ALL USING (true) WITH CHECK (true);
*/

-- ============================================
-- Verificar resultado
-- ============================================
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('system_settings', 'whatsapp_config', 'brand_settings', 'goals_settings', 'collection_rules', 'loan_packages', 'message_templates');

-- Deve mostrar 'f' (false) para RLS disabled
