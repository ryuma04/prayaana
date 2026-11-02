package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"trizpyy/internal/platform/httpx"
	"trizpyy/internal/store"
	"trizpyy/internal/telegram"
)

// tgLinkTokenTTL is how long a connect link stays valid. Tokens are
// cryptographically random, single-use and tied to the signed-in user.
const tgLinkTokenTTL = 10 * time.Minute

func tgHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

type tgStatus struct {
	Connected   bool   `json:"connected"`
	ChatID      int64  `json:"chatId,omitempty"`
	Username    string `json:"username,omitempty"`
	ConnectedAt string `json:"connectedAt,omitempty"`
	BotUsername string `json:"botUsername"`
	Mode        string `json:"mode"`
	Available   bool   `json:"available"`
}

func (a *API) telegramStatusFor(r *http.Request) (tgStatus, error) {
	mode := "telegram"
	if a.Core.Telegram.Mock() {
		mode = "mock"
	}
	out := tgStatus{BotUsername: a.Core.Telegram.BotUsername(), Mode: mode, Available: a.Core.Telegram.Enabled()}
	conn, err := a.Core.Store.TelegramConnection(r.Context(), principal(r).UserID)
	if errors.Is(err, store.ErrNotFound) {
		return out, nil
	}
	if err != nil {
		return out, err
	}
	out.Connected = conn.Status == "connected"
	out.ChatID = conn.ChatID
	out.Username = conn.Username
	out.ConnectedAt = conn.ConnectedAt.UTC().Format(time.RFC3339)
	return out, nil
}

// telegramStatusHandler answers GET /telegram/status.
func (a *API) telegramStatusHandler(w http.ResponseWriter, r *http.Request) {
	out, err := a.telegramStatusFor(r)
	respond(w, r, out, err)
}

// telegramConnect (POST /telegram/connect) creates a short-lived single-use
// token for the signed-in user and returns the t.me deep link. Linking
// completes when the user presses START and the webhook receives the token.
func (a *API) telegramConnect(w http.ResponseWriter, r *http.Request) {
	if !a.Core.Telegram.Enabled() {
		fail(w, r, httpx.E(503, "telegram", "Telegram is not set up on this server yet (TELEGRAM_BOT_TOKEN)."))
		return
	}
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		fail(w, r, err)
		return
	}
	token := hex.EncodeToString(buf)
	expires := a.Core.Now().UTC().Add(tgLinkTokenTTL)
	if err := a.Core.Store.InsertTelegramLinkToken(r.Context(), tgHash(token), principal(r).UserID, expires); err != nil {
		fail(w, r, err)
		return
	}
	httpx.OK(w, map[string]any{
		"link":      fmt.Sprintf("https://t.me/%s?start=%s", a.Core.Telegram.BotUsername(), token),
		"expiresAt": expires.Format(time.RFC3339),
	})
}

// telegramLinkDirect (POST /telegram/link) links a user account directly using
// their Telegram Chat ID / User Number, and sends an initial verification message.
func (a *API) telegramLinkDirect(w http.ResponseWriter, r *http.Request) {
	if !a.Core.Telegram.Enabled() {
		fail(w, r, httpx.E(503, "telegram", "Telegram is not set up on this server yet (TELEGRAM_BOT_TOKEN)."))
		return
	}
	var in struct {
		ChatID   any    `json:"chatId"`
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		fail(w, r, httpx.BadRequest("Invalid link payload."))
		return
	}
	var chatID int64
	switch v := in.ChatID.(type) {
	case float64:
		chatID = int64(v)
	case int64:
		chatID = v
	case string:
		clean := strings.TrimSpace(v)
		parsed, _ := strconv.ParseInt(clean, 10, 64)
		chatID = parsed
	}
	if chatID == 0 {
		fail(w, r, httpx.BadRequest("Please provide a valid numeric Telegram Chat ID."))
		return
	}
	welcome := "👋 Trizpyy connected! Your booking confirmations and travel documents will arrive here."
	if err := a.Core.Telegram.SendMessage(r.Context(), chatID, welcome); err != nil {
		slog.Warn("telegram direct link test failed", "chatId", chatID, "err", err)
		fail(w, r, httpx.E(400, "telegram", fmt.Sprintf("We couldn't reach Telegram Chat ID %d. Please open @%s in Telegram and tap START first so the bot has permission to message you.", chatID, a.Core.Telegram.BotUsername())))
		return
	}
	userID := principal(r).UserID
	if err := a.Core.Store.UpsertTelegramConnection(r.Context(), userID, chatID, strings.TrimPrefix(in.Username, "@")); err != nil {
		fail(w, r, err)
		return
	}
	out, err := a.telegramStatusFor(r)
	respond(w, r, out, err)
}

// telegramDisconnect removes the user's chat link.
func (a *API) telegramDisconnect(w http.ResponseWriter, r *http.Request) {
	if err := a.Core.Store.DeleteTelegramConnection(r.Context(), principal(r).UserID); err != nil {
		fail(w, r, err)
		return
	}
	out, err := a.telegramStatusFor(r)
	respond(w, r, out, err)
}

// telegramTest sends a test message to the user's linked chat or an explicitly specified chat ID.
func (a *API) telegramTest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ChatID any `json:"chatId"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	var targetChatID int64
	switch v := body.ChatID.(type) {
	case float64:
		targetChatID = int64(v)
	case int64:
		targetChatID = v
	case string:
		clean := strings.TrimSpace(v)
		targetChatID, _ = strconv.ParseInt(clean, 10, 64)
	}

	if targetChatID == 0 {
		conn, err := a.Core.Store.TelegramConnection(r.Context(), principal(r).UserID)
		if errors.Is(err, store.ErrNotFound) {
			if a.Core.Cfg.TelegramDefaultChatID != 0 {
				targetChatID = a.Core.Cfg.TelegramDefaultChatID
			} else {
				fail(w, r, httpx.Conflict("Connect Telegram first."))
				return
			}
		} else if err != nil {
			fail(w, r, err)
			return
		} else {
			targetChatID = conn.ChatID
		}
	}
	if err := a.Core.Telegram.GetMe(r.Context()); err != nil {
		fail(w, r, httpx.E(502, "telegram", "Telegram is not reachable right now. Please try again in a minute."))
		return
	}
	msg := "👋 Test message from Trizpyy. Your Telegram is connected — booking confirmations and travel documents will arrive here."
	if err := a.Core.Telegram.SendMessage(r.Context(), targetChatID, msg); err != nil {
		slog.Warn("telegram test message failed", "chatId", targetChatID, "err", err)
		fail(w, r, httpx.E(502, "telegram", fmt.Sprintf("We couldn't deliver the test message to %d. Check that you have tapped START on @%s.", targetChatID, a.Core.Telegram.BotUsername())))
		return
	}
	_ = a.Core.Store.TouchTelegramVerified(r.Context(), principal(r).UserID)
	httpx.OK(w, map[string]any{"sent": true, "chatId": targetChatID, "mock": a.Core.Telegram.Mock()})
}

// telegramWebhook receives Bot API updates at /api/telegram/webhook.
// It validates the webhook request using TELEGRAM_WEBHOOK_SECRET (via X-Telegram-Bot-Api-Secret-Token),
// safely parses the update, and returns HTTP 200 to Telegram.
func (a *API) telegramWebhook(w http.ResponseWriter, r *http.Request) {
	secret := a.Core.Cfg.TelegramWebhookSecret
	if secret == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Telegram-Bot-Api-Secret-Token")), []byte(secret)) != 1 {
		httpx.Fail(w, r, httpx.Unauthorized("Invalid or missing webhook secret."))
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 64<<10))
	if err != nil {
		httpx.OK(w, map[string]bool{"ok": true})
		return
	}
	var upd telegram.Update
	if err := json.Unmarshal(body, &upd); err != nil {
		httpx.OK(w, map[string]bool{"ok": true})
		return
	}
	a.ProcessTelegramUpdate(r.Context(), upd)
	httpx.OK(w, map[string]bool{"ok": true})
}

// ProcessTelegramUpdate handles a single Telegram update safely.
// It parses /start, /start <token>, /id, and also auto-links when a user sends
// their registered email or phone number. It never crashes on malformed updates.
func (a *API) ProcessTelegramUpdate(ctx context.Context, upd telegram.Update) {
	if upd.Message == nil || upd.Message.Chat.ID == 0 {
		return
	}
	chatID := upd.Message.Chat.ID
	text := strings.TrimSpace(upd.Message.Text)

	var username string
	if upd.Message.From != nil && upd.Message.From.Username != "" {
		username = upd.Message.From.Username
	} else if upd.Message.Chat.Username != "" {
		username = upd.Message.Chat.Username
	}

	reply := fmt.Sprintf("👋 Welcome to Trizpyy!\n\nYour Telegram Chat ID is: %d\n\nTo link your account:\n• Copy this Chat ID and paste it into Trizpyy Profile → Telegram Settings\n• Or reply here with your account email or phone number to link instantly!", chatID)

	if strings.HasPrefix(text, "/start") {
		payload := strings.TrimSpace(strings.TrimPrefix(text, "/start"))
		if strings.HasPrefix(payload, "@") {
			parts := strings.Fields(payload)
			if len(parts) > 1 {
				payload = strings.TrimSpace(parts[1])
			} else {
				payload = ""
			}
		}
		token := strings.TrimSpace(payload)
		if token != "" {
			userID, err := a.Core.Store.ConsumeTelegramLinkToken(ctx, tgHash(token))
			switch {
			case errors.Is(err, store.ErrNotFound):
				reply = "That connection link has expired. Open Trizpyy → Profile and tap Connect Telegram again."
			case err != nil:
				slog.Warn("telegram link", "err", err)
				reply = "Something went wrong on our side. Please try connecting again from your Trizpyy profile."
			default:
				if err := a.Core.Store.UpsertTelegramConnection(ctx, userID, chatID, username); err != nil {
					slog.Warn("telegram link save", "err", err)
					reply = "Something went wrong on our side. Please try connecting again from your Trizpyy profile."
				} else {
					reply = "✅ Telegram connected! Your Trizpyy booking confirmations and travel documents will arrive here."
				}
			}
		}
	} else if strings.Contains(text, "@") {
		email := strings.ToLower(strings.TrimSpace(text))
		u, err := a.Core.Store.UserByEmail(ctx, email)
		if err == nil && u.ID != "" {
			if err := a.Core.Store.UpsertTelegramConnection(ctx, u.ID, chatID, username); err != nil {
				reply = "Something went wrong saving the link. Please try again or use your profile."
			} else {
				reply = fmt.Sprintf("✅ Telegram successfully linked to your Trizpyy account (%s · %s)! Booking confirmations and travel documents will arrive here.", u.Name, u.Email)
			}
		} else {
			reply = fmt.Sprintf("We couldn't find a Trizpyy account with email %q. Check your spelling or enter your Chat ID (%d) in your Trizpyy profile.", email, chatID)
		}
	} else {
		digitsOnly := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, text)
		if len(digitsOnly) >= 7 {
			u, err := a.Core.Store.UserByPhone(ctx, text)
			if err == nil && u.ID != "" {
				if err := a.Core.Store.UpsertTelegramConnection(ctx, u.ID, chatID, username); err != nil {
					reply = "Something went wrong saving the link. Please try again or use your profile."
				} else {
					reply = fmt.Sprintf("✅ Telegram successfully linked to your Trizpyy account (%s)! Booking confirmations and travel documents will arrive here.", u.Name)
				}
			}
		}
	}

	go func(targetChat int64, text string) {
		sendCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := a.Core.Telegram.SendMessage(sendCtx, targetChat, text); err != nil {
			slog.Warn("telegram reply failed", "err", err)
		}
	}(chatID, reply)
}

// RunTelegramPoller polls Telegram for updates during local development when HTTPS webhooks are unavailable.
func (a *API) RunTelegramPoller(ctx context.Context) {
	if !a.Core.Telegram.Enabled() || a.Core.Telegram.Mock() {
		return
	}
	slog.Info("telegram: starting background update poller for local development")
	var offset int
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		pollCtx, cancel := context.WithTimeout(ctx, 35*time.Second)
		updates, err := a.Core.Telegram.GetUpdates(pollCtx, offset, 100, 25)
		cancel()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Debug("telegram: getUpdates failed", "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(3 * time.Second):
			}
			continue
		}

		for _, upd := range updates {
			if upd.UpdateID >= offset {
				offset = upd.UpdateID + 1
			}
			a.ProcessTelegramUpdate(ctx, upd)
		}
	}
}
