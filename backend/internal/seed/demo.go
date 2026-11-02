package seed

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"trizpyy/internal/app"
	"trizpyy/internal/domain"
	"trizpyy/internal/engine"
	"trizpyy/internal/store"
)

// Demo data for showing the operator panel: three booked trips, each with one open problem,
// planned by the real engine so the Change Impact Map, fix plans, Trip Fixer and What-If
// simulator all work on them. Every demo customer uses a @demo.trizpyy email so the data is
// easy to spot and `go run ./cmd/api demo remove` deletes all of it.

type demoTrip struct {
	customer, email, group string
	prefs                  domain.TripPreferences
	kind                   string // the open problem
}

func demoTrips(today string) []demoTrip {
	p := func(dest, stay, transport string, adults, kids int, interests ...string) domain.TripPreferences {
		return domain.TripPreferences{DestinationID: dest, StartDate: today, Nights: 4, Adults: adults, Kids: kids, BudgetPerPerson: 45000,
			StayType: stay, Transport: transport, Interests: interests, Pace: "balanced", Rhythm: "early-bird"}
	}
	return []demoTrip{
		{"Aarav Sharma", "sharma@demo.trizpyy", "Sharma family · Coorg", p("coorg", "homestay", "car", 2, 2, "nature", "food", "relax"), domain.IncWeather},
		{"Neha Iyer", "iyer@demo.trizpyy", "Iyer friends · Hampi", p("hampi", "boutique", "bus", 4, 0, "culture", "photo", "adventure"), domain.IncVendorUnavailable},
		{"Kabir Mehta", "mehta@demo.trizpyy", "Mehta couple · Gokarna", p("gokarna", "boutique", "bus", 2, 0, "nature", "relax", "food"), domain.IncWeather},
		{"Rohan Kapoor", "kapoor@demo.trizpyy", "Kapoor explorers · Kabini", p("kabini", "luxury", "car", 3, 0, "nature", "adventure", "photo"), domain.IncClosure},
		{"Ananya Verma", "verma@demo.trizpyy", "Verma group · Chikmagalur", p("chikmagalur", "homestay", "car", 4, 0, "adventure", "nature", "food"), domain.IncClosure},
		{"Vikram Fernandez", "fernandez@demo.trizpyy", "Fernandez family · Mysuru", p("mysuru", "boutique", "car", 2, 2, "culture", "food", "relax"), domain.IncVendorUnavailable},
	}
}

// Demo adds the demo trips (skipping any that already exist).
func (sd *Seeder) Demo(ctx context.Context) error {
	c := sd.core
	today := c.Today()
	for _, d := range demoTrips(today) {
		err := c.Tx(ctx, func(st *store.Store, _ *app.Events) error {
			cust, err := st.CustomerByEmail(ctx, d.email)
			if errors.Is(err, store.ErrNotFound) {
				cust = domain.Customer{ID: c.ID("cus"), Name: d.customer, Email: d.email, Phone: "+919800000000", Tone: "sun", Tags: []string{"Demo"}}
				if err := st.CreateCustomer(ctx, OperatorID, cust); err != nil {
					return err
				}
			} else if err != nil {
				return err
			}
			existing, err := st.ListTrips(ctx, store.TripFilter{CustomerID: cust.ID})
			if err != nil {
				return err
			}
			for _, t := range existing {
				if t.Status != domain.TripCompleted {
					slog.Info("demo trip already there", "trip", t.Code, "group", t.GroupName)
					return nil
				}
			}
			code, err := st.NextTripCode(ctx)
			if err != nil {
				return err
			}
			t, err := c.Eng.BuildTrip(d.prefs, engine.BuildOptions{ID: c.ID("trp"), Code: code, CustomerID: cust.ID, CustomerName: cust.Name,
				CoordinatorID: c.Eng.Cat.CoordinatorFor[d.prefs.DestinationID], GroupName: d.group, Status: domain.TripBooked, Now: c.Now().UTC()})
			if err != nil {
				return fmt.Errorf("plan %s: %w", d.group, err)
			}
			if err := st.InsertTrip(ctx, OperatorID, t); err != nil {
				return err
			}
			inc, err := sd.demoIncident(t, d.kind)
			if err != nil {
				return err
			}
			if err := st.InsertIncident(ctx, inc); err != nil {
				return err
			}
			if inc.Kind == domain.IncWeather {
				t.WeatherOverrides = map[int]string{inc.Day: "rain"}
				if err := st.SaveTrip(ctx, t); err != nil {
					return err
				}
			}
			slog.Info("demo trip added", "trip", t.Code, "group", t.GroupName, "problem", inc.Title)
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (sd *Seeder) demoIncident(t *domain.Trip, kind string) (domain.Incident, error) {
	e := sd.core.Eng
	day := engine.DefaultDisruptionDay(t, kind)
	inc := domain.Incident{ID: sd.core.ID("inc"), TripID: t.ID, Kind: kind, Day: day, Source: "operator", Status: domain.IncOpen,
		CreatedAt: sd.core.Now().UTC(), DelayMin: engine.DefaultDelay(kind)}
	if kind == domain.IncVendorUnavailable {
		for _, it := range t.Items {
			if it.Kind == "activity" && it.VendorID != "" && it.Day >= 2 {
				inc.VendorID, inc.Day = it.VendorID, it.Day
				break
			}
		}
		if inc.VendorID == "" {
			return inc, fmt.Errorf("demo trip %s has no activity partner", t.Code)
		}
	}
	place := ""
	if kind == domain.IncClosure {
		if t.DestinationID == "chikmagalur" {
			place = "Hebbe Falls Jeep Trail"
		} else if t.DestinationID == "kabini" {
			place = "Nagarhole Tiger Zone Route"
		} else {
			place = "Western Ghats Ridge Route"
		}
		inc.Place = place
	}
	preset := e.IncidentPreset(t, kind, inc.Day, inc.DelayMin, place)
	inc.Title, inc.Detail, inc.Severity = preset.Title, preset.Detail, preset.Severity
	if kind == domain.IncVendorUnavailable {
		name := e.Cat.VendorName(inc.VendorID)
		inc.Title, inc.Detail = name+" unavailable", name+" cancelled their booking for this group."
	}
	return inc, nil
}

// RemoveDemo deletes the demo trips (with their problems, agent runs and vendor requests) and customers.
func (sd *Seeder) RemoveDemo(ctx context.Context) error {
	c := sd.core
	return c.Tx(ctx, func(st *store.Store, _ *app.Events) error {
		for _, d := range demoTrips(c.Today()) {
			cust, err := st.CustomerByEmail(ctx, d.email)
			if errors.Is(err, store.ErrNotFound) {
				continue
			} else if err != nil {
				return err
			}
			trips, err := st.ListTrips(ctx, store.TripFilter{CustomerID: cust.ID})
			if err != nil {
				return err
			}
			for _, t := range trips {
				if err := st.DeleteTrip(ctx, t.ID); err != nil {
					return err
				}
			}
			if err := st.DeleteCustomer(ctx, cust.ID); err != nil {
				return err
			}
			slog.Info("demo data removed", "customer", cust.Name, "trips", len(trips))
		}
		return nil
	})
}
