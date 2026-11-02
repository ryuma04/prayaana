package booking

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"bytes"
	"encoding/json"
	"fmt"
	"io"
)

type razorpay struct {
	keyID, secret string
	client        *http.Client
}

func (r *razorpay) createOrder(ctx context.Context, amountRupees int, receipt string) (string, error) {
	body, _ := json.Marshal(map[string]any{"amount": amountRupees * 100, "currency": "INR", "receipt": receipt})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.razorpay.com/v1/orders", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(r.keyID, r.secret)
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("razorpay order: status %d: %s", resp.StatusCode, raw)
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.ID == "" {
		return "", fmt.Errorf("razorpay order: bad response")
	}
	return out.ID, nil
}

func sign(secret, payload string) string {
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(payload))
	return hex.EncodeToString(m.Sum(nil))
}

func validSignature(secret, payload, signature string) bool {
	return hmac.Equal([]byte(sign(secret, payload)), []byte(strings.ToLower(strings.TrimSpace(signature))))
}

func newRazorpay(keyID, secret string) *razorpay {
	if keyID == "" || secret == "" {
		return nil
	}
	return &razorpay{keyID: keyID, secret: secret, client: &http.Client{Timeout: 20 * time.Second}}
}

// paymentMethod asks Razorpay how the traveler actually paid (upi, card, netbanking, wallet…).
func (r *razorpay) paymentMethod(ctx context.Context, paymentID string) string {
	if r == nil || paymentID == "" {
		return ""
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.razorpay.com/v1/payments/"+paymentID, nil)
	if err != nil {
		return ""
	}
	req.SetBasicAuth(r.keyID, r.secret)
	resp, err := r.client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	var out struct {
		Method string `json:"method"`
	}
	if resp.StatusCode >= 300 || json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&out) != nil {
		return ""
	}
	return out.Method
}
