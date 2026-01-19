-- ============================================
-- SINCRONIZAR USUÁRIOS DO AUTH COM TABELA USERS
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Primeiro verifique seus usuários no Auth
SELECT id, email, raw_user_meta_data->>'name' as name, created_at 
FROM auth.users 
ORDER BY created_at;

-- 2. Inserir admin@tubarao.local (se não existir)
INSERT INTO users (id, auth_id, name, email, role, created_at)
SELECT 
    gen_random_uuid(),
    au.id,
    COALESCE(au.raw_user_meta_data->>'name', 'Admin'),
    au.email,
    'ADMIN'::user_role,
    au.created_at
FROM auth.users au
WHERE au.email = 'admin@tubarao.local'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = au.email)
ON CONFLICT (email) DO NOTHING;

-- 3. Inserir os demais usuários como CLIENT
INSERT INTO users (id, auth_id, name, email, role, created_at)
SELECT 
    gen_random_uuid(),
    au.id,
    COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
    au.email,
    'CLIENT'::user_role,
    au.created_at
FROM auth.users au
WHERE au.email != 'admin@tubarao.local'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = au.email)
ON CONFLICT (email) DO NOTHING;

-- 4. Verificar resultado
SELECT id, name, email, role, auth_id, created_at 
FROM users 
ORDER BY created_at DESC;
