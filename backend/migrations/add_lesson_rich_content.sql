-- Migration: Adicionar Rich Text Editor e Múltiplos Arquivos nas Aulas
-- Data: 2026-03-17
-- Descrição: Adiciona campos description_html e attachments para suportar
--            conteúdo rico e múltiplos materiais complementares

-- Adicionar campos para rich content
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS description_html TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Índice para busca em attachments (GIN index para JSONB)
CREATE INDEX IF NOT EXISTS idx_lessons_attachments
ON lessons USING gin(attachments);

-- Comentários para documentação
COMMENT ON COLUMN lessons.description_html IS 'HTML rico do editor TipTap/Quill - suporta formatação, links, tabelas';
COMMENT ON COLUMN lessons.attachments IS 'Array de objetos {name, url, type, size} - materiais complementares (PDFs, planilhas, imagens)';

-- Verificar estrutura atualizada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'lessons'
ORDER BY ordinal_position;
