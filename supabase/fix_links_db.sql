-- CORREÇÃO DE LINKS NO BANCO DE DADOS (VERSÃO FINAL - RAIZ)
-- Execute este script no SQL Editor do Supabase para atualizar links antigos para a nova estrutura de raiz (https://www.tubaraoemprestimo.com.br/).

-- 1. Regras de Cobrança
UPDATE collection_rules 
SET message_template = REPLACE(message_template, 'https://tubaraoemprestimo.vercel.app/', 'https://www.tubaraoemprestimo.com.br/')
WHERE message_template LIKE '%https://tubaraoemprestimo.vercel.app/%';

UPDATE collection_rules 
SET message_template = REPLACE(message_template, 'https://www.tubaraoemprestimo.com.br/#/login', 'https://www.tubaraoemprestimo.com.br/')
WHERE message_template LIKE '%https://www.tubaraoemprestimo.com.br/#/login%';

UPDATE collection_rules 
SET message_template = REPLACE(message_template, 'https://tubaraoemprestimo.com.br', 'https://www.tubaraoemprestimo.com.br/')
WHERE message_template LIKE '%https://tubaraoemprestimo.com.br%' AND message_template NOT LIKE '%https://www.tubaraoemprestimo.com.br/%';


-- 2. Templates de Mensagens Manuais/Massa
UPDATE message_templates
SET content = REPLACE(content, 'https://tubaraoemprestimo.vercel.app/', 'https://www.tubaraoemprestimo.com.br/')
WHERE content LIKE '%https://tubaraoemprestimo.vercel.app/%';

UPDATE message_templates
SET content = REPLACE(content, 'https://www.tubaraoemprestimo.com.br/#/login', 'https://www.tubaraoemprestimo.com.br/')
WHERE content LIKE '%https://www.tubaraoemprestimo.com.br/#/login%';


-- 3. Campanhas (se houver links na descrição)
UPDATE campaigns
SET description = REPLACE(description, 'https://tubaraoemprestimo.vercel.app/', 'https://www.tubaraoemprestimo.com.br/')
WHERE description LIKE '%https://tubaraoemprestimo.vercel.app/%';

UPDATE campaigns
SET description = REPLACE(description, 'https://www.tubaraoemprestimo.com.br/#/login', 'https://www.tubaraoemprestimo.com.br/')
WHERE description LIKE '%https://www.tubaraoemprestimo.com.br/#/login%';
