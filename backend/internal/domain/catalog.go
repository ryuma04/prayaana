package domain

type Climate struct {
	TempC      int    `json:"tempC"`
	Condition  string `json:"condition"`
	RainChance int    `json:"rainChance"`
}

type Meal struct {
	Name           string `json:"name"`
	PricePerPerson int    `json:"pricePerPerson"`
}

type Cluster struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Lunch  Meal   `json:"lunch"`
	Dinner *Meal  `json:"dinner,omitempty"`
}

type EmergencyContact struct {
	Label string `json:"label"`
	Phone string `json:"phone"`
}

type Destination struct {
	ID              string             `json:"id"`
	Name            string             `json:"name"`
	State           string             `json:"state"`
	Tagline         string             `json:"tagline"`
	Description     string             `json:"description"`
	Art             string             `json:"art"`
	Tone            string             `json:"tone"`
	Lat             float64            `json:"lat"`
	Lng             float64            `json:"lng"`
	Rating          float64            `json:"rating"`
	Reviews         int                `json:"reviews"`
	Moods           []string           `json:"moods"`
	Interests       []string           `json:"interests"`
	BestMonths      []int              `json:"bestMonths"`
	RainyMonths     []int              `json:"rainyMonths"`
	IdealDays       string             `json:"idealDays"`
	Gateway         string             `json:"gateway"`
	FromCity        string             `json:"fromCity"`
	Climate         Climate            `json:"climate"`
	Highlights      []string           `json:"highlights"`
	Clusters        []Cluster          `json:"clusters"`
	LocalCabPerDay  int                `json:"localCabPerDay"`
	AirportTransfer int                `json:"airportTransfer"`
	Languages       []string           `json:"languages"`
	Emergency       []EmergencyContact `json:"emergency"`
}

func (d *Destination) ClusterByID(id string) *Cluster {
	for i := range d.Clusters {
		if d.Clusters[i].ID == id {
			return &d.Clusters[i]
		}
	}
	return nil
}

type Activity struct {
	ID            string   `json:"id"`
	DestinationID string   `json:"destinationId"`
	Cluster       string   `json:"cluster"`
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Interests     []string `json:"interests"`
	DurationMin   int      `json:"durationMin"`
	Price         int      `json:"price"`
	Energy        int      `json:"energy"`
	Outdoor       bool     `json:"outdoor"`
	Slot          string   `json:"slot"`
	Rating        float64  `json:"rating"`
	Reviews       int      `json:"reviews"`
	VendorID      string   `json:"vendorId"`
	Lat           float64  `json:"lat"`
	Lng           float64  `json:"lng"`
	KidFriendly   bool     `json:"kidFriendly"`
	Walking       string   `json:"walking"`
	Icon          string   `json:"icon"`
	Tone          string   `json:"tone"`
	BackupID      string   `json:"backupId,omitempty"`
	AltVendorID   string   `json:"altVendorId,omitempty"`
	// Google Maps listing: rating and reviews above are real Google numbers once looked up (0 = not rated yet).
	PlaceID string `json:"placeId,omitempty"`
	MapsURL string `json:"mapsUrl,omitempty"`
}

type Stay struct {
	ID            string   `json:"id"`
	DestinationID string   `json:"destinationId"`
	Name          string   `json:"name"`
	Type          string   `json:"type"`
	NightlyPrice  int      `json:"nightlyPrice"`
	Rating        float64  `json:"rating"`
	Reviews       int      `json:"reviews"`
	VendorID      string   `json:"vendorId"`
	Area          string   `json:"area"`
	Amenities     []string `json:"amenities"`
	Tone          string   `json:"tone"`
	Lat           float64  `json:"lat"`
	Lng           float64  `json:"lng"`
	PlaceID       string   `json:"placeId,omitempty"`
	MapsURL       string   `json:"mapsUrl,omitempty"`
}

type TransportOption struct {
	ID             string `json:"id"`
	DestinationID  string `json:"destinationId"`
	Mode           string `json:"mode"`
	Label          string `json:"label"`
	From           string `json:"from"`
	PricePerPerson int    `json:"pricePerPerson"`
	DurationMin    int    `json:"durationMin"`
	Departs        string `json:"departs"`
	VendorID       string `json:"vendorId"`
}

type VendorMonth struct {
	Month    string `json:"month"`
	Bookings int    `json:"bookings"`
	Declines int    `json:"declines"`
	ReplyMin int    `json:"replyMin"`
}

// Vendor is a partner (stay, activity, transport, local cabs). Contact details are entered
// by the operator; every number below the contact block is computed from real requests.
type Vendor struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Kind          string `json:"kind"`
	DestinationID string `json:"destinationId"`
	ContactName   string `json:"contactName"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Language      string `json:"language"`
	Available     bool   `json:"available"`

	Requests             int           `json:"requests"` // answered or expired requests in the last 180 days
	ResponseRate         int           `json:"responseRate"`
	AvgReplyMin          int           `json:"avgReplyMin"`
	CancellationRate     float64       `json:"cancellationRate"` // share of requests declined or left unanswered
	Rating               float64       `json:"rating"`           // average traveler stars on trips with this vendor (0 = none yet)
	TrustScore           int           `json:"trustScore"`
	ActiveBookings       int           `json:"activeBookings"`
	PendingConfirmations int           `json:"pendingConfirmations"`
	History              []VendorMonth `json:"history"`
}

type DestinationReview struct {
	Name  string `json:"name"`
	City  string `json:"city"`
	Stars int    `json:"stars"`
	When  string `json:"when"`
	Text  string `json:"text"`
	Trip  string `json:"trip"`
}
