-- Adicionar campos de parceiro nos cupons
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS partner_logo TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 100;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Adicionar campo de vídeo nas campanhas
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Atualizar cupons existentes com valores padrão
UPDATE coupons SET usage_limit = 100 WHERE usage_limit IS NULL;
UPDATE coupons SET usage_count = 0 WHERE usage_count IS NULL;
