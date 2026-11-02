package engine

import "trizpyy/internal/domain"

// Forecast returns the live Open-Meteo forecast when one is cached for that date
// (the next 16 days), otherwise the deterministic climate model shared with the frontend.
func (e *Engine) Forecast(destID, iso string) domain.DayForecast {
	if e.Live != nil {
		if f, ok := e.Live(destID, iso); ok {
			f.Day = DaysBetween(e.Today(), iso)
			return f
		}
	}
	d := e.Cat.Destination(destID)
	if d == nil {
		return domain.DayForecast{Day: DaysBetween(e.Today(), iso), TempC: 25, Condition: "sunny"}
	}
	r := Seeded(destID + ":" + iso)
	base := float64(d.Climate.RainChance)
	if containsInt(d.RainyMonths, MonthOf(iso)) {
		base += 35
	}
	rain := clamp(Round(base+(r()-0.5)*40), 0, 95)
	temp := Round(float64(d.Climate.TempC) + (r()-0.5)*6)
	var cond string
	switch {
	case rain >= 75:
		cond = "rain"
	case rain >= 50:
		cond = "cloudy"
	case d.Climate.Condition == "clear":
		cond = "clear"
	case r() > 0.4:
		cond = "sunny"
	default:
		cond = "cloudy"
	}
	return domain.DayForecast{Day: DaysBetween(e.Today(), iso), TempC: temp, Condition: cond, RainChance: rain}
}

func (e *Engine) TripDayWeather(t *domain.Trip, day int) domain.DayForecast {
	base := e.Forecast(t.DestinationID, AddDays(t.Prefs.StartDate, day-1))
	override, ok := t.WeatherOverrides[day]
	if !ok || override == "" {
		return base
	}
	wet := override == "rain" || override == "storm"
	base.Condition = override
	if wet {
		base.RainChance = 92
		base.TempC -= 4
	}
	return base
}

func (e *Engine) TripForecast(t *domain.Trip) []domain.DayForecast {
	out := make([]domain.DayForecast, t.Prefs.Days())
	for i := range out {
		out[i] = e.TripDayWeather(t, i+1)
	}
	return out
}

func IsWet(f domain.DayForecast) bool {
	return f.Condition == "rain" || f.Condition == "storm" || f.RainChance >= 70
}

var ConditionLabel = map[string]string{
	"sunny": "Sunny", "clear": "Clear skies", "cloudy": "Cloudy",
	"rain": "Heavy rain", "storm": "Thunderstorm", "snow": "Snow",
}
