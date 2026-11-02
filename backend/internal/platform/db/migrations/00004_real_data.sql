-- +goose Up
-- Real data only. Removes the generated demo world (trips, customers, inbox, alerts, ledger)
-- and the vendor numbers that were produced by a random generator, drops WhatsApp-only
-- columns, and lets vendor stats be computed from real request history.

-- 1. The seeded demo world (fixed ids from the old seeder) and smoke-test accounts.
CREATE TEMP TABLE demo_trips ON COMMIT DROP AS
SELECT id FROM trips
WHERE id IN ('trp-2041','trp-2046','trp-2049','trp-2032','trp-2037','trp-2044','trp-2051','trp-2053','trp-2055',
             'trp-2060','trp-2062','trp-2019','trp-2011')
   OR customer_id IN ('cus-agarwal','cus-bose','cus-dutta','cus-iyer','cus-joshi','cus-kapoor','cus-khan','cus-kulkarni',
                      'cus-nair','cus-pune-bikers','cus-rahul','cus-reddy','cus-sen','cus-sharma')
   OR customer_id IN (SELECT c.id FROM customers c JOIN users u ON u.id = c.user_id
                      WHERE u.email ILIKE 'smoke%@example.com' OR u.email ILIKE 'qa.traveler%@example.com')
   OR customer_id IN (SELECT id FROM customers WHERE email ILIKE 'smoke%@example.com' OR email ILIKE 'qa.traveler%@example.com');

DELETE FROM ledger_entries WHERE trip_id IN (SELECT id FROM demo_trips);
DELETE FROM inbox_threads WHERE trip_id IN (SELECT id FROM demo_trips);
DELETE FROM trips WHERE id IN (SELECT id FROM demo_trips);

DELETE FROM inbox_messages WHERE id IN (
    'th-v-man-cabs-m1','th-v-man-cabs-m2','th-v-man-cabs-m3',
    'th-kulkarni-k1','th-kulkarni-k2','th-kulkarni-k3','th-kulkarni-k4','th-kulkarni-k5',
    'th-v-man-solang-adv-s1','th-v-man-solang-adv-s2','th-v-man-solang-adv-s3',
    'th-v-ris-rafting-r1','th-v-ris-rafting-r2',
    'th-agent-a1','th-agent-a2','th-system-y1','th-system-y2',
    'th-v-st-udr-leela-l1','th-v-st-udr-leela-l2');
DELETE FROM inbox_threads t WHERE t.id IN ('th-kulkarni','th-agent','th-system')
   OR NOT EXISTS (SELECT 1 FROM inbox_messages m WHERE m.thread_id = t.id);
DELETE FROM crowd_reports WHERE id IN ('cr-1','cr-2','cr-3');
DELETE FROM notifications WHERE id IN ('n-op-1','n-op-2','n-op-3','n-op-4','n-tr-1');

DELETE FROM customers c
WHERE c.id IN ('cus-agarwal','cus-bose','cus-dutta','cus-iyer','cus-joshi','cus-kapoor','cus-khan','cus-kulkarni',
               'cus-nair','cus-pune-bikers','cus-rahul','cus-reddy','cus-sen','cus-sharma')
   OR c.email ILIKE 'smoke%@example.com' OR c.email ILIKE 'qa.traveler%@example.com'
   OR c.user_id IN (SELECT id FROM users WHERE email ILIKE 'smoke%@example.com' OR email ILIKE 'qa.traveler%@example.com');
DELETE FROM users WHERE id = 'usr-rahul' OR email ILIKE 'smoke%@example.com' OR email ILIKE 'qa.traveler%@example.com';

-- 2. Vendors: real contacts are entered by the operator; stats come from vendor_requests.
UPDATE vendors SET phone = '';
ALTER TABLE vendors
    ADD COLUMN email text NOT NULL DEFAULT '',
    DROP COLUMN whatsapp_number,
    DROP COLUMN whatsapp_status,
    DROP COLUMN response_rate,
    DROP COLUMN avg_reply_min,
    DROP COLUMN cancellation_rate,
    DROP COLUMN rating,
    DROP COLUMN trust_score,
    DROP COLUMN active_bookings,
    DROP COLUMN pending_confirmations,
    DROP COLUMN history;

-- 3. Channels without WhatsApp: the vendor web link, email, or the operator on the phone.
UPDATE bookings SET channel = 'web' WHERE channel = 'whatsapp';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_channel_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_channel_check CHECK (channel IN ('web', 'phone', 'email'));
ALTER TABLE vendor_requests DROP CONSTRAINT IF EXISTS vendor_requests_channel_check;
ALTER TABLE vendor_requests ADD CONSTRAINT vendor_requests_channel_check CHECK (channel IN ('button', 'voice', 'web', 'phone'));
ALTER TABLE traveler_profiles DROP COLUMN whatsapp_connected;
ALTER TABLE inbox_threads DROP COLUMN window_open_until;

-- 4. Ratings: activities and stays carry real Google Maps ratings once looked up; 0 means "not rated yet".
ALTER TABLE activities ADD COLUMN place_id text NOT NULL DEFAULT '', ADD COLUMN maps_url text NOT NULL DEFAULT '', ADD COLUMN rated_at timestamptz;
ALTER TABLE stays ADD COLUMN place_id text NOT NULL DEFAULT '', ADD COLUMN maps_url text NOT NULL DEFAULT '', ADD COLUMN rated_at timestamptz;
UPDATE activities SET rating = 0, reviews = 0;
UPDATE stays SET rating = 0, reviews = 0;
UPDATE destinations SET rating = 0, reviews = 0, reviews_list = '[]';

-- 5. Faster lookups for computed vendor stats and the operator's request queue.
CREATE INDEX IF NOT EXISTS vendor_requests_pending_idx ON vendor_requests (created_at DESC) WHERE status = 'pending';

-- +goose Down
DROP INDEX IF EXISTS vendor_requests_pending_idx;
ALTER TABLE activities DROP COLUMN IF EXISTS place_id, DROP COLUMN IF EXISTS maps_url, DROP COLUMN IF EXISTS rated_at;
ALTER TABLE stays DROP COLUMN IF EXISTS place_id, DROP COLUMN IF EXISTS maps_url, DROP COLUMN IF EXISTS rated_at;
ALTER TABLE inbox_threads ADD COLUMN IF NOT EXISTS window_open_until timestamptz;
ALTER TABLE traveler_profiles ADD COLUMN IF NOT EXISTS whatsapp_connected boolean NOT NULL DEFAULT false;
ALTER TABLE vendor_requests DROP CONSTRAINT IF EXISTS vendor_requests_channel_check;
ALTER TABLE vendor_requests ADD CONSTRAINT vendor_requests_channel_check CHECK (channel IN ('button', 'voice', 'web'));
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_channel_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_channel_check CHECK (channel IN ('whatsapp', 'web', 'phone', 'email'));
ALTER TABLE vendors
    DROP COLUMN IF EXISTS email,
    ADD COLUMN IF NOT EXISTS whatsapp_number text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'template-only',
    ADD COLUMN IF NOT EXISTS response_rate integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_reply_min integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cancellation_rate double precision NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rating double precision NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 80,
    ADD COLUMN IF NOT EXISTS active_bookings integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pending_confirmations integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]';
