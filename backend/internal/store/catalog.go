package store

import (
	"context"
	"encoding/json"
	"math"
	"time"

	"github.com/jackc/pgx/v5"

	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
)

func (s *Store) EnsureOperator(ctx context.Context, id, name string) error {
	_, err := s.q.Exec(ctx, `INSERT INTO operators (id, name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`, id, name)
	return err
}

func js(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

// UpsertCatalog loads the reference data on every start: new destinations, experiences, stays and
// routes are added, descriptive fields are refreshed, and everything the operator or a live source
// owns is kept (vendor contacts and availability, Google ratings, coordinator assignments).
// Run inside a transaction (activity backups are deferred FKs).
func (s *Store) UpsertCatalog(ctx context.Context, operatorID string, d catalog.Data) error {
	b := &pgx.Batch{}
	for i, x := range d.Destinations {
		b.Queue(`INSERT INTO destinations (id, name, state, tagline, description, art, tone, lat, lng, rating, reviews, moods, interests,
			best_months, rainy_months, ideal_days, gateway, from_city, climate, highlights, clusters, local_cab_per_day, airport_transfer,
			languages, emergency, reviews_list, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'[]',$24)
			ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, state=EXCLUDED.state, tagline=EXCLUDED.tagline, description=EXCLUDED.description,
			art=EXCLUDED.art, tone=EXCLUDED.tone, lat=EXCLUDED.lat, lng=EXCLUDED.lng, moods=EXCLUDED.moods, interests=EXCLUDED.interests,
			best_months=EXCLUDED.best_months, rainy_months=EXCLUDED.rainy_months, ideal_days=EXCLUDED.ideal_days, gateway=EXCLUDED.gateway,
			from_city=EXCLUDED.from_city, climate=EXCLUDED.climate, highlights=EXCLUDED.highlights, clusters=EXCLUDED.clusters,
			local_cab_per_day=EXCLUDED.local_cab_per_day, airport_transfer=EXCLUDED.airport_transfer, languages=EXCLUDED.languages,
			emergency=EXCLUDED.emergency, position=EXCLUDED.position`,
			x.ID, x.Name, x.State, x.Tagline, x.Description, x.Art, x.Tone, x.Lat, x.Lng, strs(x.Moods), strs(x.Interests),
			x.BestMonths, x.RainyMonths, x.IdealDays, x.Gateway, x.FromCity, js(x.Climate), strs(x.Highlights), js(x.Clusters),
			x.LocalCabPerDay, x.AirportTransfer, strs(x.Languages), js(x.Emergency), i)
	}
	for i, v := range d.Vendors {
		b.Queue(`INSERT INTO vendors (id, operator_id, name, kind, destination_id, contact_name, phone, email, language, available, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
			ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind, destination_id=EXCLUDED.destination_id, position=EXCLUDED.position`,
			v.ID, operatorID, v.Name, v.Kind, v.DestinationID, v.ContactName, v.Phone, v.Email, v.Language, i)
	}
	for i, a := range d.Activities {
		b.Queue(`INSERT INTO activities (id, destination_id, cluster, title, description, interests, duration_min, price, energy, outdoor, slot,
			rating, reviews, vendor_id, lat, lng, kid_friendly, walking, icon, tone, backup_id, alt_vendor_id, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
			ON CONFLICT (id) DO UPDATE SET destination_id=EXCLUDED.destination_id, cluster=EXCLUDED.cluster, title=EXCLUDED.title,
			description=EXCLUDED.description, interests=EXCLUDED.interests, duration_min=EXCLUDED.duration_min, price=EXCLUDED.price,
			energy=EXCLUDED.energy, outdoor=EXCLUDED.outdoor, slot=EXCLUDED.slot, vendor_id=EXCLUDED.vendor_id, lat=EXCLUDED.lat,
			lng=EXCLUDED.lng, kid_friendly=EXCLUDED.kid_friendly, walking=EXCLUDED.walking, icon=EXCLUDED.icon, tone=EXCLUDED.tone,
			backup_id=EXCLUDED.backup_id, alt_vendor_id=EXCLUDED.alt_vendor_id, position=EXCLUDED.position`,
			a.ID, a.DestinationID, a.Cluster, a.Title, a.Description, strs(a.Interests), a.DurationMin, a.Price, a.Energy, a.Outdoor, a.Slot,
			a.VendorID, a.Lat, a.Lng, a.KidFriendly, a.Walking, a.Icon, a.Tone, nullStr(a.BackupID), nullStr(a.AltVendorID), i)
	}
	for i, x := range d.Stays {
		b.Queue(`INSERT INTO stays (id, destination_id, name, type, nightly_price, rating, reviews, vendor_id, area, amenities, tone, lat, lng, position)
			VALUES ($1,$2,$3,$4,$5,0,0,$6,$7,$8,$9,$10,$11,$12)
			ON CONFLICT (id) DO UPDATE SET destination_id=EXCLUDED.destination_id, name=EXCLUDED.name, type=EXCLUDED.type,
			nightly_price=EXCLUDED.nightly_price, vendor_id=EXCLUDED.vendor_id, area=EXCLUDED.area, amenities=EXCLUDED.amenities,
			tone=EXCLUDED.tone, lat=EXCLUDED.lat, lng=EXCLUDED.lng, position=EXCLUDED.position`,
			x.ID, x.DestinationID, x.Name, x.Type, x.NightlyPrice, x.VendorID, x.Area, strs(x.Amenities), x.Tone, x.Lat, x.Lng, i)
	}
	for i, t := range d.Transport {
		b.Queue(`INSERT INTO transport_options (id, destination_id, mode, label, from_city, price_per_person, duration_min, departs, vendor_id, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			ON CONFLICT (id) DO UPDATE SET destination_id=EXCLUDED.destination_id, mode=EXCLUDED.mode, label=EXCLUDED.label, from_city=EXCLUDED.from_city,
			price_per_person=EXCLUDED.price_per_person, duration_min=EXCLUDED.duration_min, departs=EXCLUDED.departs, vendor_id=EXCLUDED.vendor_id,
			position=EXCLUDED.position`, t.ID, t.DestinationID, t.Mode, t.Label, t.From, t.PricePerPerson, t.DurationMin, t.Departs, t.VendorID, i)
	}
	for i, m := range d.Team {
		b.Queue(`INSERT INTO team_members (id, operator_id, name, role, region, phone, languages, status, rating, tone, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET region=EXCLUDED.region, languages=EXCLUDED.languages,
			position=EXCLUDED.position`, m.ID, operatorID, m.Name, m.Role, m.Region, m.Phone, strs(m.Languages), m.Status, m.Rating, m.Tone, i)
	}
	for dest, member := range d.CoordinatorFor {
		b.Queue(`INSERT INTO destination_coordinators (destination_id, member_id) VALUES ($1,$2) ON CONFLICT (destination_id) DO NOTHING`, dest, member)
	}
	return s.q.SendBatch(ctx, b).Close()
}

func orEmpty[T any](v []T) []T {
	if v == nil {
		return []T{}
	}
	return v
}

// LoadCatalog reads the reference data from the database into an engine snapshot.
func (s *Store) LoadCatalog(ctx context.Context, quiz []catalog.QuizQuestion) (*catalog.Catalog, error) {
	d := catalog.Data{Quiz: quiz, CoordinatorFor: map[string]string{}}
	rows, err := s.q.Query(ctx, `SELECT id, name, state, tagline, description, art, tone, lat, lng, moods, interests,
		best_months, rainy_months, ideal_days, gateway, from_city, climate, highlights, clusters, local_cab_per_day, airport_transfer,
		languages, emergency FROM destinations ORDER BY position`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var x domain.Destination
		var climate, clusters, emergency []byte
		if err := rows.Scan(&x.ID, &x.Name, &x.State, &x.Tagline, &x.Description, &x.Art, &x.Tone, &x.Lat, &x.Lng,
			&x.Moods, &x.Interests, &x.BestMonths, &x.RainyMonths, &x.IdealDays, &x.Gateway, &x.FromCity, &climate, &x.Highlights,
			&clusters, &x.LocalCabPerDay, &x.AirportTransfer, &x.Languages, &emergency); err != nil {
			rows.Close()
			return nil, err
		}
		_ = json.Unmarshal(climate, &x.Climate)
		_ = json.Unmarshal(clusters, &x.Clusters)
		_ = json.Unmarshal(emergency, &x.Emergency)
		d.Destinations = append(d.Destinations, x)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if d.Vendors, err = s.ListVendors(ctx); err != nil {
		return nil, err
	}

	rows, err = s.q.Query(ctx, `SELECT id, destination_id, cluster, title, description, interests, duration_min, price, energy, outdoor, slot,
		rating, reviews, vendor_id, lat, lng, kid_friendly, walking, icon, tone, backup_id, alt_vendor_id, place_id, maps_url FROM activities ORDER BY position`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var a domain.Activity
		var backup, alt *string
		if err := rows.Scan(&a.ID, &a.DestinationID, &a.Cluster, &a.Title, &a.Description, &a.Interests, &a.DurationMin, &a.Price, &a.Energy,
			&a.Outdoor, &a.Slot, &a.Rating, &a.Reviews, &a.VendorID, &a.Lat, &a.Lng, &a.KidFriendly, &a.Walking, &a.Icon, &a.Tone, &backup, &alt,
			&a.PlaceID, &a.MapsURL); err != nil {
			rows.Close()
			return nil, err
		}
		a.BackupID, a.AltVendorID = str(backup), str(alt)
		d.Activities = append(d.Activities, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.q.Query(ctx, `SELECT id, destination_id, name, type, nightly_price, rating, reviews, vendor_id, area, amenities, tone, lat, lng,
		place_id, maps_url FROM stays ORDER BY position`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var x domain.Stay
		if err := rows.Scan(&x.ID, &x.DestinationID, &x.Name, &x.Type, &x.NightlyPrice, &x.Rating, &x.Reviews, &x.VendorID, &x.Area,
			&x.Amenities, &x.Tone, &x.Lat, &x.Lng, &x.PlaceID, &x.MapsURL); err != nil {
			rows.Close()
			return nil, err
		}
		d.Stays = append(d.Stays, x)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.q.Query(ctx, `SELECT id, destination_id, mode, label, from_city, price_per_person, duration_min, departs, vendor_id
		FROM transport_options ORDER BY position`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var t domain.TransportOption
		if err := rows.Scan(&t.ID, &t.DestinationID, &t.Mode, &t.Label, &t.From, &t.PricePerPerson, &t.DurationMin, &t.Departs, &t.VendorID); err != nil {
			rows.Close()
			return nil, err
		}
		d.Transport = append(d.Transport, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.q.Query(ctx, `SELECT destination_id, member_id FROM destination_coordinators`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var dest, member string
		if err := rows.Scan(&dest, &member); err != nil {
			return nil, err
		}
		d.CoordinatorFor[dest] = member
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	c := catalog.New(d)
	c.RollUpRatings()
	return c, nil
}

// ListVendors returns every partner with stats computed from its real request history.
func (s *Store) ListVendors(ctx context.Context) ([]domain.Vendor, error) {
	rows, err := s.q.Query(ctx, `SELECT id, name, kind, destination_id, contact_name, phone, email, language, available FROM vendors ORDER BY position`)
	if err != nil {
		return nil, err
	}
	var out []domain.Vendor
	for rows.Next() {
		var v domain.Vendor
		if err := rows.Scan(&v.ID, &v.Name, &v.Kind, &v.DestinationID, &v.ContactName, &v.Phone, &v.Email, &v.Language, &v.Available); err != nil {
			rows.Close()
			return nil, err
		}
		v.History = []domain.VendorMonth{}
		v.TrustScore = catalog.NewVendorTrust
		out = append(out, v)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	stats, err := s.VendorStats(ctx)
	if err != nil {
		return nil, err
	}
	for i := range out {
		if st, ok := stats[out[i].ID]; ok {
			st.apply(&out[i])
		}
	}
	return out, nil
}

type vendorStat struct {
	answered, declined, expired, pending int
	replyMin                             float64
	active                               int
	stars                                float64
	starCount                            int
	months                               map[string]*domain.VendorMonth
}

// apply turns raw counts into the vendor's numbers. Trust starts at a neutral 80 for a new
// partner and moves towards the measured score as real requests come in.
func (st vendorStat) apply(v *domain.Vendor) {
	total := st.answered + st.expired
	v.Requests = total
	v.PendingConfirmations = st.pending
	v.ActiveBookings = st.active
	if st.starCount > 0 {
		v.Rating = math.Round(st.stars/float64(st.starCount)*10) / 10
	}
	if total == 0 {
		return
	}
	v.ResponseRate = int(math.Round(float64(st.answered) / float64(total) * 100))
	v.AvgReplyMin = int(math.Round(st.replyMin))
	v.CancellationRate = math.Round(float64(st.declined+st.expired)/float64(total)*1000) / 10
	speed := 100.0
	switch {
	case st.replyMin > 120:
		speed = 40
	case st.replyMin > 10:
		speed = 100 - (st.replyMin-10)/110*60
	}
	measured := 0.45*float64(v.ResponseRate) + 0.35*(100-v.CancellationRate) + 0.2*speed
	if v.Rating > 0 {
		measured = 0.85*measured + 0.15*(v.Rating/5*100)
	}
	const prior = 3.0 // a few real requests are needed before the score moves far from neutral
	trust := (catalog.NewVendorTrust*prior + measured*float64(total)) / (prior + float64(total))
	v.TrustScore = max(1, min(99, int(math.Round(trust))))
	months := make([]domain.VendorMonth, 0, len(st.months))
	now := time.Now().UTC()
	for i := 5; i >= 0; i-- {
		key := now.AddDate(0, -i, 0).Format("Jan")
		if m, ok := st.months[key]; ok {
			months = append(months, *m)
		}
	}
	v.History = months
}

// VendorStats aggregates the last 180 days of vendor requests, active bookings and review stars.
func (s *Store) VendorStats(ctx context.Context) (map[string]vendorStat, error) {
	out := map[string]vendorStat{}
	rows, err := s.q.Query(ctx, `SELECT vendor_id, status, created_at, responded_at FROM vendor_requests
		WHERE created_at > now() - interval '180 days' AND status <> 'cancelled'`)
	if err != nil {
		return nil, err
	}
	type acc struct {
		st      vendorStat
		replies []float64
	}
	accs := map[string]*acc{}
	for rows.Next() {
		var vendor, status string
		var created time.Time
		var responded *time.Time
		if err := rows.Scan(&vendor, &status, &created, &responded); err != nil {
			rows.Close()
			return nil, err
		}
		a := accs[vendor]
		if a == nil {
			a = &acc{st: vendorStat{months: map[string]*domain.VendorMonth{}}}
			accs[vendor] = a
		}
		month := created.Format("Jan")
		m := a.st.months[month]
		if m == nil {
			m = &domain.VendorMonth{Month: month}
			a.st.months[month] = m
		}
		switch status {
		case domain.AnswerPending:
			a.st.pending++
			continue
		case "timeout":
			a.st.expired++
			m.Declines++
		default:
			a.st.answered++
			if status == domain.AnswerNo {
				a.st.declined++
				m.Declines++
			}
			if responded != nil {
				a.replies = append(a.replies, responded.Sub(created).Minutes())
			}
		}
		m.Bookings++
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for id, a := range accs {
		if len(a.replies) > 0 {
			sum := 0.0
			for _, r := range a.replies {
				sum += r
			}
			a.st.replyMin = sum / float64(len(a.replies))
			for _, m := range a.st.months {
				m.ReplyMin = int(math.Round(a.st.replyMin))
			}
		}
		out[id] = a.st
	}

	rows, err = s.q.Query(ctx, `SELECT b.vendor_id, count(*) FROM bookings b JOIN trips t ON t.id = b.trip_id
		WHERE b.status = 'confirmed' AND t.status IN ('booked', 'live') GROUP BY b.vendor_id`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id string
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			rows.Close()
			return nil, err
		}
		st := out[id]
		st.active = n
		out[id] = st
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.q.Query(ctx, `SELECT DISTINCT ON (b.vendor_id, r.trip_id) b.vendor_id, r.stars FROM trip_reviews r
		JOIN bookings b ON b.trip_id = r.trip_id AND b.status = 'confirmed'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var stars int
		if err := rows.Scan(&id, &stars); err != nil {
			return nil, err
		}
		st := out[id]
		st.stars += float64(stars)
		st.starCount++
		out[id] = st
	}
	return out, rows.Err()
}

// VendorTrust returns the live trust score of every vendor.
func (s *Store) VendorTrust(ctx context.Context) (map[string]int, error) {
	list, err := s.ListVendors(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]int, len(list))
	for _, v := range list {
		out[v.ID] = v.TrustScore
	}
	return out, nil
}

// VendorContact is what the operator can edit about a partner.
type VendorContact struct {
	ContactName *string
	Phone       *string
	Email       *string
	Language    *string
}

func (s *Store) UpdateVendorContact(ctx context.Context, id string, c VendorContact) error {
	tag, err := s.q.Exec(ctx, `UPDATE vendors SET contact_name=coalesce($2, contact_name), phone=coalesce($3, phone),
		email=coalesce($4, email), language=coalesce($5, language) WHERE id=$1`, id, c.ContactName, c.Phone, c.Email, c.Language)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Store) SetVendorAvailability(ctx context.Context, id string, available bool) error {
	tag, err := s.q.Exec(ctx, `UPDATE vendors SET available=$2 WHERE id=$1`, id, available)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// VendorEmail is where booking and change requests are emailed (empty when not on file).
func (s *Store) VendorEmail(ctx context.Context, id string) (string, error) {
	var e string
	err := s.q.QueryRow(ctx, `SELECT email FROM vendors WHERE id=$1`, id).Scan(&e)
	return e, notFound(err)
}

// Unrated lists catalog items (activities and stays) whose Google rating has not been looked up recently.
type Unrated struct {
	Kind, ID, Name, DestinationID string
	Lat, Lng                      float64
}

func (s *Store) UnratedItems(ctx context.Context, limit int) ([]Unrated, error) {
	rows, err := s.q.Query(ctx, `(SELECT 'activity', id, title, destination_id, lat, lng, rated_at FROM activities
			WHERE rated_at IS NULL OR rated_at < now() - interval '30 days')
		UNION ALL
		(SELECT 'stay', id, name, destination_id, lat, lng, rated_at FROM stays
			WHERE rated_at IS NULL OR rated_at < now() - interval '30 days')
		ORDER BY 7 NULLS FIRST LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Unrated
	for rows.Next() {
		var u Unrated
		var rated *time.Time
		if err := rows.Scan(&u.Kind, &u.ID, &u.Name, &u.DestinationID, &u.Lat, &u.Lng, &rated); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// SetRating stores a Google Maps rating for an activity or stay (rating 0 = no listing found).
func (s *Store) SetRating(ctx context.Context, kind, id string, rating float64, reviews int, placeID, mapsURL string) error {
	table := "activities"
	if kind == "stay" {
		table = "stays"
	}
	_, err := s.q.Exec(ctx, `UPDATE `+table+` SET rating=$2, reviews=$3, place_id=$4, maps_url=$5, rated_at=now() WHERE id=$1`,
		id, rating, reviews, placeID, mapsURL)
	return err
}

// VendorContactOf is a vendor's current contact details (operator-entered).
func (s *Store) VendorContactOf(ctx context.Context, id string) (domain.Vendor, error) {
	var v domain.Vendor
	err := s.q.QueryRow(ctx, `SELECT id, name, contact_name, phone, email FROM vendors WHERE id=$1`, id).Scan(&v.ID, &v.Name, &v.ContactName, &v.Phone, &v.Email)
	return v, notFound(err)
}

// EnsureDestination guarantees that a destination, stay, and transport option exist in the
// database so trips referencing them never violate foreign key constraints.
func (s *Store) EnsureDestination(ctx context.Context, operatorID string, d *domain.Destination, stay *domain.Stay, tr *domain.TransportOption) error {
	if d == nil {
		return nil
	}
	art := d.Art
	if art == "" {
		art = "mountain"
	}
	tone := d.Tone
	if tone == "" {
		tone = "sky"
	}
	cab := d.LocalCabPerDay
	if cab == 0 {
		cab = 2500
	}
	transfer := d.AirportTransfer
	if transfer == 0 {
		transfer = 1200
	}
	_, err := s.q.Exec(ctx, `INSERT INTO destinations (id, name, state, tagline, description, art, tone, lat, lng, rating, reviews, moods, interests,
		best_months, rainy_months, ideal_days, gateway, from_city, climate, highlights, clusters, local_cab_per_day, airport_transfer,
		languages, emergency, reviews_list, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,4.5,100,$10,$11,'{10,11,12,1,2,3,4}','{7,8}','3-5 days',
		$12,$13,$14,$15,$16,$17,$18,'{"English","Hindi"}','[]','[]',99)
		ON CONFLICT (id) DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng`,
		d.ID, d.Name, d.State, d.Tagline, d.Description, art, tone, d.Lat, d.Lng, strs(d.Moods), strs(d.Interests),
		d.Gateway, d.FromCity, js(d.Climate), strs(d.Highlights), js(d.Clusters), cab, transfer)
	if err != nil {
		return err
	}
	vID := "v-stay-" + d.ID
	_, _ = s.q.Exec(ctx, `INSERT INTO vendors (id, operator_id, name, kind, destination_id, contact_name, phone, email, language, available, position)
		VALUES ($1,$2,$3,'stay',$4,'Reservations','','','English',true,99) ON CONFLICT (id) DO NOTHING`,
		vID, operatorID, d.Name+" Hospitality Partner", d.ID)

	if stay != nil && stay.ID != "" {
		sVendor := stay.VendorID
		if sVendor == "" {
			sVendor = vID
		}
		sType := stay.Type
		if sType == "" {
			sType = "boutique"
		}
		_, err = s.q.Exec(ctx, `INSERT INTO stays (id, destination_id, name, type, nightly_price, rating, reviews, vendor_id, area, amenities, tone, lat, lng, position)
			VALUES ($1,$2,$3,$4,$5,4.5,50,$6,$7,$8,'pink',$9,$10,99)
			ON CONFLICT (id) DO NOTHING`,
			stay.ID, d.ID, stay.Name, sType, max(1000, stay.NightlyPrice), sVendor, stay.Area, strs(stay.Amenities), stay.Lat, stay.Lng)
		if err != nil {
			return err
		}
	}

	if tr != nil && tr.ID != "" {
		_, err = s.q.Exec(ctx, `INSERT INTO transport_options (id, destination_id, mode, label, from_city, price_per_person, duration_min, departs, vendor_id, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,99)
			ON CONFLICT (id) DO NOTHING`,
			tr.ID, d.ID, tr.Mode, tr.Label, tr.From, tr.PricePerPerson, tr.DurationMin, tr.Departs, vID)
		if err != nil {
			return err
		}
	}
	return nil
}
