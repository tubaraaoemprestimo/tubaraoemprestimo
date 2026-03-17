-- Script SQL para notificar clientes sem documentos
-- Atualiza status e descrição, depois o admin pode reenviar notificação pelo painel

-- Atualizar os 3 clientes para WAITING_DOCS com descrição detalhada
UPDATE loan_requests
SET
    status = 'WAITING_DOCS',
    supplemental_description = 'Documentos obrigatórios não foram enviados no momento da solicitação. Por favor, envie:

✅ Selfie
✅ RG frente e verso
✅ Comprovante de endereço
✅ Vídeo selfie
✅ Vídeo da casa
✅ Carteira de trabalho

Prazo: 48 horas

Acesse o app e envie os documentos na área "Meus Documentos".',
    supplemental_requested_at = NOW()
WHERE id IN (
    '4e23aef2-3f8d-4917-a5a2-636a9ca27c47', -- Yuri Arruda De Carvalho
    'c2beb28c-ed8f-46be-953f-a6a3f0319d6e', -- Jefferson Santos
    'a3c213c1-c2d6-4ecc-9343-ca7732e984d3'  -- Teste completo
);

-- Verificar atualização
SELECT
    id,
    client_name,
    email,
    phone,
    status,
    LEFT(supplemental_description, 100) as description_preview
FROM loan_requests
WHERE id IN (
    '4e23aef2-3f8d-4917-a5a2-636a9ca27c47',
    'c2beb28c-ed8f-46be-953f-a6a3f0319d6e',
    'a3c213c1-c2d6-4ecc-9343-ca7732e984d3'
)
ORDER BY client_name;
