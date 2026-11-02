package documents

import (
	"bytes"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-pdf/fpdf"

	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/store"
)

// Data is everything a trip document shows. It is gathered once per issue.
type Data struct {
	Trip        *domain.Trip
	Price       domain.PriceBreakdown
	Destination *domain.Destination
	Stay        *domain.Stay
	Transport   *domain.TransportOption
	Contact     store.Contact
	Payment     *store.Payment
	Bookings    []domain.Booking
	Coordinator *domain.TeamMember
	Forecast    []domain.DayForecast
	Vendor      func(id string) *domain.Vendor
	Operator    string
	IssuedAt    time.Time
	Location    *time.Location
	Version     int
}

var (
	ink    = [3]int{28, 27, 43}
	muted  = [3]int{110, 107, 130}
	purple = [3]int{123, 92, 240}
	lav    = [3]int{236, 229, 254}
	mint   = [3]int{227, 241, 212}
	line   = [3]int{222, 220, 232}
)

// clean maps text to the PDF core fonts' Windows-1252 range.
func clean(s string) string {
	r := strings.NewReplacer("₹", "Rs ", "→", "to", "←", "from", "✓", "v", "✔", "v", "×", "x", "≈", "~", " ", " ")
	s = r.Replace(s)
	var b strings.Builder
	for _, c := range s {
		switch {
		case c < 0x80, c >= 0xA0 && c <= 0xFF:
			b.WriteRune(c)
		case strings.ContainsRune("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”• to,˜™š›œžŸ", c):
			b.WriteRune(c)
		case c == utf8.RuneError:
		default:
			// emoji and other symbols are dropped
		}
	}
	return strings.TrimSpace(b.String())
}

func rupees(n int) string { return strings.Replace(engine.Rupees(n), "₹", "Rs ", 1) }

type doc struct {
	*fpdf.Fpdf
	tr func(string) string
}

func newDoc(title, subtitle string, d Data) *doc {
	p := fpdf.New("P", "mm", "A4", "")
	p.SetMargins(15, 16, 15)
	p.SetAutoPageBreak(true, 18)
	p.SetTitle(title, true)
	p.SetAuthor("Trizpyy", true)
	p.SetCreator("Trizpyy API", true)
	p.SetCreationDate(d.IssuedAt)
	p.SetModificationDate(d.IssuedAt)
	p.SetCatalogSort(true)
	dd := &doc{Fpdf: p, tr: p.UnicodeTranslatorFromDescriptor("")}
	issued := d.IssuedAt.In(d.Location).Format("2 Jan 2006, 3:04 PM")
	p.SetFooterFunc(func() {
		p.SetY(-12)
		dd.font("", 7.5, muted)
		p.CellFormat(0, 4, dd.t(fmt.Sprintf("%s · %s · version %d · issued %s · page %d", d.Trip.Code, title, d.Version, issued, p.PageNo())),
			"", 0, "C", false, 0, "")
	})
	p.AddPage()
	// Brand band
	dd.fill(purple)
	p.Rect(0, 0, 210, 26, "F")
	p.SetXY(15, 7)
	dd.font("B", 18, [3]int{255, 255, 255})
	p.CellFormat(90, 8, "Trizpyy", "", 0, "L", false, 0, "")
	dd.font("", 9, [3]int{255, 255, 255})
	p.CellFormat(90, 8, dd.t(d.Operator), "", 1, "R", false, 0, "")
	p.SetX(15)
	p.CellFormat(90, 5, dd.t("Plan your own trip. We handle the changes."), "", 0, "L", false, 0, "")
	p.CellFormat(90, 5, dd.t("Trip "+d.Trip.Code), "", 1, "R", false, 0, "")
	p.SetY(33)
	dd.font("B", 16, ink)
	p.CellFormat(0, 8, dd.t(title), "", 1, "L", false, 0, "")
	if subtitle != "" {
		dd.font("", 10, muted)
		p.MultiCell(0, 5, dd.t(subtitle), "", "L", false)
	}
	p.Ln(3)
	return dd
}

func (d *doc) t(s string) string { return d.tr(clean(s)) }

func (d *doc) font(style string, size float64, c [3]int) {
	d.SetFont("Helvetica", style, size)
	d.SetTextColor(c[0], c[1], c[2])
}

func (d *doc) fill(c [3]int) { d.SetFillColor(c[0], c[1], c[2]) }

func (d *doc) section(title string) {
	d.Ln(2)
	d.font("B", 11, purple)
	d.CellFormat(0, 7, d.t(title), "B", 1, "L", false, 0, "")
	d.Ln(1.5)
}

// facts prints label/value pairs in two columns.
func (d *doc) facts(all [][2]string) {
	pairs := make([][2]string, 0, len(all))
	for _, kv := range all {
		if strings.TrimSpace(kv[1]) != "" {
			pairs = append(pairs, kv)
		}
	}
	for i, kv := range pairs {
		x := 15.0
		if i%2 == 1 {
			x = 108
		}
		if i%2 == 0 && d.GetY() > 265 {
			d.AddPage()
		}
		y := d.GetY()
		d.SetXY(x, y)
		d.font("", 8, muted)
		d.CellFormat(87, 4, d.t(kv[0]), "", 2, "L", false, 0, "")
		d.SetX(x)
		d.font("B", 10, ink)
		d.CellFormat(87, 5.5, d.t(fitAt(kv[1], 87, 2.05)), "", 0, "L", false, 0, "")
		if i%2 == 1 || i == len(pairs)-1 {
			d.SetXY(15, y+11)
		} else {
			d.SetXY(15, y)
		}
	}
}

type column struct {
	title string
	width float64
	align string
}

func (d *doc) table(cols []column, rows [][]string) {
	head := func() {
		d.fill(lav)
		d.font("B", 8.5, ink)
		for _, c := range cols {
			d.CellFormat(c.width, 7, d.t(c.title), "", 0, c.align, true, 0, "")
		}
		d.Ln(-1)
	}
	head()
	d.SetDrawColor(line[0], line[1], line[2])
	for _, r := range rows {
		if d.GetY() > 268 {
			d.AddPage()
			head()
		}
		d.font("", 9, ink)
		for i, c := range cols {
			v := ""
			if i < len(r) {
				v = r[i]
			}
			d.CellFormat(c.width, 6.5, d.t(fit(v, c.width)), "B", 0, c.align, false, 0, "")
		}
		d.Ln(-1)
	}
}

// fit trims text to roughly what a column of this width holds at 9pt.
func fit(s string, width float64) string { return fitAt(s, width, 1.85) }

// fitAt trims text for a column, given the average glyph width in mm.
func fitAt(s string, width, glyph float64) string {
	n := int(width / glyph)
	r := []rune(s)
	if len(r) <= n || n < 4 {
		return s
	}
	return string(r[:n-1]) + "…"
}

func (d *doc) bytes() ([]byte, error) {
	var buf bytes.Buffer
	if err := d.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func tripDates(t *domain.Trip) string {
	end := engine.AddDays(t.Prefs.StartDate, t.Prefs.Nights)
	return fmt.Sprintf("%s to %s (%d nights)", engine.DayDate(t.Prefs.StartDate, 1), engine.DayDate(end, 1)+" "+end[:4], t.Prefs.Nights)
}

func travelers(p domain.TripPreferences) string {
	s := fmt.Sprintf("%d adult%s", p.Adults, plural(p.Adults))
	if p.Kids > 0 {
		s += fmt.Sprintf(", %d kid%s", p.Kids, plural(p.Kids))
	}
	return s
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

// paymentFacts describes the payment honestly, including whether it was a test checkout.
func paymentFacts(p *store.Payment, loc *time.Location) [][2]string {
	if p == nil {
		return [][2]string{{"Status", "Not paid yet"}}
	}
	how := "Razorpay"
	if p.Provider == "simulated" {
		how = "Test checkout (no real money)"
	}
	method := map[string]string{"upi": "UPI", "card": "Card", "netbanking": "Netbanking", "wallet": "Wallet", "emi": "EMI", "paylater": "Pay later"}[p.Method]
	if method == "" {
		method = "Online"
	}
	when := ""
	if p.PaidAt != nil {
		when = p.PaidAt.In(loc).Format("2 Jan 2006, 3:04 PM")
	}
	return [][2]string{{"Paid", rupees(p.Amount) + " · " + method}, {"Paid through", how},
		{"Payment reference", p.PaymentRef}, {"Paid on", when}}
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

func statusLabel(s string) string {
	switch s {
	case "confirmed":
		return "Confirmed"
	case "requested":
		return "Awaiting vendor"
	case "declined":
		return "Declined"
	case "cancelled":
		return "Cancelled"
	}
	return s
}

func (d Data) vendorName(id string) string {
	if v := d.Vendor(id); v != nil {
		return v.Name
	}
	return id
}

// Confirmation is the booking confirmation.
func Confirmation(d Data) ([]byte, error) {
	t := d.Trip
	p := newDoc("Your trip ticket", fmt.Sprintf("%s · %s", t.Title, d.Destination.Name+", "+d.Destination.State), d)
	p.ticket(d)
	p.section("Lead traveler")
	p.facts([][2]string{{"Name", d.Contact.Name}, {"Email", d.Contact.Email}, {"Mobile", d.Contact.Phone}})
	p.section("Payment")
	p.facts(paymentFacts(d.Payment, d.Location))
	p.section("Your bookings")
	rows := make([][]string, 0, len(d.Bookings))
	for _, b := range d.Bookings {
		rows = append(rows, []string{b.ID, d.vendorName(b.VendorID), b.ItemTitle, fmt.Sprintf("Day %d", b.Day), statusLabel(b.Status)})
	}
	if len(rows) == 0 {
		rows = append(rows, []string{"", "Partners are asked to confirm right after payment", "", "", ""})
	}
	p.table([]column{{"Booking", 30, "L"}, {"Partner", 50, "L"}, {"For", 62, "L"}, {"Day", 14, "C"}, {"Status", 24, "L"}}, rows)
	p.section("Help during your trip")
	pairs := [][2]string{}
	for _, e := range d.Destination.Emergency {
		pairs = append(pairs, [2]string{e.Label, e.Phone})
	}
	p.facts(pairs)
	p.Ln(2)
	p.font("", 8.5, muted)
	p.MultiCell(0, 4.5, p.t("If anything changes, every partner confirms first and you get an updated ticket and receipt by email."), "", "L", false)
	return p.bytes()
}

// Invoice is the bill for the trip.
func Invoice(d Data) ([]byte, error) {
	t := d.Trip
	pr := d.Price
	p := newDoc("Receipt", fmt.Sprintf("Receipt INV-%s-%d · %s", strings.TrimPrefix(t.Code, "TRZ-"), d.Version, t.Title), d)
	if t.PaymentStatus == domain.PayPaid {
		p.paidStamp("PAID")
	}
	p.section("Billed to")
	p.facts([][2]string{{"Name", d.Contact.Name}, {"Email", d.Contact.Email}, {"Mobile", d.Contact.Phone}, {"Trip", t.Code + " · " + tripDates(t)}})
	p.section("Charges")
	stayNote := ""
	if d.Stay != nil {
		stayNote = fmt.Sprintf("%s · %d room%s x %d nights", d.Stay.Name, pr.Rooms, plural(pr.Rooms), t.Prefs.Nights)
	}
	travelNote := ""
	if d.Transport != nil {
		travelNote = fmt.Sprintf("%s · %d traveler%s, return", d.Transport.Label, pr.Travelers, plural(pr.Travelers))
	}
	rows := [][]string{
		{"Stay", stayNote, rupees(pr.Stay)},
		{"Travel", travelNote, rupees(pr.Travel)},
		{"Local transport", "Cabs and airport transfers", rupees(pr.Local)},
		{"Experiences", "Tickets for the planned activities", rupees(pr.Activities)},
	}
	if pr.Meals > 0 {
		rows = append(rows, []string{"Meals", "Planned meals", rupees(pr.Meals)})
	}
	rows = append(rows, []string{"Subtotal", "", rupees(pr.Subtotal)})
	if pr.TeamUp > 0 {
		rows = append(rows, []string{"Team-up discount", "Group price unlocked", "-" + rupees(pr.TeamUp)})
	}
	if pr.Promo > 0 {
		rows = append(rows, []string{"Promo", t.PromoCode, "-" + rupees(pr.Promo)})
	}
	rows = append(rows, []string{"Service fee", "3% (capped)", rupees(pr.ServiceFee)}, []string{"GST", "5%", rupees(pr.Tax)})
	p.table([]column{{"Item", 38, "L"}, {"Details", 107, "L"}, {"Amount", 35, "R"}}, rows)
	p.Ln(2)
	p.fill(lav)
	p.font("B", 12, ink)
	p.CellFormat(145, 10, p.t("  Total"), "", 0, "L", true, 0, "")
	p.CellFormat(35, 10, p.t(rupees(pr.Total)), "", 1, "R", true, 0, "")
	p.font("", 9, muted)
	p.CellFormat(0, 6, p.t(fmt.Sprintf("%s per person · %d traveler%s", rupees(pr.PerPerson), pr.Travelers, plural(pr.Travelers))), "", 1, "R", false, 0, "")
	p.section("Payment")
	p.facts(paymentFacts(d.Payment, d.Location))
	var adjustments int
	for _, r := range t.Receipts {
		adjustments += r.CostDelta
	}
	if adjustments != 0 {
		p.section("Changes after booking")
		rows := [][]string{}
		for _, r := range t.Receipts {
			if r.CostDelta != 0 {
				rows = append(rows, []string{r.CreatedAt.In(d.Location).Format("2 Jan"), r.ID + " · " + r.Title, strings.Replace(engine.RupeesSigned(r.CostDelta), "₹", "Rs ", 1)})
			}
		}
		p.table([]column{{"Date", 25, "L"}, {"Change Receipt", 120, "L"}, {"Amount", 35, "R"}}, rows)
		p.font("", 8.5, muted)
		p.MultiCell(0, 4.5, p.t("Refunds are credited to the original payment method; extra charges are collected before the change is applied."), "", "L", false)
	}
	return p.bytes()
}

// Itinerary is the day-by-day plan.
func Itinerary(d Data) ([]byte, error) {
	t := d.Trip
	p := newDoc("Trip itinerary", fmt.Sprintf("%s · %s · %s", t.Title, tripDates(t), travelers(t.Prefs)), d)
	for day := 1; day <= t.Prefs.Days(); day++ {
		if p.GetY() > 240 {
			p.AddPage()
		}
		title := fmt.Sprintf("Day %d · %s", day, engine.DayDate(t.Prefs.StartDate, day))
		if day-1 < len(d.Forecast) {
			f := d.Forecast[day-1]
			src := "climate estimate"
			if f.Source != "" {
				src = "Open-Meteo"
			}
			title += fmt.Sprintf("   %s %d°C, rain %d%% (%s)", engine.ConditionLabel[f.Condition], f.TempC, f.RainChance, src)
		}
		p.section(title)
		rows := [][]string{}
		for _, it := range engine.DayItems(t.Items, day) {
			if it.Status == domain.ItemCancelled {
				continue
			}
			when := engine.MinToTime(it.StartMin)
			if it.DurationMin > 0 {
				when += " - " + engine.MinToTime(it.End())
			}
			name := it.Title
			if it.Hearted {
				name = "* " + name
			}
			who := ""
			if it.VendorID != "" {
				who = d.vendorName(it.VendorID)
			}
			rows = append(rows, []string{when, name, orDash(it.Place), who})
		}
		if len(rows) == 0 {
			rows = append(rows, []string{"", "Free day", "", ""})
		}
		p.table([]column{{"Time", 38, "L"}, {"Plan", 70, "L"}, {"Where", 38, "L"}, {"Partner", 34, "L"}}, rows)
	}
	p.Ln(1)
	p.font("", 8, muted)
	p.CellFormat(0, 5, p.t("* = your Must-Do Hearts. Weather: Open-Meteo.com (CC BY 4.0) when available."), "", 1, "L", false, 0, "")
	if len(t.Receipts) > 0 {
		p.section("Change Receipts")
		rows := [][]string{}
		for _, r := range t.Receipts {
			rows = append(rows, []string{r.ID, r.Title, strings.Join(r.ApprovedBy, ", "), r.CreatedAt.In(d.Location).Format("2 Jan, 3:04 PM")})
		}
		p.table([]column{{"Receipt", 30, "L"}, {"What changed", 70, "L"}, {"Approved by", 50, "L"}, {"When", 30, "L"}}, rows)
	}
	return p.bytes()
}

// Vouchers has one voucher per vendor booking, to show at check-in or pickup.
func Vouchers(d Data) ([]byte, error) {
	t := d.Trip
	p := newDoc("Tickets & vouchers", fmt.Sprintf("%s · show the matching voucher to each partner", t.Title), d)
	count := 0
	for _, b := range d.Bookings {
		if b.Status == "cancelled" || b.Status == "declined" {
			continue
		}
		if p.GetY() > 215 {
			p.AddPage()
		}
		count++
		y := p.GetY()
		p.SetDrawColor(ink[0], ink[1], ink[2])
		p.SetDashPattern([]float64{1.5, 1}, 0)
		p.RoundedRect(15, y, 180, 50, 4, "1234", "D")
		p.SetDashPattern([]float64{}, 0)
		p.SetXY(20, y+4)
		p.font("B", 12, ink)
		p.CellFormat(120, 6, p.t(b.ItemTitle), "", 0, "L", false, 0, "")
		p.font("B", 10, purple)
		p.CellFormat(50, 6, p.t(b.ID), "", 1, "R", false, 0, "")
		v := d.Vendor(b.VendorID)
		vendor, phone := b.VendorID, ""
		if v != nil {
			vendor, phone = v.Name, v.ContactName+" · "+v.Phone
		}
		when := engine.DayDate(t.Prefs.StartDate, b.Day)
		if it := t.Item(b.ItemID); it != nil {
			when += ", " + engine.MinToTime(it.StartMin)
		}
		p.SetXY(20, y+13)
		pairs := [][2]string{{"Partner", vendor}, {"Contact", phone}, {"When", fmt.Sprintf("Day %d · %s", b.Day, when)},
			{"Guests", fmt.Sprintf("%s · lead: %s", travelers(t.Prefs), d.Contact.Name)}, {"Status", statusLabel(b.Status)}, {"Value", rupees(b.Amount)}}
		for i, kv := range pairs {
			x := 20.0
			if i%2 == 1 {
				x = 108
			}
			p.SetXY(x, y+13+float64(i/2)*11)
			p.font("", 7.5, muted)
			p.CellFormat(85, 4, p.t(kv[0]), "", 2, "L", false, 0, "")
			p.SetX(x)
			p.font("B", 9.5, ink)
			p.CellFormat(85, 5, p.t(fit(kv[1], 150)), "", 0, "L", false, 0, "")
		}
		p.SetXY(15, y+55)
	}
	if count == 0 {
		p.font("", 10, muted)
		p.MultiCell(0, 6, p.t("Vouchers appear here as soon as partners receive your booking."), "", "L", false)
	}
	return p.bytes()
}
