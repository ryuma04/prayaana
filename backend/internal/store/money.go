package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"trizpyy/internal/domain"
)

func (s *Store) InsertBookings(ctx context.Context, list []domain.Booking) error {
	if len(list) == 0 {
		return nil
	}
	b := &pgx.Batch{}
	for _, x := range list {
		b.Queue(`INSERT INTO bookings (id, trip_id, item_id, item_title, vendor_id, customer_name, status, amount, day, date, channel, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
			x.ID, x.TripID, x.ItemID, x.ItemTitle, x.VendorID, x.CustomerName, x.Status, x.Amount, x.Day, x.Date, x.Channel, x.UpdatedAt)
	}
	return s.q.SendBatch(ctx, b).Close()
}

type BookingFilter struct {
	TripID   string
	VendorID string
	Status   string
	Limit    int
}

func (s *Store) ListBookings(ctx context.Context, f BookingFilter) ([]domain.Booking, error) {
	if f.Limit <= 0 {
		f.Limit = 1000
	}
	rows, err := s.q.Query(ctx, `SELECT id, trip_id, item_id, item_title, vendor_id, customer_name, status, amount, day,
		to_char(date, 'YYYY-MM-DD'), channel, updated_at FROM bookings
		WHERE ($1 = '' OR trip_id=$1) AND ($2 = '' OR vendor_id=$2) AND ($3 = '' OR status=$3)
		ORDER BY updated_at DESC, id LIMIT $4`, f.TripID, f.VendorID, f.Status, f.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Booking{}
	for rows.Next() {
		var x domain.Booking
		if err := rows.Scan(&x.ID, &x.TripID, &x.ItemID, &x.ItemTitle, &x.VendorID, &x.CustomerName, &x.Status, &x.Amount, &x.Day,
			&x.Date, &x.Channel, &x.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (s *Store) SetBookingStatusForVendor(ctx context.Context, tripID, vendorID, status string, onlyFrom ...string) (int64, error) {
	tag, err := s.q.Exec(ctx, `UPDATE bookings SET status=$3, updated_at=now()
		WHERE trip_id=$1 AND vendor_id=$2 AND (cardinality($4::text[]) = 0 OR status = ANY($4))`, tripID, vendorID, status, strs(onlyFrom))
	return tag.RowsAffected(), err
}

// SetBookingStatus changes one booking and returns its trip id.
func (s *Store) SetBookingStatus(ctx context.Context, id, status string) (string, error) {
	var tripID string
	err := s.q.QueryRow(ctx, `UPDATE bookings SET status=$2, updated_at=now() WHERE id=$1 RETURNING trip_id`, id, status).Scan(&tripID)
	return tripID, notFound(err)
}

func (s *Store) SetBookingStatusForItem(ctx context.Context, tripID, itemID, status string) error {
	_, err := s.q.Exec(ctx, `UPDATE bookings SET status=$3, updated_at=now() WHERE trip_id=$1 AND item_id=$2 AND status <> 'cancelled'`, tripID, itemID, status)
	return err
}

// RescheduleBookingForItem moves an item's live booking to another trip day.
func (s *Store) RescheduleBookingForItem(ctx context.Context, tripID, itemID string, day int, date string) error {
	_, err := s.q.Exec(ctx, `UPDATE bookings SET day=$3, date=$4, updated_at=now() WHERE trip_id=$1 AND item_id=$2 AND status <> 'cancelled'`, tripID, itemID, day, date)
	return err
}

func (s *Store) CountBookings(ctx context.Context, tripID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx, `SELECT count(*) FROM bookings WHERE trip_id=$1`, tripID).Scan(&n)
	return n, err
}

// Payments

type Payment struct {
	ID         string     `json:"id"`
	TripID     string     `json:"tripId"`
	Provider   string     `json:"provider"`
	OrderID    string     `json:"orderId"`
	PaymentRef string     `json:"paymentRef,omitempty"`
	Amount     int        `json:"amount"`
	Currency   string     `json:"currency"`
	Method     string     `json:"method"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"createdAt"`
	PaidAt     *time.Time `json:"paidAt,omitempty"`
}

func (s *Store) InsertPayment(ctx context.Context, p Payment) error {
	_, err := s.q.Exec(ctx, `INSERT INTO payments (id, trip_id, provider, order_id, amount, currency, method, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, p.ID, p.TripID, p.Provider, p.OrderID, p.Amount, p.Currency, p.Method, p.Status)
	return err
}

func (s *Store) LockPaymentByOrder(ctx context.Context, orderID string) (Payment, error) {
	var p Payment
	var ref *string
	err := s.q.QueryRow(ctx, `SELECT id, trip_id, provider, order_id, payment_ref, amount, currency, method, status, created_at, paid_at
		FROM payments WHERE order_id=$1 FOR UPDATE`, orderID).
		Scan(&p.ID, &p.TripID, &p.Provider, &p.OrderID, &ref, &p.Amount, &p.Currency, &p.Method, &p.Status, &p.CreatedAt, &p.PaidAt)
	p.PaymentRef = str(ref)
	return p, notFound(err)
}

func (s *Store) MarkPayment(ctx context.Context, id, status, ref, method string) error {
	_, err := s.q.Exec(ctx, `UPDATE payments SET status=$2, payment_ref=coalesce(nullif($3, ''), payment_ref),
		method=coalesce(nullif($4, ''), method), paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END WHERE id=$1`, id, status, ref, method)
	return err
}

// Ledger

func (s *Store) InsertLedger(ctx context.Context, e domain.LedgerEntry) error {
	if e.Date.IsZero() {
		e.Date = time.Now().UTC()
	}
	_, err := s.q.Exec(ctx, `INSERT INTO ledger_entries (id, trip_id, kind, party, amount, status, method, note, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, e.ID, nullStr(e.TripID), e.Kind, e.Party, e.Amount, e.Status, e.Method, e.Note, e.Date)
	return err
}

func (s *Store) ListLedger(ctx context.Context, tripID string, limit int) ([]domain.LedgerEntry, error) {
	if limit <= 0 {
		limit = 2000
	}
	rows, err := s.q.Query(ctx, `SELECT id, coalesce(trip_id, ''), kind, party, amount, status, method, note, created_at FROM ledger_entries
		WHERE ($1 = '' OR trip_id=$1) ORDER BY created_at DESC, id LIMIT $2`, tripID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.LedgerEntry{}
	for rows.Next() {
		var e domain.LedgerEntry
		if err := rows.Scan(&e.ID, &e.TripID, &e.Kind, &e.Party, &e.Amount, &e.Status, &e.Method, &e.Note, &e.Date); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
