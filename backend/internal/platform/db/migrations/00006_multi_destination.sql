-- +goose Up
-- Multi-destination trip persistence: stores the list of destinations,
-- day allocation per destination, and resolved origin place.
ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS destinations text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS destination_allocations jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS origin_place jsonb;

-- +goose Down
ALTER TABLE trips
    DROP COLUMN IF EXISTS destinations,
    DROP COLUMN IF EXISTS destination_allocations,
    DROP COLUMN IF EXISTS origin_place;
