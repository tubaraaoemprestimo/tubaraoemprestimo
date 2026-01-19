-- ==============================================
-- TUBARÃO EMPRÉSTIMOS - Garantir WhatsApp Evolution API
-- Execute este script no Supabase SQL Editor
-- ==============================================

-- 1. Garantir que a tabela whatsapp_config existe
CREATE TABLE IF NOT EXISTS whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_url TEXT,
    api_key TEXT,
    instance_name VARCHAR(255),
    is_connected BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Desabilitar RLS para evitar problemas de permissão
ALTER TABLE whatsapp_config DISABLE ROW LEVEL SECURITY;

-- 3. Inserir configuração padrão se não existir
INSERT INTO whatsapp_config (id, api_url, api_key, instance_name, is_connected)
SELECT 
    'a0000000-0000-0000-0000-000000000001'::uuid,
    '',
    '',
    'tubarao-instance',
    false
WHERE NOT EXISTS (
    SELECT 1 FROM whatsapp_config LIMIT 1
);

-- 4. Verificar configuração atual
SELECT * FROM whatsapp_config;

-- ==============================================
-- INSTRUÇÕES DE CONFIGURAÇÃO DA EVOLUTION API:
-- ==============================================
-- 
-- 1. Acesse sua Evolution API (ex: https://api.yourserver.com)
-- 
-- 2. No painel administrativo do Tubarão Empréstimos:
--    - Vá em Configurações -> aba WhatsApp
--    
-- 3. Preencha os campos:
--    - URL da API: URL completa da sua Evolution API
--      Exemplo: https://api.evolution.com.br
--    
--    - Chave da API (apikey): Sua chave de autenticação
--      Você encontra no arquivo .env da Evolution API
--    
--    - Nome da Instância: Nome único para identificar a conexão
--      Exemplo: tubarao-whatsapp
--    
-- 4. Clique em "Salvar Configuração"
-- 
-- 5. Clique em "Gerar QR Code"
-- 
-- 6. Escaneie o QR Code com o WhatsApp do celular
-- 
-- 7. Aguarde a conexão ser estabelecida
-- 
-- ==============================================
-- TESTANDO A CONEXÃO:
-- ==============================================
-- 
-- Após conectar, você pode testar enviando uma mensagem
-- pela tela de Clientes -> Ações -> Enviar WhatsApp
-- 
-- ==============================================
