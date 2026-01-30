-- CORREÇÃO DE LINKS NO BANCO DE DADOS
-- Execute este script no SQL Editor do Supabase para atualizar links antigos em templates já salvos.

-- 1. Regras de Cobrança
UPDATE collection_rules 
SET message_template = REPLACE(message_template, 'https://tubaraoemprestimo.vercel.app/', 'https://www.tubaraoemprestimo.com.br/#/login')
WHERE message_template LIKE '%https://tubaraoemprestimo.vercel.app/%';

UPDATE collection_rules 
SET message_template = REPLACE(message_template, 'https://tubaraoemprestimo.com.br', 'https://www.tubaraoemprestimo.com.br/#/login')
WHERE message_template LIKE '%https://tubaraoemprestimo.com.br%';

-- 2. Templates de Mensagens Manuais/Massa
UPDATE message_templates
SET content = REPLACE(content, 'https://tubaraoemprestimo.vercel.app/', 'https://www.tubaraoemprestimo.com.br/#/login')
WHERE content LIKE '%https://tubaraoemprestimo.vercel.app/%';

-- 3. Campanhas (se houver links na descrição)
UPDATE campaigns
SET description = REPLACE(description, 'https://tubaraoemprestimo.vercel.app/', 'https://www.tubaraoemprestimo.com.br/#/login')
WHERE description LIKE '%https://tubaraoemprestimo.vercel.app/%';
