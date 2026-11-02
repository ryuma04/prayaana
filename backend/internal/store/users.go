package store

import (
	"context"
	"encoding/json"
	"time"

	"trizpyy/internal/domain"
)

const userCols = `id, name, email, role, coalesce(operator_id, ''), phone, avatar_tone, email_verified_at IS NOT NULL, created_at`

func (s *Store) CreateUser(ctx context.Context, u domain.User, passwordHash string) error {
	var verified *time.Time
	if u.EmailVerified {
		now := time.Now().UTC()
		verified = &now
	}
	_, err := s.q.Exec(ctx, `INSERT INTO users (id, name, email, password_hash, role, operator_id, phone, avatar_tone, email_verified_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, u.ID, u.Name, u.Email, passwordHash, u.Role, nullStr(u.OperatorID), u.Phone, u.AvatarTone, verified)
	return err
}

// Credentials is what login needs: the user, their password hash and lockout state.
type Credentials struct {
	User         domain.User
	Hash         string
	FailedLogins int
	LockedUntil  *time.Time
}

func (s *Store) CredentialsByEmail(ctx context.Context, email string) (Credentials, error) {
	var c Credentials
	u := &c.User
	err := s.q.QueryRow(ctx, `SELECT `+userCols+`, password_hash, failed_logins, locked_until FROM users WHERE lower(email)=lower($1)`, email).
		Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.OperatorID, &u.Phone, &u.AvatarTone, &u.EmailVerified, &u.CreatedAt, &c.Hash, &c.FailedLogins, &c.LockedUntil)
	return c, notFound(err)
}

func (s *Store) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	c, err := s.CredentialsByEmail(ctx, email)
	return c.User, err
}

func (s *Store) UserByID(ctx context.Context, id string) (domain.User, error) {
	var u domain.User
	err := s.q.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.OperatorID, &u.Phone, &u.AvatarTone, &u.EmailVerified, &u.CreatedAt)
	return u, notFound(err)
}

func (s *Store) UserByPhone(ctx context.Context, phone string) (domain.User, error) {
	var u domain.User
	err := s.q.QueryRow(ctx, `SELECT `+userCols+` FROM users 
		WHERE regexp_replace(phone, '\D', '', 'g') = regexp_replace($1, '\D', '', 'g')
		AND length(regexp_replace($1, '\D', '', 'g')) >= 7 LIMIT 1`, phone).
		Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.OperatorID, &u.Phone, &u.AvatarTone, &u.EmailVerified, &u.CreatedAt)
	return u, notFound(err)
}

// RecordLoginFailure counts a wrong password and locks the account after too many in a row.
func (s *Store) RecordLoginFailure(ctx context.Context, userID string, maxFails int, lockFor time.Duration) error {
	_, err := s.q.Exec(ctx, `UPDATE users SET
		failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
		locked_until  = CASE WHEN failed_logins + 1 >= $2 THEN now() + $3::interval ELSE locked_until END
		WHERE id=$1`, userID, maxFails, lockFor.String())
	return err
}

func (s *Store) ResetLoginFailures(ctx context.Context, userID string) error {
	_, err := s.q.Exec(ctx, `UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1 AND (failed_logins <> 0 OR locked_until IS NOT NULL)`, userID)
	return err
}

func (s *Store) MarkEmailVerified(ctx context.Context, userID string) error {
	_, err := s.q.Exec(ctx, `UPDATE users SET email_verified_at=coalesce(email_verified_at, now()) WHERE id=$1`, userID)
	return err
}

// Email verification

type Verification struct {
	ID        string
	UserID    string
	CodeHash  string
	Attempts  int
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

func (s *Store) InsertVerification(ctx context.Context, v Verification, tokenHash string) error {
	if _, err := s.q.Exec(ctx, `UPDATE email_verifications SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, v.UserID); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `INSERT INTO email_verifications (id, user_id, token_hash, code_hash, expires_at) VALUES ($1,$2,$3,$4,$5)`,
		v.ID, v.UserID, tokenHash, v.CodeHash, v.ExpiresAt)
	return err
}

const verificationCols = `id, user_id, code_hash, attempts, expires_at, used_at, created_at`

func scanVerification(row interface{ Scan(...any) error }) (Verification, error) {
	var v Verification
	err := row.Scan(&v.ID, &v.UserID, &v.CodeHash, &v.Attempts, &v.ExpiresAt, &v.UsedAt, &v.CreatedAt)
	return v, notFound(err)
}

func (s *Store) VerificationByToken(ctx context.Context, tokenHash string) (Verification, error) {
	return scanVerification(s.q.QueryRow(ctx, `SELECT `+verificationCols+` FROM email_verifications WHERE token_hash=$1 FOR UPDATE`, tokenHash))
}

func (s *Store) LatestVerification(ctx context.Context, userID string) (Verification, error) {
	return scanVerification(s.q.QueryRow(ctx, `SELECT `+verificationCols+` FROM email_verifications WHERE user_id=$1
		ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, userID))
}

func (s *Store) CountVerificationAttempt(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `UPDATE email_verifications SET attempts=attempts+1 WHERE id=$1`, id)
	return err
}

func (s *Store) UseVerification(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `UPDATE email_verifications SET used_at=now() WHERE id=$1`, id)
	return err
}

func (s *Store) CountUsers(ctx context.Context) (int, error) {
	var n int
	err := s.q.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) DefaultOperator(ctx context.Context) (string, error) {
	var id string
	err := s.q.QueryRow(ctx, `SELECT id FROM operators ORDER BY created_at LIMIT 1`).Scan(&id)
	return id, notFound(err)
}

type Profile struct {
	DNA              *domain.TravelDNA   `json:"dna"`
	QuizAnswers      map[string]any      `json:"quizAnswers"`
	Onboarding       map[string]any      `json:"onboarding"`
	XP               int                 `json:"xp"`
	Badges           []string            `json:"badges"`
	SavedPlaces      []string            `json:"savedPlaces"`
	AutoApproveLimit int                 `json:"autoApproveLimit"`
	Language         string              `json:"language"`
	PrepDone         map[string][]string `json:"prepDone"`
	UpdatedAt        time.Time           `json:"updatedAt"`
}

func (s *Store) EnsureProfile(ctx context.Context, userID string) error {
	_, err := s.q.Exec(ctx, `INSERT INTO traveler_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, userID)
	return err
}

func (s *Store) GetProfile(ctx context.Context, userID string) (Profile, error) {
	var p Profile
	var dna, quiz, onboarding, prep []byte
	err := s.q.QueryRow(ctx, `SELECT dna, quiz_answers, onboarding, xp, badges, saved_places, auto_approve_limit,
		language, prep_done, updated_at FROM traveler_profiles WHERE user_id=$1`, userID).
		Scan(&dna, &quiz, &onboarding, &p.XP, &p.Badges, &p.SavedPlaces, &p.AutoApproveLimit, &p.Language, &prep, &p.UpdatedAt)
	if err != nil {
		return p, notFound(err)
	}
	if len(dna) > 0 && string(dna) != "null" {
		p.DNA = &domain.TravelDNA{}
		_ = json.Unmarshal(dna, p.DNA)
	}
	_ = json.Unmarshal(quiz, &p.QuizAnswers)
	_ = json.Unmarshal(onboarding, &p.Onboarding)
	_ = json.Unmarshal(prep, &p.PrepDone)
	if p.PrepDone == nil {
		p.PrepDone = map[string][]string{}
	}
	p.Badges, p.SavedPlaces = strs(p.Badges), strs(p.SavedPlaces)
	return p, nil
}

func (s *Store) SaveProfile(ctx context.Context, userID string, p Profile) error {
	var dna []byte
	if p.DNA != nil {
		dna = js(p.DNA)
	}
	quiz, onboarding, prep := js(orMap(p.QuizAnswers)), js(orMap(p.Onboarding)), js(p.PrepDone)
	_, err := s.q.Exec(ctx, `UPDATE traveler_profiles SET dna=$2, quiz_answers=$3, onboarding=$4, xp=$5, badges=$6, saved_places=$7,
		auto_approve_limit=$8, language=$9, prep_done=$10, updated_at=now() WHERE user_id=$1`,
		userID, dna, quiz, onboarding, p.XP, strs(p.Badges), strs(p.SavedPlaces), p.AutoApproveLimit, p.Language, prep)
	return err
}

func orMap(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	return m
}

// AddXP awards points and an optional badge (idempotent for badges).
func (s *Store) AddXP(ctx context.Context, userID string, points int, badge string) error {
	_, err := s.q.Exec(ctx, `UPDATE traveler_profiles SET xp = xp + $2,
		badges = CASE WHEN $3 = '' OR $3 = ANY(badges) THEN badges ELSE array_append(badges, $3) END, updated_at=now()
		WHERE user_id=$1`, userID, points, badge)
	return err
}

func (s *Store) AutoApproveLimitForTrip(ctx context.Context, tripID string) (int, error) {
	var limit *int
	err := s.q.QueryRow(ctx, `SELECT p.auto_approve_limit FROM trips t JOIN customers c ON c.id=t.customer_id
		LEFT JOIN traveler_profiles p ON p.user_id=c.user_id WHERE t.id=$1`, tripID).Scan(&limit)
	if err != nil {
		return 1000, notFound(err)
	}
	if limit == nil {
		return 1000, nil
	}
	return *limit, nil
}

// Customers

func (s *Store) CreateCustomer(ctx context.Context, operatorID string, c domain.Customer) error {
	since := c.Since
	if since == "" {
		since = time.Now().UTC().Format("2006-01-02")
	}
	_, err := s.q.Exec(ctx, `INSERT INTO customers (id, operator_id, user_id, name, city, email, phone, since, dna_name, tone, tags)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, c.ID, operatorID, nullStr(c.UserID), c.Name, c.City, c.Email, c.Phone, since,
		c.DNA, c.Tone, strs(c.Tags))
	return err
}

// DeleteCustomer removes a customer with no trips left (used to clear demo data).
func (s *Store) DeleteCustomer(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM customers WHERE id=$1`, id)
	return err
}

func (s *Store) CustomerForUser(ctx context.Context, userID string) (domain.Customer, error) {
	rows, err := s.listCustomers(ctx, `WHERE c.user_id=$1`, userID)
	if err != nil {
		return domain.Customer{}, err
	}
	if len(rows) == 0 {
		return domain.Customer{}, ErrNotFound
	}
	return rows[0], nil
}

func (s *Store) LinkCustomerUser(ctx context.Context, customerID, userID string) error {
	_, err := s.q.Exec(ctx, `UPDATE customers SET user_id=$2 WHERE id=$1 AND user_id IS NULL`, customerID, userID)
	return err
}

func (s *Store) CustomerByEmail(ctx context.Context, email string) (domain.Customer, error) {
	rows, err := s.listCustomers(ctx, `WHERE lower(c.email)=lower($1)`, email)
	if err != nil {
		return domain.Customer{}, err
	}
	if len(rows) == 0 {
		return domain.Customer{}, ErrNotFound
	}
	return rows[0], nil
}

func (s *Store) SetCustomerDNA(ctx context.Context, userID, dnaName string) error {
	_, err := s.q.Exec(ctx, `UPDATE customers SET dna_name=$2 WHERE user_id=$1`, userID, dnaName)
	return err
}

func (s *Store) ListCustomers(ctx context.Context) ([]domain.Customer, error) {
	return s.listCustomers(ctx, `WHERE $1 = ''`, "")
}

func (s *Store) listCustomers(ctx context.Context, where string, arg any) ([]domain.Customer, error) {
	rows, err := s.q.Query(ctx, `SELECT c.id, coalesce(c.user_id, ''), c.name, c.city, c.email, c.phone, to_char(c.since, 'YYYY-MM-DD'),
		c.dna_name, c.tone, c.tags,
		(SELECT count(*) FROM trips t WHERE t.customer_id=c.id AND t.status <> 'draft'),
		coalesce((SELECT sum(l.amount) FROM ledger_entries l JOIN trips t ON t.id=l.trip_id
			WHERE t.customer_id=c.id AND l.kind IN ('payment','adjustment','refund') AND l.status <> 'failed'), 0)
		FROM customers c `+where+` ORDER BY c.created_at, c.id`, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Customer
	for rows.Next() {
		var c domain.Customer
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.City, &c.Email, &c.Phone, &c.Since, &c.DNA, &c.Tone, &c.Tags, &c.Trips, &c.LTV); err != nil {
			return nil, err
		}
		c.Tags = strs(c.Tags)
		out = append(out, c)
	}
	return out, rows.Err()
}

// Team

func (s *Store) ListTeam(ctx context.Context) ([]domain.TeamMember, error) {
	rows, err := s.q.Query(ctx, `SELECT id, name, role, region, phone, languages, status, rating, tone FROM team_members ORDER BY position, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.TeamMember
	for rows.Next() {
		var m domain.TeamMember
		if err := rows.Scan(&m.ID, &m.Name, &m.Role, &m.Region, &m.Phone, &m.Languages, &m.Status, &m.Rating, &m.Tone); err != nil {
			return nil, err
		}
		m.Languages = strs(m.Languages)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) TeamMemberExists(ctx context.Context, id string) (bool, error) {
	var ok bool
	// Guides a Super Admin rejected or suspended can't be put on a tour.
	err := s.q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM team_members WHERE id=$1 AND role='coordinator'
		AND verification_status NOT IN ('rejected', 'suspended'))`, id).Scan(&ok)
	return ok, err
}
