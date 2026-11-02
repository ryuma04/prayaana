-- +goose Up
-- Super Admin: a platform role above operators, account suspension, and Tripzyy's own
-- verification of guides (team_members). Every change is additive; existing rows keep working.

-- Allow the super_admin role (the inline CHECK is named users_role_check by Postgres).
-- +goose StatementBegin
DO $$
DECLARE c text;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%''traveler''%''operator''%'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
-- +goose StatementEnd
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('traveler', 'operator', 'super_admin'));

ALTER TABLE users
    ADD COLUMN account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
    ADD COLUMN status_changed_at timestamptz,
    ADD COLUMN status_changed_by text;

-- Guides start as pending: nobody is shown as verified until a Super Admin reviews them.
ALTER TABLE team_members
    ADD COLUMN verification_status text NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
    ADD COLUMN verification_note text NOT NULL DEFAULT '',
    ADD COLUMN verified_at timestamptz,
    ADD COLUMN verification_changed_at timestamptz,
    ADD COLUMN verification_changed_by text;

-- +goose Down
ALTER TABLE team_members
    DROP COLUMN IF EXISTS verification_status,
    DROP COLUMN IF EXISTS verification_note,
    DROP COLUMN IF EXISTS verified_at,
    DROP COLUMN IF EXISTS verification_changed_at,
    DROP COLUMN IF EXISTS verification_changed_by;
ALTER TABLE users
    DROP COLUMN IF EXISTS account_status,
    DROP COLUMN IF EXISTS status_changed_at,
    DROP COLUMN IF EXISTS status_changed_by;
DELETE FROM users WHERE role = 'super_admin';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('traveler', 'operator'));
