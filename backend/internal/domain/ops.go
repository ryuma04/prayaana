package domain

import "time"

const (
	RoleTraveler = "traveler"
	RoleOperator = "operator"
	// RoleSuperAdmin runs the platform (guide verification, account suspension). Its one
	// login comes from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD on the server.
	RoleSuperAdmin = "super_admin"
)

type User struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	OperatorID    string    `json:"operatorId,omitempty"`
	Phone         string    `json:"phone,omitempty"`
	AvatarTone    string    `json:"avatarTone"`
	EmailVerified bool      `json:"emailVerified"`
	CreatedAt     time.Time `json:"createdAt"`
}

type Customer struct {
	ID     string   `json:"id"`
	UserID string   `json:"userId,omitempty"`
	Name   string   `json:"name"`
	City   string   `json:"city"`
	Email  string   `json:"email"`
	Phone  string   `json:"phone"`
	Since  string   `json:"since"`
	DNA    string   `json:"dnaName"`
	Trips  int      `json:"trips"`
	LTV    int      `json:"ltv"`
	Tone   string   `json:"tone"`
	Tags   []string `json:"tags"`
}

type TeamMember struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Role      string   `json:"role"`
	Region    string   `json:"region"`
	Phone     string   `json:"phone"`
	Languages []string `json:"languages"`
	Status    string   `json:"status"`
	Rating    float64  `json:"rating"`
	Tone      string   `json:"tone"`
}

type Booking struct {
	ID           string    `json:"id"`
	TripID       string    `json:"tripId"`
	ItemID       string    `json:"itemId"`
	ItemTitle    string    `json:"itemTitle"`
	VendorID     string    `json:"vendorId"`
	CustomerName string    `json:"customerName"`
	Status       string    `json:"status"`
	Amount       int       `json:"amount"`
	Day          int       `json:"day"`
	Date         string    `json:"date"`
	Channel      string    `json:"channel"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type LedgerEntry struct {
	ID     string    `json:"id"`
	Kind   string    `json:"kind"`
	Party  string    `json:"party"`
	TripID string    `json:"tripId"`
	Amount int       `json:"amount"`
	Status string    `json:"status"`
	Date   time.Time `json:"date"`
	Method string    `json:"method"`
	Note   string    `json:"note"`
}

type Attachment struct {
	Name string `json:"name"`
	Size string `json:"size"`
	// DocID links a trip document (PDF) posted in the trip chat.
	DocID string `json:"docId,omitempty"`
}

// Document is an issued trip PDF (the bytes live in the database, not in JSON).
type Document struct {
	ID        string    `json:"id"`
	TripID    string    `json:"tripId"`
	Kind      string    `json:"kind"` // confirmation, invoice, itinerary, voucher
	Title     string    `json:"title"`
	FileName  string    `json:"fileName"`
	Version   int       `json:"version"`
	Reason    string    `json:"reason"`
	SizeBytes int       `json:"sizeBytes"`
	SHA256    string    `json:"sha256"`
	CreatedAt time.Time `json:"createdAt"`
	Latest    bool      `json:"latest"`
}

type InboxMessage struct {
	ID         string      `json:"id"`
	From       string      `json:"from"`
	Type       string      `json:"type"`
	Body       string      `json:"body"`
	Transcript string      `json:"transcript,omitempty"`
	Decision   string      `json:"decision,omitempty"`
	Confidence *float64    `json:"confidence,omitempty"`
	Attachment *Attachment `json:"attachment,omitempty"`
	At         time.Time   `json:"at"`
	Status     string      `json:"status,omitempty"`
}

type InboxThread struct {
	ID       string         `json:"id"`
	Party    string         `json:"party"`
	Name     string         `json:"name"`
	Subtitle string         `json:"subtitle"`
	TripID   string         `json:"tripId,omitempty"`
	VendorID string         `json:"vendorId,omitempty"`
	Unread   int            `json:"unread"`
	Messages []InboxMessage `json:"messages"`
	Tone     string         `json:"tone"`
}

type CrowdReport struct {
	ID            string    `json:"id"`
	Place         string    `json:"place"`
	DestinationID string    `json:"destinationId"`
	Type          string    `json:"type"`
	Text          string    `json:"text"`
	Reporter      string    `json:"reporter"`
	ReporterRole  string    `json:"reporterRole"`
	CreatedAt     time.Time `json:"createdAt"`
	Verified      bool      `json:"verified"`
	Confirmations int       `json:"confirmations"`
	AffectedTrips []string  `json:"affectedTrips"`
}

type EarlyWarning struct {
	ID         string    `json:"id"`
	TripID     string    `json:"tripId"`
	Title      string    `json:"title"`
	Detail     string    `json:"detail"`
	EtaLateMin int       `json:"etaLateMin"`
	CreatedAt  time.Time `json:"createdAt"`
	Status     string    `json:"status"`
}

type Notification struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Href      string    `json:"href,omitempty"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"createdAt"`
	Audience  string    `json:"audience"`
}

type DNATraits struct {
	Adventure int `json:"adventure"`
	Nature    int `json:"nature"`
	Culture   int `json:"culture"`
	Food      int `json:"food"`
	Luxury    int `json:"luxury"`
	Social    int `json:"social"`
}

type TravelDNA struct {
	Traits  DNATraits `json:"traits"`
	Name    string    `json:"name"`
	Emoji   string    `json:"emoji"`
	Summary string    `json:"summary"`
	Pace    string    `json:"pace"`
	Rhythm  string    `json:"rhythm"`
}
