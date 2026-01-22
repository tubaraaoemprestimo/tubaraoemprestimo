-- ============================================
-- SEED: Templates de Mensagens Automáticas
-- Execute este SQL no Supabase para criar todos os templates
-- ============================================

-- Limpar templates existentes (opcional)
-- DELETE FROM message_templates;

-- 1. BOAS-VINDAS (ao cadastrar)
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Boas-vindas', 'WELCOME', 
'Olá {nome}! 👋

Seja bem-vindo(a) ao *Tubarão Empréstimos*! 🦈

Seu cadastro foi realizado com sucesso. Agora você pode solicitar seu empréstimo de forma rápida e segura.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}'], true, 'SIGNUP')

ON CONFLICT (id) DO NOTHING;

-- 2. SOLICITAÇÃO RECEBIDA
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Solicitação Recebida', 'CUSTOM', 
'Olá {nome}! 📝

Recebemos sua solicitação de empréstimo no valor de *R$ {valor}*.

Nossa equipe está analisando seus dados e em breve você receberá uma resposta.

⏳ *Prazo de análise:* até 24 horas úteis

📱 *Acompanhe pelo App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}'], true, 'LOAN_REQUESTED')

ON CONFLICT (id) DO NOTHING;

-- 3. EMPRÉSTIMO APROVADO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Empréstimo Aprovado', 'APPROVAL', 
'🎉 *PARABÉNS, {nome}!*

Seu empréstimo foi *APROVADO*!

💰 *Valor:* R$ {valor}
📅 *Parcelas:* {parcelas}x
📊 *Total:* R$ {total}

O valor será liberado em até 24 horas após assinatura do contrato.

📱 *Acesse o App para assinar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{parcelas}', '{total}'], true, 'LOAN_APPROVED')

ON CONFLICT (id) DO NOTHING;

-- 4. EMPRÉSTIMO REJEITADO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Solicitação Não Aprovada', 'REJECTION', 
'Olá {nome},

Infelizmente sua solicitação de empréstimo não foi aprovada neste momento.

📋 *Motivo:* {motivo}

Você pode fazer uma nova solicitação em 30 dias.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{motivo}'], true, 'LOAN_REJECTED')

ON CONFLICT (id) DO NOTHING;

-- 5. PAGAMENTO CONFIRMADO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Pagamento Confirmado', 'PAYMENT', 
'✅ *PAGAMENTO CONFIRMADO!*

Olá {nome}!

Recebemos seu pagamento de *R$ {valor}* referente à parcela {parcela}.

📅 *Data:* {data}
💳 *Próxima parcela:* {proxima_parcela}

Obrigado por manter seus pagamentos em dia! 🙏

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{parcela}', '{data}', '{proxima_parcela}'], true, 'PAYMENT_CONFIRMED')

ON CONFLICT (id) DO NOTHING;

-- 6. LEMBRETE DE VENCIMENTO (7 dias antes)
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Lembrete 7 dias', 'REMINDER', 
'📅 *LEMBRETE DE VENCIMENTO*

Olá {nome}!

Sua parcela no valor de *R$ {valor}* vence em *7 dias* ({vencimento}).

💡 Pague em dia e evite juros!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'REMINDER_7_DAYS')

ON CONFLICT (id) DO NOTHING;

-- 7. LEMBRETE DE VENCIMENTO (3 dias antes)
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Lembrete 3 dias', 'REMINDER', 
'⏰ *ATENÇÃO - VENCIMENTO PRÓXIMO*

Olá {nome}!

Sua parcela de *R$ {valor}* vence em *3 dias* ({vencimento}).

⚠️ Evite multas e juros, pague em dia!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'REMINDER_3_DAYS')

ON CONFLICT (id) DO NOTHING;

-- 8. LEMBRETE NO DIA DO VENCIMENTO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Vencimento Hoje', 'REMINDER', 
'🔔 *VENCIMENTO HOJE!*

Olá {nome}!

Sua parcela de *R$ {valor}* vence *HOJE* ({vencimento}).

⚡ Pague agora e evite cobranças adicionais!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'REMINDER_TODAY')

ON CONFLICT (id) DO NOTHING;

-- 9. COBRANÇA 1 DIA DE ATRASO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Cobrança 1 dia', 'COLLECTION', 
'⚠️ *PARCELA EM ATRASO*

Olá {nome}!

Identificamos que sua parcela de *R$ {valor}* venceu ontem ({vencimento}).

💡 Regularize o quanto antes para evitar juros adicionais.

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{vencimento}'], true, 'COLLECTION_1_DAY')

ON CONFLICT (id) DO NOTHING;

-- 10. COBRANÇA 3 DIAS DE ATRASO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Cobrança 3 dias', 'COLLECTION', 
'🔴 *ATENÇÃO - 3 DIAS DE ATRASO*

Olá {nome}!

Sua parcela de *R$ {valor}* está em atraso há *3 dias*.

⚠️ *Valor atualizado:* R$ {valor_atualizado}

Entre em contato para negociar ou pague pelo app.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{valor_atualizado}'], true, 'COLLECTION_3_DAYS')

ON CONFLICT (id) DO NOTHING;

-- 11. COBRANÇA 7 DIAS DE ATRASO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Cobrança 7 dias', 'COLLECTION', 
'🚨 *URGENTE - 7 DIAS DE ATRASO*

Olá {nome}!

Sua parcela está em atraso há *7 dias*.

💰 *Valor original:* R$ {valor}
📈 *Valor atualizado:* R$ {valor_atualizado}
📅 *Vencimento:* {vencimento}

⚠️ Regularize para evitar negativação!

📲 WhatsApp: (XX) XXXXX-XXXX

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{valor_atualizado}', '{vencimento}'], true, 'COLLECTION_7_DAYS')

ON CONFLICT (id) DO NOTHING;

-- 12. COBRANÇA 15 DIAS DE ATRASO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Cobrança 15 dias', 'COLLECTION', 
'⛔ *ÚLTIMO AVISO - 15 DIAS DE ATRASO*

{nome}, sua situação está crítica!

Sua parcela está em atraso há *15 dias*.

💰 *Débito atualizado:* R$ {valor_atualizado}

⚠️ *AÇÃO NECESSÁRIA:*
Regularize imediatamente para evitar:
• Inclusão no SPC/Serasa
• Cobrança judicial
• Protesto

📲 Entre em contato URGENTE!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor_atualizado}'], true, 'COLLECTION_15_DAYS')

ON CONFLICT (id) DO NOTHING;

-- 13. COBRANÇA 30 DIAS DE ATRASO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Cobrança 30 dias', 'COLLECTION', 
'🔒 *AVISO FINAL - 30 DIAS DE ATRASO*

{nome},

Seu débito de *R$ {valor_atualizado}* está em atraso há 30 dias.

⚠️ *CONSEQUÊNCIAS EM ANDAMENTO:*
• Negativação nos órgãos de proteção
• Processo de cobrança judicial

📞 *ÚLTIMA CHANCE:* Entre em contato para negociação.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor_atualizado}'], true, 'COLLECTION_30_DAYS')

ON CONFLICT (id) DO NOTHING;

-- 14. PROPOSTA DE RENEGOCIAÇÃO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Proposta Renegociação', 'CUSTOM', 
'💡 *PROPOSTA ESPECIAL DE RENEGOCIAÇÃO*

Olá {nome}!

Temos uma proposta exclusiva para regularizar sua situação:

💰 *Débito atual:* R$ {valor}
✨ *Desconto especial:* {desconto}%
💵 *Valor com desconto:* R$ {valor_desconto}

⏰ *Válido por:* 7 dias

📱 *Acesse o App para aceitar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{desconto}', '{valor_desconto}'], true, 'RENEGOTIATION_OFFER')

ON CONFLICT (id) DO NOTHING;

-- 15. CONTRATO ASSINADO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Contrato Assinado', 'APPROVAL', 
'📝 *CONTRATO ASSINADO COM SUCESSO!*

Olá {nome}!

Seu contrato foi assinado com sucesso.

📋 *Detalhes:*
💰 Valor: R$ {valor}
📅 Parcelas: {parcelas}x de R$ {valor_parcela}
📆 1ª Parcela: {primeira_parcela}

O valor será liberado em até 24 horas!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{parcelas}', '{valor_parcela}', '{primeira_parcela}'], true, 'CONTRACT_SIGNED')

ON CONFLICT (id) DO NOTHING;

-- 16. VALOR LIBERADO
INSERT INTO message_templates (id, name, category, content, variables, is_active, trigger_event) VALUES
(gen_random_uuid(), 'Valor Liberado', 'PAYMENT', 
'💸 *VALOR LIBERADO!*

Olá {nome}!

O valor de *R$ {valor}* foi transferido para sua conta!

🏦 *Banco:* {banco}
📅 *Data:* {data}

Lembre-se: sua primeira parcela vence em {primeira_parcela}.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', 
ARRAY['{nome}', '{valor}', '{banco}', '{data}', '{primeira_parcela}'], true, 'AMOUNT_RELEASED')

ON CONFLICT (id) DO NOTHING;


-- ============================================
-- REGRAS DE COBRANÇA AUTOMÁTICA
-- ============================================

-- Limpar regras existentes (opcional)
-- DELETE FROM collection_rules;

-- Regras de Lembrete (antes do vencimento)
INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), -7, 'REMINDER', 
'📅 *LEMBRETE DE VENCIMENTO*

Olá {nome}!

Sua parcela no valor de *R$ {valor}* vence em *7 dias* ({data_vencimento}).

💡 Pague em dia e evite juros!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), -3, 'REMINDER', 
'⏰ *ATENÇÃO - VENCIMENTO PRÓXIMO*

Olá {nome}!

Sua parcela de *R$ {valor}* vence em *3 dias* ({data_vencimento}).

⚠️ Evite multas e juros, pague em dia!

📱 *Acesse o App para pagar:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), -1, 'REMINDER', 
'🔔 *VENCIMENTO AMANHÃ!*

Olá {nome}!

Sua parcela de *R$ {valor}* vence *AMANHÃ* ({data_vencimento}).

⚡ Programe seu pagamento!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 0, 'REMINDER', 
'🔔 *VENCIMENTO HOJE!*

Olá {nome}!

Sua parcela de *R$ {valor}* vence *HOJE* ({data_vencimento}).

⚡ Pague agora e evite cobranças adicionais!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

-- Regras de Cobrança (após vencimento)
INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 1, 'COLLECTION', 
'⚠️ *PARCELA EM ATRASO*

Olá {nome}!

Sua parcela de *R$ {valor}* venceu ontem ({data_vencimento}).

💡 Regularize o quanto antes para evitar juros.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 3, 'COLLECTION', 
'🔴 *ATENÇÃO - 3 DIAS DE ATRASO*

Olá {nome}!

Sua parcela de *R$ {valor}* está em atraso há *3 dias*.

⚠️ Regularize para evitar multas maiores.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 5, 'COLLECTION', 
'🚨 *5 DIAS DE ATRASO*

{nome}, sua parcela está em atraso há 5 dias.

💰 *Valor:* R$ {valor}
📅 *Vencimento:* {data_vencimento}

⚠️ Entre em contato para evitar negativação.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 7, 'COLLECTION', 
'🚨 *URGENTE - 7 DIAS DE ATRASO*

{nome}!

Sua parcela está em atraso há *7 dias*.

💰 *Valor:* R$ {valor}
📅 *Vencimento:* {data_vencimento}

⚠️ Regularize URGENTE para evitar negativação!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 10, 'COLLECTION', 
'⛔ *10 DIAS DE ATRASO - ALERTA*

{nome},

Sua parcela está em atraso há *10 dias*.

⚠️ *CONSEQUÊNCIAS PRÓXIMAS:*
• Inclusão no SPC/Serasa
• Juros acumulados

📲 Entre em contato para negociar!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 15, 'COLLECTION', 
'⛔ *ÚLTIMO AVISO - 15 DIAS*

{nome}, situação CRÍTICA!

Sua parcela está em atraso há *15 dias*.

⚠️ *AÇÃO IMEDIATA NECESSÁRIA:*
Regularize para evitar:
• SPC/Serasa
• Cobrança judicial

📲 Entre em contato URGENTE!

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collection_rules (id, days_offset, type, message_template, active) VALUES
(gen_random_uuid(), 30, 'COLLECTION', 
'🔒 *AVISO FINAL - 30 DIAS*

{nome},

Seu débito de *R$ {valor}* está em atraso há 30 dias.

⚠️ *PROVIDÊNCIAS EM ANDAMENTO:*
• Negativação nos órgãos de proteção
• Processo de cobrança judicial

📞 *ÚLTIMA CHANCE:* Entre em contato.

📱 *Acesse o App:*
https://tubaraoemprestimo.vercel.app/

_Tubarão Empréstimos 🦈_', true)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- VERIFICAR DADOS INSERIDOS
-- ============================================

SELECT 'Templates criados:' as info, COUNT(*) as total FROM message_templates;
SELECT 'Regras de cobrança criadas:' as info, COUNT(*) as total FROM collection_rules;
