-- +goose Up
CREATE TABLE operators (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    settings    jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id             text PRIMARY KEY,
    name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    email          text NOT NULL,
    password_hash  text NOT NULL,
    role           text NOT NULL CHECK (role IN ('traveler', 'operator')),
    operator_id    text REFERENCES operators(id),
    phone          text NOT NULL DEFAULT '',
    avatar_tone    text NOT NULL DEFAULT 'sky',
    created_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (role <> 'operator' OR operator_id IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE traveler_profiles (
    user_id             text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    dna                 jsonb,
    quiz_answers        jsonb NOT NULL DEFAULT '{}',
    onboarding          jsonb NOT NULL DEFAULT '{}',
    xp                  integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
    badges              text[] NOT NULL DEFAULT '{}',
    saved_places        text[] NOT NULL DEFAULT '{}',
    auto_approve_limit  integer NOT NULL DEFAULT 1000 CHECK (auto_approve_limit BETWEEN 0 AND 100000),
    whatsapp_connected  boolean NOT NULL DEFAULT false,
    language            text NOT NULL DEFAULT 'English',
    prep_done           jsonb NOT NULL DEFAULT '{}',
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE destinations (
    id                text PRIMARY KEY,
    name              text NOT NULL,
    state             text NOT NULL,
    tagline           text NOT NULL,
    description       text NOT NULL,
    art               text NOT NULL,
    tone              text NOT NULL,
    lat               double precision NOT NULL,
    lng               double precision NOT NULL,
    rating            double precision NOT NULL,
    reviews           integer NOT NULL,
    moods             text[] NOT NULL,
    interests         text[] NOT NULL,
    best_months       integer[] NOT NULL,
    rainy_months      integer[] NOT NULL,
    ideal_days        text NOT NULL,
    gateway           text NOT NULL,
    from_city         text NOT NULL,
    climate           jsonb NOT NULL,
    highlights        text[] NOT NULL,
    clusters          jsonb NOT NULL,
    local_cab_per_day integer NOT NULL CHECK (local_cab_per_day >= 0),
    airport_transfer  integer NOT NULL CHECK (airport_transfer >= 0),
    languages         text[] NOT NULL,
    emergency         jsonb NOT NULL,
    reviews_list      jsonb NOT NULL DEFAULT '[]',
    position          integer NOT NULL
);

CREATE TABLE vendors (
    id                     text PRIMARY KEY,
    operator_id            text NOT NULL REFERENCES operators(id),
    name                   text NOT NULL,
    kind                   text NOT NULL CHECK (kind IN ('stay', 'activity', 'transport', 'local')),
    destination_id         text NOT NULL REFERENCES destinations(id),
    contact_name           text NOT NULL,
    phone                  text NOT NULL,
    whatsapp_number        text NOT NULL DEFAULT '',
    language               text NOT NULL,
    response_rate          integer NOT NULL CHECK (response_rate BETWEEN 0 AND 100),
    avg_reply_min          integer NOT NULL CHECK (avg_reply_min >= 0),
    cancellation_rate      double precision NOT NULL CHECK (cancellation_rate BETWEEN 0 AND 100),
    rating                 double precision NOT NULL CHECK (rating BETWEEN 0 AND 5),
    trust_score            integer NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
    active_bookings        integer NOT NULL DEFAULT 0,
    pending_confirmations  integer NOT NULL DEFAULT 0,
    available              boolean NOT NULL DEFAULT true,
    whatsapp_status        text NOT NULL DEFAULT 'template-only' CHECK (whatsapp_status IN ('connected', 'window-open', 'template-only')),
    history                jsonb NOT NULL DEFAULT '[]',
    position               integer NOT NULL
);
CREATE INDEX vendors_destination_idx ON vendors (destination_id);

CREATE TABLE activities (
    id              text PRIMARY KEY,
    destination_id  text NOT NULL REFERENCES destinations(id),
    cluster         text NOT NULL,
    title           text NOT NULL,
    description     text NOT NULL,
    interests       text[] NOT NULL,
    duration_min    integer NOT NULL CHECK (duration_min > 0),
    price           integer NOT NULL CHECK (price >= 0),
    energy          smallint NOT NULL CHECK (energy BETWEEN 1 AND 5),
    outdoor         boolean NOT NULL,
    slot            text NOT NULL CHECK (slot IN ('morning', 'afternoon', 'evening')),
    rating          double precision NOT NULL,
    reviews         integer NOT NULL,
    vendor_id       text NOT NULL REFERENCES vendors(id),
    lat             double precision NOT NULL,
    lng             double precision NOT NULL,
    kid_friendly    boolean NOT NULL,
    walking         text NOT NULL CHECK (walking IN ('low', 'medium', 'high')),
    icon            text NOT NULL,
    tone            text NOT NULL,
    backup_id       text REFERENCES activities(id) DEFERRABLE INITIALLY DEFERRED,
    alt_vendor_id   text REFERENCES vendors(id),
    position        integer NOT NULL
);
CREATE INDEX activities_destination_idx ON activities (destination_id);

CREATE TABLE stays (
    id              text PRIMARY KEY,
    destination_id  text NOT NULL REFERENCES destinations(id),
    name            text NOT NULL,
    type            text NOT NULL CHECK (type IN ('hostel', 'budget', 'boutique', 'homestay', 'luxury')),
    nightly_price   integer NOT NULL CHECK (nightly_price >= 0),
    rating          double precision NOT NULL,
    reviews         integer NOT NULL,
    vendor_id       text NOT NULL REFERENCES vendors(id),
    area            text NOT NULL,
    amenities       text[] NOT NULL,
    tone            text NOT NULL,
    lat             double precision NOT NULL,
    lng             double precision NOT NULL,
    position        integer NOT NULL
);

CREATE TABLE transport_options (
    id                text PRIMARY KEY,
    destination_id    text NOT NULL REFERENCES destinations(id),
    mode              text NOT NULL CHECK (mode IN ('flight', 'train', 'bus', 'car')),
    label             text NOT NULL,
    from_city         text NOT NULL,
    price_per_person  integer NOT NULL CHECK (price_per_person >= 0),
    duration_min      integer NOT NULL CHECK (duration_min > 0),
    departs           text NOT NULL,
    vendor_id         text NOT NULL REFERENCES vendors(id),
    position          integer NOT NULL
);

CREATE TABLE team_members (
    id           text PRIMARY KEY,
    operator_id  text NOT NULL REFERENCES operators(id),
    name         text NOT NULL,
    role         text NOT NULL CHECK (role IN ('coordinator', 'ops', 'admin')),
    region       text NOT NULL,
    phone        text NOT NULL,
    languages    text[] NOT NULL DEFAULT '{}',
    status       text NOT NULL CHECK (status IN ('on-trip', 'available', 'off-duty')),
    rating       double precision NOT NULL DEFAULT 5,
    tone         text NOT NULL DEFAULT 'sky',
    position     integer NOT NULL DEFAULT 0
);

CREATE TABLE destination_coordinators (
    destination_id  text PRIMARY KEY REFERENCES destinations(id),
    member_id       text NOT NULL REFERENCES team_members(id)
);

CREATE TABLE customers (
    id           text PRIMARY KEY,
    operator_id  text NOT NULL REFERENCES operators(id),
    user_id      text UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    name         text NOT NULL,
    city         text NOT NULL DEFAULT '',
    email        text NOT NULL DEFAULT '',
    phone        text NOT NULL DEFAULT '',
    since        date NOT NULL DEFAULT CURRENT_DATE,
    dna_name     text NOT NULL DEFAULT '',
    tone         text NOT NULL DEFAULT 'sky',
    tags         text[] NOT NULL DEFAULT '{}',
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE trip_code_seq START 2070;

CREATE TABLE trips (
    id                 text PRIMARY KEY,
    code               text NOT NULL UNIQUE,
    operator_id        text NOT NULL REFERENCES operators(id),
    customer_id        text NOT NULL REFERENCES customers(id),
    destination_id     text NOT NULL REFERENCES destinations(id),
    title              text NOT NULL,
    start_date         date NOT NULL,
    nights             integer NOT NULL CHECK (nights BETWEEN 1 AND 30),
    adults             integer NOT NULL CHECK (adults >= 1),
    kids               integer NOT NULL DEFAULT 0 CHECK (kids >= 0),
    budget_per_person  integer NOT NULL CHECK (budget_per_person >= 0),
    stay_type          text NOT NULL,
    transport_mode     text NOT NULL,
    interests          text[] NOT NULL DEFAULT '{}',
    pace               text NOT NULL CHECK (pace IN ('relaxed', 'balanced', 'packed')),
    rhythm             text NOT NULL CHECK (rhythm IN ('early-bird', 'night-owl')),
    special            text[] NOT NULL DEFAULT '{}',
    own_words          text NOT NULL DEFAULT '',
    from_city          text NOT NULL DEFAULT '',
    stay_id            text NOT NULL REFERENCES stays(id),
    transport_id       text NOT NULL REFERENCES transport_options(id),
    status             text NOT NULL CHECK (status IN ('draft', 'booked', 'live', 'completed')),
    payment_status     text NOT NULL CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partial')),
    promo_code         text,
    coordinator_id     text REFERENCES team_members(id),
    group_name         text NOT NULL,
    current_day        integer,
    weather_overrides  jsonb NOT NULL DEFAULT '{}',
    optimized          jsonb,
    version            integer NOT NULL DEFAULT 1,
    created_at         timestamptz NOT NULL DEFAULT now(),
    booked_at          timestamptz,
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trips_customer_idx ON trips (customer_id);
CREATE INDEX trips_status_idx ON trips (status);
CREATE INDEX trips_destination_idx ON trips (destination_id);

CREATE TABLE trip_items (
    id            text PRIMARY KEY,
    trip_id       text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    position      integer NOT NULL,
    day           integer NOT NULL CHECK (day >= 1),
    kind          text NOT NULL CHECK (kind IN ('flight', 'train', 'bus', 'car', 'transfer', 'checkin', 'checkout', 'activity', 'meal', 'rest')),
    ref_id        text,
    title         text NOT NULL,
    subtitle      text NOT NULL DEFAULT '',
    place         text NOT NULL DEFAULT '',
    start_min     integer NOT NULL,
    duration_min  integer NOT NULL CHECK (duration_min >= 0),
    unit_cost     integer NOT NULL,
    qty           integer NOT NULL CHECK (qty >= 1),
    cost_mode     text NOT NULL CHECK (cost_mode IN ('per-person', 'flat')),
    hearted       boolean NOT NULL DEFAULT false,
    vendor_id     text REFERENCES vendors(id),
    outdoor       boolean NOT NULL DEFAULT false,
    energy        integer NOT NULL DEFAULT 0,
    status        text NOT NULL CHECK (status IN ('planned', 'confirmed', 'done', 'live', 'changed', 'cancelled')),
    depends_on    text[] NOT NULL DEFAULT '{}',
    buffer_min    integer NOT NULL DEFAULT 15,
    lat           double precision,
    lng           double precision,
    icon          text NOT NULL DEFAULT '',
    tone          text NOT NULL DEFAULT 'sky',
    note          text NOT NULL DEFAULT ''
);
CREATE INDEX trip_items_trip_idx ON trip_items (trip_id, position);
CREATE INDEX trip_items_vendor_idx ON trip_items (vendor_id);

CREATE TABLE trip_reviews (
    trip_id     text PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
    stars       integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
    aspects     jsonb NOT NULL DEFAULT '{}',
    text        text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE change_receipts (
    id             text PRIMARY KEY,
    trip_id        text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title          text NOT NULL,
    reason         text NOT NULL DEFAULT '',
    changes        jsonb NOT NULL DEFAULT '[]',
    approved_by    text[] NOT NULL DEFAULT '{}',
    cost_delta     integer NOT NULL DEFAULT 0,
    plan_strategy  text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_receipts_trip_idx ON change_receipts (trip_id, created_at DESC);

CREATE TABLE bookings (
    id             text PRIMARY KEY,
    trip_id        text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    item_id        text NOT NULL,
    item_title     text NOT NULL,
    vendor_id      text NOT NULL REFERENCES vendors(id),
    customer_name  text NOT NULL,
    status         text NOT NULL CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled')),
    amount         integer NOT NULL,
    day            integer NOT NULL,
    date           date NOT NULL,
    channel        text NOT NULL CHECK (channel IN ('whatsapp', 'web', 'phone')),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_trip_idx ON bookings (trip_id);
CREATE INDEX bookings_vendor_idx ON bookings (vendor_id, status);

CREATE TABLE payments (
    id           text PRIMARY KEY,
    trip_id      text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    provider     text NOT NULL CHECK (provider IN ('razorpay', 'simulated')),
    order_id     text NOT NULL UNIQUE,
    payment_ref  text,
    amount       integer NOT NULL CHECK (amount >= 0),
    currency     text NOT NULL DEFAULT 'INR',
    method       text NOT NULL DEFAULT '',
    status       text NOT NULL CHECK (status IN ('created', 'paid', 'failed')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    paid_at      timestamptz
);
CREATE INDEX payments_trip_idx ON payments (trip_id);

CREATE TABLE ledger_entries (
    id          text PRIMARY KEY,
    trip_id     text REFERENCES trips(id) ON DELETE SET NULL,
    kind        text NOT NULL CHECK (kind IN ('payment', 'payout', 'refund', 'adjustment')),
    party       text NOT NULL,
    amount      integer NOT NULL,
    status      text NOT NULL CHECK (status IN ('settled', 'pending', 'failed')),
    method      text NOT NULL DEFAULT '',
    note        text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_created_idx ON ledger_entries (created_at DESC);

CREATE TABLE incidents (
    id                text PRIMARY KEY,
    trip_id           text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    kind              text NOT NULL CHECK (kind IN ('weather', 'flight_delay', 'vendor_unavailable', 'traveler_request', 'closure', 'running_late', 'crowd_report', 'health')),
    title             text NOT NULL,
    detail            text NOT NULL DEFAULT '',
    day               integer NOT NULL CHECK (day >= 1),
    severity          integer NOT NULL CHECK (severity BETWEEN 1 AND 5),
    source            text NOT NULL,
    status            text NOT NULL CHECK (status IN ('open', 'analyzing', 'plans_ready', 'awaiting_vendors', 'resolved', 'escalated')),
    delay_min         integer,
    vendor_id         text REFERENCES vendors(id),
    place             text,
    mood              text,
    selected_plan_id  text,
    agent_run_id      text,
    receipt_id        text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_trip_idx ON incidents (trip_id);
CREATE INDEX incidents_open_idx ON incidents (status) WHERE status <> 'resolved';

CREATE TABLE agent_runs (
    id                text PRIMARY KEY,
    incident_id       text NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    trip_id           text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    status            text NOT NULL CHECK (status IN ('running', 'waiting', 'succeeded', 'failed', 'needs_human')),
    attempt           integer NOT NULL DEFAULT 1,
    plan_id           text,
    mode              text NOT NULL CHECK (mode IN ('auto', 'manual')),
    scope             text NOT NULL CHECK (scope IN ('operator', 'traveler')),
    excluded_vendors  text[] NOT NULL DEFAULT '{}',
    impact            jsonb,
    plans             jsonb,
    summary           text NOT NULL DEFAULT '',
    started_at        timestamptz NOT NULL DEFAULT now(),
    finished_at       timestamptz
);
CREATE INDEX agent_runs_incident_idx ON agent_runs (incident_id);
CREATE INDEX agent_runs_active_idx ON agent_runs (status) WHERE status IN ('running', 'waiting');

CREATE TABLE agent_steps (
    id       text PRIMARY KEY,
    run_id   text NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    seq      integer NOT NULL,
    tool     text NOT NULL,
    label    text NOT NULL,
    status   text NOT NULL CHECK (status IN ('pending', 'running', 'done', 'failed', 'warning', 'waiting')),
    result   text NOT NULL DEFAULT '',
    detail   text[] NOT NULL DEFAULT '{}',
    kind     text NOT NULL DEFAULT 'normal',
    took_ms  integer,
    ts       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, seq)
);

CREATE TABLE confirmations (
    id           text PRIMARY KEY,
    incident_id  text REFERENCES incidents(id) ON DELETE CASCADE,
    run_id       text REFERENCES agent_runs(id) ON DELETE CASCADE,
    trip_id      text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    plan         jsonb NOT NULL,
    attempt      integer NOT NULL DEFAULT 1,
    phase        text NOT NULL CHECK (phase IN ('asking', 'saved', 'undone', 'expired')),
    deadline_at  timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    resolved_at  timestamptz
);
CREATE INDEX confirmations_asking_idx ON confirmations (deadline_at) WHERE phase = 'asking';

CREATE TABLE vendor_requests (
    token            text PRIMARY KEY,
    confirmation_id  text REFERENCES confirmations(id) ON DELETE CASCADE,
    run_id           text REFERENCES agent_runs(id) ON DELETE CASCADE,
    incident_id      text REFERENCES incidents(id) ON DELETE CASCADE,
    trip_id          text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    vendor_id        text NOT NULL REFERENCES vendors(id),
    traveler_name    text NOT NULL,
    date_label       text NOT NULL DEFAULT '',
    original         text NOT NULL,
    proposed         text NOT NULL,
    item_title       text NOT NULL,
    status           text NOT NULL CHECK (status IN ('pending', 'yes', 'no', 'other_time', 'timeout', 'cancelled')),
    channel          text CHECK (channel IN ('button', 'voice', 'web')),
    alt_time         text,
    voice            jsonb,
    kind             text NOT NULL CHECK (kind IN ('change', 'booking')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    responded_at     timestamptz
);
CREATE INDEX vendor_requests_confirmation_idx ON vendor_requests (confirmation_id);
CREATE INDEX vendor_requests_vendor_idx ON vendor_requests (vendor_id, status);

CREATE TABLE decisions (
    id          text PRIMARY KEY,
    engine      text NOT NULL,
    question    text NOT NULL,
    options     text[] NOT NULL,
    answer      text NOT NULL,
    confidence  double precision NOT NULL,
    took_ms     integer NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inbox_threads (
    id                 text PRIMARY KEY,
    party              text NOT NULL CHECK (party IN ('vendor', 'traveler', 'agent', 'system')),
    name               text NOT NULL,
    subtitle           text NOT NULL DEFAULT '',
    trip_id            text REFERENCES trips(id) ON DELETE SET NULL,
    vendor_id          text REFERENCES vendors(id),
    unread             integer NOT NULL DEFAULT 0 CHECK (unread >= 0),
    window_open_until  timestamptz,
    tone               text NOT NULL DEFAULT 'cream',
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inbox_messages (
    id          text PRIMARY KEY,
    thread_id   text NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
    sender      text NOT NULL CHECK (sender IN ('them', 'us', 'agent')),
    type        text NOT NULL CHECK (type IN ('text', 'voice', 'button', 'template', 'attachment')),
    body        text NOT NULL,
    transcript  text,
    decision    text,
    confidence  double precision,
    attachment  jsonb,
    status      text CHECK (status IN ('sent', 'delivered', 'read')),
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inbox_messages_thread_idx ON inbox_messages (thread_id, created_at);

CREATE TABLE crowd_reports (
    id              text PRIMARY KEY,
    place           text NOT NULL,
    destination_id  text NOT NULL REFERENCES destinations(id),
    type            text NOT NULL CHECK (type IN ('closed', 'road_blocked', 'crowded', 'unsafe', 'other')),
    text            text NOT NULL,
    reporter        text NOT NULL,
    reporter_role   text NOT NULL CHECK (reporter_role IN ('traveler', 'guide', 'vendor')),
    verified        boolean NOT NULL DEFAULT false,
    confirmations   integer NOT NULL DEFAULT 1,
    affected_trips  text[] NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL DEFAULT now() + interval '6 hours'
);

CREATE TABLE early_warnings (
    id            text PRIMARY KEY,
    trip_id       text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    title         text NOT NULL,
    detail        text NOT NULL,
    eta_late_min  integer NOT NULL DEFAULT 0,
    status        text NOT NULL CHECK (status IN ('watching', 'handed-to-agent', 'resolved')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id          text PRIMARY KEY,
    audience    text NOT NULL CHECK (audience IN ('traveler', 'operator')),
    user_id     text REFERENCES users(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('weather', 'flight', 'vendor', 'agent', 'payment', 'risk', 'trip', 'system')),
    title       text NOT NULL,
    body        text NOT NULL DEFAULT '',
    href        text,
    read        boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_audience_idx ON notifications (audience, created_at DESC);

CREATE TABLE ai_cache (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS ai_cache, notifications, early_warnings, crowd_reports, inbox_messages, inbox_threads,
    decisions, vendor_requests, confirmations, agent_steps, agent_runs, incidents, ledger_entries, payments,
    bookings, change_receipts, trip_reviews, trip_items, trips, customers, destination_coordinators,
    team_members, transport_options, stays, activities, vendors, destinations, traveler_profiles, users,
    operators CASCADE;
DROP SEQUENCE IF EXISTS trip_code_seq;
