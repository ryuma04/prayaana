// Package catalog holds an indexed snapshot of reference data (destinations, experiences,
// stays, transport, vendors) used by the engine. The reference data is immutable; vendor
// trust scores are live values refreshed from real request history.
package catalog

import (
	"sync"

	"trizpyy/internal/domain"
)

type QuizOption struct {
	ID    string         `json:"id"`
	Label string         `json:"label"`
	Emoji string         `json:"emoji"`
	Hint  string         `json:"hint,omitempty"`
	Tone  string         `json:"tone"`
	Delta map[string]any `json:"delta"`
}

type QuizQuestion struct {
	ID         string       `json:"id"`
	Kind       string       `json:"kind"`
	Title      string       `json:"title"`
	Subtitle   string       `json:"subtitle,omitempty"`
	Max        int          `json:"max,omitempty"`
	Options    []QuizOption `json:"options,omitempty"`
	Trait      string       `json:"trait,omitempty"`
	Left       string       `json:"left,omitempty"`
	Right      string       `json:"right,omitempty"`
	EmojiLeft  string       `json:"emojiLeft,omitempty"`
	EmojiRight string       `json:"emojiRight,omitempty"`
}

type Data struct {
	Operator       string                   `json:"operator"`
	Destinations   []domain.Destination     `json:"destinations"`
	Activities     []domain.Activity        `json:"activities"`
	Stays          []domain.Stay            `json:"stays"`
	Transport      []domain.TransportOption `json:"transport"`
	Vendors        []domain.Vendor          `json:"vendors"`
	Team           []domain.TeamMember      `json:"team"`
	CoordinatorFor map[string]string        `json:"coordinatorFor"`
	Quiz           []QuizQuestion           `json:"quiz"`
}

type Catalog struct {
	Destinations   []domain.Destination
	Activities     []domain.Activity
	Stays          []domain.Stay
	Transport      []domain.TransportOption
	Vendors        []domain.Vendor
	Quiz           []QuizQuestion
	CoordinatorFor map[string]string

	destByID    map[string]*domain.Destination
	actByID     map[string]*domain.Activity
	actByDest   map[string][]domain.Activity
	stayByID    map[string]*domain.Stay
	staysByDest map[string][]domain.Stay
	transByID   map[string]*domain.TransportOption
	transByDest map[string][]domain.TransportOption
	vendorByID  map[string]*domain.Vendor
	cabByDest   map[string]string

	mu      sync.RWMutex
	trust   map[string]int
	ratings map[string]Rating
	paused  map[string]bool
	similar map[string]map[string]float64
}

// NewVendorTrust is the neutral score of a partner with no request history yet.
const NewVendorTrust = 80

func New(d Data) *Catalog {
	c := &Catalog{
		Destinations:   d.Destinations,
		Activities:     d.Activities,
		Stays:          d.Stays,
		Transport:      d.Transport,
		Vendors:        d.Vendors,
		Quiz:           d.Quiz,
		CoordinatorFor: d.CoordinatorFor,
		destByID:       map[string]*domain.Destination{},
		actByID:        map[string]*domain.Activity{},
		actByDest:      map[string][]domain.Activity{},
		stayByID:       map[string]*domain.Stay{},
		staysByDest:    map[string][]domain.Stay{},
		transByID:      map[string]*domain.TransportOption{},
		transByDest:    map[string][]domain.TransportOption{},
		vendorByID:     map[string]*domain.Vendor{},
		cabByDest:      map[string]string{},
		trust:          map[string]int{},
	}
	if c.CoordinatorFor == nil {
		c.CoordinatorFor = map[string]string{}
	}
	for i := range c.Destinations {
		c.destByID[c.Destinations[i].ID] = &c.Destinations[i]
	}
	for i := range c.Activities {
		a := &c.Activities[i]
		c.actByID[a.ID] = a
		c.actByDest[a.DestinationID] = append(c.actByDest[a.DestinationID], *a)
	}
	for i := range c.Stays {
		s := &c.Stays[i]
		c.stayByID[s.ID] = s
		c.staysByDest[s.DestinationID] = append(c.staysByDest[s.DestinationID], *s)
	}
	for i := range c.Transport {
		t := &c.Transport[i]
		c.transByID[t.ID] = t
		c.transByDest[t.DestinationID] = append(c.transByDest[t.DestinationID], *t)
	}
	for i := range c.Vendors {
		v := &c.Vendors[i]
		c.vendorByID[v.ID] = v
		c.trust[v.ID] = v.TrustScore
		if v.Kind == "local" && c.cabByDest[v.DestinationID] == "" {
			c.cabByDest[v.DestinationID] = v.ID
		}
	}
	return c
}

// Destination, Activity and Stay return copies that carry the live rating.
func (c *Catalog) Destination(id string) *domain.Destination {
	d := c.destByID[id]
	if d == nil {
		return nil
	}
	x := c.LiveDestination(*d)
	return &x
}

func (c *Catalog) Activity(id string) *domain.Activity {
	a := c.actByID[id]
	if a == nil {
		return nil
	}
	x := c.LiveActivity(*a)
	return &x
}

func (c *Catalog) Stay(id string) *domain.Stay {
	s := c.stayByID[id]
	if s == nil {
		return nil
	}
	x := c.LiveStay(*s)
	return &x
}

func (c *Catalog) TransportOption(id string) *domain.TransportOption {
	return c.transByID[id]
}
func (c *Catalog) Vendor(id string) *domain.Vendor { return c.vendorByID[id] }

func (c *Catalog) ActivitiesFor(dest string) []domain.Activity {
	list := c.actByDest[dest]
	out := make([]domain.Activity, len(list))
	for i, a := range list {
		out[i] = c.LiveActivity(a)
	}
	return out
}

func (c *Catalog) StaysFor(dest string) []domain.Stay {
	list := c.staysByDest[dest]
	out := make([]domain.Stay, len(list))
	for i, s := range list {
		out[i] = c.LiveStay(s)
	}
	return out
}

func (c *Catalog) TransportFor(dest string) []domain.TransportOption {
	return c.transByDest[dest]
}

// CabVendorFor is the destination's local cab partner (airport pickups, day cabs).
func (c *Catalog) CabVendorFor(dest string) string { return c.cabByDest[dest] }

func (c *Catalog) VendorName(id string) string {
	if v := c.Vendor(id); v != nil {
		return v.Name
	}
	return id
}

// TrustScore is the vendor's live trust score (see SetTrust); fallback for unknown vendors.
func (c *Catalog) TrustScore(id string, fallback int) int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if t, ok := c.trust[id]; ok && t > 0 {
		return t
	}
	return fallback
}

// SetTrust replaces the live trust scores (computed from vendor request history).
func (c *Catalog) SetTrust(scores map[string]int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for id, t := range scores {
		c.trust[id] = t
	}
}

// Rating is a real Google Maps rating for an activity or stay.
type Rating struct {
	Stars   float64 `json:"rating"`
	Reviews int     `json:"reviews"`
	PlaceID string  `json:"placeId,omitempty"`
	MapsURL string  `json:"mapsUrl,omitempty"`
}

// SetRating records a rating looked up while the server runs (stored in the database too).
func (c *Catalog) SetRating(id string, r Rating) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.ratings == nil {
		c.ratings = map[string]Rating{}
	}
	c.ratings[id] = r
}

// RatingOf is the live rating of an activity or stay (the stored value unless updated since start).
func (c *Catalog) RatingOf(id string, stored float64) float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if r, ok := c.ratings[id]; ok {
		return r.Stars
	}
	return stored
}

// LiveActivity returns a copy of the activity with its latest rating.
func (c *Catalog) LiveActivity(a domain.Activity) domain.Activity {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if r, ok := c.ratings[a.ID]; ok {
		a.Rating, a.Reviews, a.PlaceID, a.MapsURL = r.Stars, r.Reviews, r.PlaceID, r.MapsURL
	}
	return a
}

// LiveStay returns a copy of the stay with its latest rating.
func (c *Catalog) LiveStay(s domain.Stay) domain.Stay {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if r, ok := c.ratings[s.ID]; ok {
		s.Rating, s.Reviews, s.PlaceID, s.MapsURL = r.Stars, r.Reviews, r.PlaceID, r.MapsURL
	}
	return s
}

// LiveDestination returns a copy of the destination whose rating is the review-weighted
// average of its rated experiences and stays, and whose review count is their total.
func (c *Catalog) LiveDestination(d domain.Destination) domain.Destination {
	sum, n := 0.0, 0
	for _, a := range c.actByDest[d.ID] {
		a = c.LiveActivity(a)
		if a.Rating > 0 && a.Reviews > 0 {
			sum += a.Rating * float64(a.Reviews)
			n += a.Reviews
		}
	}
	for _, s := range c.staysByDest[d.ID] {
		s = c.LiveStay(s)
		if s.Rating > 0 && s.Reviews > 0 {
			sum += s.Rating * float64(s.Reviews)
			n += s.Reviews
		}
	}
	d.Rating, d.Reviews = 0, n
	if n > 0 {
		d.Rating = float64(int(sum/float64(n)*10+0.5)) / 10
	}
	return d
}

// RollUpRatings fills destination ratings from their items (called once after loading).
func (c *Catalog) RollUpRatings() {
	for i := range c.Destinations {
		c.Destinations[i] = c.LiveDestination(c.Destinations[i])
		c.destByID[c.Destinations[i].ID] = &c.Destinations[i]
	}
}

// Snapshot is the whole catalog with live ratings and trust, for the API.
func (c *Catalog) Snapshot() Data {
	d := Data{Quiz: c.Quiz, CoordinatorFor: c.CoordinatorFor}
	for _, x := range c.Destinations {
		d.Destinations = append(d.Destinations, c.LiveDestination(x))
	}
	for _, a := range c.Activities {
		d.Activities = append(d.Activities, c.LiveActivity(a))
	}
	for _, s := range c.Stays {
		d.Stays = append(d.Stays, c.LiveStay(s))
	}
	d.Transport = c.Transport
	for _, v := range c.Vendors {
		v.TrustScore = c.TrustScore(v.ID, NewVendorTrust)
		v.Available = c.Available(v.ID)
		d.Vendors = append(d.Vendors, v)
	}
	return d
}

// SetSimilarity stores semantic similarity between activities (from the AI service).
func (c *Catalog) SetSimilarity(m map[string]map[string]float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.similar = m
}

// Similarity is the semantic similarity of two activities (0–1), when the AI service provided it.
func (c *Catalog) Similarity(a, b string) (float64, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.similar[a][b]
	return v, ok
}

// Available reports whether a partner is taking bookings (the operator's switch, live).
func (c *Catalog) Available(id string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if v, ok := c.paused[id]; ok {
		return !v
	}
	if v := c.vendorByID[id]; v != nil {
		return v.Available
	}
	return true
}

// SetAvailable records the operator pausing or resuming a partner.
func (c *Catalog) SetAvailable(id string, available bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.paused == nil {
		c.paused = map[string]bool{}
	}
	c.paused[id] = !available
}
