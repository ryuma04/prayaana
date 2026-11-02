// Package jobs runs the background work that keeps data real: Google Maps ratings for the catalog,
// vendor trust scores from request history, and the weather early-warning scan.
package jobs

import (
	"context"
	"log/slog"
	"time"

	"trizpyy/internal/app"
	"trizpyy/internal/catalog"
	"trizpyy/internal/engine"
	"trizpyy/internal/providers"
)

// every runs fn now and then on each tick until ctx ends.
func every(ctx context.Context, name string, d time.Duration, fn func(context.Context) error) {
	tick := time.NewTicker(d)
	defer tick.Stop()
	for {
		if err := fn(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("background job", "job", name, "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

// Trust keeps the engine's vendor trust scores in step with real request history.
func Trust(ctx context.Context, c *app.Core) {
	every(ctx, "vendor-trust", 2*time.Minute, func(ctx context.Context) error {
		scores, err := c.Store.VendorTrust(ctx)
		if err != nil {
			return err
		}
		c.Eng.Cat.SetTrust(scores)
		return nil
	})
}

// Semantic loads activity similarity from the Python AI service into memory, so swap ranking
// can use it without waiting on the network. Without the service, ranking uses shared tags.
func Semantic(ctx context.Context, c *app.Core) {
	if c.AISvc == nil {
		slog.Info("ai service off: no AI_SERVICE_URL (semantic ranking uses tags)")
		return
	}
	every(ctx, "semantic-similarity", 2*time.Minute, func(ctx context.Context) error {
		if h, err := c.AISvc.Health(ctx); err != nil || h.Semantic.Status != "ready" {
			return nil // try again next tick; the model may still be loading
		}
		m, err := c.AISvc.SimilarityMatrix(ctx)
		if err != nil {
			return err
		}
		c.Eng.Cat.SetSimilarity(m)
		return nil
	})
}

// Ratings looks up the real Google Maps rating of every experience and stay (a few per run, so the
// Places quota is never burst) and refreshes each one monthly. Items with no listing stay unrated.
func Ratings(ctx context.Context, c *app.Core, places *providers.Places) {
	if !places.Enabled() {
		slog.Info("google ratings off: no GOOGLE_PLACES_API_KEY")
		return
	}
	every(ctx, "google-ratings", 10*time.Minute, func(ctx context.Context) error {
		items, err := c.Store.UnratedItems(ctx, 25)
		if err != nil || len(items) == 0 {
			return err
		}
		found := 0
		for _, it := range items {
			if ctx.Err() != nil {
				return nil
			}
			dest := c.Eng.Cat.Destination(it.DestinationID)
			query := it.Name
			if dest != nil {
				query += ", " + dest.Name
			}
			res, err := places.Search(ctx, providers.PlaceQuery{Text: query, Center: providers.LatLng{Lat: it.Lat, Lng: it.Lng}, RadiusM: 15000, MaxCount: 3})
			if err != nil {
				return err // quota or outage: try again next run
			}
			r := catalog.Rating{}
			for _, p := range res {
				// Only accept a listing near where the catalog says the place is.
				if p.Rating > 0 && engine.HaversineKm(it.Lat, it.Lng, p.Lat, p.Lng) <= 25 {
					r = catalog.Rating{Stars: p.Rating, Reviews: p.Reviews, PlaceID: p.ID, MapsURL: p.MapsURL}
					found++
					break
				}
			}
			if err := c.Store.SetRating(ctx, it.Kind, it.ID, r.Stars, r.Reviews, r.PlaceID, r.MapsURL); err != nil {
				return err
			}
			c.Eng.Cat.SetRating(it.ID, r)
			time.Sleep(250 * time.Millisecond)
		}
		slog.Info("google ratings updated", "checked", len(items), "rated", found)
		return nil
	})
}
