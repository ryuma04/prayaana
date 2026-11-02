package mail

import (
	"strings"
	"testing"
)

func TestVerifyEmailRenders(t *testing.T) {
	m, err := VerifyEmail("a@b.com", VerifyData{Name: "Rahul <b>", Code: "042917", Link: "https://api.test/auth/verify-email?token=x&y=1", ExpiresIn: "24 hours", Year: 2026})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"042917", "Confirm your email", "Verify my email", "token=x&amp;y=1", "Rahul &lt;b&gt;"} {
		if !strings.Contains(m.HTML, want) {
			t.Errorf("html missing %q", want)
		}
	}
	if !strings.Contains(m.Text, "042917") || !strings.Contains(m.Subject, "042917") {
		t.Error("code missing from text or subject")
	}
}
