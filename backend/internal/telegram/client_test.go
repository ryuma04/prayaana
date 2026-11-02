package telegram

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSetWebhookSendsSecretToken(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botmock-token/setWebhook" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true,"result":true}`))
	}))
	defer server.Close()

	client := New(Config{
		Token:    "mock-token",
		Username: "TrizpyyBot",
		BaseURL:  server.URL,
		Mode:     "telegram",
	})

	err := client.SetWebhook(context.Background(), "https://example.com/api/telegram/webhook", "test-secret-123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got["url"] != "https://example.com/api/telegram/webhook" {
		t.Errorf("url = %v; want https://example.com/api/telegram/webhook", got["url"])
	}
	if got["secret_token"] != "test-secret-123" {
		t.Errorf("secret_token = %v; want test-secret-123", got["secret_token"])
	}
}

func TestDeleteWebhook(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botmock-token/deleteWebhook" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true,"result":true}`))
	}))
	defer server.Close()

	client := New(Config{
		Token:    "mock-token",
		Username: "TrizpyyBot",
		BaseURL:  server.URL,
		Mode:     "telegram",
	})

	err := client.DeleteWebhook(context.Background(), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got["drop_pending_updates"] != true {
		t.Errorf("drop_pending_updates = %v; want true", got["drop_pending_updates"])
	}
}

func TestGetUpdatesParsesMessages(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botmock-token/getUpdates" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"ok": true,
			"result": [
				{
					"update_id": 42,
					"message": {
						"message_id": 101,
						"chat": {"id": 12345678, "username": "traveler"},
						"from": {"id": 12345678, "username": "traveler"},
						"text": "/start abc123xyz"
					}
				}
			]
		}`))
	}))
	defer server.Close()

	client := New(Config{
		Token:    "mock-token",
		Username: "TrizpyyBot",
		BaseURL:  server.URL,
		Mode:     "telegram",
	})

	updates, err := client.GetUpdates(context.Background(), 0, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(updates) != 1 {
		t.Fatalf("got %d updates, want 1", len(updates))
	}
	if updates[0].UpdateID != 42 {
		t.Errorf("update_id = %d, want 42", updates[0].UpdateID)
	}
	if updates[0].Message == nil || updates[0].Message.Text != "/start abc123xyz" {
		t.Errorf("message text = %v, want /start abc123xyz", updates[0].Message)
	}
}

func TestTokenRedactionInErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"ok":false,"description":"Internal error"}`))
	}))
	defer server.Close()

	secretToken := "secret-bot-token-never-leak"
	client := New(Config{
		Token:    secretToken,
		Username: "TrizpyyBot",
		BaseURL:  server.URL,
		Mode:     "telegram",
	})

	err := client.SetWebhook(context.Background(), "https://example.com/webhook", "")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if strings.Contains(err.Error(), secretToken) {
		t.Fatalf("secret bot token leaked in error message: %v", err)
	}
}
