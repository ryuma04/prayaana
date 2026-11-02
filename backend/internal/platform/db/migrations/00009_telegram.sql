-- +goose Up
-- Telegram account linking for customer document delivery (replaces the
-- customer-facing WhatsApp delivery). The bot token is configuration only and
-- is never stored in the database.
CREATE TABLE IF NOT EXISTS telegram_connections (
  user_id                   text PRIMARY KEY,
  telegram_chat_id          bigint NOT NULL,
  telegram_username         text NOT NULL DEFAULT '',
  telegram_status           text NOT NULL DEFAULT 'connected',
  telegram_connected_at     timestamptz NOT NULL DEFAULT now(),
  telegram_last_verified_at timestamptz
);

-- Short-lived single-use tokens behind https://t.me/<bot>?start=<token>.
-- Only the SHA-256 hash of a token is stored.
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_link_tokens_user ON telegram_link_tokens(user_id);

-- +goose Down
DROP TABLE IF EXISTS telegram_link_tokens;
DROP TABLE IF EXISTS telegram_connections;
