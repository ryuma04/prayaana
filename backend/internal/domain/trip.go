package domain

import "time"

const (
	TripDraft     = "draft"
	TripBooked    = "booked"
	TripLive      = "live"
	TripCompleted = "completed"

	PayUnpaid   = "unpaid"
	PayPaid     = "paid"
	PayRefunded = "refunded"
	PayPartial  = "partial"

	ItemPlanned   = "planned"
	ItemConfirmed = "confirmed"
	ItemDone      = "done"
	ItemLive      = "live"
	ItemChanged   = "changed"
	ItemCancelled = "cancelled"
)

type TripItem struct {
	ID          string   `json:"id"`
	Day         int      `json:"day"`
	Date        string   `json:"date,omitempty"`
	Kind        string   `json:"kind"`
	RefID       string   `json:"refId,omitempty"`
	Title       string   `json:"title"`
	Subtitle    string   `json:"subtitle"`
	Place       string   `json:"place"`
	Location    string   `json:"location,omitempty"`
	StartMin    int      `json:"startMin"`
	DurationMin int      `json:"durationMin"`
	StartTime   string   `json:"startTime,omitempty"`
	EndTime     string   `json:"endTime,omitempty"`
	UnitCost    int      `json:"unitCost"`
	Qty         int      `json:"qty"`
	CostMode    string   `json:"costMode"`
	Hearted     bool     `json:"hearted"`
	VendorID    string   `json:"vendorId,omitempty"`
	Outdoor     bool     `json:"outdoor"`
	Energy      int      `json:"energy"`
	Status      string   `json:"status"`
	DependsOn   []string `json:"dependsOn"`
	BufferMin   int      `json:"bufferMin"`
	Lat         *float64 `json:"lat,omitempty"`
	Lng         *float64 `json:"lng,omitempty"`
	Icon        string   `json:"icon"`
	Tone        string   `json:"tone"`
	Note        string   `json:"note,omitempty"`
}

func (i TripItem) End() int { return i.StartMin + i.DurationMin }

func (i TripItem) HasPoint() bool { return i.Lat != nil && i.Lng != nil }

type PlaceIdentity struct {
	PlaceID          string  `json:"placeId"`
	Name             string  `json:"name"`
	FormattedAddress string  `json:"formattedAddress,omitempty"`
	Lat              float64 `json:"lat"`
	Lng              float64 `json:"lng"`
	City             string  `json:"city,omitempty"`
	State            string  `json:"state,omitempty"`
	Country          string  `json:"country,omitempty"`
}

type DestinationAllocation struct {
	DestinationID string  `json:"destinationId"`
	Days          int     `json:"days"`
	StartDay      int     `json:"startDay"`
	EndDay        int     `json:"endDay"`
	PlaceName     string  `json:"placeName,omitempty"`
	Lat           float64 `json:"lat,omitempty"`
	Lng           float64 `json:"lng,omitempty"`
}

type TripPreferences struct {
	DestinationID          string                  `json:"destinationId"`
	Destinations           []string                `json:"destinations,omitempty"`
	DestinationDays        map[string]int          `json:"destinationDays,omitempty"`
	DestinationAllocations []DestinationAllocation `json:"destinationAllocations,omitempty"`
	OriginPlace            *PlaceIdentity          `json:"originPlace,omitempty"`
	DestinationPlaces      []PlaceIdentity         `json:"destinationPlaces,omitempty"`
	StartDate              string                  `json:"startDate"`
	Nights                 int                     `json:"nights"`
	Adults                 int                     `json:"adults"`
	Kids                   int                     `json:"kids"`
	BudgetPerPerson        int                     `json:"budgetPerPerson"`
	StayType               string                  `json:"stayType"`
	Transport              string                  `json:"transport"`
	Interests              []string                `json:"interests"`
	Pace                   string                  `json:"pace"`
	Rhythm                 string                  `json:"rhythm"`
	Special                []string                `json:"special"`
	OwnWords               string                  `json:"ownWords"`
	FromCity               string                  `json:"fromCity"`
}

func (p TripPreferences) Travelers() int { return p.Adults + p.Kids }

func (p TripPreferences) Days() int { return p.Nights + 1 }

func (p TripPreferences) Budget() int { return p.BudgetPerPerson * p.Travelers() }

type Change struct {
	Before string `json:"before"`
	After  string `json:"after"`
}

type ChangeReceipt struct {
	ID           string    `json:"id"`
	TripID       string    `json:"tripId"`
	Title        string    `json:"title"`
	Reason       string    `json:"reason"`
	Changes      []Change  `json:"changes"`
	ApprovedBy   []string  `json:"approvedBy"`
	CostDelta    int       `json:"costDelta"`
	CreatedAt    time.Time `json:"createdAt"`
	PlanStrategy string    `json:"planStrategy,omitempty"`
}

type TripReview struct {
	Stars     int            `json:"stars"`
	Aspects   map[string]int `json:"aspects"`
	Text      string         `json:"text"`
	CreatedAt time.Time      `json:"createdAt"`
}

type Optimized struct {
	SavedMin     int `json:"savedMin"`
	MovedOutdoor int `json:"movedOutdoor"`
}

type Trip struct {
	ID               string                  `json:"id"`
	Code             string                  `json:"code"`
	Title            string                  `json:"title"`
	DestinationID    string                  `json:"destinationId"`
	Destinations     []string                `json:"destinations,omitempty"`
	Allocations      []DestinationAllocation `json:"allocations,omitempty"`
	OriginPlace      *PlaceIdentity          `json:"originPlace,omitempty"`
	Prefs            TripPreferences         `json:"prefs"`
	StayID           string                  `json:"stayId"`
	TransportID      string                  `json:"transportId"`
	Items            []TripItem              `json:"items"`
	Status           string                  `json:"status"`
	PaymentStatus    string                  `json:"paymentStatus"`
	PromoCode        string                  `json:"promoCode,omitempty"`
	CreatedAt        time.Time               `json:"createdAt"`
	BookedAt         *time.Time              `json:"bookedAt,omitempty"`
	Receipts         []ChangeReceipt         `json:"receipts"`
	CoordinatorID    string                  `json:"coordinatorId"`
	CustomerID       string                  `json:"customerId"`
	CustomerName     string                  `json:"customerName"`
	GroupName        string                  `json:"groupName"`
	CurrentDay       *int                    `json:"currentDay,omitempty"`
	WeatherOverrides map[int]string          `json:"weatherOverrides,omitempty"`
	Review           *TripReview             `json:"review,omitempty"`
	Optimized        *Optimized              `json:"optimized,omitempty"`
	Version          int                     `json:"version"`
}

func (t *Trip) Item(id string) *TripItem {
	for i := range t.Items {
		if t.Items[i].ID == id {
			return &t.Items[i]
		}
	}
	return nil
}

// Clone returns a deep copy so engine functions never mutate the caller's trip.
func (t *Trip) Clone() *Trip {
	c := *t
	c.Items = CloneItems(t.Items)
	// Non-nil copies so empty lists stay [] in JSON, never null.
	c.Prefs.Interests = append([]string{}, t.Prefs.Interests...)
	c.Prefs.Special = append([]string{}, t.Prefs.Special...)
	c.Receipts = append([]ChangeReceipt{}, t.Receipts...)
	if t.WeatherOverrides != nil {
		c.WeatherOverrides = make(map[int]string, len(t.WeatherOverrides))
		for k, v := range t.WeatherOverrides {
			c.WeatherOverrides[k] = v
		}
	}
	if t.CurrentDay != nil {
		d := *t.CurrentDay
		c.CurrentDay = &d
	}
	return &c
}

func CloneItems(items []TripItem) []TripItem {
	out := make([]TripItem, len(items))
	for i, it := range items {
		it.DependsOn = append([]string{}, it.DependsOn...)
		out[i] = it
	}
	return out
}

type PriceBreakdown struct {
	Stay         int    `json:"stay"`
	Travel       int    `json:"travel"`
	Local        int    `json:"local"`
	Activities   int    `json:"activities"`
	Meals        int    `json:"meals"`
	Subtotal     int    `json:"subtotal"`
	TeamUp       int    `json:"teamUp"`
	Promo        int    `json:"promo"`
	ServiceFee   int    `json:"serviceFee"`
	Tax          int    `json:"tax"`
	Total        int    `json:"total"`
	PerPerson    int    `json:"perPerson"`
	Budget       int    `json:"budget"`
	BudgetStatus string `json:"budgetStatus"`
	Travelers    int    `json:"travelers"`
	Rooms        int    `json:"rooms"`
}

type DayForecast struct {
	Day        int    `json:"day"`
	TempC      int    `json:"tempC"`
	Condition  string `json:"condition"`
	RainChance int    `json:"rainChance"`
	// Source is "open-meteo" for a live forecast; empty means the climate model.
	Source string `json:"source,omitempty"`
}
