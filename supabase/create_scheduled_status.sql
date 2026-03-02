-- ============================================
-- Tabela: scheduled_status
-- Agendamento de posts no Status do WhatsApp
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    caption TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'POSTED', 'FAILED')),
    error_message TEXT,
    posted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar status pendentes
CREATE INDEX IF NOT EXISTS idx_scheduled_status_pending 
ON scheduled_status(scheduled_at) 
WHERE status = 'PENDING';

-- Habilitar RLS
ALTER TABLE scheduled_status ENABLE ROW LEVEL SECURITY;

-- Policy para admins
CREATE POLICY "Admins can manage scheduled_status" ON scheduled_status
    FOR ALL USING (true);

-- ============================================
-- VERIFICAR
-- ============================================
SELECT 'Tabela scheduled_status criada com sucesso!' as resultado;
