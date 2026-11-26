-- Central WhatsApp em tempo real (25/11/2026). SOMENTE ACRÉSCIMOS: tabelas novas, nada existente muda.
-- Aplicar: docker exec -i tubarao_postgres psql -v ON_ERROR_STOP=1 -U postgres -d tubarao_db < migration.sql
BEGIN;

-- Conversa = 1 contato da instância (remote_jid como na Evolution: @s.whatsapp.net ou @lid).
CREATE TABLE IF NOT EXISTS wa_conversations (
    id                   TEXT PRIMARY KEY,
    instance             TEXT NOT NULL,
    remote_jid           TEXT NOT NULL,
    phone                TEXT,                         -- só quando o JID é número de telefone
    name                 TEXT,
    profile_pic_url      TEXT,
    customer_id          TEXT,                         -- vínculo confirmado pelo operador
    mode                 TEXT NOT NULL DEFAULT 'AI_ACTIVE', -- AI_ACTIVE | WAITING_HUMAN | HUMAN_ACTIVE | CLOSED
    assigned_to          TEXT,
    assigned_at          TIMESTAMP(3),
    waiting_since        TIMESTAMP(3),
    archived             BOOLEAN NOT NULL DEFAULT false,
    unread_count         INTEGER NOT NULL DEFAULT 0,
    last_message_at      TIMESTAMP(3),
    last_message_preview TEXT,
    last_message_from_me BOOLEAN,
    version              INTEGER NOT NULL DEFAULT 0,  -- concorrência otimista (assumir/transferir)
    created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_conv_jid ON wa_conversations (instance, remote_jid);
CREATE INDEX IF NOT EXISTS idx_wa_conv_last ON wa_conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_mode ON wa_conversations (mode, assigned_to);
CREATE INDEX IF NOT EXISTS idx_wa_conv_updated ON wa_conversations (updated_at);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON wa_conversations (phone);

CREATE TABLE IF NOT EXISTS wa_messages (
    id                 TEXT PRIMARY KEY,
    conversation_id    TEXT NOT NULL REFERENCES wa_conversations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    instance           TEXT NOT NULL,
    external_id        TEXT NOT NULL,                  -- key.id da Evolution (ou 'local:' até o provedor responder)
    from_me            BOOLEAN NOT NULL,
    origin             TEXT NOT NULL,                  -- CLIENTE | IA | HUMANO | AUTOMACAO | DISPOSITIVO_EXTERNO | ORIGEM_DESCONHECIDA
    sender_user_id     TEXT,
    type               TEXT NOT NULL,                  -- text | image | audio | video | document | sticker | other
    text               TEXT,
    media_mime         TEXT,
    media_name         TEXT,
    quoted_external_id TEXT,
    status             TEXT NOT NULL DEFAULT 'UNKNOWN', -- PENDING | SENT | DELIVERED | READ | FAILED | UNKNOWN
    status_rank        INTEGER NOT NULL DEFAULT 0,
    error              TEXT,
    client_request_id  TEXT,                           -- idempotência de envio pelo painel
    imported           BOOLEAN NOT NULL DEFAULT false,
    timestamp          TIMESTAMP(3) NOT NULL,
    created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_msg_external ON wa_messages (instance, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_msg_client_req ON wa_messages (client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv_ts ON wa_messages (conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_updated ON wa_messages (updated_at);
CREATE INDEX IF NOT EXISTS idx_wa_msg_ts ON wa_messages (timestamp);

CREATE TABLE IF NOT EXISTS wa_quick_replies (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
