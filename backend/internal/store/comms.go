package store

import (
	"context"
	"encoding/json"
	"time"

	"trizpyy/internal/domain"
)

// Inbox

func (s *Store) UpsertThread(ctx context.Context, t domain.InboxThread) error {
	_, err := s.q.Exec(ctx, `INSERT INTO inbox_threads (id, party, name, subtitle, trip_id, vendor_id, unread, tone, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
		ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, subtitle=EXCLUDED.subtitle, updated_at=now()`,
		t.ID, t.Party, t.Name, t.Subtitle, nullStr(t.TripID), nullStr(t.VendorID), t.Unread, orDefault(t.Tone, "cream"))
	return err
}

func (s *Store) AddMessage(ctx context.Context, threadID string, m domain.InboxMessage, unread bool) error {
	var att []byte
	if m.Attachment != nil {
		att = js(m.Attachment)
	}
	if m.At.IsZero() {
		m.At = time.Now().UTC()
	}
	_, err := s.q.Exec(ctx, `INSERT INTO inbox_messages (id, thread_id, sender, type, body, transcript, decision, confidence, attachment, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, m.ID, threadID, m.From, m.Type, m.Body, nullStr(m.Transcript), nullStr(m.Decision),
		m.Confidence, att, nullStr(m.Status), m.At)
	if err != nil {
		return err
	}
	_, err = s.q.Exec(ctx, `UPDATE inbox_threads SET updated_at=now(), unread = unread + CASE WHEN $2 THEN 1 ELSE 0 END WHERE id=$1`, threadID, unread)
	return err
}

func (s *Store) MarkThreadRead(ctx context.Context, id string) error {
	tag, err := s.q.Exec(ctx, `UPDATE inbox_threads SET unread=0 WHERE id=$1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Store) ThreadExists(ctx context.Context, id string) (bool, error) {
	var ok bool
	err := s.q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM inbox_threads WHERE id=$1)`, id).Scan(&ok)
	return ok, err
}

func (s *Store) ListThreads(ctx context.Context) ([]domain.InboxThread, error) {
	rows, err := s.q.Query(ctx, `SELECT id, party, name, subtitle, coalesce(trip_id, ''), coalesce(vendor_id, ''), unread, tone
		FROM inbox_threads ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	var threads []domain.InboxThread
	idx := map[string]int{}
	for rows.Next() {
		var t domain.InboxThread
		if err := rows.Scan(&t.ID, &t.Party, &t.Name, &t.Subtitle, &t.TripID, &t.VendorID, &t.Unread, &t.Tone); err != nil {
			rows.Close()
			return nil, err
		}
		t.Messages = []domain.InboxMessage{}
		idx[t.ID] = len(threads)
		threads = append(threads, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	mrows, err := s.q.Query(ctx, `SELECT thread_id, id, sender, type, body, coalesce(transcript, ''), coalesce(decision, ''), confidence,
		attachment, coalesce(status, ''), created_at FROM inbox_messages ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer mrows.Close()
	for mrows.Next() {
		var threadID string
		var m domain.InboxMessage
		var att []byte
		if err := mrows.Scan(&threadID, &m.ID, &m.From, &m.Type, &m.Body, &m.Transcript, &m.Decision, &m.Confidence, &att, &m.Status, &m.At); err != nil {
			return nil, err
		}
		if len(att) > 0 {
			m.Attachment = &domain.Attachment{}
			_ = json.Unmarshal(att, m.Attachment)
		}
		if i, ok := idx[threadID]; ok {
			threads[i].Messages = append(threads[i].Messages, m)
		}
	}
	if threads == nil {
		threads = []domain.InboxThread{}
	}
	return threads, mrows.Err()
}

// Notifications

func (s *Store) InsertNotification(ctx context.Context, userID string, n domain.Notification) error {
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	_, err := s.q.Exec(ctx, `INSERT INTO notifications (id, audience, user_id, kind, title, body, href, read, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, n.ID, n.Audience, nullStr(userID), n.Kind, n.Title, n.Body, nullStr(n.Href), n.Read, n.CreatedAt)
	return err
}

// ListNotifications returns a traveler's own notices, or every operator notice.
func (s *Store) ListNotifications(ctx context.Context, audience, userID string, limit int) ([]domain.Notification, error) {
	rows, err := s.q.Query(ctx, `SELECT id, kind, title, body, coalesce(href, ''), read, created_at, audience FROM notifications
		WHERE audience=$1 AND ($1 = 'operator' OR user_id=$2) ORDER BY created_at DESC LIMIT $3`, audience, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Notification{}
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(&n.ID, &n.Kind, &n.Title, &n.Body, &n.Href, &n.Read, &n.CreatedAt, &n.Audience); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) MarkNotifications(ctx context.Context, audience, userID, id string) error {
	_, err := s.q.Exec(ctx, `UPDATE notifications SET read=true WHERE audience=$1 AND ($1 = 'operator' OR user_id=$2) AND ($3 = '' OR id=$3)`,
		audience, userID, id)
	return err
}

// Alerts

func (s *Store) InsertCrowdReport(ctx context.Context, r domain.CrowdReport) error {
	_, err := s.q.Exec(ctx, `INSERT INTO crowd_reports (id, place, destination_id, type, text, reporter, reporter_role, verified, confirmations,
		affected_trips, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, r.ID, r.Place, r.DestinationID, r.Type, r.Text, r.Reporter,
		r.ReporterRole, r.Verified, max(1, r.Confirmations), strs(r.AffectedTrips), r.CreatedAt)
	return err
}

func (s *Store) ListCrowdReports(ctx context.Context) ([]domain.CrowdReport, error) {
	rows, err := s.q.Query(ctx, `SELECT id, place, destination_id, type, text, reporter, reporter_role, created_at, verified, confirmations,
		affected_trips FROM crowd_reports ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CrowdReport{}
	for rows.Next() {
		var r domain.CrowdReport
		if err := rows.Scan(&r.ID, &r.Place, &r.DestinationID, &r.Type, &r.Text, &r.Reporter, &r.ReporterRole, &r.CreatedAt, &r.Verified,
			&r.Confirmations, &r.AffectedTrips); err != nil {
			return nil, err
		}
		r.AffectedTrips = strs(r.AffectedTrips)
		out = append(out, r)
	}
	return out, rows.Err()
}

// RecentSimilarReports counts unexpired reports for the same place in the last two hours.
func (s *Store) RecentSimilarReports(ctx context.Context, destinationID, place string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx, `SELECT count(*) FROM crowd_reports WHERE destination_id=$1 AND lower(place)=lower($2)
		AND created_at > now() - interval '2 hours'`, destinationID, place).Scan(&n)
	return n, err
}

func (s *Store) VerifyCrowdReport(ctx context.Context, id string) (domain.CrowdReport, error) {
	var r domain.CrowdReport
	err := s.q.QueryRow(ctx, `UPDATE crowd_reports SET verified=true, confirmations=confirmations+1, expires_at=now() + interval '6 hours'
		WHERE id=$1 RETURNING id, place, destination_id, type, text, reporter, reporter_role, created_at, verified, confirmations, affected_trips`, id).
		Scan(&r.ID, &r.Place, &r.DestinationID, &r.Type, &r.Text, &r.Reporter, &r.ReporterRole, &r.CreatedAt, &r.Verified, &r.Confirmations, &r.AffectedTrips)
	r.AffectedTrips = strs(r.AffectedTrips)
	return r, notFound(err)
}

func (s *Store) InsertWarning(ctx context.Context, w domain.EarlyWarning) error {
	_, err := s.q.Exec(ctx, `INSERT INTO early_warnings (id, trip_id, title, detail, eta_late_min, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		w.ID, w.TripID, w.Title, w.Detail, w.EtaLateMin, w.Status, w.CreatedAt)
	return err
}

func (s *Store) ListWarnings(ctx context.Context) ([]domain.EarlyWarning, error) {
	rows, err := s.q.Query(ctx, `SELECT id, trip_id, title, detail, eta_late_min, created_at, status FROM early_warnings ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.EarlyWarning{}
	for rows.Next() {
		var w domain.EarlyWarning
		if err := rows.Scan(&w.ID, &w.TripID, &w.Title, &w.Detail, &w.EtaLateMin, &w.CreatedAt, &w.Status); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

func (s *Store) GetWarning(ctx context.Context, id string) (domain.EarlyWarning, error) {
	var w domain.EarlyWarning
	err := s.q.QueryRow(ctx, `SELECT id, trip_id, title, detail, eta_late_min, created_at, status FROM early_warnings WHERE id=$1`, id).
		Scan(&w.ID, &w.TripID, &w.Title, &w.Detail, &w.EtaLateMin, &w.CreatedAt, &w.Status)
	return w, notFound(err)
}

func (s *Store) SetWarningStatus(ctx context.Context, id, status string) error {
	_, err := s.q.Exec(ctx, `UPDATE early_warnings SET status=$2 WHERE id=$1`, id, status)
	return err
}

// AI bookkeeping

func (s *Store) LogDecision(ctx context.Context, id, engine, question string, options []string, answer string, confidence float64, tookMs int) error {
	_, err := s.q.Exec(ctx, `INSERT INTO decisions (id, engine, question, options, answer, confidence, took_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, engine, question, strs(options), answer, confidence, tookMs)
	return err
}

func (s *Store) CacheGet(ctx context.Context, key string, v any) bool {
	var raw []byte
	if err := s.q.QueryRow(ctx, `SELECT value FROM ai_cache WHERE key=$1 AND created_at > now() - interval '7 days'`, key).Scan(&raw); err != nil {
		return false
	}
	return json.Unmarshal(raw, v) == nil
}

func (s *Store) CachePut(ctx context.Context, key string, v any) error {
	_, err := s.q.Exec(ctx, `INSERT INTO ai_cache (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, created_at=now()`, key, js(v))
	return err
}

// Decision is one logged AI decision.
type Decision struct {
	ID         string    `json:"id"`
	Engine     string    `json:"engine"`
	Question   string    `json:"question"`
	Options    []string  `json:"options"`
	Answer     string    `json:"answer"`
	Confidence float64   `json:"confidence"`
	TookMs     int       `json:"tookMs"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (s *Store) ListDecisions(ctx context.Context, limit int) ([]Decision, error) {
	rows, err := s.q.Query(ctx, `SELECT id, engine, question, options, answer, confidence, took_ms, created_at FROM decisions
		ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Decision{}
	for rows.Next() {
		var d Decision
		if err := rows.Scan(&d.ID, &d.Engine, &d.Question, &d.Options, &d.Answer, &d.Confidence, &d.TookMs, &d.CreatedAt); err != nil {
			return nil, err
		}
		d.Options = strs(d.Options)
		out = append(out, d)
	}
	return out, rows.Err()
}
