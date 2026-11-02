package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"trizpyy/internal/domain"
)

const incidentCols = `id, trip_id, kind, title, detail, day, severity, source, status, created_at, delay_min, vendor_id, place, mood,
	selected_plan_id, agent_run_id, receipt_id`

func scanIncident(row pgx.Row) (domain.Incident, error) {
	var i domain.Incident
	var vendor, place, mood, plan, run, receipt *string
	err := row.Scan(&i.ID, &i.TripID, &i.Kind, &i.Title, &i.Detail, &i.Day, &i.Severity, &i.Source, &i.Status, &i.CreatedAt,
		&i.DelayMin, &vendor, &place, &mood, &plan, &run, &receipt)
	i.VendorID, i.Place, i.Mood, i.SelectedPlanID, i.AgentRunID, i.ReceiptID = str(vendor), str(place), str(mood), str(plan), str(run), str(receipt)
	return i, notFound(err)
}

func (s *Store) InsertIncident(ctx context.Context, i domain.Incident) error {
	_, err := s.q.Exec(ctx, `INSERT INTO incidents (id, trip_id, kind, title, detail, day, severity, source, status, created_at, delay_min,
		vendor_id, place, mood) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		i.ID, i.TripID, i.Kind, i.Title, i.Detail, i.Day, i.Severity, i.Source, i.Status, i.CreatedAt, i.DelayMin,
		nullStr(i.VendorID), nullStr(i.Place), nullStr(i.Mood))
	return err
}

func (s *Store) GetIncident(ctx context.Context, id string) (domain.Incident, error) {
	return scanIncident(s.q.QueryRow(ctx, `SELECT `+incidentCols+` FROM incidents WHERE id=$1`, id))
}

func (s *Store) LockIncident(ctx context.Context, id string) (domain.Incident, error) {
	return scanIncident(s.q.QueryRow(ctx, `SELECT `+incidentCols+` FROM incidents WHERE id=$1 FOR UPDATE`, id))
}

type IncidentPatch struct {
	Status         *string
	SelectedPlanID *string
	AgentRunID     *string
	ReceiptID      *string
}

func (s *Store) UpdateIncident(ctx context.Context, id string, p IncidentPatch) error {
	_, err := s.q.Exec(ctx, `UPDATE incidents SET status=coalesce($2, status), selected_plan_id=coalesce($3, selected_plan_id),
		agent_run_id=coalesce($4, agent_run_id), receipt_id=coalesce($5, receipt_id), updated_at=now() WHERE id=$1`,
		id, p.Status, p.SelectedPlanID, p.AgentRunID, p.ReceiptID)
	return err
}

func (s *Store) ListIncidents(ctx context.Context, tripID string, openOnly bool) ([]domain.Incident, error) {
	rows, err := s.q.Query(ctx, `SELECT `+incidentCols+` FROM incidents WHERE ($1 = '' OR trip_id=$1) AND (NOT $2 OR status <> 'resolved')
		ORDER BY created_at DESC`, tripID, openOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Incident{}
	for rows.Next() {
		i, err := scanIncident(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// Agent runs

func (s *Store) InsertRun(ctx context.Context, r domain.AgentRun) error {
	_, err := s.q.Exec(ctx, `INSERT INTO agent_runs (id, incident_id, trip_id, status, attempt, mode, scope, started_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, r.ID, r.IncidentID, r.TripID, r.Status, r.Attempt, r.Mode, r.Scope, r.StartedAt)
	return err
}

type RunPatch struct {
	Status          *string
	Attempt         *int
	PlanID          *string
	ExcludedVendors []string
	Impact          *domain.ImpactSummary
	Plans           []domain.FixPlan
	Summary         *string
	Finished        bool
}

func (s *Store) UpdateRun(ctx context.Context, id string, p RunPatch) error {
	var impact, plans []byte
	if p.Impact != nil {
		impact = js(p.Impact)
	}
	if p.Plans != nil {
		plans = js(p.Plans)
	}
	var excluded []string
	if p.ExcludedVendors != nil {
		excluded = p.ExcludedVendors
	}
	_, err := s.q.Exec(ctx, `UPDATE agent_runs SET status=coalesce($2, status), attempt=coalesce($3, attempt), plan_id=coalesce($4, plan_id),
		excluded_vendors=coalesce($5, excluded_vendors), impact=coalesce($6, impact), plans=coalesce($7, plans), summary=coalesce($8, summary),
		finished_at = CASE WHEN $9 THEN now() ELSE finished_at END WHERE id=$1`,
		id, p.Status, p.Attempt, p.PlanID, excluded, impact, plans, p.Summary, p.Finished)
	return err
}

const runCols = `id, incident_id, trip_id, status, attempt, coalesce(plan_id, ''), mode, scope, excluded_vendors, impact, plans, summary, started_at, finished_at`

func scanRun(row pgx.Row) (domain.AgentRun, error) {
	var r domain.AgentRun
	var impact, plans []byte
	err := row.Scan(&r.ID, &r.IncidentID, &r.TripID, &r.Status, &r.Attempt, &r.PlanID, &r.Mode, &r.Scope, &r.ExcludedVendors,
		&impact, &plans, &r.Summary, &r.StartedAt, &r.FinishedAt)
	if err != nil {
		return r, notFound(err)
	}
	if len(impact) > 0 {
		r.Impact = &domain.ImpactSummary{}
		_ = json.Unmarshal(impact, r.Impact)
	}
	if len(plans) > 0 {
		_ = json.Unmarshal(plans, &r.Plans)
	}
	r.ExcludedVendors = strs(r.ExcludedVendors)
	r.Steps = []domain.AgentStep{}
	return r, nil
}

func (s *Store) GetRun(ctx context.Context, id string) (domain.AgentRun, error) {
	r, err := scanRun(s.q.QueryRow(ctx, `SELECT `+runCols+` FROM agent_runs WHERE id=$1`, id))
	if err != nil {
		return r, err
	}
	r.Steps, err = s.ListSteps(ctx, id)
	return r, err
}

func (s *Store) ListRuns(ctx context.Context, limit int) ([]domain.AgentRun, error) {
	rows, err := s.q.Query(ctx, `SELECT `+runCols+` FROM agent_runs ORDER BY started_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	var out []domain.AgentRun
	for rows.Next() {
		r, err := scanRun(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if out[i].Steps, err = s.ListSteps(ctx, out[i].ID); err != nil {
			return nil, err
		}
	}
	if out == nil {
		out = []domain.AgentRun{}
	}
	return out, nil
}

func (s *Store) ActiveRunForIncident(ctx context.Context, incidentID string) (string, error) {
	var id string
	err := s.q.QueryRow(ctx, `SELECT id FROM agent_runs WHERE incident_id=$1 AND status IN ('running','waiting') ORDER BY started_at DESC LIMIT 1`, incidentID).Scan(&id)
	return id, notFound(err)
}

// FailInterruptedRuns closes runs that were active when the server stopped.
func (s *Store) FailInterruptedRuns(ctx context.Context) ([]domain.AgentRun, error) {
	rows, err := s.q.Query(ctx, `UPDATE agent_runs SET status='needs_human', finished_at=now(),
		summary='Interrupted by a server restart. Nothing was changed without every vendor''s yes.'
		WHERE status IN ('running','waiting') RETURNING `+runCols)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.AgentRun
	for rows.Next() {
		r, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) InsertStep(ctx context.Context, runID string, st domain.AgentStep) (int, error) {
	var seq int
	err := s.q.QueryRow(ctx, `INSERT INTO agent_steps (id, run_id, seq, tool, label, status, result, detail, kind, took_ms, ts)
		VALUES ($1, $2, (SELECT coalesce(max(seq), 0) + 1 FROM agent_steps WHERE run_id=$2), $3, $4, $5, $6, $7, $8, $9, $10) RETURNING seq`,
		st.ID, runID, st.Tool, st.Label, st.Status, st.Result, strs(st.Detail), orDefault(st.Kind, "normal"), st.TookMs, st.TS).Scan(&seq)
	return seq, err
}

func (s *Store) UpdateStep(ctx context.Context, st domain.AgentStep) error {
	_, err := s.q.Exec(ctx, `UPDATE agent_steps SET status=$2, result=$3, detail=$4, took_ms=$5 WHERE id=$1`,
		st.ID, st.Status, st.Result, strs(st.Detail), st.TookMs)
	return err
}

// SettleOpenSteps marks steps still shown as running or waiting once a run has stopped.
func (s *Store) SettleOpenSteps(ctx context.Context, runID string) error {
	_, err := s.q.Exec(ctx, `UPDATE agent_steps SET status='warning', result=CASE WHEN result='' THEN 'Stopped' ELSE result END
		WHERE run_id=$1 AND status IN ('running','waiting','pending')`, runID)
	return err
}

func (s *Store) ListSteps(ctx context.Context, runID string) ([]domain.AgentStep, error) {
	rows, err := s.q.Query(ctx, `SELECT id, tool, label, status, result, detail, kind, took_ms, ts FROM agent_steps WHERE run_id=$1 ORDER BY seq`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.AgentStep{}
	for rows.Next() {
		var st domain.AgentStep
		if err := rows.Scan(&st.ID, &st.Tool, &st.Label, &st.Status, &st.Result, &st.Detail, &st.Kind, &st.TookMs, &st.TS); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

// Confirmations (all-or-nothing rounds)

type Confirmation struct {
	ID         string         `json:"id"`
	IncidentID string         `json:"incidentId,omitempty"`
	RunID      string         `json:"runId,omitempty"`
	TripID     string         `json:"tripId"`
	Plan       domain.FixPlan `json:"plan"`
	Attempt    int            `json:"attempt"`
	Phase      string         `json:"phase"`
	DeadlineAt time.Time      `json:"deadlineAt"`
	CreatedAt  time.Time      `json:"createdAt"`
}

func (s *Store) InsertConfirmation(ctx context.Context, c Confirmation) error {
	_, err := s.q.Exec(ctx, `INSERT INTO confirmations (id, incident_id, run_id, trip_id, plan, attempt, phase, deadline_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, c.ID, nullStr(c.IncidentID), nullStr(c.RunID), c.TripID, js(c.Plan), c.Attempt, c.Phase, c.DeadlineAt)
	return err
}

func (s *Store) SetConfirmationPhase(ctx context.Context, id, phase string) error {
	_, err := s.q.Exec(ctx, `UPDATE confirmations SET phase=$2, resolved_at=now() WHERE id=$1 AND phase='asking'`, id, phase)
	return err
}

// ExpireConfirmations times out every pending vendor answer in rounds past their deadline.
func (s *Store) ExpireConfirmations(ctx context.Context, now time.Time) ([]string, error) {
	rows, err := s.q.Query(ctx, `UPDATE vendor_requests r SET status='timeout', responded_at=$1
		FROM confirmations c WHERE r.confirmation_id=c.id AND c.phase='asking' AND c.deadline_at < $1 AND r.status='pending'
		RETURNING c.id`, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := map[string]bool{}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}

// Vendor requests

const requestCols = `token, coalesce(confirmation_id, ''), coalesce(run_id, ''), coalesce(incident_id, ''), trip_id, vendor_id, traveler_name,
	date_label, original, proposed, item_title, status, coalesce(channel, ''), responded_at, coalesce(alt_time, ''), voice, created_at, kind`

func scanRequest(row pgx.Row) (domain.VendorRequest, error) {
	var r domain.VendorRequest
	var voice []byte
	err := row.Scan(&r.Token, &r.ConfirmationID, &r.RunID, &r.IncidentID, &r.TripID, &r.VendorID, &r.TravelerName, &r.DateLabel,
		&r.Original, &r.Proposed, &r.ItemTitle, &r.Status, &r.Channel, &r.RespondedAt, &r.AltTime, &voice, &r.CreatedAt, &r.Kind)
	if err != nil {
		return r, notFound(err)
	}
	if len(voice) > 0 {
		r.Voice = &domain.VoiceInterpretation{}
		_ = json.Unmarshal(voice, r.Voice)
	}
	return r, nil
}

func (s *Store) InsertRequests(ctx context.Context, list []domain.VendorRequest) error {
	b := &pgx.Batch{}
	for _, r := range list {
		b.Queue(`INSERT INTO vendor_requests (token, confirmation_id, run_id, incident_id, trip_id, vendor_id, traveler_name, date_label,
			original, proposed, item_title, status, kind, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
			r.Token, nullStr(r.ConfirmationID), nullStr(r.RunID), nullStr(r.IncidentID), r.TripID, r.VendorID, r.TravelerName, r.DateLabel,
			r.Original, r.Proposed, r.ItemTitle, r.Status, r.Kind, r.CreatedAt)
	}
	return s.q.SendBatch(ctx, b).Close()
}

func (s *Store) GetRequest(ctx context.Context, token string) (domain.VendorRequest, error) {
	return scanRequest(s.q.QueryRow(ctx, `SELECT `+requestCols+` FROM vendor_requests WHERE token=$1`, token))
}

func (s *Store) RequestsForConfirmation(ctx context.Context, confirmationID string) ([]domain.VendorRequest, error) {
	return s.listRequests(ctx, `WHERE confirmation_id=$1 ORDER BY created_at, token`, confirmationID)
}

func (s *Store) RequestsForRun(ctx context.Context, runID string) ([]domain.VendorRequest, error) {
	return s.listRequests(ctx, `WHERE run_id=$1 ORDER BY created_at, token`, runID)
}

func (s *Store) PendingRequestForVendor(ctx context.Context, vendorID string) (domain.VendorRequest, error) {
	return scanRequest(s.q.QueryRow(ctx, `SELECT `+requestCols+` FROM vendor_requests WHERE vendor_id=$1 AND status='pending'
		ORDER BY created_at DESC LIMIT 1`, vendorID))
}

func (s *Store) PendingBookingRequests(ctx context.Context, tripID string) ([]domain.VendorRequest, error) {
	return s.listRequests(ctx, `WHERE trip_id=$1 AND kind='booking' AND status='pending' ORDER BY created_at, token`, tripID)
}

// RequestsForVendor is a partner's recent request history (newest first).
func (s *Store) RequestsForVendor(ctx context.Context, vendorID string, limit int) ([]domain.VendorRequest, error) {
	return s.listRequests(ctx, `WHERE vendor_id=$1 ORDER BY created_at DESC LIMIT $2`, vendorID, limit)
}

// PendingRequests is every vendor request still waiting for an answer, newest first.
func (s *Store) PendingRequests(ctx context.Context) ([]domain.VendorRequest, error) {
	return s.listRequests(ctx, `WHERE status='pending' ORDER BY created_at DESC LIMIT 300`)
}

func (s *Store) listRequests(ctx context.Context, where string, args ...any) ([]domain.VendorRequest, error) {
	rows, err := s.q.Query(ctx, `SELECT `+requestCols+` FROM vendor_requests `+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.VendorRequest{}
	for rows.Next() {
		r, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// AnswerRequest records a reply only while the request is still pending; it reports whether it applied.
func (s *Store) AnswerRequest(ctx context.Context, token, answer, channel, altTime string, voice *domain.VoiceInterpretation) (bool, error) {
	var v []byte
	if voice != nil {
		v = js(voice)
	}
	tag, err := s.q.Exec(ctx, `UPDATE vendor_requests SET status=$2, channel=nullif($3, ''), alt_time=nullif($4, ''), voice=$5, responded_at=now()
		WHERE token=$1 AND status='pending'`, token, answer, channel, altTime, v)
	return tag.RowsAffected() > 0, err
}

// WithdrawRun cancels every unanswered request of an agent run and closes its open rounds.
func (s *Store) WithdrawRun(ctx context.Context, runID string) error {
	if _, err := s.q.Exec(ctx, `UPDATE vendor_requests SET status='cancelled' WHERE run_id=$1 AND status='pending'`, runID); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `UPDATE confirmations SET phase='undone', resolved_at=now() WHERE run_id=$1 AND phase='asking'`, runID)
	return err
}

// CloseStaleRounds closes rounds left open by a previous server process.
func (s *Store) CloseStaleRounds(ctx context.Context) error {
	if _, err := s.q.Exec(ctx, `UPDATE vendor_requests r SET status='cancelled' FROM confirmations c
		WHERE r.confirmation_id=c.id AND c.phase='asking' AND r.status='pending'`); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `UPDATE confirmations SET phase='expired', resolved_at=now() WHERE phase='asking'`)
	return err
}

func (s *Store) CancelRequests(ctx context.Context, tokens []string) error {
	_, err := s.q.Exec(ctx, `UPDATE vendor_requests SET status='cancelled' WHERE token = ANY($1) AND status IN ('pending','yes')`, tokens)
	return err
}
