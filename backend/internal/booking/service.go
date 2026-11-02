// Package booking turns a draft into a paid trip: orders, payment verification,
// vendor bookings, the money ledger and booking requests to vendors.
package booking

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/documents"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
	"trizpyy/internal/trips"
)

type Service struct {
	*app.Core
	trips *trips.Service
	rzp   *razorpay
}

func New(c *app.Core, t *trips.Service) *Service {
	return &Service{Core: c, trips: t, rzp: newRazorpay(c.Cfg.RazorpayKeyID, c.Cfg.RazorpayKeySecret)}
}

type Order struct {
	OrderID  string `json:"orderId"`
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
	Provider string `json:"provider"`
	KeyID    string `json:"keyId,omitempty"`
	TripCode string `json:"tripCode"`
}

// Checkout is the optional lead-traveler contact sent with POST /trips/{id}/book.
type Checkout struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	TelegramUpdates bool   `json:"telegramUpdates"`
	WhatsAppUpdates bool   `json:"whatsappUpdates,omitempty"`
}

// CreateOrder starts checkout for a draft trip (POST /trips/{id}/book).
func (s *Service) CreateOrder(ctx context.Context, p auth.Principal, tripID string, in Checkout) (Order, error) {
	v, err := s.trips.Get(ctx, p, tripID)
	if err != nil {
		return Order{}, err
	}
	if phone := digitsOnly(in.Phone); in.Phone != "" && (len(phone) < 10 || len(phone) > 13) {
		return Order{}, httpx.Invalid(map[string]string{"phone": "Enter a valid mobile number for tickets and trip updates."})
	}
	if in.Email != "" && (!strings.Contains(in.Email, "@") || len(in.Email) > 200) {
		return Order{}, httpx.Invalid(map[string]string{"email": "Enter a valid email."})
	}
	t := v.Trip
	if t.PaymentStatus != domain.PayUnpaid || t.Status != domain.TripDraft {
		return Order{}, httpx.Conflict("This trip is already booked.")
	}
	if engine.DaysBetween(s.Today(), t.Prefs.StartDate) < 0 {
		return Order{}, httpx.BadRequest("The start date has passed. Pick new dates before booking.")
	}
	amount := v.Price.Total
	if amount <= 0 {
		return Order{}, httpx.BadRequest("This trip has nothing to pay for yet.")
	}
	if s.rzp == nil {
		return Order{}, httpx.E(503, "payment", "Payments are not set up on this server yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).")
	}
	id, err := s.rzp.createOrder(ctx, amount, t.Code)
	if err != nil {
		slog.Error("razorpay order failed", "err", err)
		return Order{}, httpx.E(502, "payment", "The payment gateway is not responding. Please try again in a minute.")
	}
	order := Order{OrderID: id, Amount: amount, Currency: "INR", Provider: "razorpay", KeyID: s.Cfg.RazorpayKeyID, TripCode: t.Code}
	err = s.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		if err := st.SetTripContact(ctx, tripID, strings.TrimSpace(in.Phone), strings.TrimSpace(in.Email), in.TelegramUpdates || in.WhatsAppUpdates); err != nil {
			return err
		}
		return st.InsertPayment(ctx, store.Payment{ID: s.ID("pay"), TripID: tripID, Provider: order.Provider, OrderID: order.OrderID,
			Amount: amount, Currency: "INR", Status: "created"})
	})
	return order, err
}

func digitsOnly(v string) string {
	var b strings.Builder
	for _, r := range v {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

type VerifyInput struct {
	OrderID   string `json:"orderId"`
	PaymentID string `json:"paymentId"`
	Signature string `json:"signature"`
	Method    string `json:"method"`
}

type Confirmed struct {
	trips.View
	Bookings []domain.Booking `json:"bookings"`
	Payment  store.Payment    `json:"payment"`
}

var methodLabel = map[string]string{"upi": "UPI", "card": "Card", "netbanking": "Netbanking", "wallet": "Wallet", "emi": "EMI", "paylater": "Pay later"}

// Verify checks the payment and books the trip exactly once.
func (s *Service) Verify(ctx context.Context, p auth.Principal, tripID string, in VerifyInput) (Confirmed, error) {
	if _, err := s.trips.Authorize(ctx, p, tripID); err != nil {
		return Confirmed{}, err
	}
	if in.OrderID == "" {
		return Confirmed{}, httpx.BadRequest("orderId is required.")
	}
	// The method comes from Razorpay itself (the traveler picks it inside Razorpay Checkout).
	if m := s.rzp.paymentMethod(ctx, in.PaymentID); m != "" {
		in.Method = m
	}
	return s.confirm(ctx, tripID, in)
}

func (s *Service) confirm(ctx context.Context, tripID string, in VerifyInput) (Confirmed, error) {
	var out Confirmed
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		pay, err := st.LockPaymentByOrder(ctx, in.OrderID)
		if errors.Is(err, store.ErrNotFound) {
			return httpx.NotFound("We couldn't find that payment order.")
		}
		if err != nil {
			return err
		}
		if tripID != "" && pay.TripID != tripID {
			return httpx.BadRequest("That payment belongs to a different trip.")
		}
		tripID = pay.TripID
		t, err := st.LockTrip(ctx, tripID)
		if err != nil {
			return err
		}
		if pay.Status == "paid" {
			bookings, err := st.ListBookings(ctx, store.BookingFilter{TripID: tripID})
			if err != nil {
				return err
			}
			out = Confirmed{View: trips.View{Trip: t, Price: s.Eng.PriceTrip(t)}, Bookings: bookings, Payment: pay}
			return nil
		}
		// Razorpay signs order_id|payment_id with our secret; anything else is rejected.
		if pay.Provider != "razorpay" || in.PaymentID == "" || s.Cfg.RazorpayKeySecret == "" ||
			!validSignature(s.Cfg.RazorpayKeySecret, in.OrderID+"|"+in.PaymentID, in.Signature) {
			return httpx.E(402, "payment", "We couldn't verify this payment. No booking was made.")
		}
		if t.Status != domain.TripDraft || t.PaymentStatus != domain.PayUnpaid {
			return httpx.Conflict("This trip is already booked.")
		}
		price := s.Eng.PriceTrip(t)
		if price.Total != pay.Amount {
			return httpx.Conflict("The trip changed after checkout started. Please start the payment again.")
		}
		ref := in.PaymentID
		method := methodLabel[in.Method]
		if method == "" {
			method = "Online"
		}
		if err := st.MarkPayment(ctx, pay.ID, "paid", ref, in.Method); err != nil {
			return err
		}
		pay.Status, pay.PaymentRef = "paid", ref
		now := s.Now().UTC()
		c := t.Clone()
		c.Status, c.PaymentStatus, c.BookedAt = domain.TripBooked, domain.PayPaid, &now
		for i := range c.Items {
			if c.Items[i].Status != domain.ItemCancelled {
				c.Items[i].Status = domain.ItemPlanned
			}
		}
		if err := st.SaveTrip(ctx, c); err != nil {
			return err
		}
		bookings := s.bookingsFor(c, now)
		if err := st.InsertBookings(ctx, bookings); err != nil {
			return err
		}
		if err := st.InsertLedger(ctx, domain.LedgerEntry{ID: s.ID("txn"), Kind: "payment", Party: c.CustomerName, TripID: c.ID,
			Amount: price.Total, Status: "settled", Method: fmt.Sprintf("%s · Razorpay (%s)", method, ref), Note: c.Code + " · full payment", Date: now}); err != nil {
			return err
		}
		owner, err := st.TripOwner(ctx, c.ID)
		if err != nil {
			return err
		}
		vendors, err := s.requestBookings(ctx, st, ev, c, bookings)
		if err != nil {
			return err
		}
		if err := s.NotifyOperators(ctx, st, ev, "payment", "New booking · "+c.Code,
			fmt.Sprintf("%s paid %s for %s. %d vendor requests sent.", c.CustomerName, engine.Rupees(price.Total), c.Title, len(vendors)), "/ops/tours/"+c.ID); err != nil {
			return err
		}
		if err := s.NotifyTraveler(ctx, st, ev, owner, "payment", "Payment successful",
			engine.Rupees(price.Total)+" paid. We're confirming with every vendor now.", "/my-trip/"+c.ID); err != nil {
			return err
		}
		if owner != "" {
			if err := st.AddXP(ctx, owner, 150, "booked"); err != nil {
				return err
			}
		}
		var docs []domain.Document
		if s.Docs != nil {
			docs, err = s.Docs.Issue(ctx, st, c, documents.All, "Booked")
			if err != nil {
				return err
			}
			if err := s.MessageTraveler(ctx, st, ev, c, owner, fmt.Sprintf("Booking confirmed · %s\n%s · from %s\nPaid %s (ref %s). We've asked %d partners to confirm; you'll get a message here as each one answers. Your documents are attached.",
				c.Code, c.Title, engine.DayDate(c.Prefs.StartDate, 1), engine.Rupees(price.Total), ref, len(vendors)), docs); err != nil {
				return err
			}
			ev.Add(app.TripEvent("documents.updated", c.ID, owner, map[string]any{"documents": docs}))
		}
		// Telegram has replaced the customer-facing WhatsApp delivery: a linked
		// traveler gets the confirmation and the trip PDFs after this commits.
		s.SendBookingConfirmationTelegram(ctx, st, ev, c, docs)
		ev.Add(app.TripEvent("trip.updated", c.ID, owner, map[string]string{"reason": "booked"}))
		ev.Add(app.TripEvent("booking.status", c.ID, owner, map[string]any{"bookings": bookings}))
		out = Confirmed{View: trips.View{Trip: c, Price: price}, Bookings: bookings, Payment: pay}
		return nil
	})
	if err == nil && out.Trip != nil && engine.DaysBetween(out.Trip.Prefs.StartDate, s.Today()) >= 0 {
		// A trip that starts today goes live straight away instead of at the next progress tick.
		go func() {
			if err := s.trips.Progress(context.Background()); err != nil {
				slog.Warn("trip progress after booking", "err", err)
			}
		}()
	}
	return out, err
}

func (s *Service) bookingsFor(t *domain.Trip, now time.Time) []domain.Booking {
	var out []domain.Booking
	stay := s.Eng.Cat.Stay(t.StayID)
	n := 10
	for _, it := range t.Items {
		if it.VendorID == "" || it.Status == domain.ItemCancelled || it.Kind == "checkout" {
			continue
		}
		title, amount := it.Title, engine.ItemCost(it)
		if it.Kind == "checkin" && stay != nil {
			title = fmt.Sprintf("%s · %d nights", stay.Name, t.Prefs.Nights)
			amount = s.Eng.StayTotal(t)
		}
		out = append(out, domain.Booking{
			ID: fmt.Sprintf("BK-%s-%d", strings.TrimPrefix(t.Code, "TRZ-"), n), TripID: t.ID, ItemID: it.ID, ItemTitle: title,
			VendorID: it.VendorID, CustomerName: t.CustomerName, Status: "requested", Amount: amount, Day: it.Day,
			Date: engine.AddDays(t.Prefs.StartDate, it.Day-1), Channel: "web", UpdatedAt: now,
		})
		n++
	}
	return out
}

// requestBookings sends one booking request per vendor: a reply link (emailed when the vendor has
// an email on file) that the operator can also open, copy or answer for the vendor after a call.
func (s *Service) requestBookings(ctx context.Context, st *store.Store, ev *app.Events, t *domain.Trip, bookings []domain.Booking) ([]string, error) {
	type agg struct {
		titles []string
		day    int
	}
	var order []string
	byVendor := map[string]*agg{}
	for _, b := range bookings {
		a := byVendor[b.VendorID]
		if a == nil {
			a = &agg{day: b.Day}
			byVendor[b.VendorID] = a
			order = append(order, b.VendorID)
		}
		a.titles = append(a.titles, fmt.Sprintf("%s (Day %d)", b.ItemTitle, b.Day))
	}
	now := s.Now().UTC()
	var reqs []domain.VendorRequest
	for _, v := range order {
		a := byVendor[v]
		token := s.ID("bk")
		proposed := fmt.Sprintf("%s · %d guests · from %s", strings.Join(a.titles, " + "), t.Prefs.Travelers(), engine.DayDate(t.Prefs.StartDate, 1))
		reqs = append(reqs, domain.VendorRequest{Token: token, TripID: t.ID, VendorID: v, TravelerName: t.CustomerName,
			DateLabel: engine.DayDate(t.Prefs.StartDate, a.day), Original: "", Proposed: proposed, ItemTitle: "Booking request",
			Status: domain.AnswerPending, CreatedAt: now, Kind: "booking"})
		link := fmt.Sprintf("%s/v/%s", s.Cfg.PublicWeb, token)
		body := fmt.Sprintf("Booking request · %s · %s\nPlease confirm, decline or suggest another time: %s", t.Code, proposed, link)
		if err := s.SendToVendor(ctx, st, ev, v, domain.InboxMessage{From: "us", Type: "template", Body: body}, link); err != nil {
			return nil, err
		}
	}
	return order, st.InsertRequests(ctx, reqs)
}

// AnswerBooking applies a vendor's reply to a booking request.
func (s *Service) AnswerBooking(ctx context.Context, req domain.VendorRequest, answer, channel, altTime string, voice *domain.VoiceInterpretation) error {
	return s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		ok, err := st.AnswerRequest(ctx, req.Token, answer, channel, altTime, voice)
		if err != nil || !ok {
			return err
		}
		t, err := st.LockTrip(ctx, req.TripID)
		if err != nil {
			return err
		}
		owner, err := st.TripOwner(ctx, t.ID)
		if err != nil {
			return err
		}
		status := "confirmed"
		if answer != domain.AnswerYes {
			status = "declined"
		}
		if _, err := st.SetBookingStatusForVendor(ctx, t.ID, req.VendorID, status, "requested"); err != nil {
			return err
		}
		thread, err := s.VendorThread(ctx, st, req.VendorID)
		if err != nil {
			return err
		}
		reply := map[string]string{"yes": "Confirm", "no": "Can't do", "other_time": "Other time"}[answer]
		msg := domain.InboxMessage{ID: s.ID("m"), From: "them", Type: "button", Body: reply + channelNote(channel, altTime), At: s.Now().UTC()}
		if voice != nil {
			msg.Type, msg.Body, msg.Transcript, msg.Decision = "voice", voice.AudioLabel, voice.Transcript, voice.Decision
			msg.Confidence = &voice.Confidence
		}
		if err := st.AddMessage(ctx, thread, msg, answer != domain.AnswerYes); err != nil {
			return err
		}
		if answer == domain.AnswerYes {
			c := t.Clone()
			for i := range c.Items {
				if c.Items[i].VendorID == req.VendorID && c.Items[i].Status == domain.ItemPlanned {
					c.Items[i].Status = domain.ItemConfirmed
				}
			}
			if err := st.SaveTrip(ctx, c); err != nil {
				return err
			}
			if err := s.allConfirmed(ctx, st, ev, c, owner); err != nil {
				return err
			}
		} else {
			day := 1
			for _, it := range t.Items {
				if it.VendorID == req.VendorID && it.Status != domain.ItemCancelled {
					day = it.Day
					break
				}
			}
			name := s.Eng.Cat.VendorName(req.VendorID)
			inc := domain.Incident{ID: s.ID("inc"), TripID: t.ID, Kind: domain.IncVendorUnavailable, Title: name + " can't take the booking",
				Detail: fmt.Sprintf("%s replied “%s” to the booking request.", name, reply), Day: day, Severity: 4, Source: "vendor",
				Status: domain.IncOpen, CreatedAt: s.Now().UTC(), VendorID: req.VendorID}
			if err := st.InsertIncident(ctx, inc); err != nil {
				return err
			}
			if err := s.NotifyOperators(ctx, st, ev, "vendor", t.Code+": "+inc.Title, "Open the problem to let the agent find a new partner.", "/ops/incidents/"+inc.ID); err != nil {
				return err
			}
			ev.Add(app.TripEvent("incident.created", t.ID, owner, inc))
		}
		ev.Add(app.TripEvent("booking.status", t.ID, owner, map[string]string{"vendorId": req.VendorID, "status": status, "token": req.Token}))
		ev.Add(app.TripEvent("trip.updated", t.ID, owner, map[string]string{"reason": "vendor-" + status}))
		return nil
	})
}

// allConfirmed tells the traveler (with fresh vouchers) once every partner has said yes.
func (s *Service) allConfirmed(ctx context.Context, st *store.Store, ev *app.Events, t *domain.Trip, owner string) error {
	list, err := st.ListBookings(ctx, store.BookingFilter{TripID: t.ID})
	if err != nil || len(list) == 0 || s.Docs == nil {
		return err
	}
	vendors := map[string]bool{}
	for _, b := range list {
		if b.Status == "requested" || b.Status == "declined" {
			return nil
		}
		if b.Status == "confirmed" {
			vendors[b.VendorID] = true
		}
	}
	docs, err := s.Docs.Issue(ctx, st, t, []string{documents.KindConfirmation, documents.KindVoucher}, "All partners confirmed")
	if err != nil {
		return err
	}
	ev.Add(app.TripEvent("documents.updated", t.ID, owner, map[string]any{"documents": docs}))
	return s.MessageTraveler(ctx, st, ev, t, owner, fmt.Sprintf("All %d partners confirmed %s. Your vouchers are ready, show them at check-in and pickups.", len(vendors), t.Code), docs)
}

// Resend re-sends a pending booking request to the vendor (operator action).
func (s *Service) Resend(ctx context.Context, bookingID string) (domain.Booking, error) {
	var out domain.Booking
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		b, err := st.BookingByID(ctx, bookingID)
		if err != nil {
			return err
		}
		if b.Status != "requested" {
			return httpx.Conflict("Only bookings still waiting for the partner can be re-sent.")
		}
		out = b
		req, err := st.PendingRequestFor(ctx, b.TripID, b.VendorID)
		if errors.Is(err, store.ErrNotFound) {
			// No open request (e.g. it expired): send a fresh one with a new reply link.
			t, err := st.GetTrip(ctx, b.TripID)
			if err != nil {
				return err
			}
			_, err = s.requestBookings(ctx, st, ev, t, []domain.Booking{b})
			return err
		}
		if err != nil {
			return err
		}
		link := fmt.Sprintf("%s/v/%s", s.Cfg.PublicWeb, req.Token)
		body := fmt.Sprintf("Reminder · booking request for %s · %s\nPlease answer here: %s", b.CustomerName, req.Proposed, link)
		if err := s.SendToVendor(ctx, st, ev, b.VendorID, domain.InboxMessage{From: "us", Type: "template", Body: body}, link); err != nil {
			return err
		}
		out = b
		return nil
	})
	if errors.Is(err, store.ErrNotFound) {
		return out, httpx.NotFound("We couldn't find that booking.")
	}
	return out, err
}

// SetStatus lets the operator confirm a booking by hand (e.g. after a phone call) or cancel it.
func (s *Service) SetStatus(ctx context.Context, bookingID, status string) (domain.Booking, error) {
	if status != "confirmed" && status != "cancelled" {
		return domain.Booking{}, httpx.BadRequest("status must be confirmed or cancelled.")
	}
	var out domain.Booking
	err := s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		tripID, err := st.SetBookingStatus(ctx, bookingID, status)
		if err != nil {
			return err
		}
		list, err := st.ListBookings(ctx, store.BookingFilter{TripID: tripID})
		if err != nil {
			return err
		}
		for _, b := range list {
			if b.ID == bookingID {
				out = b
			}
		}
		owner, err := st.TripOwner(ctx, tripID)
		if err != nil {
			return err
		}
		ev.Add(app.TripEvent("booking.status", tripID, owner, map[string]string{"bookingId": bookingID, "status": status}))
		return nil
	})
	if errors.Is(err, store.ErrNotFound) {
		return out, httpx.NotFound("We couldn't find that booking.")
	}
	return out, err
}

// Webhook handles Razorpay's payment.captured / order.paid events.
func (s *Service) Webhook(ctx context.Context, body []byte, signature string) error {
	if s.Cfg.RazorpayWebhookSecret == "" {
		return httpx.NotFound("Payments webhook is not configured.")
	}
	if !validSignature(s.Cfg.RazorpayWebhookSecret, string(body), signature) {
		return httpx.Unauthorized("Bad signature.")
	}
	var evt struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID      string `json:"id"`
					OrderID string `json:"order_id"`
					Method  string `json:"method"`
				} `json:"entity"`
			} `json:"payment"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(body, &evt); err != nil {
		return httpx.BadRequest("Bad payload.")
	}
	if evt.Event != "payment.captured" && evt.Event != "order.paid" {
		return nil
	}
	e := evt.Payload.Payment.Entity
	if e.OrderID == "" {
		return nil
	}
	in := VerifyInput{OrderID: e.OrderID, PaymentID: e.ID, Method: e.Method, Signature: sign(s.Cfg.RazorpayKeySecret, e.OrderID+"|"+e.ID)}
	_, err := s.confirm(ctx, "", in)
	var he *httpx.Error
	if errors.As(err, &he) && he.Status == 409 {
		return nil
	}
	return err
}

func (s *Service) Bookings(ctx context.Context, p auth.Principal, tripID string) ([]domain.Booking, error) {
	if _, err := s.trips.Authorize(ctx, p, tripID); err != nil {
		return nil, err
	}
	return s.Store.ListBookings(ctx, store.BookingFilter{TripID: tripID})
}

// channelNote says how an answer arrived, for the operator's record.
func channelNote(channel, altTime string) string {
	note := map[string]string{"web": " (reply link)", "phone": " (recorded by operator after a call)", "voice": " (voice note)"}[channel]
	if altTime != "" {
		note += " · " + altTime
	}
	return note
}
