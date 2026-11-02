package store

import (
	"context"
	"time"
)

// TelegramConnection links a Trizpyy user to their Telegram chat for document
// delivery. The bot token is configuration and is never stored here.
type TelegramConnection struct {
	UserID         string
	ChatID         int64
	Username       string
	Status         string
	ConnectedAt    time.Time
	LastVerifiedAt *time.Time
}

func (s *Store) TelegramConnection(ctx context.Context, userID string) (TelegramConnection, error) {
	var c TelegramConnection
	err := s.q.QueryRow(ctx, `SELECT user_id, telegram_chat_id, telegram_username, telegram_status, telegram_connected_at, telegram_last_verified_at
		FROM telegram_connections WHERE user_id=$1`, userID).
		Scan(&c.UserID, &c.ChatID, &c.Username, &c.Status, &c.ConnectedAt, &c.LastVerifiedAt)
	return c, notFound(err)
}

func (s *Store) TelegramConnectionByPhoneOrEmail(ctx context.Context, contact string) (TelegramConnection, error) {
	var c TelegramConnection
	err := s.q.QueryRow(ctx, `SELECT c.user_id, c.telegram_chat_id, c.telegram_username, c.telegram_status, c.telegram_connected_at, c.telegram_last_verified_at
		FROM telegram_connections c
		JOIN users u ON u.id = c.user_id
		WHERE (lower(u.email) = lower(trim($1)) OR 
		       (length(regexp_replace($1, '\D', '', 'g')) >= 7 AND regexp_replace(u.phone, '\D', '', 'g') = regexp_replace($1, '\D', '', 'g')))
		AND c.telegram_status = 'connected' LIMIT 1`, contact).
		Scan(&c.UserID, &c.ChatID, &c.Username, &c.Status, &c.ConnectedAt, &c.LastVerifiedAt)
	return c, notFound(err)
}

func (s *Store) UpsertTelegramConnection(ctx context.Context, userID string, chatID int64, username string) error {
	_, err := s.q.Exec(ctx, `INSERT INTO telegram_connections (user_id, telegram_chat_id, telegram_username, telegram_status, telegram_connected_at, telegram_last_verified_at)
		VALUES ($1,$2,$3,'connected',now(),now())
		ON CONFLICT (user_id) DO UPDATE SET telegram_chat_id=$2, telegram_username=$3, telegram_status='connected',
			telegram_connected_at=now(), telegram_last_verified_at=now()`, userID, chatID, username)
	return err
}

func (s *Store) DeleteTelegramConnection(ctx context.Context, userID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM telegram_connections WHERE user_id=$1`, userID)
	return err
}

func (s *Store) TouchTelegramVerified(ctx context.Context, userID string) error {
	_, err := s.q.Exec(ctx, `UPDATE telegram_connections SET telegram_last_verified_at=now() WHERE user_id=$1`, userID)
	return err
}

// InsertTelegramLinkToken stores the hash of a fresh single-use linking token
// and voids the user's previous unused tokens.
func (s *Store) InsertTelegramLinkToken(ctx context.Context, tokenHash, userID string, expiresAt time.Time) error {
	if _, err := s.q.Exec(ctx, `UPDATE telegram_link_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, userID); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `INSERT INTO telegram_link_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)`, tokenHash, userID, expiresAt)
	return err
}

// ConsumeTelegramLinkToken marks a live token used and returns its user.
// ErrNotFound means unknown, expired or already used — callers treat all the same.
func (s *Store) ConsumeTelegramLinkToken(ctx context.Context, tokenHash string) (string, error) {
	var userID string
	err := s.q.QueryRow(ctx, `UPDATE telegram_link_tokens SET used_at=now()
		WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`, tokenHash).Scan(&userID)
	return userID, notFound(err)
}
