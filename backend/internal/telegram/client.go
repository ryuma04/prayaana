// Package telegram delivers customer-facing booking confirmations and trip
// documents through the official Telegram Bot API (@TrizpyyBot). It replaced
// the WhatsApp delivery for travelers. It intentionally has no database
// dependency: callers queue sends only after their transaction has committed.
package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ModeMock never calls the real API: sends are logged as mock and are never
// claimed to be real deliveries.
const ModeMock = "mock"

type Sender interface {
	Enabled() bool
	Mock() bool
	BotUsername() string
	GetMe(ctx context.Context) error
	SendMessage(ctx context.Context, chatID int64, text string) error
	SendDocument(ctx context.Context, chatID int64, fileName string, content []byte, caption string) error
	SetWebhook(ctx context.Context, webhookURL, secretToken string) error
	DeleteWebhook(ctx context.Context, dropPendingUpdates bool) error
	GetUpdates(ctx context.Context, offset int, limit int, timeout int) ([]Update, error)
}

type Update struct {
	UpdateID int      `json:"update_id"`
	Message  *Message `json:"message"`
}

type Message struct {
	MessageID int    `json:"message_id"`
	From      *User  `json:"from"`
	Chat      Chat   `json:"chat"`
	Text      string `json:"text"`
	Date      int    `json:"date"`
}

type User struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	Username  string `json:"username"`
}

type Chat struct {
	ID       int64  `json:"id"`
	Type     string `json:"type"`
	Username string `json:"username"`
}

type Config struct {
	Token    string // bot token: a backend secret, never logged or exposed to the frontend
	Username string // bot username without @, e.g. TrizpyyBot
	BaseURL  string // https://api.telegram.org
	Mode     string // "telegram" (real API) or "mock"
}

type Client struct {
	token, username, baseURL, mode string
	http                           *http.Client
}

func New(c Config) *Client {
	return &Client{token: c.Token, username: strings.TrimPrefix(c.Username, "@"),
		baseURL: strings.TrimRight(c.BaseURL, "/"), mode: strings.ToLower(c.Mode),
		http: &http.Client{Timeout: 30 * time.Second}}
}

func (c *Client) Mock() bool { return c != nil && c.mode == ModeMock }

func (c *Client) Enabled() bool {
	if c == nil {
		return false
	}
	return c.Mock() || (c.token != "" && c.baseURL != "")
}

func (c *Client) BotUsername() string {
	if c == nil {
		return ""
	}
	return c.username
}

// GetMe verifies the bot token against the Bot API.
func (c *Client) GetMe(ctx context.Context) error {
	if c.Mock() {
		return nil
	}
	return c.call(ctx, "getMe", "application/json", []byte(`{}`))
}

func (c *Client) SendMessage(ctx context.Context, chatID int64, text string) error {
	if c.Mock() {
		slog.Info("mock telegram: sendMessage skipped (no real message was sent)", "chatId", chatID)
		return nil
	}
	body, err := json.Marshal(map[string]any{"chat_id": chatID, "text": text})
	if err != nil {
		return err
	}
	return c.call(ctx, "sendMessage", "application/json", body)
}

// SendDocument uploads one PDF with multipart/form-data.
func (c *Client) SendDocument(ctx context.Context, chatID int64, fileName string, content []byte, caption string) error {
	if c.Mock() {
		slog.Info("mock telegram: sendDocument skipped (no real file was sent)", "chatId", chatID, "file", fileName)
		return nil
	}
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	_ = mw.WriteField("chat_id", strconv.FormatInt(chatID, 10))
	if caption != "" {
		_ = mw.WriteField("caption", caption)
	}
	fw, err := mw.CreateFormFile("document", fileName)
	if err != nil {
		return err
	}
	if _, err := fw.Write(content); err != nil {
		return err
	}
	if err := mw.Close(); err != nil {
		return err
	}
	return c.call(ctx, "sendDocument", mw.FormDataContentType(), buf.Bytes())
}

// call posts one Bot API method with limited exponential backoff on timeouts,
// network failures, 429 and 5xx. Other 4xx answers (invalid chat, the user
// blocked the bot, bad request) are permanent and never retried.
func (c *Client) call(ctx context.Context, method, contentType string, body []byte) error {
	url := fmt.Sprintf("%s/bot%s/%s", c.baseURL, c.token, method)
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return lastErr
			case <-time.After(time.Duration(1<<attempt) * time.Second):
			}
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return c.redact(err)
		}
		req.Header.Set("Content-Type", contentType)
		resp, err := c.http.Do(req)
		if err != nil {
			lastErr = c.redact(err)
			continue
		}
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<10))
		resp.Body.Close()
		if resp.StatusCode < http.StatusMultipleChoices {
			return nil
		}
		lastErr = fmt.Errorf("telegram %s: status %d: %s", method, resp.StatusCode, strings.TrimSpace(string(raw)))
		if resp.StatusCode != http.StatusTooManyRequests && resp.StatusCode < 500 {
			return lastErr
		}
	}
	return lastErr
}

// redact keeps the bot token out of every error (request errors embed the URL).
func (c *Client) redact(err error) error {
	if err == nil || c.token == "" {
		return err
	}
	return errors.New(strings.ReplaceAll(err.Error(), c.token, "***"))
}

// SetWebhook registers the HTTPS webhook URL with the optional secret token.
func (c *Client) SetWebhook(ctx context.Context, webhookURL, secretToken string) error {
	if c.Mock() {
		slog.Info("mock telegram: setWebhook skipped", "url", webhookURL)
		return nil
	}
	payload := map[string]any{
		"url":             webhookURL,
		"allowed_updates": []string{"message"},
	}
	if secretToken != "" {
		payload["secret_token"] = secretToken
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.call(ctx, "setWebhook", "application/json", body)
}

// DeleteWebhook deletes the active webhook.
func (c *Client) DeleteWebhook(ctx context.Context, dropPendingUpdates bool) error {
	if c.Mock() {
		return nil
	}
	payload := map[string]any{"drop_pending_updates": dropPendingUpdates}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.call(ctx, "deleteWebhook", "application/json", body)
}

// GetUpdates performs long-polling to retrieve updates for local development.
func (c *Client) GetUpdates(ctx context.Context, offset, limit, timeout int) ([]Update, error) {
	if c.Mock() {
		return nil, nil
	}
	payload := map[string]any{
		"offset":          offset,
		"limit":           limit,
		"timeout":         timeout,
		"allowed_updates": []string{"message"},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/bot%s/getUpdates", c.baseURL, c.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, c.redact(err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, c.redact(err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 512<<10))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("telegram getUpdates: status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	var res struct {
		OK          bool     `json:"ok"`
		Description string   `json:"description"`
		Result      []Update `json:"result"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return nil, err
	}
	if !res.OK {
		return nil, fmt.Errorf("telegram getUpdates: %s", res.Description)
	}
	return res.Result, nil
}
