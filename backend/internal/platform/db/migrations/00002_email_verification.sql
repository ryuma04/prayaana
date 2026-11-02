-- +goose Up
ALTER TABLE users
    ADD COLUMN email_verified_at timestamptz,
    ADD COLUMN failed_logins integer NOT NULL DEFAULT 0,
    ADD COLUMN locked_until timestamptz;

UPDATE users SET email_verified_at = created_at;

CREATE TABLE email_verifications (
    id          text PRIMARY KEY,
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  text NOT NULL UNIQUE,
    code_hash   text NOT NULL,
    attempts    integer NOT NULL DEFAULT 0,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verifications_user_idx ON email_verifications (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS email_verifications;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at, DROP COLUMN IF EXISTS failed_logins, DROP COLUMN IF EXISTS locked_until;
