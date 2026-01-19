-- ============================================
-- RESET COMPLETO DE POLÍTICAS RLS - TABELA USERS
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. DESABILITAR RLS TEMPORARIAMENTE (para limpar)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
    END LOOP;
END $$;

-- 3. RE-HABILITAR RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICA PERMISSIVA PARA LEITURA (authenticated pode ler tudo)
CREATE POLICY "users_select_authenticated" ON users
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. CRIAR POLÍTICA PARA UPDATE DO PRÓPRIO PERFIL
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    TO authenticated
    USING (auth_id = auth.uid())
    WITH CHECK (auth_id = auth.uid());

-- 6. CRIAR POLÍTICA PARA ADMIN FAZER TUDO
CREATE POLICY "users_admin_all" ON users
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() 
            AND role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() 
            AND role = 'ADMIN'
        )
    );

-- 7. POLÍTICA PARA SERVICE ROLE (Edge Functions)
CREATE POLICY "users_service_role" ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 8. VERIFICAR POLÍTICAS CRIADAS
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'users';

-- 9. VERIFICAR DADOS
SELECT id, auth_id, name, email, role FROM users ORDER BY role DESC;

-- 10. TESTAR: Simular busca que o app faz
-- Substitua 'd32dcb99-9a1f-48fe-98b3-f913607f2572' pelo auth_id do admin
SELECT * FROM users WHERE auth_id = 'd32dcb99-9a1f-48fe-98b3-f913607f2572';
