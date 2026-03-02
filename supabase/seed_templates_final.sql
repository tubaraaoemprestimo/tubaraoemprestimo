-- ============================================
-- SEED: Templates de Mensagens Automáticas
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Limpar templates existentes
DELETE FROM message_templates WHERE true;

-- 1. BOAS-VINDAS
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Boas-vindas', 'WELCOME', 
'Olá {nome}! 👋

Seja bem-vindo(a) ao *Tubarão Empréstimos*! 🦈

Seu cadastro foi realizado com sucesso. Agora você pode solicitar seu empréstimo de forma rápida e segura.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}'], true, 'SIGNUP');

-- 2. SOLICITAÇÃO RECEBIDA
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Solicitação Recebida', 'CUSTOM', 
'Olá {nome}! 📝

Recebemos sua solicitação de empréstimo no valor de *R$ {valor}*.

Nossa equipe está analisando seus dados e em breve você receberá uma resposta.

⏳ *Prazo de análise:* até 24 horas úteis

📱 *Acompanhe pelo App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}'], true, 'LOAN_REQUESTED');

-- 3. EMPRÉSTIMO APROVADO
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Empréstimo Aprovado', 'APPROVAL', 
'🎉 *PARABÉNS, {nome}!*

Seu empréstimo foi *APROVADO*!

💰 *Valor:* R$ {valor}

O valor será liberado em até 24 horas após assinatura do contrato.

📱 *Acesse o App para assinar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}'], true, 'LOAN_APPROVED');

-- 4. EMPRÉSTIMO REJEITADO
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Solicitação Não Aprovada', 'REJECTION', 
'Olá {nome},

Infelizmente sua solicitação de empréstimo não foi aprovada neste momento.

📋 *Motivo:* {motivo}

Você pode fazer uma nova solicitação em 30 dias.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{motivo}'], true, 'LOAN_REJECTED');

-- 5. PAGAMENTO CONFIRMADO
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Pagamento Confirmado', 'PAYMENT', 
'✅ *PAGAMENTO CONFIRMADO!*

Olá {nome}!

Recebemos seu pagamento de *R$ {valor}*.

Obrigado por manter seus pagamentos em dia! 🙏

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}'], true, 'PAYMENT_CONFIRMED');

-- 6. LEMBRETE 7 DIAS
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Lembrete 7 dias', 'REMINDER', 
'📅 *LEMBRETE DE VENCIMENTO*

Olá {nome}!

Sua parcela no valor de *R$ {valor}* vence em *7 dias* ({vencimento}).

💡 Pague em dia e evite juros!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'REMINDER_7_DAYS');

-- 7. LEMBRETE 3 DIAS
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Lembrete 3 dias', 'REMINDER', 
'⏰ *ATENÇÃO - VENCIMENTO PRÓXIMO*

Olá {nome}!

Sua parcela de *R$ {valor}* vence em *3 dias* ({vencimento}).

⚠️ Evite multas e juros, pague em dia!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'REMINDER_3_DAYS');

-- 8. VENCIMENTO HOJE
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Vencimento Hoje', 'REMINDER', 
'🔔 *VENCIMENTO HOJE!*

Olá {nome}!

Sua parcela de *R$ {valor}* vence *HOJE* ({vencimento}).

⚡ Pague agora e evite cobranças adicionais!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'REMINDER_TODAY');

-- 9. COBRANÇA 1 DIA
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Cobrança 1 dia', 'COLLECTION', 
'⚠️ *PARCELA EM ATRASO*

Olá {nome}!

Identificamos que sua parcela de *R$ {valor}* venceu ontem ({vencimento}).

💡 Regularize o quanto antes para evitar juros adicionais.

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'COLLECTION_1_DAY');

-- 10. COBRANÇA 3 DIAS
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Cobrança 3 dias', 'COLLECTION', 
'🔴 *ATENÇÃO - 3 DIAS DE ATRASO*

Olá {nome}!

Sua parcela de *R$ {valor}* está em atraso há *3 dias*.

⚠️ Regularize para evitar multas maiores.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}'], true, 'COLLECTION_3_DAYS');

-- 11. COBRANÇA 7 DIAS
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Cobrança 7 dias', 'COLLECTION', 
'🚨 *URGENTE - 7 DIAS DE ATRASO*

{nome}, sua parcela está em atraso há *7 dias*.

💰 *Valor:* R$ {valor}

⚠️ Regularize URGENTE para evitar negativação!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}'], true, 'COLLECTION_7_DAYS');

-- 12. COBRANÇA 15 DIAS
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Cobrança 15 dias', 'COLLECTION', 
'⛔ *ÚLTIMO AVISO - 15 DIAS DE ATRASO*

{nome}, sua situação está crítica!

Sua parcela está em atraso há *15 dias*.

⚠️ *AÇÃO NECESSÁRIA:*
Regularize imediatamente para evitar:
• Inclusão no SPC/Serasa
• Cobrança judicial

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}'], true, 'COLLECTION_15_DAYS');

-- 13. COBRANÇA 30 DIAS
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Cobrança 30 dias', 'COLLECTION', 
'🔒 *AVISO FINAL - 30 DIAS DE ATRASO*

{nome},

Seu débito está em atraso há 30 dias.

⚠️ *CONSEQUÊNCIAS EM ANDAMENTO:*
• Negativação nos órgãos de proteção
• Processo de cobrança judicial

📞 *ÚLTIMA CHANCE:* Entre em contato para negociação.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}'], true, 'COLLECTION_30_DAYS');

-- 14. VALOR LIBERADO
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Valor Liberado', 'PAYMENT', 
'💸 *VALOR LIBERADO!*

Olá {nome}!

O valor de *R$ {valor}* foi transferido para sua conta!

Lembre-se: sua primeira parcela vence em {primeira_parcela}.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{primeira_parcela}'], true, 'AMOUNT_RELEASED');

-- 15. CONTRATO ASSINADO
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Contrato Assinado', 'APPROVAL', 
'📝 *CONTRATO ASSINADO COM SUCESSO!*

Olá {nome}!

Seu contrato foi assinado com sucesso.

O valor será liberado em até 24 horas!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}'], true, 'CONTRACT_SIGNED');

-- 16. PROPOSTA RENEGOCIAÇÃO
INSERT INTO message_templates (name, category, content, variables, is_active, trigger_event) VALUES
('Proposta Renegociação', 'CUSTOM', 
'💡 *PROPOSTA ESPECIAL DE RENEGOCIAÇÃO*

Olá {nome}!

Temos uma proposta exclusiva para regularizar sua situação:

💰 *Débito atual:* R$ {valor}
✨ *Desconto especial:* {desconto}%

⏰ *Válido por:* 7 dias

📱 *Acesse o App para aceitar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{desconto}'], true, 'RENEGOTIATION_OFFER');


-- ============================================
-- VERIFICAR TEMPLATES CRIADOS
-- ============================================
SELECT COUNT(*) as total_templates FROM message_templates;
SELECT name, category, trigger_event FROM message_templates ORDER BY category, name;
