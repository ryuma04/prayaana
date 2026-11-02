package engine

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

// Round mirrors JavaScript's Math.round (halves round towards +Infinity).
func Round(x float64) int { return int(math.Floor(x + 0.5)) }

func HashString(s string) uint32 {
	h := uint32(2166136261)
	for _, cu := range utf16.Encode([]rune(s)) {
		h ^= uint32(cu)
		h *= 16777619
	}
	return h
}

// Seeded is a port of the frontend mulberry32 generator so both sides agree on demo data.
func Seeded(seed string) func() float64 {
	a := HashString(seed)
	return func() float64 {
		a += 0x6d2b79f5
		t := (a ^ (a >> 15)) * (1 | a)
		t = (t + (t^(t>>7))*(61|t)) ^ t
		return float64(t^(t>>14)) / 4294967296
	}
}

const isoLayout = "2006-01-02"

func parseISO(iso string) time.Time {
	t, err := time.Parse(isoLayout, iso)
	if err != nil {
		return time.Time{}
	}
	return t
}

func AddDays(iso string, days int) string {
	return parseISO(iso).AddDate(0, 0, days).Format(isoLayout)
}

func DaysBetween(a, b string) int {
	return int(math.Round(parseISO(b).Sub(parseISO(a)).Hours() / 24))
}

func ValidISODate(s string) bool {
	_, err := time.Parse(isoLayout, s)
	return err == nil
}

func MonthOf(iso string) int { return int(parseISO(iso).Month()) }

func DayDate(startISO string, day int) string {
	return parseISO(AddDays(startISO, day-1)).Format("Mon, 2 Jan")
}

func MinToTime(min int) string {
	m := ((min % 1440) + 1440) % 1440
	h, mm := m/60, m%60
	suffix := "AM"
	if h >= 12 {
		suffix = "PM"
	}
	h12 := h % 12
	if h12 == 0 {
		h12 = 12
	}
	return fmt.Sprintf("%d:%02d %s", h12, mm, suffix)
}

func TimeToMin(t string) int {
	parts := strings.SplitN(t, ":", 2)
	h, _ := strconv.Atoi(parts[0])
	m := 0
	if len(parts) > 1 {
		m, _ = strconv.Atoi(parts[1])
	}
	return h*60 + m
}

func Duration(min int) string {
	h, m := min/60, min%60
	switch {
	case h > 0 && m > 0:
		return fmt.Sprintf("%dh %dm", h, m)
	case h > 0:
		return fmt.Sprintf("%dh", h)
	default:
		return fmt.Sprintf("%dm", m)
	}
}

func groupIndian(n int) string {
	s := strconv.Itoa(n)
	if len(s) <= 3 {
		return s
	}
	head, tail := s[:len(s)-3], s[len(s)-3:]
	var parts []string
	for len(head) > 2 {
		parts = append([]string{head[len(head)-2:]}, parts...)
		head = head[:len(head)-2]
	}
	if head != "" {
		parts = append([]string{head}, parts...)
	}
	return strings.Join(parts, ",") + "," + tail
}

func Rupees(n int) string {
	abs := n
	if abs < 0 {
		abs = -abs
	}
	s := "₹" + groupIndian(abs)
	if n < 0 {
		return "−" + s
	}
	return s
}

func RupeesSigned(n int) string {
	switch {
	case n > 0:
		return "+" + Rupees(n)
	case n < 0:
		return Rupees(n)
	default:
		return Rupees(0)
	}
}

func HaversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	la1 := lat1 * math.Pi / 180
	la2 := lat2 * math.Pi / 180
	h := math.Pow(math.Sin(dLat/2), 2) + math.Cos(la1)*math.Cos(la2)*math.Pow(math.Sin(dLng/2), 2)
	return 2 * r * math.Asin(math.Sqrt(h))
}

func RoadMinutes(km float64) int { return Round(10 + (km/28)*60) }

func Plural(n int, word string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, word)
	}
	return fmt.Sprintf("%d %ss", n, word)
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func containsInt(list []int, v int) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func intersect(a, b []string) []string {
	var out []string
	for _, x := range a {
		if contains(b, x) {
			out = append(out, x)
		}
	}
	return out
}

func uniq(list []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range list {
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func ptr[T any](v T) *T { return &v }

func fptr(v float64) *float64 { return &v }

// rated is a catalog rating for scoring: real Google ratings when known, a neutral 4.3 otherwise,
// so an item that has not been looked up yet is neither favoured nor punished.
func rated(r float64) float64 {
	if r <= 0 {
		return 4.3
	}
	return r
}
