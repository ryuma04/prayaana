// Package mail sends transactional email through Resend, any SMTP server, or the log in development.
package mail

import (
	"bytes"
	"context"
	"crypto/tls"
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	htmltpl "html/template"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	texttpl "text/template"
	"time"
)

type Message struct {
	To          string
	Subject     string
	HTML        string
	Text        string
	Attachments []Attachment
}

// Attachment is a file sent with the email (trip tickets and receipts as PDF).
type Attachment struct {
	Name        string
	ContentType string
	Data        []byte
}

type Mailer interface {
	Send(ctx context.Context, m Message) error
	// Delivers reports whether mail actually leaves the server (false for the dev log mailer).
	Delivers() bool
}

type Config struct {
	From      string
	ResendKey string
	SMTPHost  string
	SMTPPort  string
	SMTPUser  string
	SMTPPass  string
}

func New(c Config) Mailer {
	// SMTP (for example Gmail with an app password) wins when both are set: it can mail anyone,
	// while Resend needs a verified domain before it can mail people other than the account owner.
	switch {
	case c.SMTPHost != "":
		port := c.SMTPPort
		if port == "" {
			port = "587"
		}
		from := c.From
		if c.SMTPUser != "" && (from == "" || strings.Contains(from, "resend.dev")) {
			from = "Trizpyy <" + c.SMTPUser + ">" // Gmail only sends as the signed-in address
		}
		return &smtpMailer{host: c.SMTPHost, port: port, user: c.SMTPUser, pass: c.SMTPPass, from: from}
	case c.ResendKey != "":
		return &resend{key: c.ResendKey, from: c.From, client: &http.Client{Timeout: 15 * time.Second}}
	}
	return logMailer{}
}

type logMailer struct{}

func (logMailer) Delivers() bool { return false }

func (logMailer) Send(_ context.Context, m Message) error {
	slog.Info("email (not sent: no RESEND_API_KEY or SMTP_HOST configured)", "to", m.To, "subject", m.Subject, "text", m.Text)
	return nil
}

type resend struct {
	key, from string
	client    *http.Client
}

func (r *resend) Delivers() bool { return true }

func (r *resend) Send(ctx context.Context, m Message) error {
	payload := map[string]any{"from": r.from, "to": []string{m.To}, "subject": m.Subject, "html": m.HTML, "text": m.Text}
	if len(m.Attachments) > 0 {
		var files []map[string]string
		for _, a := range m.Attachments {
			files = append(files, map[string]string{"filename": a.Name, "content": base64.StdEncoding.EncodeToString(a.Data)})
		}
		payload["attachments"] = files
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("resend: status %d: %s", resp.StatusCode, raw)
	}
	return nil
}

type smtpMailer struct {
	host, port, user, pass, from string
}

func (s *smtpMailer) Delivers() bool { return true }

func (s *smtpMailer) Send(ctx context.Context, m Message) error {
	boundary := fmt.Sprintf("trizpyy-%d", time.Now().UnixNano())
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nDate: %s\r\n", s.from, m.To,
		mime.QEncoding.Encode("utf-8", m.Subject), time.Now().UTC().Format(time.RFC1123Z))
	alt := boundary + "-alt"
	if len(m.Attachments) > 0 {
		fmt.Fprintf(&b, "Content-Type: multipart/mixed; boundary=%q\r\n\r\n--%s\r\n", boundary, boundary)
	}
	fmt.Fprintf(&b, "Content-Type: multipart/alternative; boundary=%q\r\n\r\n", alt)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s\r\n", alt, m.Text)
	fmt.Fprintf(&b, "--%s\r\nContent-Type: text/html; charset=utf-8\r\n\r\n%s\r\n--%s--\r\n", alt, m.HTML, alt)
	if len(m.Attachments) > 0 {
		for _, a := range m.Attachments {
			ct := a.ContentType
			if ct == "" {
				ct = "application/octet-stream"
			}
			fmt.Fprintf(&b, "--%s\r\nContent-Type: %s; name=%q\r\nContent-Disposition: attachment; filename=%q\r\nContent-Transfer-Encoding: base64\r\n\r\n", boundary, ct, a.Name, a.Name)
			enc := base64.StdEncoding.EncodeToString(a.Data)
			for len(enc) > 76 {
				b.WriteString(enc[:76] + "\r\n")
				enc = enc[76:]
			}
			b.WriteString(enc + "\r\n")
		}
		fmt.Fprintf(&b, "--%s--\r\n", boundary)
	}

	done := make(chan error, 1)
	go func() { done <- s.deliver(m.To, []byte(b.String())) }()
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (s *smtpMailer) deliver(to string, msg []byte) error {
	addr := net.JoinHostPort(s.host, s.port)
	var auth smtp.Auth
	if s.user != "" {
		auth = smtp.PlainAuth("", s.user, s.pass, s.host)
	}
	from := s.from
	if i := strings.LastIndex(from, "<"); i >= 0 {
		from = strings.Trim(from[i:], "<> ")
	}
	if s.port == "465" {
		conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12})
		if err != nil {
			return err
		}
		c, err := smtp.NewClient(conn, s.host)
		if err != nil {
			return err
		}
		defer c.Close()
		if auth != nil {
			if err := c.Auth(auth); err != nil {
				return err
			}
		}
		if err := c.Mail(from); err != nil {
			return err
		}
		if err := c.Rcpt(to); err != nil {
			return err
		}
		w, err := c.Data()
		if err != nil {
			return err
		}
		if _, err := w.Write(msg); err != nil {
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
		return c.Quit()
	}
	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}

//go:embed templates/*
var templates embed.FS

var (
	htmlT = htmltpl.Must(htmltpl.ParseFS(templates, "templates/*.html"))
	textT = texttpl.Must(texttpl.ParseFS(templates, "templates/*.txt"))
)

type VerifyData struct {
	Name      string
	Code      string
	Link      string
	ExpiresIn string
	Year      int
	Digits    []string
}

// VerifyEmail renders the verification email in the Trizpyy clay style.
func VerifyEmail(to string, d VerifyData) (Message, error) {
	d.Digits = strings.Split(d.Code, "")
	var h, t bytes.Buffer
	if err := htmlT.ExecuteTemplate(&h, "verify.html", d); err != nil {
		return Message{}, err
	}
	if err := textT.ExecuteTemplate(&t, "verify.txt", d); err != nil {
		return Message{}, err
	}
	return Message{To: to, Subject: d.Code + " is your Trizpyy code", HTML: h.String(), Text: t.String()}, nil
}

// Notice renders a short transactional email (vendor request, trip update) with one button.
func Notice(to, subject, body, link, action string) (Message, error) {
	var h bytes.Buffer
	data := struct {
		Subject, Link, Action string
		Lines                 []string
	}{subject, link, action, strings.Split(body, "\n")}
	if err := noticeT.Execute(&h, data); err != nil {
		return Message{}, err
	}
	text := body
	if link != "" {
		text += "\n\n" + action + ": " + link
	}
	return Message{To: to, Subject: subject, HTML: h.String(), Text: text + "\n\n, Trizpyy"}, nil
}

var noticeT = htmltpl.Must(htmltpl.New("notice").Parse(`<!doctype html><html><body style="margin:0;background:#E4EAF3;font-family:Poppins,Arial,sans-serif;color:#1C1B2B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:2px solid #1C1B2B;border-radius:24px" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7B5CF0">Trizpyy</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">{{.Subject}}</h1>
{{range .Lines}}<p style="margin:0 0 8px;font-size:15px;line-height:1.5">{{.}}</p>{{end}}
{{if .Link}}<p style="margin:24px 0 0"><a href="{{.Link}}" style="display:inline-block;background:#1C1B22;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">{{.Action}}</a></p>{{end}}
</td></tr></table></td></tr></table></body></html>`))
