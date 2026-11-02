-- +goose Up
-- Travel DNA learning: what the traveler did (events) and how their DNA changed (history).
-- History rows are only ever inserted, never updated, so the evolution can be shown later.
CREATE TABLE IF NOT EXISTS traveler_events (
    id          text PRIMARY KEY,
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id     text,
    kind        text NOT NULL,
    activity_id text,
    item_id     text,
    value       integer,
    detail      text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS traveler_events_user ON traveler_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dna_history (
    id         text PRIMARY KEY,
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dimension  text NOT NULL,
    old_value  integer NOT NULL,
    new_value  integer NOT NULL,
    reason     text NOT NULL,
    source     text NOT NULL,
    event_id   text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dna_history_user ON dna_history (user_id, created_at DESC);

-- End-of-trip feedback answers (loved / disliked experiences, pace, more / less of each dimension).
ALTER TABLE trip_reviews ADD COLUMN IF NOT EXISTS feedback jsonb;

-- +goose Down
ALTER TABLE trip_reviews DROP COLUMN IF EXISTS feedback;
DROP TABLE IF EXISTS dna_history;
DROP TABLE IF EXISTS traveler_events;
