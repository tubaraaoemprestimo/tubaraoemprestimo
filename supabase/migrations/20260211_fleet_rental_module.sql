-- =====================================================
-- FLEET RENTAL MODULE - Sistema de Locacao Semanal
-- =====================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('CAR', 'MOTORCYCLE', 'VAN', 'TRUCK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rental_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rental_payment_status AS ENUM ('PENDING', 'PAID', 'LATE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE video_check_status AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fleet_alert_type AS ENUM ('NO_ACCESS', 'NO_VIDEO', 'LATE_PAYMENT', 'LOCATION_CHANGE', 'VEHICLE_BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 1. FLEET VEHICLES - Catalogo de veiculos
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type vehicle_type NOT NULL DEFAULT 'CAR',
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    color VARCHAR(50),
    chassis VARCHAR(50),
    renavam VARCHAR(50),
    weekly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    mileage INTEGER DEFAULT 0,
    fuel_type VARCHAR(20) DEFAULT 'FLEX',
    status vehicle_status DEFAULT 'AVAILABLE',
    photo_urls TEXT[] DEFAULT '{}',
    notes TEXT,
    insurance_policy VARCHAR(100),
    insurance_expires_at DATE,
    next_inspection_at DATE,
    blockable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_status ON fleet_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_type ON fleet_vehicles(type);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_plate ON fleet_vehicles(license_plate);

-- =====================================================
-- 2. FLEET RENTALS - Contratos de locacao
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    contract_number VARCHAR(50) UNIQUE,
    status rental_status DEFAULT 'PENDING',
    start_date DATE NOT NULL,
    end_date DATE,
    weekly_rate DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    deposit_paid BOOLEAN DEFAULT false,
    late_fixed_fee DECIMAL(10,2) DEFAULT 50.00,
    late_daily_interest DECIMAL(5,3) DEFAULT 1.000,
    contract_pdf_url TEXT,
    signature_url TEXT,
    signed_at TIMESTAMPTZ,
    sign_ip VARCHAR(45),
    sign_latitude DECIMAL(10,8),
    sign_longitude DECIMAL(11,8),
    terms_accepted BOOLEAN DEFAULT false,
    terms_accepted_at TIMESTAMPTZ,
    admin_notes TEXT,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_rentals_vehicle ON fleet_rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_rentals_customer ON fleet_rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_fleet_rentals_status ON fleet_rentals(status);

-- =====================================================
-- 3. FLEET WEEKLY PAYMENTS - Cobrancas semanais
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_weekly_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID NOT NULL REFERENCES fleet_rentals(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    week_number INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    late_fee DECIMAL(10,2) DEFAULT 0,
    late_interest DECIMAL(10,2) DEFAULT 0,
    total_due DECIMAL(10,2) NOT NULL,
    status rental_payment_status DEFAULT 'PENDING',
    pix_code TEXT,
    proof_url TEXT,
    paid_at TIMESTAMPTZ,
    confirmed_by UUID,
    confirmed_at TIMESTAMPTZ,
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_payments_rental ON fleet_weekly_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_fleet_payments_customer ON fleet_weekly_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_fleet_payments_status ON fleet_weekly_payments(status);
CREATE INDEX IF NOT EXISTS idx_fleet_payments_due ON fleet_weekly_payments(due_date);

-- =====================================================
-- 4. FLEET VIDEO CHECKS - Videos semanais obrigatorios
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_video_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID NOT NULL REFERENCES fleet_rentals(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    week_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    video_exterior_url TEXT,
    video_dashboard_url TEXT,
    video_residence_url TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    accuracy DECIMAL(10,2),
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(50),
    captured_at TIMESTAMPTZ,
    status video_check_status DEFAULT 'PENDING',
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_videos_rental ON fleet_video_checks(rental_id);
CREATE INDEX IF NOT EXISTS idx_fleet_videos_status ON fleet_video_checks(status);
CREATE INDEX IF NOT EXISTS idx_fleet_videos_due ON fleet_video_checks(due_date);

-- =====================================================
-- 5. FLEET LOCATION LOGS - Rastreamento GPS
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_location_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID REFERENCES fleet_rentals(id),
    customer_id UUID REFERENCES customers(id),
    event_type VARCHAR(50) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy DECIMAL(10,2),
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(50),
    device_info TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_location_rental ON fleet_location_logs(rental_id);
CREATE INDEX IF NOT EXISTS idx_fleet_location_customer ON fleet_location_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_fleet_location_created ON fleet_location_logs(created_at);

-- =====================================================
-- 6. FLEET MAINTENANCE TICKETS - Manutencao/Incidentes
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id),
    rental_id UUID REFERENCES fleet_rentals(id),
    customer_id UUID REFERENCES customers(id),
    type VARCHAR(50) NOT NULL DEFAULT 'MAINTENANCE',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    priority VARCHAR(20) DEFAULT 'NORMAL',
    status maintenance_ticket_status DEFAULT 'OPEN',
    resolution TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    scheduled_at DATE,
    cost DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_tickets_vehicle ON fleet_maintenance_tickets(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tickets_status ON fleet_maintenance_tickets(status);

-- =====================================================
-- 7. FLEET ALERTS - Alertas automaticos
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID REFERENCES fleet_rentals(id),
    customer_id UUID REFERENCES customers(id),
    vehicle_id UUID REFERENCES fleet_vehicles(id),
    type fleet_alert_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'WARNING',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_alerts_rental ON fleet_alerts(rental_id);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_resolved ON fleet_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_type ON fleet_alerts(type);

-- =====================================================
-- 8. FLEET SETTINGS - Configuracoes admin
-- =====================================================
CREATE TABLE IF NOT EXISTS fleet_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    default_late_fixed_fee DECIMAL(10,2) DEFAULT 50.00,
    default_late_daily_interest DECIMAL(5,3) DEFAULT 1.000,
    video_check_required BOOLEAN DEFAULT true,
    video_check_day_of_week INTEGER DEFAULT 1,
    auto_generate_pix BOOLEAN DEFAULT true,
    auto_send_whatsapp_reminders BOOLEAN DEFAULT true,
    auto_send_email_reminders BOOLEAN DEFAULT true,
    days_before_due_reminder INTEGER DEFAULT 1,
    max_days_late_before_block INTEGER DEFAULT 7,
    pix_key TEXT,
    pix_key_type VARCHAR(20) DEFAULT 'cpf',
    pix_receiver_name VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO fleet_settings (id) VALUES (uuid_generate_v4()) ON CONFLICT DO NOTHING;

-- =====================================================
-- TRIGGERS - updated_at automatico
-- =====================================================
CREATE OR REPLACE FUNCTION update_fleet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_fleet_vehicles_updated BEFORE UPDATE ON fleet_vehicles FOR EACH ROW EXECUTE FUNCTION update_fleet_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_fleet_rentals_updated BEFORE UPDATE ON fleet_rentals FOR EACH ROW EXECUTE FUNCTION update_fleet_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_fleet_tickets_updated BEFORE UPDATE ON fleet_maintenance_tickets FOR EACH ROW EXECUTE FUNCTION update_fleet_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_fleet_settings_updated BEFORE UPDATE ON fleet_settings FOR EACH ROW EXECUTE FUNCTION update_fleet_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- RLS POLICIES (opcional - ativar conforme necessidade)
-- =====================================================
-- ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fleet_rentals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fleet_weekly_payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fleet_video_checks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fleet_location_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fleet_maintenance_tickets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fleet_alerts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fleet_settings ENABLE ROW LEVEL SECURITY;
