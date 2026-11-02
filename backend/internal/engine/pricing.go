package engine

import (
	"sort"
	"strings"

	"trizpyy/internal/domain"
)

type Promo struct {
	Code        string
	Label       string
	MinSubtotal int
	apply       func(subtotal int) int
}

var Promos = []Promo{
	{Code: "TRIZPYY10", Label: "10% off, up to ₹2,500", apply: func(s int) int { return min(2500, Round(float64(s)*0.1)) }},
	{Code: "FIRSTTRIP", Label: "₹1,000 off your first trip", MinSubtotal: 15000, apply: func(int) int { return 1000 }},
	{Code: "MONSOON500", Label: "₹500 off monsoon getaways", apply: func(int) int { return 500 }},
}

func findPromo(code string) *Promo {
	code = strings.ToUpper(strings.TrimSpace(code))
	for i := range Promos {
		if Promos[i].Code == code {
			return &Promos[i]
		}
	}
	return nil
}

// TeamUp lists popular experiences where a group deal (5% off) is unlocked.
var TeamUp = map[string]bool{
	"man-paragliding": true, "goa-grande": true, "ris-rafting": true,
	"leh-pangong": true, "hav-scuba": true, "udr-pichola": true,
}

func QtyOf(i domain.TripItem) int {
	if i.CostMode == "per-person" {
		return i.Qty
	}
	return 1
}

func ItemCost(i domain.TripItem) int {
	if i.Status == domain.ItemCancelled {
		return 0
	}
	return i.UnitCost * QtyOf(i)
}

func (e *Engine) StayTotal(t *domain.Trip) int {
	s := e.Cat.Stay(t.StayID)
	if s == nil {
		return 0
	}
	return s.NightlyPrice * RoomsFor(t.Prefs) * t.Prefs.Nights
}

func (e *Engine) PriceTrip(t *domain.Trip) domain.PriceBreakdown {
	p := t.Prefs
	travelers := p.Travelers()
	var travel, local, acts, meals, teamUpBase int
	for _, i := range t.Items {
		if !IsActive(i) {
			continue
		}
		c := ItemCost(i)
		switch {
		case TransportKinds[i.Kind]:
			travel += c
		case i.Kind == "transfer":
			local += c
		case i.Kind == "activity" || i.Kind == "rest":
			acts += c
		case i.Kind == "meal":
			meals += c
		}
		if i.RefID != "" && TeamUp[i.RefID] {
			teamUpBase += c
		}
	}
	stay := e.StayTotal(t)
	subtotal := stay + travel + local + acts + meals
	teamUp := Round(float64(teamUpBase) * 0.05)
	promo := 0
	if def := findPromo(t.PromoCode); def != nil && subtotal >= def.MinSubtotal {
		promo = def.apply(subtotal)
	}
	discounted := subtotal - teamUp - promo
	fee := min(1500, Round(float64(discounted)*0.03))
	tax := Round(float64(discounted+fee) * 0.05)
	total := discounted + fee + tax
	budget := p.BudgetPerPerson * travelers
	ratio := float64(total) / float64(max(1, budget))
	status := "over"
	if ratio <= 0.88 {
		status = "roomy"
	} else if ratio <= 1 {
		status = "on-budget"
	}
	return domain.PriceBreakdown{
		Stay: stay, Travel: travel, Local: local, Activities: acts, Meals: meals,
		Subtotal: subtotal, TeamUp: teamUp, Promo: promo, ServiceFee: fee, Tax: tax,
		Total: total, PerPerson: Round(float64(total) / float64(max(1, travelers))),
		Budget: budget, BudgetStatus: status, Travelers: travelers, Rooms: RoomsFor(p),
	}
}

// ValidatePromo returns the promo label, or a traveler-friendly error message.
func (e *Engine) ValidatePromo(code string, t *domain.Trip) (string, string) {
	def := findPromo(code)
	if def == nil {
		return "", "That code isn't valid. Try TRIZPYY10."
	}
	c := *t
	c.PromoCode = ""
	if sub := e.PriceTrip(&c).Subtotal; def.MinSubtotal > 0 && sub < def.MinSubtotal {
		return "", "Needs a trip above " + Rupees(def.MinSubtotal) + "."
	}
	return def.Label, ""
}

func NormalizePromo(code string) string { return strings.ToUpper(strings.TrimSpace(code)) }

type VendorShare struct {
	VendorID string            `json:"vendorId"`
	Items    []domain.TripItem `json:"items"`
	Amount   int               `json:"amount"`
}

func (e *Engine) VendorBreakdown(t *domain.Trip) []VendorShare {
	idx := map[string]int{}
	var rows []VendorShare
	add := func(v string) *VendorShare {
		if i, ok := idx[v]; ok {
			return &rows[i]
		}
		idx[v] = len(rows)
		rows = append(rows, VendorShare{VendorID: v, Items: []domain.TripItem{}})
		return &rows[len(rows)-1]
	}
	for _, i := range t.Items {
		if i.VendorID == "" || !IsActive(i) {
			continue
		}
		r := add(i.VendorID)
		r.Items = append(r.Items, i)
		r.Amount += ItemCost(i)
	}
	if s := e.Cat.Stay(t.StayID); s != nil {
		add(s.VendorID).Amount += e.StayTotal(t)
	}
	sort.SliceStable(rows, func(a, b int) bool { return rows[a].Amount > rows[b].Amount })
	return rows
}
