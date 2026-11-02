package store

import (
	"context"
	"time"
)

// Account status (users.account_status).
const (
	AccountActive    = "active"
	AccountSuspended = "suspended"
)

// Guide verification by Tripzyy (team_members.verification_status).
const (
	GuidePending   = "pending"
	GuideVerified  = "verified"
	GuideRejected  = "rejected"
	GuideSuspended = "suspended"
)

func (s *Store) AccountStatus(ctx context.Context, userID string) (string, error) {
	var status string
	err := s.q.QueryRow(ctx, `SELECT account_status FROM users WHERE id=$1`, userID).Scan(&status)
	return status, notFound(err)
}

// SuspendedUserIDs lists every account whose sessions must be refused.
func (s *Store) SuspendedUserIDs(ctx context.Context) ([]string, error) {
	rows, err := s.q.Query(ctx, `SELECT id FROM users WHERE account_status='suspended'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// SetAccountStatus suspends or reactivates a traveler or operator. Super Admin accounts are
// never matched, so they cannot be changed through this path.
func (s *Store) SetAccountStatus(ctx context.Context, userID, status, by string) error {
	tag, err := s.q.Exec(ctx, `UPDATE users SET account_status=$2, status_changed_at=now(), status_changed_by=$3
		WHERE id=$1 AND role IN ('traveler', 'operator')`, userID, status, by)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// Super Admin login (provisioned from the server environment)

// ActivateSuperAdmin sets the configured password and makes the account usable.
func (s *Store) ActivateSuperAdmin(ctx context.Context, userID, passwordHash string) error {
	_, err := s.q.Exec(ctx, `UPDATE users SET password_hash=$2, account_status='active',
		email_verified_at=coalesce(email_verified_at, now()) WHERE id=$1 AND role='super_admin'`, userID, passwordHash)
	return err
}

// DisableSuperAdminsExcept suspends every Super Admin login other than the configured email
// (all of them when email is empty), so removing or changing the env vars revokes access.
func (s *Store) DisableSuperAdminsExcept(ctx context.Context, email string) (int64, error) {
	tag, err := s.q.Exec(ctx, `UPDATE users SET account_status='suspended', status_changed_at=now(), status_changed_by='system'
		WHERE role='super_admin' AND account_status <> 'suspended' AND ($1 = '' OR lower(email) <> lower($1))`, email)
	return tag.RowsAffected(), err
}

// Platform overview

type PlatformStats struct {
	Users               int `json:"users"`
	Travelers           int `json:"travelers"`
	Operators           int `json:"operators"`
	OperatorCompanies   int `json:"operatorCompanies"`
	SuspendedAccounts   int `json:"suspendedAccounts"`
	DemoAccounts        int `json:"demoAccounts"`
	Guides              int `json:"guides"`
	VerifiedGuides      int `json:"verifiedGuides"`
	PendingGuides       int `json:"pendingGuides"`
	RejectedGuides      int `json:"rejectedGuides"`
	SuspendedGuides     int `json:"suspendedGuides"`
	LiveTrips           int `json:"liveTrips"`
	UpcomingTrips       int `json:"upcomingTrips"`
	ActiveIncidents     int `json:"activeIncidents"`
	DemoActiveIncidents int `json:"demoActiveIncidents"`
}

func (s *Store) PlatformStats(ctx context.Context) (PlatformStats, error) {
	var p PlatformStats
	err := s.q.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM users WHERE role <> 'super_admin'),
		(SELECT count(*) FROM users WHERE role = 'traveler'),
		(SELECT count(*) FROM users WHERE role = 'operator'),
		(SELECT count(*) FROM operators),
		(SELECT count(*) FROM users WHERE role <> 'super_admin' AND account_status = 'suspended'),
		(SELECT count(*) FROM users WHERE role <> 'super_admin' AND (lower(email) LIKE '%.demo' OR lower(email) LIKE '%@demo.trizpyy')),
		(SELECT count(*) FROM team_members WHERE role = 'coordinator'),
		(SELECT count(*) FROM team_members WHERE role = 'coordinator' AND verification_status = 'verified'),
		(SELECT count(*) FROM team_members WHERE role = 'coordinator' AND verification_status = 'pending'),
		(SELECT count(*) FROM team_members WHERE role = 'coordinator' AND verification_status = 'rejected'),
		(SELECT count(*) FROM team_members WHERE role = 'coordinator' AND verification_status = 'suspended'),
		(SELECT count(*) FROM trips WHERE status = 'live'),
		(SELECT count(*) FROM trips WHERE status = 'booked'),
		(SELECT count(*) FROM incidents WHERE status <> 'resolved'),
		(SELECT count(*) FROM incidents i JOIN trips t ON t.id = i.trip_id JOIN customers c ON c.id = t.customer_id
			WHERE i.status <> 'resolved' AND (lower(c.email) LIKE '%.demo' OR lower(c.email) LIKE '%@demo.trizpyy'))`).
		Scan(&p.Users, &p.Travelers, &p.Operators, &p.OperatorCompanies, &p.SuspendedAccounts, &p.DemoAccounts,
			&p.Guides, &p.VerifiedGuides, &p.PendingGuides, &p.RejectedGuides, &p.SuspendedGuides,
			&p.LiveTrips, &p.UpcomingTrips, &p.ActiveIncidents, &p.DemoActiveIncidents)
	return p, err
}

// Accounts

type AdminAccount struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	Role            string     `json:"role"`
	Phone           string     `json:"phone,omitempty"`
	AvatarTone      string     `json:"avatarTone"`
	EmailVerified   bool       `json:"emailVerified"`
	CreatedAt       time.Time  `json:"createdAt"`
	Status          string     `json:"status"`
	StatusChangedAt *time.Time `json:"statusChangedAt,omitempty"`
	OperatorID      string     `json:"operatorId,omitempty"`
	OperatorName    string     `json:"operatorName,omitempty"`
	Trips           int        `json:"trips"`
	Demo            bool       `json:"demo"`
}

const adminAccountCols = `u.id, u.name, u.email, u.role, u.phone, u.avatar_tone, u.email_verified_at IS NOT NULL, u.created_at,
	u.account_status, u.status_changed_at, coalesce(u.operator_id, ''), coalesce(o.name, ''),
	(SELECT count(*) FROM trips t JOIN customers c ON c.id = t.customer_id WHERE c.user_id = u.id AND t.status <> 'draft'),
	-- Seeded demo logins (*.demo) and demo customers (@demo.trizpyy).
	(lower(u.email) LIKE '%.demo' OR lower(u.email) LIKE '%@demo.trizpyy')`

func scanAccount(row interface{ Scan(...any) error }) (AdminAccount, error) {
	var a AdminAccount
	err := row.Scan(&a.ID, &a.Name, &a.Email, &a.Role, &a.Phone, &a.AvatarTone, &a.EmailVerified, &a.CreatedAt,
		&a.Status, &a.StatusChangedAt, &a.OperatorID, &a.OperatorName, &a.Trips, &a.Demo)
	return a, err
}

// ListAccounts returns travelers and operators (never Super Admins), newest first.
// role and q are optional filters; limit caps the page.
func (s *Store) ListAccounts(ctx context.Context, role, q string, limit int) ([]AdminAccount, int, error) {
	where := `WHERE u.role IN ('traveler', 'operator') AND ($1 = '' OR u.role = $1)
		AND ($2 = '' OR u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')`
	var total int
	if err := s.q.QueryRow(ctx, `SELECT count(*) FROM users u `+where, role, q).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.q.Query(ctx, `SELECT `+adminAccountCols+` FROM users u LEFT JOIN operators o ON o.id = u.operator_id `+where+`
		ORDER BY u.created_at DESC, u.id LIMIT $3`, role, q, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []AdminAccount{}
	for rows.Next() {
		a, err := scanAccount(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}

// AccountByID finds a traveler or operator account.
func (s *Store) AccountByID(ctx context.Context, id string) (AdminAccount, error) {
	a, err := scanAccount(s.q.QueryRow(ctx, `SELECT `+adminAccountCols+` FROM users u LEFT JOIN operators o ON o.id = u.operator_id
		WHERE u.id = $1 AND u.role IN ('traveler', 'operator')`, id))
	return a, notFound(err)
}

// Guides (team members with the coordinator role: the people who lead tours on the ground)

type AdminGuide struct {
	ID                    string     `json:"id"`
	Name                  string     `json:"name"`
	Region                string     `json:"region"`
	Phone                 string     `json:"phone"`
	Languages             []string   `json:"languages"`
	DutyStatus            string     `json:"dutyStatus"`
	Rating                float64    `json:"rating"`
	Tone                  string     `json:"tone"`
	OperatorID            string     `json:"operatorId"`
	OperatorName          string     `json:"operatorName"`
	Verification          string     `json:"verification"`
	VerificationNote      string     `json:"verificationNote"`
	VerifiedAt            *time.Time `json:"verifiedAt,omitempty"`
	VerificationChangedAt *time.Time `json:"verificationChangedAt,omitempty"`
	Destinations          []string   `json:"destinations"`
	ToursLed              int        `json:"toursLed"`
	ActiveTours           int        `json:"activeTours"`
}

const adminGuideCols = `m.id, m.name, m.region, m.phone, m.languages, m.status, m.rating, m.tone, m.operator_id, coalesce(o.name, ''),
	m.verification_status, m.verification_note, m.verified_at, m.verification_changed_at,
	coalesce((SELECT array_agg(d.name ORDER BY d.position) FROM destination_coordinators dc JOIN destinations d ON d.id = dc.destination_id
		WHERE dc.member_id = m.id), '{}'),
	(SELECT count(*) FROM trips t WHERE t.coordinator_id = m.id AND t.status <> 'draft'),
	(SELECT count(*) FROM trips t WHERE t.coordinator_id = m.id AND t.status IN ('booked', 'live'))`

func scanGuide(row interface{ Scan(...any) error }) (AdminGuide, error) {
	var g AdminGuide
	err := row.Scan(&g.ID, &g.Name, &g.Region, &g.Phone, &g.Languages, &g.DutyStatus, &g.Rating, &g.Tone, &g.OperatorID, &g.OperatorName,
		&g.Verification, &g.VerificationNote, &g.VerifiedAt, &g.VerificationChangedAt, &g.Destinations, &g.ToursLed, &g.ActiveTours)
	g.Languages, g.Destinations = strs(g.Languages), strs(g.Destinations)
	return g, err
}

func (s *Store) ListGuides(ctx context.Context, verification string) ([]AdminGuide, error) {
	rows, err := s.q.Query(ctx, `SELECT `+adminGuideCols+` FROM team_members m LEFT JOIN operators o ON o.id = m.operator_id
		WHERE m.role = 'coordinator' AND ($1 = '' OR m.verification_status = $1) ORDER BY m.position, m.id`, verification)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdminGuide{}
	for rows.Next() {
		g, err := scanGuide(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (s *Store) GuideByID(ctx context.Context, id string) (AdminGuide, error) {
	g, err := scanGuide(s.q.QueryRow(ctx, `SELECT `+adminGuideCols+` FROM team_members m LEFT JOIN operators o ON o.id = m.operator_id
		WHERE m.id = $1 AND m.role = 'coordinator'`, id))
	return g, notFound(err)
}

func (s *Store) SetGuideVerification(ctx context.Context, id, status, note, by string) error {
	tag, err := s.q.Exec(ctx, `UPDATE team_members SET verification_status=$2, verification_note=$3,
		verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE NULL END,
		verification_changed_at=now(), verification_changed_by=$4
		WHERE id=$1 AND role='coordinator'`, id, status, note, by)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// PublicGuide is what anyone may see about a Tripzyy Verified guide (no phone number).
type PublicGuide struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Region       string    `json:"region"`
	Languages    []string  `json:"languages"`
	Tone         string    `json:"tone"`
	Destinations []string  `json:"destinations"`
	Badge        string    `json:"badge"`
	VerifiedAt   time.Time `json:"verifiedAt"`
}

// VerifiedGuides lists only guides whose current status is verified.
func (s *Store) VerifiedGuides(ctx context.Context) ([]PublicGuide, error) {
	rows, err := s.q.Query(ctx, `SELECT m.id, m.name, m.region, m.languages, m.tone,
		coalesce((SELECT array_agg(d.name ORDER BY d.position) FROM destination_coordinators dc JOIN destinations d ON d.id = dc.destination_id
			WHERE dc.member_id = m.id), '{}'), m.verified_at
		FROM team_members m WHERE m.role = 'coordinator' AND m.verification_status = 'verified' AND m.verified_at IS NOT NULL
		ORDER BY m.position, m.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PublicGuide{}
	for rows.Next() {
		var g PublicGuide
		if err := rows.Scan(&g.ID, &g.Name, &g.Region, &g.Languages, &g.Tone, &g.Destinations, &g.VerifiedAt); err != nil {
			return nil, err
		}
		g.Languages, g.Destinations, g.Badge = strs(g.Languages), strs(g.Destinations), "Tripzyy Verified"
		out = append(out, g)
	}
	return out, rows.Err()
}
