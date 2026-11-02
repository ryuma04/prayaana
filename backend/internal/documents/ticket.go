package documents

import (
	"strings"

	"trizpyy/internal/domain"
)

var (
	white = [3]int{255, 255, 255}
	sun   = [3]int{250, 212, 127}
	green = [3]int{35, 134, 75}
)

// ticket draws the trip as a boarding-pass style ticket: the journey on the left and a
// tear-off stub with the booking reference on the right.
func (d *doc) ticket(dt Data) {
	t := dt.Trip
	x, y, w, h, stub := 15.0, d.GetY()+2, 180.0, 58.0, 52.0
	d.fill(ink)
	d.RoundedRect(x, y, w, h, 5, "1234", "F")
	d.fill(sun)
	d.RoundedRect(x+w-stub, y, stub, h, 5, "23", "F")
	// Perforation between ticket and stub.
	d.SetDrawColor(255, 255, 255)
	d.SetDashPattern([]float64{1.2, 1.4}, 0)
	d.SetLineWidth(0.4)
	d.Line(x+w-stub, y+4, x+w-stub, y+h-4)
	d.SetDashPattern([]float64{}, 0)
	d.fill(white)
	d.Circle(x+w-stub, y, 3.2, "F")
	d.Circle(x+w-stub, y+h, 3.2, "F")

	from := strings.TrimSpace(t.Prefs.FromCity)
	if from == "" {
		from = "Home"
	}
	to := dt.Destination.Name
	left := x + 8
	d.SetXY(left, y+7)
	d.font("", 7.5, [3]int{190, 186, 214})
	d.CellFormat(120, 4, d.t("FROM"), "", 0, "L", false, 0, "")
	d.SetXY(left+64, y+7)
	d.CellFormat(50, 4, d.t("TO"), "", 1, "L", false, 0, "")
	d.SetXY(left, y+11)
	d.font("B", 18, white)
	d.CellFormat(58, 9, d.t(fitAt(from, 58, 3.6)), "", 0, "L", false, 0, "")
	d.font("B", 16, sun)
	d.CellFormat(6, 9, ">", "", 0, "C", false, 0, "")
	d.font("B", 18, white)
	d.CellFormat(56, 9, d.t(fitAt(to, 56, 3.6)), "", 1, "L", false, 0, "")

	cell := func(cx, cy float64, label, value string, width float64) {
		d.SetXY(cx, cy)
		d.font("", 7, [3]int{190, 186, 214})
		d.CellFormat(width, 4, d.t(strings.ToUpper(label)), "", 2, "L", false, 0, "")
		d.SetX(cx)
		d.font("B", 9.5, white)
		d.CellFormat(width, 5, d.t(fitAt(value, width, 2)), "", 0, "L", false, 0, "")
	}
	stay, transport := "", ""
	if dt.Stay != nil {
		stay = dt.Stay.Name
	}
	if dt.Transport != nil {
		transport = dt.Transport.Label
	}
	cell(left, y+26, "Dates", tripDates(t), 60)
	cell(left+64, y+26, "Travelers", travelers(t.Prefs), 56)
	cell(left, y+40, "Stay", stay, 60)
	cell(left+64, y+40, "Getting there", transport, 56)

	// Stub
	sx := x + w - stub + 6
	d.SetXY(sx, y+8)
	d.font("", 7, ink)
	d.CellFormat(stub-12, 4, d.t("BOOKING"), "", 2, "L", false, 0, "")
	d.SetX(sx)
	d.font("B", 16, ink)
	d.CellFormat(stub-12, 9, d.t(t.Code), "", 2, "L", false, 0, "")
	status := "Confirmed"
	if t.PaymentStatus == domain.PayPaid {
		status = "Paid"
	}
	d.SetX(sx)
	d.font("", 7, ink)
	d.CellFormat(stub-12, 5, d.t("STATUS"), "", 2, "L", false, 0, "")
	d.SetX(sx)
	d.font("B", 11, ink)
	d.CellFormat(stub-12, 6, d.t(status), "", 2, "L", false, 0, "")
	d.SetX(sx)
	d.font("", 7, ink)
	d.CellFormat(stub-12, 5, d.t("TOTAL"), "", 2, "L", false, 0, "")
	d.SetX(sx)
	d.font("B", 11, ink)
	d.CellFormat(stub-12, 6, d.t(rupees(dt.Price.Total)), "", 2, "L", false, 0, "")

	d.SetDrawColor(line[0], line[1], line[2])
	d.SetLineWidth(0.2)
	d.SetXY(15, y+h+6)
}

// paidStamp marks a settled receipt in the top right corner (drawn straight: a rotated
// transform around text is not reliably closed by the PDF library).
func (d *doc) paidStamp(label string) {
	x, y := d.GetXY()
	defer d.SetXY(x, y)
	d.SetDrawColor(green[0], green[1], green[2])
	d.SetLineWidth(0.8)
	d.RoundedRect(148, 36, 44, 14, 3, "1234", "D")
	d.SetXY(148, 38.5)
	d.font("B", 16, green)
	d.CellFormat(44, 9, d.t(label), "", 0, "C", false, 0, "")
	d.SetDrawColor(line[0], line[1], line[2])
	d.SetLineWidth(0.2)
}
