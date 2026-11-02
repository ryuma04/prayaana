package trips

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"trizpyy/internal/ai"
	"trizpyy/internal/app"
	"trizpyy/internal/auth"
	"trizpyy/internal/documents"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/learning"
	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
)

type Service struct {
	*app.Core
	// Learn turns the traveler's own edits and feedback into Travel DNA updates (nil in tests).
	Learn *learning.Service
}

func New(c *app.Core) *Service { return &Service{Core: c} }

// View is a trip with its live price.
type View struct {
	Trip  *domain.Trip          `json:"trip"`
	Price domain.PriceBreakdown `json:"price"`
}

func (s *Service) view(t *domain.Trip) View { return View{Trip: t, Price: s.Eng.PriceTrip(t)} }

var ErrTripNotFound = httpx.NotFound("We couldn't find that trip.")

// Authorize checks the caller may see the trip and returns the owning traveler's user id.
func (s *Service) Authorize(ctx context.Context, p auth.Principal, tripID string) (string, error) {
	owner, err := s.Store.TripOwner(ctx, tripID)
	if errors.Is(err, store.ErrNotFound) {
		return "", ErrTripNotFound
	}
	if err != nil {
		return "", err
	}
	if !p.Operator() && owner != p.UserID {
		return "", ErrTripNotFound
	}
	return owner, nil
}

func (s *Service) Get(ctx context.Context, p auth.Principal, id string) (View, error) {
	if _, err := s.Authorize(ctx, p, id); err != nil {
		return View{}, err
	}
	t, err := s.Store.GetTrip(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return View{}, ErrTripNotFound
	}
	if err != nil {
		return View{}, err
	}
	return s.view(t), nil
}

func (s *Service) Mine(ctx context.Context, p auth.Principal) ([]View, error) {
	c, err := s.Store.CustomerForUser(ctx, p.UserID)
	if errors.Is(err, store.ErrNotFound) {
		return []View{}, nil
	}
	if err != nil {
		return nil, err
	}
	list, err := s.Store.ListTrips(ctx, store.TripFilter{CustomerID: c.ID})
	if err != nil {
		return nil, err
	}
	out := make([]View, 0, len(list))
	for i := len(list) - 1; i >= 0; i-- {
		out = append(out, s.view(list[i]))
	}
	return out, nil
}

type CreateInput struct {
	Prefs       domain.TripPreferences `json:"prefs"`
	StayID      string                 `json:"stayId"`
	TransportID string                 `json:"transportId"`
	CustomerID  string                 `json:"customerId"`
}

// Planning explains how the plan was built (shown while the trip is generated).
type Planning struct {
	Wishes      []engine.Wish `json:"wishes"`
	WishEngine  string        `json:"wishEngine"`
	Matched     int           `json:"matched"`
	Scored      int           `json:"scored"`
	WetDays     int           `json:"wetDays"`
	StayName    string        `json:"stayName"`
	Transport   string        `json:"transport"`
	TotalBudget int           `json:"totalBudget"`
}

type Created struct {
	View
	Planning Planning `json:"planning"`
}

// wishes reads the traveler's own words with the AI and keeps every rule-based wish it missed.
func (s *Service) wishes(ctx context.Context, words string) ([]engine.Wish, string) {
	rules := engine.ParseWishes(words)
	list, eng, ok := s.AI.ExtractWishes(ctx, words)
	if !ok {
		return rules, "rules"
	}
	out := make([]engine.Wish, 0, len(list)+len(rules))
	for _, w := range list {
		out = append(out, engine.Wish{Text: w.Text, Boosts: w.Boosts, LowWalking: w.LowWalking, Kids: w.Kids})
	}
	for _, r := range rules {
		if !covered(r, out) {
			out = append(out, r)
		}
	}
	return out, eng
}

func covered(r engine.Wish, list []engine.Wish) bool {
	for _, w := range list {
		if r.LowWalking && w.LowWalking || r.Kids && w.Kids {
			return true
		}
		if len(r.Boosts) == 0 {
			continue
		}
		all := true
		for _, b := range r.Boosts {
			if !oneOf(b, w.Boosts) {
				all = false
				break
			}
		}
		if all {
			return true
		}
	}
	return false
}

func (s *Service) Create(ctx context.Context, p auth.Principal, in CreateInput) (Created, error) {
	prefs, err := normalizePrefs(in.Prefs, s.Eng, s.Today())
	if err != nil {
		return Created{}, err
	}
	var customer domain.Customer
	if p.Operator() {
		if in.CustomerID == "" {
			return Created{}, httpx.BadRequest("Choose the customer this trip is for.")
		}
		list, err := s.Store.ListCustomers(ctx)
		if err != nil {
			return Created{}, err
		}
		for _, c := range list {
			if c.ID == in.CustomerID {
				customer = c
			}
		}
		if customer.ID == "" {
			return Created{}, httpx.BadRequest("That customer does not exist.")
		}
	} else if customer, err = s.Store.CustomerForUser(ctx, p.UserID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return Created{}, httpx.Forbidden("Your traveler profile is incomplete. Please sign up again.")
		}
		return Created{}, err
	}
	wishes, wishEngine := s.wishes(ctx, prefs.OwnWords)
	var created Created
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		code, err := st.NextTripCode(ctx)
		if err != nil {
			return err
		}
		opID, err := st.DefaultOperator(ctx)
		if err != nil {
			return err
		}
		t, err := s.Eng.BuildTrip(prefs, engine.BuildOptions{
			ID: s.ID("trp"), Code: code, CustomerID: customer.ID, CustomerName: customer.Name,
			CoordinatorID: s.Eng.Cat.CoordinatorFor[prefs.DestinationID], GroupName: groupName(customer.Name, prefs),
			StayID: in.StayID, TransportID: in.TransportID, Wishes: wishes, Now: s.Now().UTC(),
		})
		if err != nil {
			return httpx.BadRequest(err.Error())
		}
		for _, destID := range t.Destinations {
			if d := s.Eng.ResolveDestination(destID, prefs); d != nil {
				stay := s.Eng.PickStay(d, prefs)
				tr := s.Eng.PickTransport(d, prefs)
				_ = st.EnsureDestination(ctx, opID, d, &stay, &tr)
			}
		}
		if err := st.InsertTrip(ctx, opID, t); err != nil {
			return err
		}
		if customer.UserID != "" {
			if err := st.AddXP(ctx, customer.UserID, 50, "planner"); err != nil {
				return err
			}
		}
		ev.Add(app.TripEvent("trip.updated", t.ID, customer.UserID, map[string]string{"reason": "created"}))
		created = Created{View: s.view(t), Planning: s.planning(t, prefs, wishes, wishEngine)}
		return nil
	})
	return created, err
}

func (s *Service) planning(t *domain.Trip, p domain.TripPreferences, wishes []engine.Wish, eng string) Planning {
	wet := 0
	for _, f := range s.Eng.TripForecast(t) {
		if engine.IsWet(f) {
			wet++
		}
	}
	stay, transport := "", ""
	if x := s.Eng.Cat.Stay(t.StayID); x != nil {
		stay = x.Name
	}
	if x := s.Eng.Cat.TransportOption(t.TransportID); x != nil {
		transport = x.Mode
	}
	if wishes == nil {
		wishes = []engine.Wish{}
	}
	return Planning{
		Wishes: wishes, WishEngine: eng, Matched: s.Eng.MatchedExperiences(p, wishes), Scored: len(s.Eng.Cat.ActivitiesFor(p.DestinationID)),
		WetDays: wet, StayName: stay, Transport: transport, TotalBudget: p.BudgetPerPerson * p.Travelers(),
	}
}

func groupName(customer string, p domain.TripPreferences) string {
	parts := strings.Fields(customer)
	last := customer
	if len(parts) > 0 {
		last = parts[len(parts)-1]
	}
	switch {
	case p.Travelers() > 2:
		return last + " group"
	case p.Adults == 2:
		return last + " couple"
	}
	return last + " trip"
}

// mutate loads a trip under a row lock, applies fn and saves it atomically.
func (s *Service) mutate(ctx context.Context, p auth.Principal, id, reason string, fn func(t *domain.Trip) (*domain.Trip, error)) (View, error) {
	owner, err := s.Authorize(ctx, p, id)
	if err != nil {
		return View{}, err
	}
	var out View
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		t, err := st.LockTrip(ctx, id)
		if err != nil {
			return err
		}
		before := s.Eng.PriceTrip(t).Total
		next, err := fn(t)
		if err != nil {
			return err
		}
		next.Version = t.Version
		if err := st.SaveTrip(ctx, next); err != nil {
			return err
		}
		out = s.view(next)
		ev.Add(app.TripEvent("trip.updated", id, owner, map[string]any{"reason": reason, "priceFrom": before, "priceTo": out.Price.Total, "version": next.Version}))
		return nil
	})
	if errors.Is(err, store.ErrConflict) {
		return View{}, httpx.Conflict("This trip was just changed elsewhere. Refresh and try again.")
	}
	return out, err
}

func editable(t *domain.Trip) error {
	if t.Status != domain.TripDraft {
		return httpx.Conflict("This trip is already booked. Use Adapt or mood buttons to change it, so every vendor confirms.")
	}
	return nil
}

func userErr(err error) error {
	if err == nil {
		return nil
	}
	var he *httpx.Error
	if errors.As(err, &he) {
		return err
	}
	return httpx.BadRequest(err.Error())
}

type ItemPatch struct {
	Op         string `json:"op"`
	Day        int    `json:"day"`
	StartMin   *int   `json:"startMin"`
	Qty        int    `json:"qty"`
	ActivityID string `json:"activityId"`
}

func (s *Service) PatchItem(ctx context.Context, p auth.Principal, tripID, itemID string, in ItemPatch) (View, error) {
	var events []learning.Event
	v, err := s.mutate(ctx, p, tripID, in.Op, func(t *domain.Trip) (*domain.Trip, error) {
		events = nil
		if it := t.Item(itemID); it != nil && it.Kind == "activity" && it.RefID != "" {
			switch in.Op {
			case "heart":
				kind := "hearted"
				if it.Hearted {
					kind = "unhearted"
				}
				events = []learning.Event{{Kind: kind, TripID: tripID, ItemID: itemID, ActivityID: it.RefID, Detail: it.Title}}
			case "remove":
				events = []learning.Event{{Kind: "removed", TripID: tripID, ItemID: itemID, ActivityID: it.RefID, Detail: it.Title}}
			case "swap":
				if a := s.Eng.Cat.Activity(in.ActivityID); a != nil && a.ID != it.RefID {
					events = []learning.Event{{Kind: "swap_replaced", TripID: tripID, ItemID: itemID, ActivityID: it.RefID, Detail: it.Title},
						{Kind: "swap_chosen", TripID: tripID, ItemID: itemID, ActivityID: a.ID, Detail: a.Title}}
				}
			}
		}
		if in.Op != "heart" {
			if err := editable(t); err != nil {
				return nil, err
			}
		} else if t.Status == domain.TripCompleted {
			return nil, httpx.Conflict("This trip is already over.")
		}
		var next *domain.Trip
		var err error
		switch in.Op {
		case "heart":
			next, err = s.Eng.ToggleHeart(t, itemID)
		case "remove":
			next, err = s.Eng.RemoveItem(t, itemID)
		case "move":
			next, err = s.Eng.MoveItem(t, itemID, in.Day)
		case "time":
			if in.StartMin == nil {
				return nil, httpx.BadRequest("startMin is required.")
			}
			next, err = s.Eng.ChangeTime(t, itemID, *in.StartMin)
		case "qty":
			next, err = s.Eng.ChangeQty(t, itemID, in.Qty)
		case "swap":
			a := s.Eng.Cat.Activity(in.ActivityID)
			if a == nil {
				return nil, httpx.BadRequest("Pick an experience to swap in.")
			}
			next, err = s.Eng.SwapActivity(t, itemID, *a)
		default:
			return nil, httpx.BadRequest("op must be heart, remove, move, time, qty or swap.")
		}
		return next, userErr(err)
	})
	if err == nil && !p.Operator() {
		s.Learn.Record(ctx, p.UserID, events...) // the traveler's own choices teach their Travel DNA
	}
	return v, err
}

type AddInput struct {
	ActivityID string `json:"activityId"`
	Day        int    `json:"day"`
}

func (s *Service) AddItem(ctx context.Context, p auth.Principal, tripID string, in AddInput) (View, error) {
	v, err := s.mutate(ctx, p, tripID, "add", func(t *domain.Trip) (*domain.Trip, error) {
		if err := editable(t); err != nil {
			return nil, err
		}
		a := s.Eng.Cat.Activity(in.ActivityID)
		if a == nil {
			return nil, httpx.BadRequest("Pick an experience to add.")
		}
		for _, i := range t.Items {
			if i.RefID == a.ID && engine.IsActive(i) {
				return nil, httpx.Conflict("That experience is already in your plan.")
			}
		}
		next, err := s.Eng.AddActivity(t, *a, in.Day)
		return next, userErr(err)
	})
	if err == nil && !p.Operator() {
		if a := s.Eng.Cat.Activity(in.ActivityID); a != nil {
			s.Learn.Record(ctx, p.UserID, learning.Event{Kind: "added", TripID: tripID, ActivityID: a.ID, Detail: a.Title})
		}
	}
	return v, err
}

type TripPatch struct {
	StayID      string `json:"stayId"`
	TransportID string `json:"transportId"`
	Adults      *int   `json:"adults"`
	Kids        *int   `json:"kids"`
	GroupName   string `json:"groupName"`
	StartDate   string `json:"startDate"`
	Budget      *int   `json:"budgetPerPerson"`
}

func (s *Service) Patch(ctx context.Context, p auth.Principal, tripID string, in TripPatch) (View, error) {
	return s.mutate(ctx, p, tripID, "details", func(t *domain.Trip) (*domain.Trip, error) {
		if err := editable(t); err != nil {
			return nil, err
		}
		next := t
		var err error
		if in.StayID != "" {
			if next, err = s.Eng.ChangeStay(next, in.StayID); err != nil {
				return nil, userErr(err)
			}
		}
		if in.TransportID != "" {
			if next, err = s.Eng.ChangeTransport(next, in.TransportID); err != nil {
				return nil, userErr(err)
			}
		}
		if in.Adults != nil || in.Kids != nil {
			a, k := next.Prefs.Adults, next.Prefs.Kids
			if in.Adults != nil {
				a = *in.Adults
			}
			if in.Kids != nil {
				k = *in.Kids
			}
			if next, err = s.Eng.SetTravelers(next, a, k); err != nil {
				return nil, userErr(err)
			}
		}
		if in.StartDate != "" {
			if !engine.ValidISODate(in.StartDate) || engine.DaysBetween(s.Today(), in.StartDate) < 0 || engine.DaysBetween(s.Today(), in.StartDate) > 400 {
				return nil, httpx.BadRequest("Pick a start date between today and about a year from now.")
			}
			next = next.Clone()
			next.Prefs.StartDate = in.StartDate
		}
		if in.Budget != nil {
			if *in.Budget < 1000 || *in.Budget > 5_000_000 {
				return nil, httpx.BadRequest("Budget per person must be between ₹1,000 and ₹50,00,000.")
			}
			next = next.Clone()
			next.Prefs.BudgetPerPerson = *in.Budget
		}
		if g := strings.TrimSpace(in.GroupName); g != "" {
			if len(g) > 60 {
				return nil, httpx.BadRequest("Group name is too long.")
			}
			next = next.Clone()
			next.GroupName = g
		}
		return next, nil
	})
}

func (s *Service) Optimize(ctx context.Context, p auth.Principal, tripID string) (View, domain.Optimized, error) {
	var res domain.Optimized
	v, err := s.mutate(ctx, p, tripID, "optimize", func(t *domain.Trip) (*domain.Trip, error) {
		if err := editable(t); err != nil {
			return nil, err
		}
		r := s.Eng.OptimizeTrip(t)
		res = domain.Optimized{SavedMin: r.SavedMin, MovedOutdoor: r.MovedOutdoor}
		return r.Trip, nil
	})
	return v, res, err
}

func (s *Service) OptimizeBudget(ctx context.Context, p auth.Principal, tripID string) (View, engine.BudgetOptimization, error) {
	var opt engine.BudgetOptimization
	v, err := s.mutate(ctx, p, tripID, "budget_optimize", func(t *domain.Trip) (*domain.Trip, error) {
		if err := editable(t); err != nil {
			return nil, err
		}
		opt = s.Eng.OptimizeBudget(t)
		return opt.Trip, nil
	})
	return v, opt, err
}

func (s *Service) ApplyPromo(ctx context.Context, p auth.Principal, tripID, code string) (View, string, error) {
	var label string
	v, err := s.mutate(ctx, p, tripID, "promo", func(t *domain.Trip) (*domain.Trip, error) {
		if t.PaymentStatus != domain.PayUnpaid {
			return nil, httpx.Conflict("Promo codes can only be added before payment.")
		}
		l, msg := s.Eng.ValidatePromo(code, t)
		if msg != "" {
			return nil, httpx.BadRequest(msg)
		}
		label = l
		c := t.Clone()
		c.PromoCode = engine.NormalizePromo(code)
		return c, nil
	})
	return v, label, err
}

func (s *Service) RemovePromo(ctx context.Context, p auth.Principal, tripID string) (View, error) {
	return s.mutate(ctx, p, tripID, "promo", func(t *domain.Trip) (*domain.Trip, error) {
		if t.PaymentStatus != domain.PayUnpaid {
			return nil, httpx.Conflict("Promo codes can only be changed before payment.")
		}
		c := t.Clone()
		c.PromoCode = ""
		return c, nil
	})
}

func (s *Service) Delete(ctx context.Context, p auth.Principal, tripID string) error {
	if _, err := s.Authorize(ctx, p, tripID); err != nil {
		return err
	}
	return s.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		t, err := st.LockTrip(ctx, tripID)
		if err != nil {
			return err
		}
		if t.Status != domain.TripDraft {
			return httpx.Conflict("Only draft trips can be deleted.")
		}
		return st.DeleteTrip(ctx, tripID)
	})
}

type Alternatives struct {
	Item domain.TripItem      `json:"item"`
	List []engine.Alternative `json:"list"`
}

func (s *Service) Alternatives(ctx context.Context, p auth.Principal, tripID, itemID string) (Alternatives, error) {
	v, err := s.Get(ctx, p, tripID)
	if err != nil {
		return Alternatives{}, err
	}
	it := v.Trip.Item(itemID)
	if it == nil {
		return Alternatives{}, httpx.NotFound("That item is no longer in your plan.")
	}
	if it.Kind != "activity" {
		return Alternatives{}, httpx.BadRequest("Only experiences have alternatives.")
	}
	list := s.Eng.ActivityAlternatives(v.Trip, *it, 4)
	if len(list) <= 1 {
		return Alternatives{}, httpx.Unavailable("No alternatives found nearby for this slot.")
	}
	return Alternatives{Item: *it, List: list}, nil
}

func (s *Service) StayAlternatives(ctx context.Context, p auth.Principal, tripID string) ([]engine.StayAlternative, error) {
	v, err := s.Get(ctx, p, tripID)
	if err != nil {
		return nil, err
	}
	return s.Eng.StayAlternatives(v.Trip), nil
}

type Insights struct {
	Forecast  []domain.DayForecast `json:"forecast"`
	Prep      []engine.PrepItem    `json:"prep"`
	Vendors   []engine.VendorShare `json:"vendors"`
	HeartsMax int                  `json:"heartsMax"`
}

func (s *Service) Insights(ctx context.Context, p auth.Principal, tripID string) (Insights, error) {
	v, err := s.Get(ctx, p, tripID)
	if err != nil {
		return Insights{}, err
	}
	return Insights{Forecast: s.Eng.TripForecast(v.Trip), Prep: s.Eng.PrepChecklist(v.Trip), Vendors: s.Eng.VendorBreakdown(v.Trip), HeartsMax: engine.MaxHearts}, nil
}

type MoodInput struct {
	Mood   string `json:"mood"`
	Day    int    `json:"day"`
	NowMin *int   `json:"nowMin"`
}

func (s *Service) moodArgs(t *domain.Trip, in MoodInput) (int, int, error) {
	if !engine.ValidMood(in.Mood) {
		return 0, 0, httpx.BadRequest("mood must be tired, hungry, raining, late, over_budget or bored.")
	}
	if t.Status != domain.TripBooked && t.Status != domain.TripLive {
		return 0, 0, httpx.Conflict("Mood buttons work once the trip is booked.")
	}
	day := in.Day
	if day == 0 {
		day = engine.CurrentDayOf(t, s.Today())
	}
	if day < 1 || day > t.Prefs.Days() {
		return 0, 0, httpx.BadRequest("That day is not part of this trip.")
	}
	now := s.NowMin()
	if in.NowMin != nil {
		now = max(0, min(24*60-1, *in.NowMin))
	}
	return day, now, nil
}

func (s *Service) ProposeMood(ctx context.Context, p auth.Principal, tripID string, in MoodInput) (engine.MoodProposal, error) {
	v, err := s.Get(ctx, p, tripID)
	if err != nil {
		return engine.MoodProposal{}, err
	}
	day, now, err := s.moodArgs(v.Trip, in)
	if err != nil {
		return engine.MoodProposal{}, err
	}
	return s.Eng.MoodAdapt(v.Trip, in.Mood, day, now), nil
}

// AcceptMood re-computes the proposal on the latest trip and applies it with a Change Receipt.
func (s *Service) AcceptMood(ctx context.Context, p auth.Principal, tripID string, in MoodInput) (View, error) {
	owner, err := s.Authorize(ctx, p, tripID)
	if err != nil {
		return View{}, err
	}
	var out View
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		t, err := st.LockTrip(ctx, tripID)
		if err != nil {
			return err
		}
		day, now, err := s.moodArgs(t, in)
		if err != nil {
			return err
		}
		prop := s.Eng.MoodAdapt(t, in.Mood, day, now)
		next := prop.Trip
		next.Version = t.Version
		if err := st.SaveTrip(ctx, next); err != nil {
			return err
		}
		approved := []string{"You"}
		for i, v := range prop.Plan.Vendors {
			if i == 2 {
				break
			}
			approved = append(approved, s.Eng.Cat.VendorName(v))
		}
		changes := make([]domain.Change, 0, len(prop.Plan.Actions))
		for _, a := range prop.Plan.Actions {
			changes = append(changes, domain.Change{Before: a.FromLabel, After: a.ToLabel})
		}
		receipt := domain.ChangeReceipt{ID: engine.ReceiptID(), TripID: tripID, Title: "Mood: " + prop.Plan.Title, Reason: prop.Headline,
			Changes: changes, ApprovedBy: approved, CostDelta: prop.Plan.CostDelta, CreatedAt: s.Now().UTC(), PlanStrategy: "mood"}
		if err := st.InsertReceipt(ctx, receipt); err != nil {
			return err
		}
		next.Receipts = append([]domain.ChangeReceipt{receipt}, next.Receipts...)
		if prop.Plan.CostDelta != 0 {
			kind, status := "adjustment", "settled"
			if prop.Plan.CostDelta < 0 {
				kind, status = "refund", "pending"
			}
			if err := st.InsertLedger(ctx, domain.LedgerEntry{ID: s.ID("txn"), Kind: kind, Party: t.CustomerName, TripID: tripID,
				Amount: prop.Plan.CostDelta, Status: status, Method: "UPI · Razorpay", Note: receipt.ID + " · " + receipt.Title, Date: s.Now().UTC()}); err != nil {
				return err
			}
		}
		if err := s.NotifyOperators(ctx, st, ev, "trip", fmt.Sprintf("%s: traveler used “%s”", t.Code, prop.Plan.Title),
			fmt.Sprintf("%s · now %s", prop.Headline, engine.MinToTime(now)), "/ops/tours/"+tripID); err != nil {
			return err
		}
		if s.Docs != nil && next.Status != domain.TripDraft {
			docs, err := s.Docs.Issue(ctx, st, next, documents.AfterChange, "Change "+receipt.ID)
			if err != nil {
				return err
			}
			if err := s.MessageTraveler(ctx, st, ev, next, owner, fmt.Sprintf("Plan updated · %s\n%s\nChange Receipt %s · %s. Your updated itinerary and vouchers are attached.",
				next.Code, prop.Headline, receipt.ID, engine.RupeesSigned(prop.Plan.CostDelta)), docs); err != nil {
				return err
			}
			ev.Add(app.TripEvent("documents.updated", tripID, owner, map[string]any{"documents": docs}))
		}
		out = s.view(next)
		ev.Add(app.TripEvent("trip.updated", tripID, owner, map[string]any{"reason": "mood", "version": next.Version}))
		return nil
	})
	if errors.Is(err, store.ErrConflict) {
		return View{}, httpx.Conflict("This trip was just changed elsewhere. Refresh and try again.")
	}
	return out, err
}

type ReviewInput struct {
	Stars   int            `json:"stars"`
	Aspects map[string]int `json:"aspects"`
	Text    string         `json:"text"`
	// Feedback is the end-of-trip questionnaire; it teaches the Travel DNA.
	Feedback *learning.Feedback `json:"feedback"`
}

func (s *Service) Review(ctx context.Context, p auth.Principal, tripID string, in ReviewInput) (View, error) {
	if in.Stars < 1 || in.Stars > 5 {
		return View{}, httpx.BadRequest("Give between 1 and 5 stars.")
	}
	in.Text = strings.TrimSpace(in.Text)
	if len(in.Text) > 2000 {
		return View{}, httpx.BadRequest("Please keep your review under 2000 characters.")
	}
	aspects := map[string]int{}
	for k, v := range in.Aspects {
		if k = strings.TrimSpace(k); k != "" && len(aspects) < 10 && len(k) <= 30 {
			aspects[k] = max(1, min(5, v))
		}
	}
	owner, err := s.Authorize(ctx, p, tripID)
	if err != nil {
		return View{}, err
	}
	// The note is classified before the transaction (the decision layer may call an AI provider).
	var noteEvents []learning.Event
	if in.Feedback != nil && s.Learn != nil {
		noteEvents = s.Learn.NoteEvents(ctx, tripID, in.Feedback.Note)
	}
	var out View
	err = s.Tx(ctx, func(st *store.Store, ev *app.Events) error {
		t, err := st.LockTrip(ctx, tripID)
		if err != nil {
			return err
		}
		if t.Status != domain.TripLive && t.Status != domain.TripCompleted {
			return httpx.Conflict("You can review your trip once it has started.")
		}
		rv := domain.TripReview{Stars: in.Stars, Aspects: aspects, Text: in.Text, CreatedAt: s.Now().UTC()}
		if err := st.UpsertReview(ctx, tripID, rv); err != nil {
			return err
		}
		if in.Feedback != nil {
			fb := in.Feedback.Clean(t)
			if err := st.SetReviewFeedback(ctx, tripID, fb); err != nil {
				return err
			}
			if s.Learn != nil && owner != "" && !p.Operator() {
				evs := append(learning.FeedbackEvents(t, fb), noteEvents...)
				if _, err := s.Learn.Learn(ctx, st, owner, "feedback", evs); err != nil {
					return err
				}
			}
		}
		c := t.Clone()
		c.Review = &rv
		if err := st.SaveTrip(ctx, c); err != nil {
			return err
		}
		if owner != "" {
			if err := st.AddXP(ctx, owner, 60, "reviewer"); err != nil {
				return err
			}
		}
		if err := s.NotifyOperators(ctx, st, ev, "trip", fmt.Sprintf("%s reviewed · %d★", t.Code, in.Stars), trimText(in.Text, 120), "/ops/tours/"+tripID); err != nil {
			return err
		}
		out = s.view(c)
		ev.Add(app.TripEvent("trip.updated", tripID, owner, map[string]string{"reason": "reviewed"}))
		return nil
	})
	return out, err
}

// Classify reads a traveler's message ("we are stuck in traffic") into a typed need.
func (s *Service) Classify(ctx context.Context, p auth.Principal, tripID, text string) (ai.Message, error) {
	if _, err := s.Authorize(ctx, p, tripID); err != nil {
		return ai.Message{}, err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return ai.Message{}, httpx.BadRequest("Say or type what's happening.")
	}
	if len(text) > 1000 {
		text = text[:1000]
	}
	return s.AI.ClassifyMessage(ctx, text), nil
}

func trimText(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
