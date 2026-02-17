-- Script SQL para adicionar novos campos à tabela message_templates

-- Adiciona as colunas necessárias
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(255);
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS channel VARCHAR(50);
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS subject TEXT;

-- Cria índices para melhorar desempenho
CREATE INDEX IF NOT EXISTS idx_message_templates_trigger_event ON message_templates(trigger_event);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON message_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);

-- Inserir templates padrão
INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Aprovação de Empréstimo - Email',
    'loan_approval',
    'LOAN_APPROVED',
    'email',
    '✅ Empréstimo Aprovado — Tubarão Empréstimos',
    'Olá, {nome}!\n\nParabéns! Seu empréstimo de {valor} foi aprovado!\n\nAcesse o aplicativo para mais detalhes.\n\nChave PIX para pagamento: {pix_key}\n\nTubarão Empréstimos 🦈',
    '{nome,valor,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Aprovação de Empréstimo - Email');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Aprovação de Empréstimo - WhatsApp',
    'loan_approval',
    'LOAN_APPROVED',
    'whatsapp',
    NULL,
    '✅ *EMPRÉSTIMO APROVADO!*\n\nOlá, {nome}!\n\nParabéns! Seu empréstimo de *{valor}* foi *APROVADO*!\n\nAcesse o app para mais detalhes: https://www.tubaraoemprestimo.com.br\n\nChave PIX: {pix_key}\n\n_Tubarão Empréstimos 🦈_',
    '{nome,valor,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Aprovação de Empréstimo - WhatsApp');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Aprovação de Empréstimo - Notificação',
    'loan_approval',
    'LOAN_APPROVED',
    'notification',
    '✅ Empréstimo Aprovado',
    'Parabéns {nome}! Seu empréstimo de {valor} foi aprovado!',
    '{nome,valor}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Aprovação de Empréstimo - Notificação');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Vencimento em 3 Dias - Email',
    'due_soon',
    'INSTALLMENT_DUE_SOON',
    'email',
    '⏰ Parcela vence em 3 dias — {valor}',
    'Olá, {nome}!\n\nSua parcela de {valor} vence em 3 dias ({data_vencimento}).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\nTubarão Empréstimos 🦈',
    '{nome,valor,data_vencimento,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Vencimento em 3 Dias - Email');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Vencimento em 3 Dias - WhatsApp',
    'due_soon',
    'INSTALLMENT_DUE_SOON',
    'whatsapp',
    NULL,
    '⏰ *LEMBRETE DE VENCIMENTO*\n\nOlá, {nome}!\n\nSua parcela de *{valor}* vence em *{data_vencimento}* (3 dias).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
    '{nome,valor,data_vencimento,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Vencimento em 3 Dias - WhatsApp');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Vencimento Hoje - Email',
    'due_today',
    'INSTALLMENT_DUE_TODAY',
    'email',
    '⚠️ Parcela vence HOJE — {valor}',
    'Olá, {nome}!\n\nSua parcela de {valor} vence HOJE ({data_vencimento}).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\nTubarão Empréstimos 🦈',
    '{nome,valor,data_vencimento,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Vencimento Hoje - Email');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Vencimento Hoje - WhatsApp',
    'due_today',
    'INSTALLMENT_DUE_TODAY',
    'whatsapp',
    NULL,
    '⚠️ *PARCELA VENCE HOJE!*\n\nOlá, {nome}!\n\nSua parcela de *{valor}* vence *HOJE* ({data_vencimento}).\n\nEvite juros e multas pagando em dia.\n\nChave PIX: {pix_key}\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
    '{nome,valor,data_vencimento,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Vencimento Hoje - WhatsApp');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Atraso de Parcela - Email',
    'overdue',
    'INSTALLMENT_OVERDUE',
    'email',
    '🚨 Parcela ATRASADA ({dias_atraso} dias) — {valor}',
    'Olá, {nome}!\n\nSua parcela de {valor} venceu em {data_vencimento} e está com {dias_atraso} dia(s) de atraso.\n\nJuros e multas estão sendo aplicados diariamente.\n\nChave PIX: {pix_key}\n\nTubarão Empréstimos 🦈',
    '{nome,valor,data_vencimento,dias_atraso,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Atraso de Parcela - Email');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Atraso de Parcela - WhatsApp',
    'overdue',
    'INSTALLMENT_OVERDUE',
    'whatsapp',
    NULL,
    '🚨 *PARCELA EM ATRASO*\n\nOlá, {nome}!\n\nSua parcela de *{valor}* venceu em *{data_vencimento}* e está com *{dias_atraso}* dia(s) de atraso.\n\n⚠️ Juros e multas estão sendo aplicados diariamente.\n\nChave PIX: {pix_key}\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
    '{nome,valor,data_vencimento,dias_atraso,pix_key}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Atraso de Parcela - WhatsApp');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Bem-vindo - Email',
    'onboarding',
    'WELCOME',
    'email',
    ' sharks! Bem-vindo ao Tubarão Empréstimos',
    'Olá, {nome}!\n\nSeja bem-vindo ao Tubarão Empréstimos! Seu cadastro foi realizado com sucesso.\n\nAgora você pode solicitar seu empréstimo de forma rápida e segura.\n\nTubarão Empréstimos 🦈',
    '{nome}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Bem-vindo - Email');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Bem-vindo - WhatsApp',
    'onboarding',
    'WELCOME',
    'whatsapp',
    NULL,
    '👋 *BEM-VINDO(A) AO TUBARÃO EMPRÉSTIMOS!*\n\nOlá, {nome}!\n\nSeu cadastro foi realizado com sucesso! 🎉\n\nAgora você pode solicitar seu empréstimo de forma rápida e segura.\n\n✅ *Vantagens:*\n• Processo 100% digital\n• Aprovação em até 24h\n• Taxas competitivas\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
    '{nome}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Bem-vindo - WhatsApp');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Empréstimo Rejeitado - Email',
    'loan_rejection',
    'LOAN_REJECTED',
    'email',
    'Solicitação Não Aprovada — Tubarão Empréstimos',
    'Olá, {nome}.\n\nInfelizmente sua solicitação de empréstimo não foi aprovada neste momento.\n\nMotivo: {motivo}\n\nVocê pode tentar novamente após 30 dias ou entrar em contato conosco para mais informações.\n\nTubarão Empréstimos 🦈',
    '{nome,motivo}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Empréstimo Rejeitado - Email');

INSERT INTO message_templates (id, name, category, trigger_event, channel, subject, content, variables, is_active, created_at)
SELECT
    gen_random_uuid(),
    'Empréstimo Rejeitado - WhatsApp',
    'loan_rejection',
    'LOAN_REJECTED',
    'whatsapp',
    NULL,
    'Olá, {nome}.\n\nInfelizmente sua solicitação de empréstimo não foi aprovada neste momento.\n\nMotivo: {motivo}\n\nVocê pode fazer uma nova solicitação em 30 dias.\n\n_Acesse o app: https://www.tubaraoemprestimo.com.br_\n\n_Tubarão Empréstimos 🦈_',
    '{nome,motivo}',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Empréstimo Rejeitado - WhatsApp');