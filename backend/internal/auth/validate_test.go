package auth

import "testing"

func TestNormalizeEmail(t *testing.T) {
	good := map[string]string{" Rahul@Example.COM ": "rahul@example.com", "a.b+trip@mail.co.in": "a.b+trip@mail.co.in"}
	for in, want := range good {
		if got := normalizeEmail(in); got != want {
			t.Errorf("%q → %q, want %q", in, got, want)
		}
	}
	for _, bad := range []string{"", "rahul", "rahul@", "@x.com", "a@b", "a@b.c", "a..b@x.com", ".a@x.com", "a@-x.com", "Rahul <r@x.com>", "a b@x.com"} {
		if got := normalizeEmail(bad); got != "" {
			t.Errorf("%q should be invalid, got %q", bad, got)
		}
	}
}

func TestValidatePassword(t *testing.T) {
	cases := map[string]bool{
		"short1":         false,
		"onlyletters":    false,
		"1234567890":     false,
		"password123":    false,
		" spaced123":     false,
		"rahulmehta99":   false,
		"Himalaya2026":   true,
		"quiet-cafes-42": true,
	}
	for pw, ok := range cases {
		if got := validatePassword(pw, "rahulmehta@x.com", "Rahul Mehta") == ""; got != ok {
			t.Errorf("%q valid=%v, want %v", pw, got, ok)
		}
	}
}

func TestValidateNameAndPhone(t *testing.T) {
	if _, msg := validateName("  Rahul   Mehta "); msg != "" {
		t.Errorf("valid name rejected: %s", msg)
	}
	for _, bad := range []string{"R", "<script>", "http://spam.com", "12"} {
		if _, msg := validateName(bad); msg == "" {
			t.Errorf("%q should be rejected", bad)
		}
	}
	if p, ok := normalizePhone("98765 43210"); !ok || p != "+919876543210" {
		t.Errorf("indian mobile: %q %v", p, ok)
	}
	if _, ok := normalizePhone("12ab"); ok {
		t.Error("letters must be rejected")
	}
	if p, ok := normalizePhone(""); !ok || p != "" {
		t.Error("phone is optional")
	}
}
