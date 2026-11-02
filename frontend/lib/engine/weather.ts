import type { DayForecast, DestinationId, Trip } from "@/types";
import { destinationMap } from "@/data/destinations";
import { seeded } from "@/lib/hash";
import { useWeatherStore } from "@/stores/weatherStore";
import { addDays, daysBetween, todayISO } from "@/lib/format";

/**
 * Forecast for a destination on a date: the live Open-Meteo forecast served by the Go API
 * (next 16 days) when loaded, otherwise the deterministic climate model shared with the server.
 */
export function forecastFor(destinationId: DestinationId, iso: string): DayForecast {
  const live = useWeatherStore.getState().byDest[destinationId]?.[iso];
  if (live) return { ...live, day: daysBetween(todayISO(), iso) };
  const dest = destinationMap[destinationId];
  const r = seeded(`${destinationId}:${iso}`);
  const month = Number(iso.slice(5, 7));
  const rainyMonth = dest.rainyMonths.includes(month);
  const baseRain = dest.climate.rainChance + (rainyMonth ? 35 : 0);
  const rainChance = Math.max(0, Math.min(95, Math.round(baseRain + (r() - 0.5) * 40)));
  const tempC = Math.round(dest.climate.tempC + (r() - 0.5) * 6);
  let condition: DayForecast["condition"];
  if (rainChance >= 75) condition = "rain";
  else if (rainChance >= 50) condition = "cloudy";
  else condition = dest.climate.condition === "clear" ? "clear" : r() > 0.4 ? "sunny" : "cloudy";
  return { day: daysBetween(todayISO(), iso), tempC, condition, rainChance };
}

export function tripDayWeather(trip: Trip, day: number): DayForecast {
  const iso = addDays(trip.prefs.startDate, day - 1);
  const base = forecastFor(trip.destinationId, iso);
  const override = trip.weatherOverrides?.[day];
  if (!override) return base;
  const rain = override === "rain" || override === "storm";
  return { ...base, condition: override, rainChance: rain ? 92 : base.rainChance, tempC: rain ? base.tempC - 4 : base.tempC };
}

export function tripForecast(trip: Trip) {
  return Array.from({ length: trip.prefs.nights + 1 }, (_, i) => tripDayWeather(trip, i + 1));
}

export function isWet(f: DayForecast) {
  return f.condition === "rain" || f.condition === "storm" || f.rainChance >= 70;
}

export const conditionLabel: Record<DayForecast["condition"], string> = {
  sunny: "Sunny",
  clear: "Clear skies",
  cloudy: "Cloudy",
  rain: "Heavy rain",
  storm: "Thunderstorm",
  snow: "Snow",
};
