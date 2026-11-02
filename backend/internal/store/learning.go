package store

import (
	"context"
	"encoding/json"
	"time"

	"trizpyy/internal/domain"
)

// LockProfileDNA reads a traveler's Travel DNA for update (nil when they haven't taken the quiz).
func (s *Store) LockProfileDNA(ctx context.Context, userID string) (*domain.TravelDNA, error) {
	var raw []byte
	err := s.q.QueryRow(ctx, `SELECT dna FROM traveler_profiles WHERE user_id=$1 FOR UPDATE`, userID).Scan(&raw)
	if err != nil {
		return nil, notFound(err)
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var d domain.TravelDNA
	if err := json.Unmarshal(raw, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

func (s *Store) SetProfileDNA(ctx context.Context, userID string, d domain.TravelDNA) error {
	_, err := s.q.Exec(ctx, `UPDATE traveler_profiles SET dna=$2, updated_at=now() WHERE user_id=$1`, userID, js(d))
	return err
}

type TravelerEvent struct {
	ID, UserID, TripID, Kind, ActivityID, ItemID, Detail string
	Value                                                int
	CreatedAt                                            time.Time
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (s *Store) InsertTravelerEvent(ctx context.Context, e TravelerEvent) error {
	_, err := s.q.Exec(ctx, `INSERT INTO traveler_events (id, user_id, trip_id, kind, activity_id, item_id, value, detail, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, e.ID, e.UserID, nullable(e.TripID), e.Kind, nullable(e.ActivityID), nullable(e.ItemID), e.Value, e.Detail, e.CreatedAt)
	return err
}

// DNAChange is one row of a traveler's Travel DNA history.
type DNAChange struct {
	ID        string    `json:"id"`
	Dimension string    `json:"dimension"`
	Old       int       `json:"old"`
	New       int       `json:"new"`
	Reason    string    `json:"reason"`
	Source    string    `json:"source"`
	EventID   string    `json:"eventId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) InsertDNAChange(ctx context.Context, userID string, c DNAChange) error {
	_, err := s.q.Exec(ctx, `INSERT INTO dna_history (id, user_id, dimension, old_value, new_value, reason, source, event_id, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, c.ID, userID, c.Dimension, c.Old, c.New, c.Reason, c.Source, nullable(c.EventID), c.CreatedAt)
	return err
}

func (s *Store) ListDNAHistory(ctx context.Context, userID string, limit int) ([]DNAChange, error) {
	rows, err := s.q.Query(ctx, `SELECT id, dimension, old_value, new_value, reason, source, coalesce(event_id, ''), created_at
		FROM dna_history WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DNAChange{}
	for rows.Next() {
		var c DNAChange
		if err := rows.Scan(&c.ID, &c.Dimension, &c.Old, &c.New, &c.Reason, &c.Source, &c.EventID, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// SetReviewFeedback keeps the traveler's original end-of-trip answers next to their review.
func (s *Store) SetReviewFeedback(ctx context.Context, tripID string, feedback any) error {
	_, err := s.q.Exec(ctx, `UPDATE trip_reviews SET feedback=$2 WHERE trip_id=$1`, tripID, js(feedback))
	return err
}

// RejectedActivities are experiences the traveler removed or swapped out in the last 90 days.
func (s *Store) RejectedActivities(ctx context.Context, userID string) (map[string]bool, error) {
	rows, err := s.q.Query(ctx, `SELECT DISTINCT activity_id FROM traveler_events WHERE user_id=$1 AND activity_id IS NOT NULL
		AND kind IN ('removed', 'swap_replaced') AND created_at > now() - interval '90 days'`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}
