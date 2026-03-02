-- ==============================================
-- TUBARÃO EMPRÉSTIMOS - Rastreamento de Localização
-- Execute este script no Supabase SQL Editor
-- ==============================================

-- Tabela para armazenar localização atual dos clientes
CREATE TABLE IF NOT EXISTS customer_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2), -- precisão em metros
    address TEXT, -- endereço via reverse geocoding
    city VARCHAR(255),
    state VARCHAR(50),
    country VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_customer_locations_email ON customer_locations(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_locations_updated ON customer_locations(updated_at DESC);

-- Unique constraint para ter apenas 1 registro por cliente
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_locations_unique ON customer_locations(customer_email);

-- Desabilitar RLS
ALTER TABLE customer_locations DISABLE ROW LEVEL SECURITY;
