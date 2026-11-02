// Package ops serves the operator console: overview numbers, tours, bookings,
// customers, vendors, inbox, alerts and the money ledger.
package ops

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"trizpyy/internal/agent"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/incidents"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

type Service struct {
	*app.Core
	incidents *incidents.Service
	agent     *agent.Service
}

func New(c *app.Core, i *incidents.Service, a *agent.Service) *Service {
	return &Service{Core: c, incidents: i, agent: a}
}

type snapshot struct {
	trips     []*domain.Trip
	incidents []domain.Incident
	bookings  []domain.Booking
	ledger    []domain.LedgerEntry
}

func (s *Service) load(ctx context.Context) (snapshot, error) {
	var snap snapshot
	var err error
	if snap.trips, err = s.Store.ListTrips(ctx, store.TripFilter{}); err != nil {
		return snap, err
	}
	if snap.incidents, err = s.Store.ListIncidents(ctx, "", false); err != nil {
		return snap, err
	}
	if snap.bookings, err = s.Store.ListBookings(ctx, store.BookingFilter{Limit: 5000}); err != nil {
		return snap, err
	}
	snap.ledger, err = s.Store.ListLedger(ctx, "", 5000)
	return snap, err
}

func (s *Service) rows(snap snapshot) []engine.TourRow {
	openBy := map[string][]domain.Incident{}
	for _, i := range snap.incidents {
		if i.Status != domain.IncResolved {
			openBy[i.TripID] = append(openBy[i.TripID], i)
		}
	}
	bookBy := map[string][]domain.Booking{}
	for _, b := range snap.bookings {
		bookBy[b.TripID] = append(bookBy[b.TripID], b)
	}
	rows := make([]engine.TourRow, 0, len(snap.trips))
	for _, t := range snap.trips {
		rows = append(rows, s.Eng.TourRow(t, openBy[t.ID], bookBy[t.ID]))
	}
	return rows
}

type Overview struct {
	Stats     engine.Overview       `json:"stats"`
	Revenue   []engine.RevenuePoint `json:"revenue"`
	Tours     []engine.TourRow      `json:"tours"`
	Incidents []domain.Incident     `json:"incidents"`
	Runs      []domain.AgentRun     `json:"runs"`
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	snap, err := s.load(ctx)
	if err != nil {
		return Overview{}, err
	}
	rows := s.rows(snap)
	runs, err := s.Store.ListRuns(ctx, 8)
	if err != nil {
		return Overview{}, err
	}
	open := []domain.Incident{}
	for _, i := range snap.incidents {
		if i.Status != domain.IncResolved {
			open = append(open, i)
		}
	}
	loc := s.Cfg.Location
	return Overview{
		Stats:     s.Eng.Overview(rows, snap.incidents, snap.bookings, snap.ledger),
		Revenue:   engine.RevenueSeries(snap.ledger, s.Today(), 14, func(l domain.LedgerEntry) string { return l.Date.In(loc).Format("2006-01-02") }),
		Tours:     rows,
		Incidents: open,
		Runs:      runs,
	}, nil
}

func (s *Service) Tours(ctx context.Context, status string) ([]engine.TourRow, error) {
	snap, err := s.load(ctx)
	if err != nil {
		return nil, err
	}
	rows := s.rows(snap)
	if status == "" {
		return rows, nil
	}
	out := []engine.TourRow{}
	for _, r := range rows {
		if r.Status == status {
			out = append(out, r)
		}
	}
	return out, nil
}

type TourDetail struct {
	Row       engine.TourRow        `json:"row"`
	Price     domain.PriceBreakdown `json:"price"`
	Bookings  []domain.Booking      `json:"bookings"`
	Incidents []domain.Incident     `json:"incidents"`
	Ledger    []domain.LedgerEntry  `json:"ledger"`
	Vendors   []engine.VendorShare  `json:"vendors"`
	Forecast  []domain.DayForecast  `json:"forecast"`
	Customer  *domain.Customer      `json:"customer,omitempty"`
}

func (s *Service) Tour(ctx context.Context, id string) (TourDetail, error) {
	t, err := s.Store.GetTrip(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return TourDetail{}, httpx.NotFound("We couldn't find that tour.")
	}
	if err != nil {
		return TourDetail{}, err
	}
	bookings, err := s.Store.ListBookings(ctx, store.BookingFilter{TripID: id})
	if err != nil {
		return TourDetail{}, err
	}
	incs, err := s.Store.ListIncidents(ctx, id, false)
	if err != nil {
		return TourDetail{}, err
	}
	ledger, err := s.Store.ListLedger(ctx, id, 500)
	if err != nil {
		return TourDetail{}, err
	}
	var open []domain.Incident
	for _, i := range incs {
		if i.Status != domain.IncResolved {
			open = append(open, i)
		}
	}
	d := TourDetail{Row: s.Eng.TourRow(t, open, bookings), Price: s.Eng.PriceTrip(t), Bookings: bookings, Incidents: incs, Ledger: ledger,
		Vendors: s.Eng.VendorBreakdown(t), Forecast: s.Eng.TripForecast(t)}
	if customers, err := s.Store.ListCustomers(ctx); err == nil {
		for i := range customers {
			if customers[i].ID == t.CustomerID {
				d.Customer = &customers[i]
			}
		}
	}
	return d, nil
}

func (s *Service) AssignCoordinator(ctx context.Context, tripID, memberID string) error {
	ok, err := s.Store.TeamMemberExists(ctx, memberID)
	if err != nil {
		return err
	}
	if !ok {
		return httpx.BadRequest("Pick a coordinator from the team.")
	}
	err = s.Store.SetCoordinator(ctx, tripID, memberID)
	if errors.Is(err, store.ErrNotFound) {
		return httpx.NotFound("We couldn't find that tour.")
	}
	if err == nil {
		owner, _ := s.Store.TripOwner(ctx, tripID)
		s.Hub.Publish(app.TripEvent("trip.updated", tripID, owner, map[string]string{"reason": "coordinator"}))
	}
	return err
}

func (s *Service) Bookings(ctx context.Context, status string) ([]domain.Booking, error) {
	if status != "" && status != "requested" && status != "confirmed" && status != "declined" && status != "cancelled" {
		return nil, httpx.BadRequest("status must be requested, confirmed, declined or cancelled.")
	}
	return s.Store.ListBookings(ctx, store.BookingFilter{Status: status, Limit: 2000})
}

func (s *Service) Customers(ctx context.Context) ([]domain.Customer, error) {
	return s.Store.ListCustomers(ctx)
}

func (s *Service) Team(ctx context.Context) ([]domain.TeamMember, error) {
	return s.Store.ListTeam(ctx)
}

func (s *Service) Ledger(ctx context.Context) ([]domain.LedgerEntry, error) {
	return s.Store.ListLedger(ctx, "", 2000)
}

func (s *Service) Vendors(ctx context.Context) ([]domain.Vendor, error) {
	return s.Store.ListVendors(ctx)
}

type VendorDetail struct {
	Vendor   domain.Vendor          `json:"vendor"`
	Bookings []domain.Booking       `json:"bookings"`
	Requests []domain.VendorRequest `json:"requests"`
}

func (s *Service) Vendor(ctx context.Context, id string) (VendorDetail, error) {
	list, err := s.Store.ListVendors(ctx)
	if err != nil {
		return VendorDetail{}, err
	}
	for _, v := range list {
		if v.ID == id {
			bookings, err := s.Store.ListBookings(ctx, store.BookingFilter{VendorID: id, Limit: 200})
			return VendorDetail{Vendor: v, Bookings: bookings, Requests: []domain.VendorRequest{}}, err
		}
	}
	return VendorDetail{}, httpx.NotFound("We couldn't find that vendor.")
}

type AvailabilityResult struct {
	Vendor    domain.Vendor     `json:"vendor"`
	Incidents []domain.Incident `json:"incidents"`
}

// SetAvailability pauses or resumes a vendor; pausing raises problems on every affected trip.
func (s *Service) SetAvailability(ctx context.Context, p auth.Principal, id string, available bool) (AvailabilityResult, error) {
	err := s.Store.SetVendorAvailability(ctx, id, available)
	if errors.Is(err, store.ErrNotFound) {
		return AvailabilityResult{}, httpx.NotFound("We couldn't find that vendor.")
	}
	if err != nil {
		return AvailabilityResult{}, err
	}
	s.Eng.Cat.SetAvailable(id, available)
	res := AvailabilityResult{Incidents: []domain.Incident{}}
	if !available {
		if res.Incidents, err = s.incidents.VendorPaused(ctx, p, id); err != nil {
			return res, err
		}
	}
	d, err := s.Vendor(ctx, id)
	res.Vendor = d.Vendor
	s.Hub.Publish(app.OperatorEvent("vendor.updated", res.Vendor))
	return res, err
}

func (s *Service) Inbox(ctx context.Context) ([]domain.InboxThread, error) {
	return s.Store.ListThreads(ctx)
}

func (s *Service) MarkThreadRead(ctx context.Context, id string) error {
	err := s.Store.MarkThreadRead(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return httpx.NotFound("Conversation not found.")
	}
	return err
}

// SendMessage posts an operator reply into a conversation.
func (s *Service) SendMessage(ctx context.Context, threadID, body string) (domain.InboxMessage, error) {
	body = strings.TrimSpace(body)
	if body == "" || len(body) > 2000 {
		return domain.InboxMessage{}, httpx.BadRequest("Write a message (up to 2000 characters).")
	}
	ok, err := s.Store.ThreadExists(ctx, threadID)
	if err != nil {
		return domain.InboxMessage{}, err
	}
	if !ok {
		return domain.InboxMessage{}, httpx.NotFound("Conversation not found.")
	}
	msg := domain.InboxMessage{ID: s.ID("m"), From: "us", Type: "text", Body: body, At: s.Now().UTC(), Status: "sent"}
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		if strings.HasPrefix(threadID, "th-v-") {
			return s.SendToVendor(ctx, st, ev, strings.TrimPrefix(threadID, "th-"), msg, "")
		}
		if tripID, ok := strings.CutPrefix(threadID, "th-trip-"); ok {
			// A traveler's trip chat: the reply appears in their Messages tab.
			t, err := st.GetTrip(ctx, tripID)
			if err != nil {
				return err
			}
			owner, err := st.TripOwner(ctx, tripID)
			if err != nil {
				return err
			}
			msg, err = s.ReplyToTraveler(ctx, st, ev, t, owner, msg)
			return err
		}
		if err := st.AddMessage(ctx, threadID, msg, false); err != nil {
			return err
		}
		ev.Add(app.OperatorEvent("inbox.message", map[string]any{"threadId": threadID, "message": msg}))
		return nil
	})
	return msg, err
}

type Alerts struct {
	CrowdReports []domain.CrowdReport  `json:"crowdReports"`
	Warnings     []domain.EarlyWarning `json:"warnings"`
}

func (s *Service) Alerts(ctx context.Context) (Alerts, error) {
	reports, err := s.Store.ListCrowdReports(ctx)
	if err != nil {
		return Alerts{}, err
	}
	warnings, err := s.Store.ListWarnings(ctx)
	return Alerts{CrowdReports: reports, Warnings: warnings}, err
}

func (s *Service) VerifyReport(ctx context.Context, id string) (domain.CrowdReport, error) {
	r, err := s.Store.VerifyCrowdReport(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return r, httpx.NotFound("Report not found.")
	}
	if err == nil {
		s.Hub.Publish(app.OperatorEvent("alert.verified", r))
	}
	return r, err
}

// HandOff turns an early warning into a running-late problem and lets the agent fix it.
func (s *Service) HandOff(ctx context.Context, p auth.Principal, warningID string) (incidents.Launched, error) {
	w, err := s.Store.GetWarning(ctx, warningID)
	if errors.Is(err, store.ErrNotFound) {
		return incidents.Launched{}, httpx.NotFound("Warning not found.")
	}
	if err != nil {
		return incidents.Launched{}, err
	}
	if w.Status != "watching" {
		return incidents.Launched{}, httpx.Conflict("This warning is already being handled.")
	}
	t, err := s.Store.GetTrip(ctx, w.TripID)
	if err != nil {
		return incidents.Launched{}, err
	}
	day := engine.CurrentDayOf(t, s.Today())
	delay := max(25, w.EtaLateMin)
	inc, err := s.incidents.Create(ctx, p, t.ID, incidents.CreateInput{Kind: domain.IncRunningLate, Day: day, DelayMin: &delay, Source: "operator"})
	if err != nil {
		return incidents.Launched{}, err
	}
	run, err := s.agent.Start(ctx, p, inc.ID, agent.StartInput{Scope: "operator"})
	if err != nil {
		return incidents.Launched{}, err
	}
	if err := s.Store.SetWarningStatus(ctx, w.ID, "handed-to-agent"); err != nil {
		return incidents.Launched{}, err
	}
	return incidents.Launched{TripID: t.ID, TripCode: t.Code, IncidentID: inc.ID, RunID: run.ID}, nil
}

func (s *Service) Runs(ctx context.Context) ([]domain.AgentRun, error) {
	return s.Store.ListRuns(ctx, 30)
}

type ReportInput struct {
	Place         string `json:"place"`
	Type          string `json:"type"`
	Text          string `json:"text"`
	Role          string `json:"role"`
	DestinationID string `json:"destinationId"`
}

// Report records a crowd report and verifies it (2 reports in 2 hours, a guide/vendor, or the AI check).
func (s *Service) Report(ctx context.Context, p auth.Principal, tripID string, in ReportInput) (domain.CrowdReport, error) {
	t, err := s.Store.GetTrip(ctx, tripID)
	if errors.Is(err, store.ErrNotFound) {
		return domain.CrowdReport{}, httpx.NotFound("We couldn't find that trip.")
	}
	if err != nil {
		return domain.CrowdReport{}, err
	}
	if !p.Operator() {
		owner, err := s.Store.TripOwner(ctx, tripID)
		if err != nil || owner != p.UserID {
			return domain.CrowdReport{}, httpx.NotFound("We couldn't find that trip.")
		}
	}
	return s.report(ctx, p, t.DestinationID, in)
}

// GuideReport is a report filed from the operator console by a guide in the field.
func (s *Service) GuideReport(ctx context.Context, p auth.Principal, in ReportInput) (domain.CrowdReport, error) {
	if s.Eng.Cat.Destination(in.DestinationID) == nil {
		return domain.CrowdReport{}, httpx.BadRequest("Pick a destination for the report.")
	}
	return s.report(ctx, p, in.DestinationID, in)
}

func (s *Service) report(ctx context.Context, p auth.Principal, destinationID string, in ReportInput) (domain.CrowdReport, error) {
	in.Place, in.Text = strings.TrimSpace(in.Place), strings.TrimSpace(in.Text)
	if in.Place == "" || len(in.Place) > 80 || len(in.Text) > 400 {
		return domain.CrowdReport{}, httpx.BadRequest("Tell us the place (and optionally what's happening).")
	}
	types := []string{"closed", "road_blocked", "crowded", "unsafe", "other"}
	valid := false
	for _, x := range types {
		valid = valid || x == in.Type
	}
	if !valid {
		in.Type = "other"
	}
	role := "traveler"
	if p.Operator() {
		role = "guide"
	}
	similar, err := s.Store.RecentSimilarReports(ctx, destinationID, in.Place)
	if err != nil {
		return domain.CrowdReport{}, err
	}
	verified := role == "guide" || similar >= 1
	if check, ok := s.AI.CheckReport(ctx, in.Place, in.Text); ok {
		if !check.Real {
			verified = false
		} else if in.Type == "other" {
			in.Type = check.Type
		}
	}
	affected := []string{}
	if trips, err := s.Store.ListTrips(ctx, store.TripFilter{DestinationID: destinationID, Statuses: []string{domain.TripBooked, domain.TripLive}}); err == nil {
		for _, x := range trips {
			for _, it := range x.Items {
				if engine.IsActive(it) && strings.Contains(strings.ToLower(it.Place+" "+it.Title), strings.ToLower(in.Place)) {
					affected = append(affected, x.ID)
					break
				}
			}
		}
	}
	u, _ := s.Store.UserByID(ctx, p.UserID)
	r := domain.CrowdReport{ID: s.ID("cr"), Place: in.Place, DestinationID: destinationID, Type: in.Type, Text: orText(in.Text, in.Type),
		Reporter: orText(u.Name, "Traveler"), ReporterRole: role, CreatedAt: s.Now().UTC(), Verified: verified, Confirmations: similar + 1, AffectedTrips: affected}
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		if err := st.InsertCrowdReport(ctx, r); err != nil {
			return err
		}
		if verified && len(affected) > 0 {
			if err := s.NotifyOperators(ctx, st, ev, "risk", fmt.Sprintf("Crowd report · %s", r.Place),
				fmt.Sprintf("%s. %d tours plan to go there.", r.Text, len(affected)), "/ops/alerts"); err != nil {
				return err
			}
		}
		ev.Add(app.OperatorEvent("alert.new", r))
		return nil
	})
	return r, err
}

func orText(v, def string) string {
	if v == "" {
		return strings.ReplaceAll(def, "_", " ")
	}
	return v
}

// VendorContactInput is what the operator edits about a partner (empty fields are left as they are).
type VendorContactInput struct {
	ContactName *string `json:"contactName"`
	Phone       *string `json:"phone"`
	Email       *string `json:"email"`
	Language    *string `json:"language"`
}

// UpdateVendor saves a partner's real contact details (used for calls and emailed requests).
func (s *Service) UpdateVendor(ctx context.Context, id string, in VendorContactInput) (domain.Vendor, error) {
	fields := map[string]string{}
	trim := func(p *string, max int, field string) {
		if p == nil {
			return
		}
		*p = strings.TrimSpace(*p)
		if len(*p) > max {
			fields[field] = "Too long."
		}
	}
	trim(in.ContactName, 80, "contactName")
	trim(in.Phone, 20, "phone")
	trim(in.Email, 120, "email")
	trim(in.Language, 30, "language")
	if in.Phone != nil && *in.Phone != "" {
		digits := 0
		for _, r := range *in.Phone {
			if r >= '0' && r <= '9' {
				digits++
			} else if !strings.ContainsRune("+ -()", r) {
				digits = -100
			}
		}
		if digits < 10 || digits > 13 {
			fields["phone"] = "Enter a valid phone number, like +91 98765 43210."
		}
	}
	if in.Email != nil && *in.Email != "" && (!strings.Contains(*in.Email, "@") || strings.ContainsAny(*in.Email, " ,;")) {
		fields["email"] = "Enter a valid email address."
	}
	if len(fields) > 0 {
		return domain.Vendor{}, httpx.Invalid(fields)
	}
	err := s.Store.UpdateVendorContact(ctx, id, store.VendorContact{ContactName: in.ContactName, Phone: in.Phone, Email: in.Email, Language: in.Language})
	if errors.Is(err, store.ErrNotFound) {
		return domain.Vendor{}, httpx.NotFound("We couldn't find that vendor.")
	}
	if err != nil {
		return domain.Vendor{}, err
	}
	d, err := s.Vendor(ctx, id)
	if err == nil {
		s.Hub.Publish(app.OperatorEvent("vendor.updated", d.Vendor))
	}
	return d.Vendor, err
}

// Decisions is the log of every AI decision (what was asked, which engine answered, how sure it was).
func (s *Service) Decisions(ctx context.Context, limit int) ([]store.Decision, error) {
	return s.Store.ListDecisions(ctx, limit)
}
