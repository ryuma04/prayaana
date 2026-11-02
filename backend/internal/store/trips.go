package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"trizpyy/internal/domain"
)

const tripCols = `t.id, t.code, t.title, t.destination_id, to_char(t.start_date, 'YYYY-MM-DD'), t.nights, t.adults, t.kids,
	t.budget_per_person, t.stay_type, t.transport_mode, t.interests, t.pace, t.rhythm, t.special, t.own_words, t.from_city,
	t.stay_id, t.transport_id, t.status, t.payment_status, t.promo_code, t.coordinator_id, t.group_name, t.current_day,
	t.weather_overrides, t.optimized, t.version, t.created_at, t.booked_at, t.customer_id, c.name,
	COALESCE(t.destinations, '{}'), COALESCE(t.destination_allocations, '[]'::jsonb), t.origin_place`

const tripFrom = ` FROM trips t JOIN customers c ON c.id = t.customer_id`

func scanTrip(row pgx.Row) (*domain.Trip, error) {
	var t domain.Trip
	var promo, coord *string
	var weather, optimized, allocations, origin []byte
	var dests []string
	err := row.Scan(&t.ID, &t.Code, &t.Title, &t.DestinationID, &t.Prefs.StartDate, &t.Prefs.Nights, &t.Prefs.Adults, &t.Prefs.Kids,
		&t.Prefs.BudgetPerPerson, &t.Prefs.StayType, &t.Prefs.Transport, &t.Prefs.Interests, &t.Prefs.Pace, &t.Prefs.Rhythm,
		&t.Prefs.Special, &t.Prefs.OwnWords, &t.Prefs.FromCity, &t.StayID, &t.TransportID, &t.Status, &t.PaymentStatus,
		&promo, &coord, &t.GroupName, &t.CurrentDay, &weather, &optimized, &t.Version, &t.CreatedAt, &t.BookedAt,
		&t.CustomerID, &t.CustomerName, &dests, &allocations, &origin)
	if err != nil {
		return nil, notFound(err)
	}
	t.Prefs.DestinationID = t.DestinationID
	t.Destinations = dests
	t.Prefs.Destinations = dests
	if len(allocations) > 0 && string(allocations) != "null" {
		_ = json.Unmarshal(allocations, &t.Allocations)
		t.Prefs.DestinationAllocations = t.Allocations
	}
	if len(origin) > 0 && string(origin) != "null" {
		t.OriginPlace = &domain.PlaceIdentity{}
		_ = json.Unmarshal(origin, t.OriginPlace)
		t.Prefs.OriginPlace = t.OriginPlace
	}
	t.Prefs.Interests = strs(t.Prefs.Interests)
	t.Prefs.Special = strs(t.Prefs.Special)
	t.PromoCode, t.CoordinatorID = str(promo), str(coord)
	if len(weather) > 0 {
		var raw map[string]string
		if err := json.Unmarshal(weather, &raw); err == nil && len(raw) > 0 {
			t.WeatherOverrides = map[int]string{}
			for k, v := range raw {
				if d, err := strconv.Atoi(k); err == nil {
					t.WeatherOverrides[d] = v
				}
			}
		}
	}
	if len(optimized) > 0 && string(optimized) != "null" {
		t.Optimized = &domain.Optimized{}
		_ = json.Unmarshal(optimized, t.Optimized)
	}
	t.Items = []domain.TripItem{}
	t.Receipts = []domain.ChangeReceipt{}
	return &t, nil
}

func (s *Store) NextTripCode(ctx context.Context) (string, error) {
	var n int64
	if err := s.q.QueryRow(ctx, `SELECT nextval('trip_code_seq')`).Scan(&n); err != nil {
		return "", err
	}
	return fmt.Sprintf("TRZ-%d", n), nil
}

func weatherJSON(m map[int]string) []byte {
	out := map[string]string{}
	for k, v := range m {
		out[strconv.Itoa(k)] = v
	}
	b, _ := json.Marshal(out)
	return b
}

func optimizedJSON(o *domain.Optimized) []byte {
	if o == nil {
		return nil
	}
	b, _ := json.Marshal(o)
	return b
}

func allocationsJSON(a []domain.DestinationAllocation) []byte {
	if len(a) == 0 {
		return []byte("[]")
	}
	b, _ := json.Marshal(a)
	return b
}

func originPlaceJSON(p *domain.PlaceIdentity) []byte {
	if p == nil {
		return nil
	}
	b, _ := json.Marshal(p)
	return b
}

func (s *Store) InsertTrip(ctx context.Context, operatorID string, t *domain.Trip) error {
	p := t.Prefs
	dests := t.Destinations
	if len(dests) == 0 && len(p.Destinations) > 0 {
		dests = p.Destinations
	}
	if len(dests) == 0 && t.DestinationID != "" {
		dests = []string{t.DestinationID}
	}
	allocs := t.Allocations
	if len(allocs) == 0 && len(p.DestinationAllocations) > 0 {
		allocs = p.DestinationAllocations
	}
	orig := t.OriginPlace
	if orig == nil && p.OriginPlace != nil {
		orig = p.OriginPlace
	}
	_, err := s.q.Exec(ctx, `INSERT INTO trips (id, code, operator_id, customer_id, destination_id, title, start_date, nights, adults, kids,
		budget_per_person, stay_type, transport_mode, interests, pace, rhythm, special, own_words, from_city, stay_id, transport_id,
		status, payment_status, promo_code, coordinator_id, group_name, current_day, weather_overrides, optimized, version, created_at, booked_at,
		destinations, destination_allocations, origin_place)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)`,
		t.ID, t.Code, operatorID, t.CustomerID, t.DestinationID, t.Title, p.StartDate, p.Nights, p.Adults, p.Kids,
		p.BudgetPerPerson, p.StayType, p.Transport, strs(p.Interests), p.Pace, p.Rhythm, strs(p.Special), p.OwnWords, p.FromCity,
		t.StayID, t.TransportID, t.Status, t.PaymentStatus, nullStr(t.PromoCode), nullStr(t.CoordinatorID), t.GroupName,
		t.CurrentDay, weatherJSON(t.WeatherOverrides), optimizedJSON(t.Optimized), max(1, t.Version), t.CreatedAt, t.BookedAt,
		strs(dests), allocationsJSON(allocs), originPlaceJSON(orig))
	if err != nil {
		return err
	}
	return s.replaceItems(ctx, t)
}

// SaveTrip writes the trip if nobody changed it since it was loaded (optimistic lock).
func (s *Store) SaveTrip(ctx context.Context, t *domain.Trip) error {
	p := t.Prefs
	dests := t.Destinations
	if len(dests) == 0 && len(p.Destinations) > 0 {
		dests = p.Destinations
	}
	allocs := t.Allocations
	if len(allocs) == 0 && len(p.DestinationAllocations) > 0 {
		allocs = p.DestinationAllocations
	}
	orig := t.OriginPlace
	if orig == nil && p.OriginPlace != nil {
		orig = p.OriginPlace
	}
	tag, err := s.q.Exec(ctx, `UPDATE trips SET title=$2, start_date=$3, nights=$4, adults=$5, kids=$6, budget_per_person=$7,
		stay_type=$8, transport_mode=$9, interests=$10, pace=$11, rhythm=$12, special=$13, own_words=$14, from_city=$15,
		stay_id=$16, transport_id=$17, status=$18, payment_status=$19, promo_code=$20, coordinator_id=$21, group_name=$22,
		current_day=$23, weather_overrides=$24, optimized=$25, booked_at=$26, version=version+1, updated_at=now(),
		destinations=$28, destination_allocations=$29, origin_place=$30
		WHERE id=$1 AND version=$27`,
		t.ID, t.Title, p.StartDate, p.Nights, p.Adults, p.Kids, p.BudgetPerPerson, p.StayType, p.Transport, strs(p.Interests),
		p.Pace, p.Rhythm, strs(p.Special), p.OwnWords, p.FromCity, t.StayID, t.TransportID, t.Status, t.PaymentStatus,
		nullStr(t.PromoCode), nullStr(t.CoordinatorID), t.GroupName, t.CurrentDay, weatherJSON(t.WeatherOverrides),
		optimizedJSON(t.Optimized), t.BookedAt, t.Version, strs(dests), allocationsJSON(allocs), originPlaceJSON(orig))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrConflict
	}
	t.Version++
	return s.replaceItems(ctx, t)
}

func (s *Store) replaceItems(ctx context.Context, t *domain.Trip) error {
	if _, err := s.q.Exec(ctx, `DELETE FROM trip_items WHERE trip_id=$1`, t.ID); err != nil {
		return err
	}
	if len(t.Items) == 0 {
		return nil
	}
	rows := make([][]any, len(t.Items))
	for i, it := range t.Items {
		rows[i] = []any{it.ID, t.ID, i, it.Day, it.Kind, nullStr(it.RefID), it.Title, it.Subtitle, it.Place, it.StartMin,
			it.DurationMin, it.UnitCost, max(1, it.Qty), it.CostMode, it.Hearted, nullStr(it.VendorID), it.Outdoor, it.Energy,
			it.Status, strs(it.DependsOn), it.BufferMin, it.Lat, it.Lng, it.Icon, it.Tone, it.Note}
	}
	_, err := s.q.CopyFrom(ctx, pgx.Identifier{"trip_items"}, []string{"id", "trip_id", "position", "day", "kind", "ref_id", "title",
		"subtitle", "place", "start_min", "duration_min", "unit_cost", "qty", "cost_mode", "hearted", "vendor_id", "outdoor",
		"energy", "status", "depends_on", "buffer_min", "lat", "lng", "icon", "tone", "note"}, pgx.CopyFromRows(rows))
	return err
}

func (s *Store) GetTrip(ctx context.Context, id string) (*domain.Trip, error) {
	return s.getTrip(ctx, id, "")
}

// LockTrip loads a trip and holds a row lock until the transaction ends.
func (s *Store) LockTrip(ctx context.Context, id string) (*domain.Trip, error) {
	return s.getTrip(ctx, id, " FOR UPDATE OF t")
}

func (s *Store) getTrip(ctx context.Context, id, lock string) (*domain.Trip, error) {
	t, err := scanTrip(s.q.QueryRow(ctx, `SELECT `+tripCols+tripFrom+` WHERE t.id=$1`+lock, id))
	if err != nil {
		return nil, err
	}
	if err := s.hydrate(ctx, []*domain.Trip{t}); err != nil {
		return nil, err
	}
	return t, nil
}

type TripFilter struct {
	CustomerID    string
	DestinationID string
	Statuses      []string
}

func (s *Store) ListTrips(ctx context.Context, f TripFilter) ([]*domain.Trip, error) {
	q := `SELECT ` + tripCols + tripFrom + ` WHERE ($1 = '' OR t.customer_id = $1) AND ($2 = '' OR t.destination_id = $2)
		AND (cardinality($3::text[]) = 0 OR t.status = ANY($3)) ORDER BY t.start_date, t.code`
	rows, err := s.q.Query(ctx, q, f.CustomerID, f.DestinationID, strs(f.Statuses))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.Trip
	for rows.Next() {
		t, err := scanTrip(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, s.hydrate(ctx, out)
}

func (s *Store) hydrate(ctx context.Context, trips []*domain.Trip) error {
	if len(trips) == 0 {
		return nil
	}
	ids := make([]string, len(trips))
	byID := map[string]*domain.Trip{}
	for i, t := range trips {
		ids[i] = t.ID
		byID[t.ID] = t
	}
	rows, err := s.q.Query(ctx, `SELECT trip_id, id, day, kind, ref_id, title, subtitle, place, start_min, duration_min, unit_cost, qty,
		cost_mode, hearted, vendor_id, outdoor, energy, status, depends_on, buffer_min, lat, lng, icon, tone, note
		FROM trip_items WHERE trip_id = ANY($1) ORDER BY trip_id, position`, ids)
	if err != nil {
		return err
	}
	for rows.Next() {
		var tripID string
		var it domain.TripItem
		var ref, vendor *string
		if err := rows.Scan(&tripID, &it.ID, &it.Day, &it.Kind, &ref, &it.Title, &it.Subtitle, &it.Place, &it.StartMin,
			&it.DurationMin, &it.UnitCost, &it.Qty, &it.CostMode, &it.Hearted, &vendor, &it.Outdoor, &it.Energy, &it.Status,
			&it.DependsOn, &it.BufferMin, &it.Lat, &it.Lng, &it.Icon, &it.Tone, &it.Note); err != nil {
			rows.Close()
			return err
		}
		it.RefID, it.VendorID, it.DependsOn = str(ref), str(vendor), strs(it.DependsOn)
		byID[tripID].Items = append(byID[tripID].Items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	rrows, err := s.q.Query(ctx, `SELECT id, trip_id, title, reason, changes, approved_by, cost_delta, plan_strategy, created_at
		FROM change_receipts WHERE trip_id = ANY($1) ORDER BY created_at DESC`, ids)
	if err != nil {
		return err
	}
	for rrows.Next() {
		var r domain.ChangeReceipt
		var changes []byte
		var strategy *string
		if err := rrows.Scan(&r.ID, &r.TripID, &r.Title, &r.Reason, &changes, &r.ApprovedBy, &r.CostDelta, &strategy, &r.CreatedAt); err != nil {
			rrows.Close()
			return err
		}
		_ = json.Unmarshal(changes, &r.Changes)
		r.PlanStrategy, r.ApprovedBy = str(strategy), strs(r.ApprovedBy)
		if r.Changes == nil {
			r.Changes = []domain.Change{}
		}
		byID[r.TripID].Receipts = append(byID[r.TripID].Receipts, r)
	}
	rrows.Close()
	if err := rrows.Err(); err != nil {
		return err
	}
	vrows, err := s.q.Query(ctx, `SELECT trip_id, stars, aspects, text, created_at FROM trip_reviews WHERE trip_id = ANY($1)`, ids)
	if err != nil {
		return err
	}
	defer vrows.Close()
	for vrows.Next() {
		var tripID string
		var rv domain.TripReview
		var aspects []byte
		if err := vrows.Scan(&tripID, &rv.Stars, &aspects, &rv.Text, &rv.CreatedAt); err != nil {
			return err
		}
		_ = json.Unmarshal(aspects, &rv.Aspects)
		byID[tripID].Review = &rv
	}
	return vrows.Err()
}

func (s *Store) InsertReceipt(ctx context.Context, r domain.ChangeReceipt) error {
	changes, _ := json.Marshal(r.Changes)
	_, err := s.q.Exec(ctx, `INSERT INTO change_receipts (id, trip_id, title, reason, changes, approved_by, cost_delta, plan_strategy, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, r.ID, r.TripID, r.Title, r.Reason, changes, strs(r.ApprovedBy), r.CostDelta,
		nullStr(r.PlanStrategy), r.CreatedAt)
	return err
}

func (s *Store) UpsertReview(ctx context.Context, tripID string, r domain.TripReview) error {
	aspects, _ := json.Marshal(r.Aspects)
	_, err := s.q.Exec(ctx, `INSERT INTO trip_reviews (trip_id, stars, aspects, text, created_at) VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (trip_id) DO UPDATE SET stars=EXCLUDED.stars, aspects=EXCLUDED.aspects, text=EXCLUDED.text, created_at=EXCLUDED.created_at`,
		tripID, r.Stars, aspects, r.Text, r.CreatedAt)
	return err
}

func (s *Store) DeleteTrip(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM trips WHERE id=$1`, id)
	return err
}

// TripOwner returns the traveler user id that owns the trip ("" for walk-in customers).
func (s *Store) TripOwner(ctx context.Context, tripID string) (string, error) {
	var owner *string
	err := s.q.QueryRow(ctx, `SELECT c.user_id FROM trips t JOIN customers c ON c.id = t.customer_id WHERE t.id=$1`, tripID).Scan(&owner)
	return str(owner), notFound(err)
}

func (s *Store) SetCoordinator(ctx context.Context, tripID, memberID string) error {
	tag, err := s.q.Exec(ctx, `UPDATE trips SET coordinator_id=$2, version=version+1, updated_at=now() WHERE id=$1`, tripID, memberID)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// DestinationReviews are real reviews travelers left after trips to this destination, newest first.
func (s *Store) DestinationReviews(ctx context.Context, destinationID string, limit int) ([]domain.DestinationReview, error) {
	rows, err := s.q.Query(ctx, `SELECT c.name, c.city, r.stars, r.text, r.created_at, t.adults, t.kids, t.nights
		FROM trip_reviews r JOIN trips t ON t.id = r.trip_id JOIN customers c ON c.id = t.customer_id
		WHERE t.destination_id = $1 ORDER BY r.created_at DESC LIMIT $2`, destinationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.DestinationReview{}
	for rows.Next() {
		var name, city, text string
		var stars, adults, kids, nights int
		var at time.Time
		if err := rows.Scan(&name, &city, &stars, &text, &at, &adults, &kids, &nights); err != nil {
			return nil, err
		}
		who := "Solo"
		switch {
		case kids > 0:
			who = "Family"
		case adults == 2:
			who = "Couple"
		case adults > 2:
			who = fmt.Sprintf("Group of %d", adults)
		}
		out = append(out, domain.DestinationReview{Name: shortName(name), City: city, Stars: stars, When: at.Format("Jan 2006"), Text: text,
			Trip: fmt.Sprintf("%s · %d days", who, nights+1)})
	}
	return out, rows.Err()
}

// shortName shows "Parth Y." instead of a full name on public reviews.
func shortName(name string) string {
	parts := strings.Fields(name)
	if len(parts) < 2 {
		return name
	}
	last := []rune(parts[len(parts)-1])
	return parts[0] + " " + string(last[0]) + "."
}
