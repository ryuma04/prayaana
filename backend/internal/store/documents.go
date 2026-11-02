package store

import (
	"context"
	"encoding/json"
	"time"

	"trizpyy/internal/domain"
)

// Documents

func (s *Store) NextDocumentVersion(ctx context.Context, tripID, kind string) (int, error) {
	var v int
	err := s.q.QueryRow(ctx, `SELECT coalesce(max(version), 0) + 1 FROM documents WHERE trip_id=$1 AND kind=$2`, tripID, kind).Scan(&v)
	return v, err
}

func (s *Store) InsertDocument(ctx context.Context, d domain.Document, content []byte) error {
	_, err := s.q.Exec(ctx, `INSERT INTO documents (id, trip_id, kind, title, file_name, version, reason, size_bytes, sha256, content, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, d.ID, d.TripID, d.Kind, d.Title, d.FileName, d.Version, d.Reason, d.SizeBytes,
		d.SHA256, content, d.CreatedAt)
	return err
}

// ListDocuments returns every version, newest first; Latest marks the current one per kind.
func (s *Store) ListDocuments(ctx context.Context, tripID string) ([]domain.Document, error) {
	rows, err := s.q.Query(ctx, `SELECT id, trip_id, kind, title, file_name, version, reason, size_bytes, sha256, created_at,
		version = max(version) OVER (PARTITION BY kind) FROM documents WHERE trip_id=$1 ORDER BY created_at DESC, kind`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Document{}
	for rows.Next() {
		var d domain.Document
		if err := rows.Scan(&d.ID, &d.TripID, &d.Kind, &d.Title, &d.FileName, &d.Version, &d.Reason, &d.SizeBytes, &d.SHA256, &d.CreatedAt, &d.Latest); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) DocumentContent(ctx context.Context, tripID, id string) (domain.Document, []byte, error) {
	var d domain.Document
	var content []byte
	err := s.q.QueryRow(ctx, `SELECT id, trip_id, kind, title, file_name, version, reason, size_bytes, sha256, created_at, content
		FROM documents WHERE trip_id=$1 AND id=$2`, tripID, id).
		Scan(&d.ID, &d.TripID, &d.Kind, &d.Title, &d.FileName, &d.Version, &d.Reason, &d.SizeBytes, &d.SHA256, &d.CreatedAt, &content)
	return d, content, notFound(err)
}

// PaidPayment returns the trip's settled payment (for the invoice).
func (s *Store) PaidPayment(ctx context.Context, tripID string) (Payment, error) {
	var p Payment
	var ref *string
	err := s.q.QueryRow(ctx, `SELECT id, trip_id, provider, order_id, payment_ref, amount, currency, method, status, created_at, paid_at
		FROM payments WHERE trip_id=$1 AND status='paid' ORDER BY paid_at DESC NULLS LAST LIMIT 1`, tripID).
		Scan(&p.ID, &p.TripID, &p.Provider, &p.OrderID, &ref, &p.Amount, &p.Currency, &p.Method, &p.Status, &p.CreatedAt, &p.PaidAt)
	p.PaymentRef = str(ref)
	return p, notFound(err)
}

// Traveler contact (for trip updates and documents)

type Contact struct {
	UserID        string
	Name          string
	Email         string
	Phone         string
	Operator      string
	WhatsAppOptIn bool
}

func (s *Store) TripContact(ctx context.Context, tripID string) (Contact, error) {
	var c Contact
	var user *string
	err := s.q.QueryRow(ctx, `SELECT c.user_id, c.name, coalesce(nullif(c.email, ''), u.email, ''), coalesce(nullif(c.phone, ''), u.phone, ''), o.name, t.whatsapp_opt_in
		FROM trips t JOIN customers c ON c.id = t.customer_id JOIN operators o ON o.id = t.operator_id
		LEFT JOIN users u ON u.id = c.user_id
		WHERE t.id=$1`, tripID).Scan(&user, &c.Name, &c.Email, &c.Phone, &c.Operator, &c.WhatsAppOptIn)
	c.UserID = str(user)
	return c, notFound(err)
}

// SetTripContact saves the lead traveler's phone/email from checkout.
func (s *Store) SetTripContact(ctx context.Context, tripID, phone, email string, whatsAppOptIn bool) error {
	if _, err := s.q.Exec(ctx, `UPDATE customers SET phone=coalesce(nullif($2, ''), phone), email=coalesce(nullif($3, ''), email)
		WHERE id=(SELECT customer_id FROM trips WHERE id=$1)`, tripID, phone, email); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `UPDATE trips SET whatsapp_opt_in=$2 WHERE id=$1`, tripID, whatsAppOptIn)
	return err
}

// Thread returns one inbox conversation with its messages (oldest first).
func (s *Store) Thread(ctx context.Context, id string) (domain.InboxThread, error) {
	var t domain.InboxThread
	err := s.q.QueryRow(ctx, `SELECT id, party, name, subtitle, coalesce(trip_id, ''), coalesce(vendor_id, ''), unread, tone
		FROM inbox_threads WHERE id=$1`, id).Scan(&t.ID, &t.Party, &t.Name, &t.Subtitle, &t.TripID, &t.VendorID, &t.Unread, &t.Tone)
	if err != nil {
		return t, notFound(err)
	}
	rows, err := s.q.Query(ctx, `SELECT id, sender, type, body, coalesce(transcript, ''), coalesce(decision, ''), confidence,
		attachment, coalesce(status, ''), created_at FROM inbox_messages WHERE thread_id=$1 ORDER BY created_at, id`, id)
	if err != nil {
		return t, err
	}
	defer rows.Close()
	t.Messages = []domain.InboxMessage{}
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return t, err
		}
		t.Messages = append(t.Messages, m)
	}
	return t, rows.Err()
}

func scanMessage(row interface{ Scan(...any) error }) (domain.InboxMessage, error) {
	var m domain.InboxMessage
	var att []byte
	var at time.Time
	if err := row.Scan(&m.ID, &m.From, &m.Type, &m.Body, &m.Transcript, &m.Decision, &m.Confidence, &att, &m.Status, &at); err != nil {
		return m, err
	}
	m.At = at
	if len(att) > 0 {
		m.Attachment = &domain.Attachment{}
		_ = json.Unmarshal(att, m.Attachment)
	}
	return m, nil
}

// BookingByID returns one vendor booking.
func (s *Store) BookingByID(ctx context.Context, id string) (domain.Booking, error) {
	var x domain.Booking
	err := s.q.QueryRow(ctx, `SELECT id, trip_id, item_id, item_title, vendor_id, customer_name, status, amount, day,
		to_char(date, 'YYYY-MM-DD'), channel, updated_at FROM bookings WHERE id=$1`, id).
		Scan(&x.ID, &x.TripID, &x.ItemID, &x.ItemTitle, &x.VendorID, &x.CustomerName, &x.Status, &x.Amount, &x.Day, &x.Date, &x.Channel, &x.UpdatedAt)
	return x, notFound(err)
}

// PendingRequestFor finds the open booking request a vendor has for a trip.
func (s *Store) PendingRequestFor(ctx context.Context, tripID, vendorID string) (domain.VendorRequest, error) {
	return scanRequest(s.q.QueryRow(ctx, `SELECT `+requestCols+` FROM vendor_requests WHERE trip_id=$1 AND vendor_id=$2
		AND kind='booking' AND status='pending' ORDER BY created_at DESC LIMIT 1`, tripID, vendorID))
}

// OperatorName is the travel company's display name.
func (s *Store) OperatorName(ctx context.Context) (string, error) {
	var name string
	err := s.q.QueryRow(ctx, `SELECT name FROM operators ORDER BY created_at LIMIT 1`).Scan(&name)
	return name, notFound(err)
}
