-- +goose Up
-- Vendor contact names were invented for the demo; show the desk to ask for until the operator
-- enters the real person.
UPDATE vendors SET contact_name = CASE kind
    WHEN 'stay' THEN 'Reservations'
    WHEN 'activity' THEN 'Bookings desk'
    WHEN 'local' THEN 'Dispatch desk'
    ELSE 'Reservations' END;

-- Team phone numbers and ratings were generated too: the operator enters real numbers, and
-- status follows the trips a coordinator is actually running.
UPDATE team_members SET phone = '', rating = 0, status = 'available';

-- Vendor inbox messages about trips that no longer exist (removed test and demo trips).
DELETE FROM inbox_messages m USING inbox_threads t
WHERE m.thread_id = t.id AND t.party = 'vendor'
  AND substring(m.body from 'TRZ-[0-9]+') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM trips WHERE code = substring(m.body from 'TRZ-[0-9]+'));
-- Replies left in a vendor thread with no remaining request, then empty threads.
DELETE FROM inbox_messages m USING inbox_threads t
WHERE m.thread_id = t.id AND t.party = 'vendor'
  AND NOT EXISTS (SELECT 1 FROM inbox_messages x WHERE x.thread_id = t.id AND x.body ~ 'TRZ-[0-9]+');
DELETE FROM inbox_threads t WHERE NOT EXISTS (SELECT 1 FROM inbox_messages m WHERE m.thread_id = t.id);

-- +goose Down
SELECT 1;
