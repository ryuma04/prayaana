// Package engine is the pure trip logic: planning, pricing, schedule reflow,
// change impact, fix plans, mood re-plans and safety checks. It never touches
// the database; callers pass trips in and persist what comes out.
package engine

import (
	"crypto/rand"
	"math/big"

	"trizpyy/internal/catalog"
	"trizpyy/internal/domain"
)

type Engine struct {
	Cat   *catalog.Catalog
	Today func() string
	NewID func(prefix string) string
	// Live optionally supplies a real forecast (Open-Meteo). It must only read
	// from memory: the engine never waits on the network.
	Live func(destID, iso string) (domain.DayForecast, bool)
}

func New(cat *catalog.Catalog, today func() string) *Engine {
	return &Engine{Cat: cat, Today: today, NewID: RandomID}
}

const idAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz"

func RandomID(prefix string) string {
	b := make([]byte, 10)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(idAlphabet))))
		if err != nil {
			panic(err)
		}
		b[i] = idAlphabet[n.Int64()]
	}
	return prefix + "-" + string(b)
}

func Travelers(p domain.TripPreferences) int { return p.Adults + p.Kids }

func RoomsFor(p domain.TripPreferences) int {
	r := (p.Adults + 1) / 2
	if r < 1 {
		return 1
	}
	return r
}

func VehiclesFor(p domain.TripPreferences) int {
	v := (p.Adults + p.Kids + 4) / 5
	if v < 1 {
		return 1
	}
	return v
}
