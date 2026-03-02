-- =====================================================
-- Notificações: segregação por público (ADMIN x CLIENT)
-- Execute no Supabase SQL Editor
-- =====================================================

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS for_role VARCHAR(20);

-- Backfill seguro para registros antigos
UPDATE notifications
SET for_role = CASE
    WHEN customer_email IS NULL THEN 'ADMIN'
    ELSE 'CLIENT'
END
WHERE for_role IS NULL OR for_role = '';

ALTER TABLE notifications
ALTER COLUMN for_role SET DEFAULT 'CLIENT';

-- Índices para filtro no app
CREATE INDEX IF NOT EXISTS idx_notifications_for_role ON notifications(for_role);
CREATE INDEX IF NOT EXISTS idx_notifications_for_role_read ON notifications(for_role, read);

-- Limpeza opcional de notificações antigas inconsistentes
-- (descomente se necessário)
-- DELETE FROM notifications
-- WHERE for_role = 'CLIENT' AND customer_email IS NULL AND created_at < NOW() - INTERVAL '7 days';
