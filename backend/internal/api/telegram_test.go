package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"trizpyy/internal/app"
	"trizpyy/internal/config"
	"trizpyy/internal/telegram"
)

func TestTelegramWebhookSecretEnforcement(t *testing.T) {
	testSecret := "super-secure-webhook-secret-token"
	api := &API{
		Core: &app.Core{
			Cfg: config.Config{
				TelegramWebhookSecret: testSecret,
			},
			Telegram: telegram.New(telegram.Config{
				Token:    "mock-token",
				Username: "TrizpyyBot",
				Mode:     "mock",
			}),
		},
	}

	tests := []struct {
		name         string
		secretHeader string
		body         string
		expectedCode int
	}{
		{
			name:         "missing secret header returns 401",
			secretHeader: "",
			body:         `{"update_id":1,"message":{"text":"/start"}}`,
			expectedCode: http.StatusUnauthorized,
		},
		{
			name:         "wrong secret header returns 401",
			secretHeader: "wrong-secret",
			body:         `{"update_id":1,"message":{"text":"/start"}}`,
			expectedCode: http.StatusUnauthorized,
		},
		{
			name:         "valid secret header returns 200",
			secretHeader: testSecret,
			body:         `{"update_id":1,"message":{"text":"/start"}}`,
			expectedCode: http.StatusOK,
		},
		{
			name:         "valid secret header with malformed JSON returns 200 without crashing",
			secretHeader: testSecret,
			body:         `{invalid-json`,
			expectedCode: http.StatusOK,
		},
		{
			name:         "valid secret header with empty body returns 200 without crashing",
			secretHeader: testSecret,
			body:         ``,
			expectedCode: http.StatusOK,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/telegram/webhook", bytes.NewBufferString(tc.body))
			if tc.secretHeader != "" {
				req.Header.Set("X-Telegram-Bot-Api-Secret-Token", tc.secretHeader)
			}
			rec := httptest.NewRecorder()

			api.telegramWebhook(rec, req)

			if rec.Code != tc.expectedCode {
				t.Errorf("status code = %d; want %d; body = %s", rec.Code, tc.expectedCode, rec.Body.String())
			}
		})
	}
}

func TestTelegramWebhookEmptySecretConfigFails(t *testing.T) {
	// If backend has empty TelegramWebhookSecret, it must reject any attempt to call the webhook
	api := &API{
		Core: &app.Core{
			Cfg: config.Config{
				TelegramWebhookSecret: "",
			},
			Telegram: telegram.New(telegram.Config{
				Token:    "mock-token",
				Username: "TrizpyyBot",
				Mode:     "mock",
			}),
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/api/telegram/webhook", bytes.NewBufferString(`{"update_id":1}`))
	req.Header.Set("X-Telegram-Bot-Api-Secret-Token", "some-token")
	rec := httptest.NewRecorder()

	api.telegramWebhook(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status code = %d; want 401 when backend secret is empty", rec.Code)
	}
}

func TestProcessTelegramUpdateSafe(t *testing.T) {
	api := &API{
		Core: &app.Core{
			Telegram: telegram.New(telegram.Config{
				Token:    "mock-token",
				Username: "TrizpyyBot",
				Mode:     "mock",
			}),
		},
	}

	// Should not panic on nil message or zero chat ID
	api.ProcessTelegramUpdate(t.Context(), telegram.Update{UpdateID: 1})
	api.ProcessTelegramUpdate(t.Context(), telegram.Update{
		UpdateID: 2,
		Message: &telegram.Message{
			MessageID: 10,
			Chat:      telegram.Chat{ID: 0},
			Text:      "/start",
		},
	})

	// Valid chat with /start, /id, and plain message
	api.ProcessTelegramUpdate(t.Context(), telegram.Update{
		UpdateID: 3,
		Message: &telegram.Message{
			MessageID: 11,
			Chat:      telegram.Chat{ID: 987654321},
			Text:      "/start",
		},
	})
	api.ProcessTelegramUpdate(t.Context(), telegram.Update{
		UpdateID: 4,
		Message: &telegram.Message{
			MessageID: 12,
			Chat:      telegram.Chat{ID: 987654321},
			Text:      "/id",
		},
	})
}
