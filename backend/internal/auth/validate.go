package auth

import (
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"
)

var commonPasswords = map[string]bool{
	"password": true, "password1": true, "password123": true, "12345678": true, "123456789": true, "1234567890": true,
	"qwerty123": true, "qwertyuiop": true, "iloveyou1": true, "welcome1": true, "admin123": true, "letmein1": true,
	"abc12345": true, "trizpyy1": true, "trizpyy123": true, "india123": true, "passw0rd": true, "11111111": true,
}

var recognizedTLDs = map[string]bool{
	"com": true, "org": true, "net": true, "edu": true, "gov": true, "mil": true, "int": true,
	"in": true, "co": true, "io": true, "ai": true, "me": true, "app": true, "dev": true, "tech": true, "info": true, "biz": true, "xyz": true, "online": true, "site": true, "live": true, "pro": true, "store": true, "demo": true,
	"us": true, "uk": true, "ca": true, "au": true, "de": true, "fr": true, "jp": true, "cn": true, "eu": true, "ch": true, "se": true, "nl": true, "es": true, "it": true, "br": true, "za": true, "sg": true, "my": true, "ae": true, "sa": true, "ru": true, "nz": true, "kr": true, "hk": true, "tw": true, "ie": true, "no": true, "fi": true, "dk": true, "be": true, "at": true, "pl": true, "mx": true, "ar": true, "cl": true, "pe": true, "ph": true, "id": true, "th": true, "vn": true, "cc": true, "tv": true, "to": true, "so": true, "fm": true, "is": true, "vc": true,
	"cloud": true, "digital": true, "global": true, "agency": true, "email": true, "world": true, "space": true, "design": true, "media": true, "travel": true, "club": true, "group": true, "life": true, "today": true, "zone": true, "center": true, "expert": true, "company": true, "solutions": true, "services": true, "team": true,
}

// normalizeEmail lower-cases and validates an address; it returns "" when invalid.
func normalizeEmail(raw string) string {
	e := strings.ToLower(strings.TrimSpace(raw))
	if len(e) < 6 || len(e) > 254 || strings.ContainsAny(e, " \t\r\n<>()[],;:\"\\") {
		return ""
	}
	a, err := mail.ParseAddress(e)
	if err != nil || a.Address != e {
		return ""
	}
	local, domain, ok := strings.Cut(e, "@")
	if !ok || local == "" || len(local) > 64 || strings.HasPrefix(local, ".") || strings.HasSuffix(local, ".") || strings.Contains(e, "..") {
		return ""
	}
	labels := strings.Split(domain, ".")
	if len(labels) < 2 || len(labels[len(labels)-1]) < 2 {
		return ""
	}
	for _, l := range labels {
		if l == "" || len(l) > 63 || strings.HasPrefix(l, "-") || strings.HasSuffix(l, "-") {
			return ""
		}
	}
	tld := labels[len(labels)-1]
	if !recognizedTLDs[tld] {
		return ""
	}
	return e
}

func validateName(raw string) (string, string) {
	name := strings.Join(strings.Fields(raw), " ")
	n := utf8.RuneCountInString(name)
	switch {
	case n < 2:
		return name, "Enter your full name."
	case n > 80:
		return name, "Name must be under 80 characters."
	case strings.ContainsAny(name, "<>{}[]\\/@#$%^*=|~`") || strings.Contains(strings.ToLower(name), "http"):
		return name, "Name can only have letters, spaces, dots, apostrophes and hyphens."
	}
	letters := 0
	for _, r := range name {
		if unicode.IsControl(r) {
			return name, "Name contains invalid characters."
		}
		if unicode.IsLetter(r) {
			letters++
		}
	}
	if letters < 2 {
		return name, "Enter your full name."
	}
	return name, ""
}

func validatePassword(pw, email, name string) string {
	switch n := len(pw); {
	case n < 8:
		return "Password must be at least 8 characters."
	case n > 72:
		return "Password must be at most 72 characters."
	}
	if strings.TrimSpace(pw) != pw {
		return "Password can't start or end with a space."
	}
	var letter, digit bool
	for _, r := range pw {
		switch {
		case unicode.IsLetter(r):
			letter = true
		case unicode.IsDigit(r):
			digit = true
		case unicode.IsControl(r):
			return "Password contains invalid characters."
		}
	}
	if !letter || !digit {
		return "Use at least one letter and one number."
	}
	lower := strings.ToLower(pw)
	if commonPasswords[lower] {
		return "That password is too common. Pick something harder to guess."
	}
	if local, _, _ := strings.Cut(email, "@"); len(local) >= 4 && strings.Contains(lower, local) {
		return "Password shouldn't contain your email."
	}
	for _, part := range strings.Fields(strings.ToLower(name)) {
		if len(part) >= 4 && strings.Contains(lower, part) {
			return "Password shouldn't contain your name."
		}
	}
	return ""
}

// normalizePhone keeps an optional phone as +<digits>; it returns ok=false when malformed.
func normalizePhone(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	var b strings.Builder
	for i, r := range raw {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '+' && i == 0, r == ' ', r == '-', r == '(', r == ')':
		default:
			return "", false
		}
	}
	d := b.String()
	if len(d) == 10 && d[0] >= '6' {
		d = "91" + d
	}
	if len(d) < 11 || len(d) > 15 {
		return "", false
	}
	return "+" + d, true
}
