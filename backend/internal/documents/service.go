// Package documents issues the trip PDFs: booking confirmation, invoice,
// day-by-day itinerary and vendor vouchers. Documents are generated from the
// saved trip, payment and bookings, stored as immutable versions, and re-issued
// whenever a confirmed change alters the plan.
package documents

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"

	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

const (
	KindConfirmation = "confirmation"
	KindInvoice      = "invoice"
	KindItinerary    = "itinerary"
	KindVoucher      = "voucher"
)

// All is every document a booked trip has.
var All = []string{KindConfirmation, KindInvoice, KindItinerary, KindVoucher}

// AfterChange is what a confirmed change re-issues: the plan, the vouchers and the bill.
var AfterChange = []string{KindItinerary, KindVoucher, KindInvoice}

var titles = map[string]string{
	KindConfirmation: "Booking confirmation",
	KindInvoice:      "Invoice",
	KindItinerary:    "Trip itinerary",
	KindVoucher:      "Tickets & vouchers",
}

var renderers = map[string]func(Data) ([]byte, error){
	KindConfirmation: Confirmation,
	KindInvoice:      Invoice,
	KindItinerary:    Itinerary,
	KindVoucher:      Vouchers,
}

type Service struct{ *app.Core }

func New(c *app.Core) *Service { return &Service{Core: c} }

func (s *Service) gather(ctx context.Context, st *store.Store, t *domain.Trip) (Data, error) {
	contact, err := st.TripContact(ctx, t.ID)
	if err != nil {
		return Data{}, err
	}
	bookings, err := st.ListBookings(ctx, store.BookingFilter{TripID: t.ID})
	if err != nil {
		return Data{}, err
	}
	// Day order reads naturally on paper.
	sort.SliceStable(bookings, func(i, j int) bool {
		if bookings[i].Day != bookings[j].Day {
			return bookings[i].Day < bookings[j].Day
		}
		return bookings[i].ID < bookings[j].ID
	})
	d := Data{Trip: t, Price: s.Eng.PriceTrip(t), Destination: s.Eng.Cat.Destination(t.DestinationID), Stay: s.Eng.Cat.Stay(t.StayID),
		Transport: s.Eng.Cat.TransportOption(t.TransportID), Contact: contact, Bookings: bookings, Forecast: s.Eng.TripForecast(t),
		Vendor: s.Eng.Cat.Vendor, Operator: contact.Operator, IssuedAt: s.Now().UTC(), Location: s.Cfg.Location}
	if d.Destination == nil {
		return Data{}, fmt.Errorf("trip %s has unknown destination %q", t.ID, t.DestinationID)
	}
	if pay, err := st.PaidPayment(ctx, t.ID); err == nil {
		d.Payment = &pay
	} else if !errors.Is(err, store.ErrNotFound) {
		return Data{}, err
	}
	if t.CoordinatorID != "" {
		team, err := st.ListTeam(ctx)
		if err != nil {
			return Data{}, err
		}
		for i := range team {
			if team[i].ID == t.CoordinatorID {
				d.Coordinator = &team[i]
			}
		}
	}
	return d, nil
}

// Issue renders and stores a new version of each requested document. Pass the
// transaction's store so documents commit together with the change they describe.
func (s *Service) Issue(ctx context.Context, st *store.Store, t *domain.Trip, kinds []string, reason string) ([]domain.Document, error) {
	d, err := s.gather(ctx, st, t)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Document, 0, len(kinds))
	for _, kind := range kinds {
		render, ok := renderers[kind]
		if !ok {
			return nil, fmt.Errorf("unknown document kind %q", kind)
		}
		version, err := st.NextDocumentVersion(ctx, t.ID, kind)
		if err != nil {
			return nil, err
		}
		d.Version = version
		pdf, err := render(d)
		if err != nil {
			return nil, fmt.Errorf("render %s: %w", kind, err)
		}
		sum := sha256.Sum256(pdf)
		doc := domain.Document{ID: s.ID("doc"), TripID: t.ID, Kind: kind, Title: titles[kind], Version: version, Reason: reason,
			FileName: fmt.Sprintf("%s-%s-v%d.pdf", t.Code, strings.ReplaceAll(kind, "_", "-"), version), SizeBytes: len(pdf),
			SHA256: hex.EncodeToString(sum[:]), CreatedAt: d.IssuedAt, Latest: true}
		if err := st.InsertDocument(ctx, doc, pdf); err != nil {
			return nil, err
		}
		out = append(out, doc)
	}
	return out, nil
}

func (s *Service) authorize(ctx context.Context, p auth.Principal, tripID string) error {
	owner, err := s.Store.TripOwner(ctx, tripID)
	if errors.Is(err, store.ErrNotFound) || err == nil && !p.Operator() && owner != p.UserID {
		return httpx.NotFound("We couldn't find that trip.")
	}
	return err
}

// List returns the trip's documents. Booked trips from before documents existed
// get their first set issued on the spot.
func (s *Service) List(ctx context.Context, p auth.Principal, tripID string) ([]domain.Document, error) {
	if err := s.authorize(ctx, p, tripID); err != nil {
		return nil, err
	}
	list, err := s.Store.ListDocuments(ctx, tripID)
	if err != nil || len(list) > 0 {
		return list, err
	}
	err = s.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		t, err := st.LockTrip(ctx, tripID)
		if err != nil {
			return err
		}
		if t.Status == domain.TripDraft {
			return nil
		}
		if existing, err := st.ListDocuments(ctx, tripID); err != nil || len(existing) > 0 {
			return err // issued by a concurrent request
		}
		_, err = s.Issue(ctx, st, t, All, "Booked")
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.Store.ListDocuments(ctx, tripID)
}

// Reissue creates fresh versions of every document (operator or owner).
func (s *Service) Reissue(ctx context.Context, p auth.Principal, tripID string) ([]domain.Document, error) {
	if err := s.authorize(ctx, p, tripID); err != nil {
		return nil, err
	}
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		t, err := st.LockTrip(ctx, tripID)
		if err != nil {
			return err
		}
		if t.Status == domain.TripDraft {
			return httpx.Conflict("Documents are issued once the trip is booked.")
		}
		docs, err := s.Issue(ctx, st, t, All, "Re-issued on request")
		if err != nil {
			return err
		}
		owner, err := st.TripOwner(ctx, tripID)
		if err != nil {
			return err
		}
		ev.Add(app.TripEvent("documents.updated", tripID, owner, map[string]any{"documents": docs}))
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Store.ListDocuments(ctx, tripID)
}

func (s *Service) Content(ctx context.Context, p auth.Principal, tripID, docID string) (domain.Document, []byte, error) {
	if err := s.authorize(ctx, p, tripID); err != nil {
		return domain.Document{}, nil, err
	}
	d, content, err := s.Store.DocumentContent(ctx, tripID, docID)
	if errors.Is(err, store.ErrNotFound) {
		return d, nil, httpx.NotFound("We couldn't find that document.")
	}
	return d, content, err
}
