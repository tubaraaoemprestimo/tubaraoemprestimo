-- ==============================================
-- CONFIGURAR EVOLUTION API - TUBARÃO EMPRÉSTIMOS
-- Execute este script no Supabase SQL Editor
-- ==============================================

UPDATE whatsapp_config
SET 
    api_url = 'https://api.tubaraoemprestimo.com.br',
    api_key = 'B8959800-F546-407C-99E8-C40306E747F5',
    instance_name = 'tubarao',
    is_connected = false,
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Verificar se atualizou
SELECT * FROM whatsapp_config;

-- ==============================================
-- PRÓXIMOS PASSOS:
-- 1. Acesse o painel admin -> Configurações -> WhatsApp
-- 2. Clique em "Gerar QR Code"
-- 3. Escaneie com o celular
-- 4. Pronto! WhatsApp conectado!
-- ==============================================
