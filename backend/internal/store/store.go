// Package store holds the Postgres repositories. Every method works on either
// the pool or a transaction, so services compose them atomically.
package store

import (
	"errors"

	"github.com/jackc/pgx/v5"

	"trizpyy/internal/platform/db"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("changed by someone else")
)

type Store struct {
	q db.DBTX
}

func New(q db.DBTX) *Store { return &Store{q: q} }

// With returns a store bound to the given transaction.
func (s *Store) With(tx pgx.Tx) *Store { return &Store{q: tx} }

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func strs(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}
