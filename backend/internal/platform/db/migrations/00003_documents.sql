-- +goose Up
-- Trip documents (booking confirmation, invoice, itinerary, vouchers) as issued PDFs.
-- Each re-issue after a change is a new version; old versions stay for the record.
CREATE TABLE documents (
    id          text PRIMARY KEY,
    trip_id     text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('confirmation', 'invoice', 'itinerary', 'voucher')),
    title       text NOT NULL,
    file_name   text NOT NULL,
    version     integer NOT NULL CHECK (version >= 1),
    reason      text NOT NULL DEFAULT '',
    size_bytes  integer NOT NULL CHECK (size_bytes > 0),
    sha256      text NOT NULL,
    content     bytea NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (trip_id, kind, version)
);
CREATE INDEX documents_trip_idx ON documents (trip_id, created_at DESC);

-- Lookups that previously scanned vendor_requests.
CREATE INDEX vendor_requests_trip_idx ON vendor_requests (trip_id, kind, status);
CREATE INDEX vendor_requests_run_idx ON vendor_requests (run_id);

-- +goose Down
DROP INDEX IF EXISTS vendor_requests_run_idx;
DROP INDEX IF EXISTS vendor_requests_trip_idx;
DROP TABLE IF EXISTS documents;
