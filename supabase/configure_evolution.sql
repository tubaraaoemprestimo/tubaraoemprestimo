-- ==============================================
-- CONFIGURAR EVOLUTION API - TUBARÃO EMPRÉSTIMOS
-- Execute este script no Supabase SQL Editor
-- ==============================================

UPDATE whatsapp_config
SET 
    api_url = 'https://frozenbarracuda-evolution.cloudfy.live',
    api_key = '423xvTJtFzdL2i2bDN6hUHhTsaOXuL2S',
    instance_name = 'tubarao-emprestimos',
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
