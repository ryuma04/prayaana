package documents

import (
	"bytes"
	"testing"
	"time"

	"trizpyy/internal/domain"
	"trizpyy/internal/store"
)

func sample() Data {
	lat, lng := 12.42, 75.73
	paid := time.Date(2026, 9, 26, 10, 30, 0, 0, time.UTC)
	t := &domain.Trip{ID: "trip-1", Code: "TRZ-2071", Title: "Coorg · 5 days of misty hills", DestinationID: "coorg", StayID: "st-1",
		Prefs: domain.TripPreferences{StartDate: "2026-09-27", Nights: 4, Adults: 2, Kids: 1, Pace: "balanced"}, Status: domain.TripBooked,
		PaymentStatus: domain.PayPaid, CustomerName: "Rahul Sharma", GroupName: "Sharma family",
		Items: []domain.TripItem{
			{ID: "i1", Day: 1, Kind: "flight", Title: "KSRTC FlyBus · BLR → Madikeri", StartMin: 430, DurationMin: 180, VendorID: "v1"},
			{ID: "i2", Day: 1, Kind: "activity", Title: "Abbey Falls Trail ✨", Place: "Madikeri", StartMin: 900, DurationMin: 90, Hearted: true, VendorID: "v2", Lat: &lat, Lng: &lng},
			{ID: "i3", Day: 2, Kind: "activity", Title: "Cancelled thing", Status: domain.ItemCancelled},
		},
		Receipts: []domain.ChangeReceipt{{ID: "CR-1", Title: "Rain swap", CostDelta: -640, ApprovedBy: []string{"You", "Kodagu Eco-Trek Guides"}, CreatedAt: paid}},
	}
	vendors := map[string]*domain.Vendor{"v1": {ID: "v1", Name: "KSRTC", ContactName: "Desk", Phone: "+91 80 2222"}, "v2": {ID: "v2", Name: "Coorg Nature Guides", ContactName: "Bopanna", Phone: "+91 98450"}}
	return Data{
		Trip: t, Price: domain.PriceBreakdown{Stay: 24000, Travel: 38400, Local: 9000, Activities: 6200, Subtotal: 77600, Promo: 1000, ServiceFee: 1500, Tax: 3900, Total: 82000, PerPerson: 27333, Travelers: 3, Rooms: 2},
		Destination: &domain.Destination{ID: "coorg", Name: "Coorg", State: "Karnataka", Emergency: []domain.EmergencyContact{{Label: "Police", Phone: "112"}}},
		Stay:        &domain.Stay{Name: "Evolve Back Chikkana Halli Estate", Area: "Madikeri"},
		Transport:   &domain.TransportOption{Label: "KSRTC FlyBus · BLR → Madikeri"},
		Contact:     store.Contact{Name: "Rahul Sharma", Email: "rahul@example.com", Phone: "+91 98765 43210"},
		Payment:     &store.Payment{Provider: "simulated", Amount: 82000, Method: "upi", PaymentRef: "pay_SIM123", PaidAt: &paid},
		Bookings: []domain.Booking{{ID: "BK-2071-10", VendorID: "v1", ItemID: "i1", ItemTitle: "Bus", Status: "confirmed", Day: 1, Amount: 38400},
			{ID: "BK-2071-11", VendorID: "v2", ItemID: "i2", ItemTitle: "Abbey Falls Trail", Status: "requested", Day: 1, Amount: 1200}},
		Forecast: []domain.DayForecast{{Condition: "sunny", TempC: 21, RainChance: 10, Source: "open-meteo"}},
		Vendor:   func(id string) *domain.Vendor { return vendors[id] },
		Operator: "Saffron Trails", IssuedAt: paid, Location: time.UTC, Version: 1,
	}
}

func TestEveryDocumentRendersAValidPDF(t *testing.T) {
	d := sample()
	for kind, render := range renderers {
		pdf, err := render(d)
		if err != nil {
			t.Fatalf("%s: %v", kind, err)
		}
		if !bytes.HasPrefix(pdf, []byte("%PDF-")) || !bytes.Contains(pdf[len(pdf)-32:], []byte("%%EOF")) || len(pdf) < 1500 {
			t.Fatalf("%s: not a complete PDF (%d bytes)", kind, len(pdf))
		}
	}
}

func TestDocumentsRenderWithoutPaymentOrBookings(t *testing.T) {
	d := sample()
	d.Payment, d.Bookings, d.Forecast = nil, nil, nil
	for kind, render := range renderers {
		if _, err := render(d); err != nil {
			t.Fatalf("%s: %v", kind, err)
		}
	}
}

func TestRenderingIsDeterministic(t *testing.T) {
	a, _ := Invoice(sample())
	b, _ := Invoice(sample())
	if !bytes.Equal(a, b) {
		t.Fatal("same data should produce the same invoice bytes")
	}
}

func TestCleanKeepsTextPrintable(t *testing.T) {
	if got := clean("₹1,240 · Mysuru → Bengaluru ✅ café"); got != "Rs 1,240 · Mysuru to Bengaluru  café" {
		t.Fatalf("clean = %q", got)
	}
}
