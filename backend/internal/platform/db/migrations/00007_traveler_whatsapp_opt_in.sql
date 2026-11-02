-- +goose Up
-- Explicit consent is required before a transactional WhatsApp update is sent.
-- It belongs to a trip, so a traveler can choose it independently at each checkout.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE trips DROP COLUMN IF EXISTS whatsapp_opt_in;
