"use client";
import { create } from "zustand";
import type { DayForecast } from "@/types";
import { getWeather } from "@/lib/api/geo";

interface WeatherState {
  /** destination -> ISO date -> live forecast (Open-Meteo, via the Go API). */
  byDest: Record<string, Record<string, DayForecast>>;
  source: "open-meteo" | "climate";
  updatedAt?: string;
  attribution: string;
  /** Bumps on every load so components that read forecasts re-render. */
  version: number;
  load: () => Promise<void>;
}

export const useWeatherStore = create<WeatherState>()((set) => ({
  byDest: {},
  source: "climate",
  attribution: "",
  version: 0,
  load: async () => {
    const feed = await getWeather();
    const byDest: WeatherState["byDest"] = {};
    for (const [dest, days] of Object.entries(feed.destinations)) {
      byDest[dest] = {};
      for (const { date, ...f } of days) if (f.source === "open-meteo") byDest[dest][date] = f;
    }
    set((s) => ({ byDest, source: feed.source, updatedAt: feed.updatedAt, attribution: feed.attribution, version: s.version + 1 }));
  },
}));

let timer: ReturnType<typeof setInterval> | undefined;

/** Loads the forecast now and every 30 minutes (the server refreshes on the same cadence). */
export function startWeather() {
  const run = () => useWeatherStore.getState().load().catch(() => undefined);
  void run();
  clearInterval(timer);
  timer = setInterval(run, 30 * 60_000);
}

/** Subscribe a component to forecast updates. */
export const useWeatherVersion = () => useWeatherStore((s) => s.version);
