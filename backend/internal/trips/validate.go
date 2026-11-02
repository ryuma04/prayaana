package trips

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/platform/httpx"
)

var (
	stayTypes = []string{"hostel", "budget", "boutique", "homestay", "luxury"}
	modes     = []string{"flight", "train", "bus", "car"}
	paces     = []string{"relaxed", "balanced", "packed"}
	rhythms   = []string{"early-bird", "night-owl"}
	interests = []string{"nature", "adventure", "culture", "food", "luxury", "social", "relax", "photo"}
)

func oneOf(v string, allowed []string) bool {
	for _, a := range allowed {
		if a == v {
			return true
		}
	}
	return false
}

// normalizePrefs fills defaults and rejects anything the planner cannot honour.
func normalizePrefs(p domain.TripPreferences, eng *engine.Engine, today string) (domain.TripPreferences, error) {
	p.DestinationID = strings.TrimSpace(p.DestinationID)
	if p.DestinationID == "" && len(p.Destinations) > 0 {
		p.DestinationID = p.Destinations[0]
	}
	if len(p.Destinations) == 0 && p.DestinationID != "" {
		p.Destinations = []string{p.DestinationID}
	}
	if eng.ResolveDestination(p.DestinationID, p) == nil {
		return p, httpx.BadRequest("Pick a destination from the list.")
	}
	for _, d := range p.Destinations {
		if eng.ResolveDestination(d, p) == nil {
			return p, httpx.BadRequest(fmt.Sprintf("Unknown destination: %s", d))
		}
	}
	if p.StartDate == "" {
		p.StartDate = engine.AddDays(today, 14)
	}
	if !engine.ValidISODate(p.StartDate) {
		return p, httpx.BadRequest("Start date must look like 2026-10-12.")
	}
	if d := engine.DaysBetween(today, p.StartDate); d < -1 || d > 400 {
		return p, httpx.BadRequest("Start date must be between today and about a year from now.")
	}
	if p.Nights == 0 {
		p.Nights = 4
	}
	if p.Nights < 1 || p.Nights > 14 {
		return p, httpx.BadRequest("Trips can be 1 to 14 nights.")
	}
	if len(p.DestinationDays) > 0 {
		sum := 0
		for _, count := range p.DestinationDays {
			sum += count
		}
		if sum != p.Days() {
			return p, httpx.BadRequest("Allocated days must equal total trip duration.")
		}
	}
	if len(p.DestinationAllocations) > 0 {
		sum := 0
		for _, alloc := range p.DestinationAllocations {
			sum += alloc.Days
		}
		if sum != p.Days() {
			return p, httpx.BadRequest("Allocated days must equal total trip duration.")
		}
	}
	if p.Adults == 0 && p.Kids == 0 {
		p.Adults = 2
	}
	if p.Adults < 1 || p.Kids < 0 || p.Adults+p.Kids > 60 {
		return p, httpx.BadRequest("Travelers must be 1 to 60 with at least one adult.")
	}
	if p.BudgetPerPerson == 0 {
		p.BudgetPerPerson = 30000
	}
	if p.BudgetPerPerson < 1000 || p.BudgetPerPerson > 5_000_000 {
		return p, httpx.BadRequest("Budget per person must be between ₹1,000 and ₹50,00,000.")
	}
	if p.StayType == "" {
		p.StayType = "boutique"
	}
	if !oneOf(p.StayType, stayTypes) {
		return p, httpx.BadRequest("Stay type must be hostel, budget, homestay, boutique or luxury.")
	}
	if p.Transport == "" {
		p.Transport = "bus"
	}
	if !oneOf(p.Transport, modes) {
		return p, httpx.BadRequest("Transport must be flight, train, bus or car.")
	}
	if p.Pace == "" {
		p.Pace = "balanced"
	}
	if !oneOf(p.Pace, paces) {
		return p, httpx.BadRequest("Pace must be relaxed, balanced or packed.")
	}
	if p.Rhythm == "" {
		p.Rhythm = "early-bird"
	}
	if !oneOf(p.Rhythm, rhythms) {
		return p, httpx.BadRequest("Rhythm must be early-bird or night-owl.")
	}
	var clean []string
	for _, i := range p.Interests {
		if oneOf(i, interests) && !oneOf(i, clean) {
			clean = append(clean, i)
		}
	}
	p.Interests = clean
	if p.Interests == nil {
		p.Interests = []string{}
	}
	var special []string
	for _, s := range p.Special {
		s = strings.TrimSpace(s)
		if s != "" && utf8.RuneCountInString(s) <= 40 && len(special) < 10 {
			special = append(special, s)
		}
	}
	p.Special = special
	if p.Special == nil {
		p.Special = []string{}
	}
	p.OwnWords = strings.TrimSpace(p.OwnWords)
	if utf8.RuneCountInString(p.OwnWords) > 600 {
		return p, httpx.BadRequest("Please keep your trip description under 600 characters.")
	}
	p.FromCity = strings.TrimSpace(p.FromCity)
	if len(p.FromCity) > 60 {
		p.FromCity = p.FromCity[:60]
	}
	return p, nil
}
