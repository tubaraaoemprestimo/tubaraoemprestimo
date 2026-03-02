-- Criar tabela para migração de contratos de clientes recorrentes
CREATE TABLE IF NOT EXISTS contract_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id UUID NOT NULL REFERENCES loan_requests(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Dados do contrato atual
  loan_amount DECIMAL(10, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL,
  due_date DATE NOT NULL,
  charge_type VARCHAR(20) NOT NULL CHECK (charge_type IN ('MENSAL', 'DIARIA')),
  notes TEXT,

  -- Status e controle
  status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_VALIDACAO' CHECK (status IN ('PENDENTE_VALIDACAO', 'VALIDADO', 'REJEITADO')),

  -- Auditoria
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMP,
  validated_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejected_by UUID REFERENCES users(id),
  rejection_reason TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_migrations_status ON contract_migrations(status);
CREATE INDEX IF NOT EXISTS idx_contract_migrations_customer_id ON contract_migrations(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_migrations_loan_request_id ON contract_migrations(loan_request_id);
CREATE INDEX IF NOT EXISTS idx_contract_migrations_created_at ON contract_migrations(created_at DESC);

-- Comentários
COMMENT ON TABLE contract_migrations IS 'Tabela para gerenciar migração de contratos de clientes que já eram clientes antes do sistema';
COMMENT ON COLUMN contract_migrations.charge_type IS 'Tipo de cobrança: MENSAL ou DIARIA';
COMMENT ON COLUMN contract_migrations.status IS 'Status da migração: PENDENTE_VALIDACAO, VALIDADO ou REJEITADO';
