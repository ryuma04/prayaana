package config

import (
	"strings"
	"testing"
)

func TestTelegramWebhookSecretValidation(t *testing.T) {
	cases := []struct {
		name        string
		mode        string
		token       string
		secret      string
		expectError bool
	}{
		{
			name:        "telegram mode with token and missing secret fails",
			mode:        "telegram",
			token:       "123456:ABC-DEF",
			secret:      "",
			expectError: true,
		},
		{
			name:        "telegram mode with token and secret succeeds",
			mode:        "telegram",
			token:       "123456:ABC-DEF",
			secret:      "super-secret-token_123",
			expectError: false,
		},
		{
			name:        "mock mode without secret succeeds",
			mode:        "mock",
			token:       "123456:ABC-DEF",
			secret:      "",
			expectError: false,
		},
		{
			name:        "telegram mode without token succeeds (disabled)",
			mode:        "telegram",
			token:       "",
			secret:      "",
			expectError: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := Config{
				Port:                  "8080",
				JWTSecret:             "test-jwt-secret-at-least-32-chars-long",
				DatabaseURL:           "postgres://localhost:5432/test",
				TelegramMode:          tc.mode,
				TelegramBotToken:      tc.token,
				TelegramWebhookSecret: tc.secret,
			}
			err := cfg.Validate()
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error for missing webhook secret, got nil")
				}
				if !strings.Contains(err.Error(), "TELEGRAM_WEBHOOK_SECRET") {
					t.Errorf("error %q should mention TELEGRAM_WEBHOOK_SECRET", err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}
