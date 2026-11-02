"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { SparkleIcon, CheckCircleIcon, CalendarBlankIcon, CloudRainIcon, SunIcon, PencilSimpleIcon, MagnifyingGlassIcon, PlusIcon, NavigationArrowIcon, MapPinIcon, CrosshairIcon } from "@phosphor-icons/react";
import type { DestinationId, Interest, StayType, TransportMode } from "@/types";
import { destinations, destinationMap, monthNames } from "@/data/destinations";
import { staysFor, transportFor } from "@/data/stays";
import { DestinationArt } from "@/components/art/DestinationArt";
import { Chip, Slider, Stepper, Textarea, Badge } from "@/components/ui/primitives";
import { OptionCard } from "./StepShell";
import { parseWishes } from "@/lib/engine/planner";
import { forecastFor, isWet } from "@/lib/engine/weather";
import { addDays, cn, duration, formatDate, haversineKm, rupees, todayISO } from "@/lib/format";
import type { OnboardingAnswers } from "@/stores/travelerStore";
import {
  getPlaceAutocomplete,
  getPlaceDetails,
  getReverseGeocode,
  type PlaceAutocompleteResult,
  type TransportHub,
} from "@/lib/api/geo";
import { useModeHubs, validPoint } from "@/hooks/useModeHubs";
import { Glyph } from "@/lib/icons";

export type SetA = (patch: Partial<OnboardingAnswers>) => void;
interface P {
  a: OnboardingAnswers;
  set: SetA;
}

export function WhereStep({ a, set, recommended }: P & { recommended?: DestinationId }) {
  const [search, setSearch] = useState("");
  const [placeResults, setPlaceResults] = useState<{ id: string; name: string; description: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selectedIds = a.destinationIds ?? (a.destinationId ? [a.destinationId] : []);

  const toggleDest = (id: DestinationId) => {
    const cur = selectedIds;
    if (cur.includes(id)) {
      const next = cur.filter((x) => x !== id);
      const nextPlaces = (a.destinationPlaces || []).filter((x) => x.placeId !== id && x.name.toLowerCase().replace(/\s+/g, "-") !== id);
      set({
        destinationIds: next,
        destinationId: next[0] ?? null,
        destinationPlaces: nextPlaces,
      });
    } else {
      const dest = destinations.find((d) => d.id === id);
      const next = [...cur, id];
      set({
        destinationIds: next,
        destinationId: next[0],
        // Never overwrite an origin the traveller resolved themselves.
        fromCity: a.originPlace ? a.fromCity : dest?.fromCity ?? a.fromCity,
        nights: Math.max(2, Math.min(a.nights + (next.length > 1 ? 2 : 0), 12)),
      });
    }
  };

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setPlaceResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await getPlaceAutocomplete(q);
        if (data) {
          setPlaceResults(
            data.map((p) => ({
              id: p.placeId,
              name: p.primaryText || p.text,
              description: p.secondaryText || p.text,
            }))
          );
        }
      } catch { /* silent */ }
      setSearching(false);
    }, 350);
  }, []);

  const filtered = search.trim().length >= 2
    ? destinations.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.state.toLowerCase().includes(search.toLowerCase()))
    : destinations;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <MagnifyingGlassIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search destinations (e.g. Navi Mumbai, Goa, Jaipur)…"
          className="w-full rounded-2xl border-2 border-line bg-white py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-purple focus:ring-2 focus:ring-purple/20"
          aria-label="Search destinations"
        />
        {searching && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted animate-pulse">Searching…</span>}
      </div>

      {/* Selected destinations chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-deep">Selected ({selectedIds.length}):</span>
          {selectedIds.map((id) => {
            const d = destinations.find((x) => x.id === id);
            const dp = a.destinationPlaces?.find((x) => x.placeId === id || x.name.toLowerCase().replace(/\s+/g, "-") === id);
            const label = d?.name ?? dp?.name ?? id;
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-purple px-3 py-1 text-xs font-bold text-white shadow-pop">
                <span>{label}</span>
                <button
                  type="button"
                  onClick={() => toggleDest(id as DestinationId)}
                  className="rounded-full hover:bg-white/20 p-0.5"
                  aria-label={`Remove ${label}`}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Place results from Google API */}
      {placeResults.length > 0 && (
        <div className="rounded-2xl border-2 border-dashed border-purple/30 bg-lavender-soft/50 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-deep">Google Places suggestions</p>
          {placeResults.slice(0, 5).map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-sm hover:bg-white transition"
              onClick={async () => {
                try {
                  const details = await getPlaceDetails(p.id);
                  const cleanName = details.name || p.name;
                  const cleanId = (details.city || cleanName).toLowerCase().replace(/\s+/g, "-");
                  const placeIdentity = {
                    placeId: details.id || cleanId,
                    name: cleanName,
                    formattedAddress: details.formattedAddress,
                    lat: details.lat,
                    lng: details.lng,
                    city: details.city || cleanName,
                    state: details.state,
                    country: details.country || "India",
                  };
                  const cur = selectedIds;
                  const next = cur.includes(cleanId) ? cur : [...cur, cleanId];
                  const existingPlaces = a.destinationPlaces || [];
                  const nextPlaces = existingPlaces.some((x) => x.placeId === placeIdentity.placeId || x.name === placeIdentity.name)
                    ? existingPlaces
                    : [...existingPlaces, placeIdentity];
                  set({
                    destinationIds: next,
                    destinationId: next[0],
                    destinationPlaces: nextPlaces,
                    fromCity: a.fromCity || "Delhi",
                    nights: Math.max(a.nights, next.length > 1 ? next.length * 2 : 3),
                  });
                } catch {
                  const match = destinations.find(
                    (d) =>
                      d.name.toLowerCase() === p.name.toLowerCase() ||
                      p.description.toLowerCase().includes(d.name.toLowerCase()) ||
                      d.state.toLowerCase().includes(p.name.toLowerCase())
                  );
                  if (match) {
                    toggleDest(match.id as DestinationId);
                  }
                }
                setSearch("");
                setPlaceResults([]);
              }}
            >
              <MapPinIcon size={16} className="text-purple shrink-0" />
              <div className="flex-1 truncate">
                <span className="font-bold text-ink">{p.name}</span>
                <span className="ml-1.5 text-xs text-muted truncate">{p.description}</span>
              </div>
              <span className="text-xs font-bold text-purple-deep bg-lavender px-2 py-0.5 rounded-full">Add</span>
            </button>
          ))}
        </div>
      )}

      {/* Destination grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Destinations">
        {filtered.map((d, i) => {
          const on = selectedIds.includes(d.id);
          return (
            <motion.button
              key={d.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleDest(d.id)}
              className={cn("group relative overflow-hidden rounded-[24px] bg-white text-left transition", on ? "ring-[3px] ring-ink shadow-pop" : "shadow-clay-sm hover:-translate-y-0.5")}
            >
              <div className="h-24 overflow-hidden sm:h-28">
                <DestinationArt kind={d.art} className="transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-3">
                <p className="font-display text-sm font-bold">{d.name}</p>
                <p className="truncate text-[11px] text-muted">{d.moods.slice(0, 2).join(" · ")}</p>
              </div>
              {recommended === d.id && <span className="absolute left-2 top-2 rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-[10px] font-bold">Your DNA pick</span>}
              {on && <CheckCircleIcon size={26} weight="fill" className="absolute right-2 top-2 rounded-full bg-white text-purple" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Popular cities used as quick-picks in the "from" step ──────────── */
const FROM_CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673 },
];

/** Geocode a free-text query via Nominatim (free, no key). Returns first result or null. */
async function geocode(q: string): Promise<{ display: string; lat: number; lng: number; city: string } | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`, {
      headers: { "Accept-Language": "en" },
    });
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    if (!data.length) return null;
    const top = data[0];
    // Extract city from display_name (usually the 2nd or 3rd part)
    const parts = top.display_name.split(", ");
    const city = parts.find((p) => FROM_CITIES.some((c) => p.includes(c.name))) ?? parts[0];
    return { display: top.display_name, lat: parseFloat(top.lat), lng: parseFloat(top.lon), city };
  } catch {
    return null;
  }
}

/** Fetch place suggestions from Nominatim for autocomplete. */
async function fetchSuggestions(q: string): Promise<{ display: string; lat: number; lng: number; city: string }[]> {
  if (q.length < 2) return [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`, {
      headers: { "Accept-Language": "en" },
    });
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return data.map((d) => {
      const parts = d.display_name.split(", ");
      const city = parts.find((p) => FROM_CITIES.some((c) => p.includes(c.name))) ?? parts[0];
      return { display: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon), city };
    });
  } catch {
    return [];
  }
}

export function FromStep({ a, set }: P) {
  const [query, setQuery] = useState(a.fromAddress || "");
  const [suggestions, setSuggestions] = useState<{ display: string; lat: number; lng: number; city: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete
  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await fetchSuggestions(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSearching(false);
    }, 350);
  }, []);

  const selectSuggestion = useCallback((s: { display: string; lat: number; lng: number; city: string }) => {
    setQuery(s.display.split(",").slice(0, 3).join(","));
    setShowSuggestions(false);
    set({ fromAddress: s.display.split(",").slice(0, 3).join(","), fromCity: s.city, fromLat: s.lat, fromLng: s.lng });
  }, [set]);


  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Handle manual Enter
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    const result = await geocode(query);
    setSearching(false);
    if (result) {
      setQuery(result.display.split(",").slice(0, 3).join(","));
      set({ fromAddress: result.display.split(",").slice(0, 3).join(","), fromCity: result.city, fromLat: result.lat, fromLng: result.lng });
    }
  }, [query, set]);

  const dest = a.destinationId ? destinationMap[a.destinationId] : undefined;

  return (
    <div className="space-y-6">
      {/* Selected origin card */}
      {a.fromLat && a.fromAddress && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-4 rounded-[24px] bg-white p-5 shadow-clay"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-purple to-lavender text-white shadow-pop">
            <NavigationArrowIcon size={26} weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Travelling from</p>
            <p className="mt-0.5 truncate font-display text-lg font-extrabold">{a.fromAddress}</p>
            {dest && (
              <p className="text-xs text-muted">
                → {dest.name}, {dest.state}
              </p>
            )}
          </div>
          <CheckCircleIcon size={26} weight="fill" className="shrink-0 text-success" />
        </motion.div>
      )}

      {/* Search input */}
      <div ref={wrapperRef} className="relative">
        <label className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-clay-sm focus-within:ring-2 focus-within:ring-purple">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lavender-soft">
            <MagnifyingGlassIcon size={22} weight="duotone" className="text-purple" />
          </span>
          <span className="flex-1">
            <span className="block text-xs font-semibold text-muted">Your city or locality</span>
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Andheri West, Mumbai"
              className="w-full bg-transparent font-display text-base font-bold outline-none placeholder:text-ink/25"
              aria-label="Search your city or address"
              id="from-address-input"
            />
          </span>
          {searching && <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-lavender border-t-purple" />}
        </label>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-[20px] bg-white shadow-pop-lg border-2 border-ink"
          >
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-lavender-soft transition first:rounded-t-[18px] last:rounded-b-[18px]"
                >
                  <MapPinIcon size={18} weight="duotone" className="shrink-0 text-purple" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.display.split(",").slice(0, 2).join(",")}</span>
                    <span className="block truncate text-xs text-muted">{s.display.split(",").slice(2, 5).join(",")}</span>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </div>

    </div>
  );
}

export function WhenStep({ a, set }: P) {
  const dest = a.destinationId ? destinationMap[a.destinationId] : undefined;
  const flex = useMemo(() => {
    if (!dest) return [];
    return [-3, -2, -1, 0, 1, 2, 3].map((off) => {
      const iso = addDays(a.startDate, off);
      const days = Array.from({ length: a.nights + 1 }, (_, i) => forecastFor(dest.id, addDays(iso, i)));
      const rain = Math.round(days.reduce((s, f) => s + f.rainChance, 0) / days.length);
      const weekendNights = Array.from({ length: a.nights }, (_, i) => new Date(`${addDays(iso, i)}T00:00:00`).getDay()).filter((d) => d === 5 || d === 6).length;
      const stay = staysFor(dest.id).find((s) => s.type === a.stayType) ?? staysFor(dest.id)[1];
      const delta = Math.round(weekendNights * stay.nightlyPrice * 0.18);
      return { off, iso, rain, delta, wet: days.filter(isWet).length };
    });
  }, [dest, a.startDate, a.nights, a.stayType]);
  const base = flex.find((f) => f.off === 0)?.delta ?? 0;
  const month = Number(a.startDate.slice(5, 7));
  return (
    <div className="space-y-6">
      <label className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-clay-sm">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky">
          <CalendarBlankIcon size={22} weight="duotone" />
        </span>
        <span className="flex-1">
          <span className="block text-xs font-semibold text-muted">Start date</span>
          <input
            type="date"
            min={todayISO()}
            value={a.startDate}
            onChange={(e) => e.target.value && set({ startDate: e.target.value })}
            className="w-full bg-transparent font-display text-lg font-bold outline-none"
            aria-label="Start date"
          />
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {[
          ["Tomorrow", 1],
          ["This weekend", ((6 - new Date().getDay() + 7) % 7) || 7],
          ["In 2 weeks", 14],
          ["Next month", 30],
        ].map(([l, d]) => (
          <Chip key={l as string} size="sm" selected={a.startDate === addDays(todayISO(), d as number)} onClick={() => set({ startDate: addDays(todayISO(), d as number) })}>
            {l as string}
          </Chip>
        ))}
      </div>
      {dest && (
        <div className="rounded-[24px] bg-white p-4 shadow-clay-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-bold">Flex-date saver</p>
            {dest.rainyMonths.includes(month) ? <Badge tone="sky">Monsoon month in {dest.name}</Badge> : dest.bestMonths.includes(month) ? <Badge tone="mint">Best season ✓</Badge> : null}
          </div>
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {flex.map((f) => {
              const diff = f.delta - base;
              const on = f.off === 0;
              return (
                <button
                  key={f.iso}
                  type="button"
                  onClick={() => set({ startDate: f.iso })}
                  className={cn("flex w-24 shrink-0 flex-col items-center rounded-2xl p-2.5 text-center transition", on ? "bg-ink text-white" : "bg-canvas hover:bg-lavender-soft")}
                  aria-label={`Start ${formatDate(f.iso)}, ${f.rain}% rain`}
                >
                  <span className="text-[11px] font-semibold opacity-70">{formatDate(f.iso, { weekday: "short" })}</span>
                  <span className="font-display text-sm font-bold">{formatDate(f.iso)}</span>
                  <span className={cn("mt-1 inline-flex items-center gap-0.5 text-[11px]", !on && f.wet ? "text-sky-deep" : "")}>
                    {f.wet ? <CloudRainIcon size={12} /> : <SunIcon size={12} />} {f.rain}%
                  </span>
                  <span className={cn("text-[11px] font-bold", on ? "" : diff < 0 ? "text-success" : diff > 0 ? "text-danger" : "text-muted")}>{on ? "Selected" : diff === 0 ? "Same" : rupees(diff, { sign: true })}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Weekend nights cost more; rain chance from the forecast. Best months: {dest.bestMonths.map((m) => monthNames[m - 1]).join(", ")}.</p>
        </div>
      )}
    </div>
  );
}

export function DaysStep({ a, set }: P) {
  const dest = a.destinationId ? destinationMap[a.destinationId] : undefined;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-[28px] bg-white p-6 shadow-clay">
        <div>
          <p className="font-display text-5xl font-extrabold tabular">{a.nights + 1}</p>
          <p className="text-sm font-semibold text-muted">days · {a.nights} nights</p>
        </div>
        <Stepper value={a.nights} onChange={(v) => set({ nights: v })} min={1} max={10} label="nights" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[2, 3, 4, 5, 6].map((n) => (
          <Chip key={n} selected={a.nights === n} onClick={() => set({ nights: n })}>
            {n + 1} days
          </Chip>
        ))}
      </div>
      {dest && (
        <p className="rounded-2xl bg-sun-soft p-4 text-sm">
          💡 Most travellers spend <b>{dest.idealDays}</b> in {dest.name}.
        </p>
      )}
    </div>
  );
}

export function AllocationStep({ a, set }: P) {
  const destIds = a.destinationIds?.length ? a.destinationIds : (a.destinationId ? [a.destinationId] : []);
  const totalDays = a.nights + 1;
  const initKeyRef = useRef<string>("");
  const currentKey = `${destIds.join(",")}_${totalDays}`;

  useEffect(() => {
    const curAlloc = a.destinationAllocations || {};
    const hasAll = destIds.length > 0 && destIds.every((id) => typeof curAlloc[id] === "number" && curAlloc[id] > 0);
    if (!hasAll || initKeyRef.current !== currentKey) {
      initKeyRef.current = currentKey;
      const initial: Record<string, number> = {};
      const base = Math.max(1, Math.floor(totalDays / Math.max(1, destIds.length)));
      const remainder = totalDays - base * destIds.length;
      destIds.forEach((id, idx) => {
        initial[id] = base + (idx < remainder ? 1 : 0);
      });
      const newSum = Object.values(initial).reduce((acc, v) => acc + v, 0);
      if (newSum !== totalDays && destIds.length > 0) {
        initial[destIds[0]] = Math.max(1, initial[destIds[0]] + (totalDays - newSum));
      }
      set({ destinationAllocations: initial });
    }
  }, [destIds, totalDays, currentKey, a.destinationAllocations, set]);

  const allocations = a.destinationAllocations || {};
  const allocatedSum = destIds.reduce((sum, id) => sum + (allocations[id] || 0), 0);
  const isValid = allocatedSum === totalDays;

  const updateAllocation = (id: string, delta: number) => {
    const current = allocations[id] || 1;
    // Smart 2-destination balancing: if exactly 2 destinations and currently balanced,
    // adjust both so user stays in balance in 1 click!
    if (destIds.length === 2 && allocatedSum === totalDays) {
      const otherId = destIds.find((x) => x !== id)!;
      const otherCurrent = allocations[otherId] || 1;
      if (delta > 0 && otherCurrent > 1) {
        set({
          destinationAllocations: {
            ...allocations,
            [id]: current + 1,
            [otherId]: otherCurrent - 1,
          },
        });
        return;
      } else if (delta < 0 && current > 1) {
        set({
          destinationAllocations: {
            ...allocations,
            [id]: current - 1,
            [otherId]: otherCurrent + 1,
          },
        });
        return;
      }
    }
    // Standard adjustment (e.g. for >2 destinations or if not balanced)
    const nextVal = Math.max(1, current + delta);
    set({
      destinationAllocations: {
        ...allocations,
        [id]: nextVal,
      },
    });
  };

  const id1 = destIds[0];
  const id2 = destIds[1];
  const dest1 = id1 ? destinations.find((d) => d.id === id1) : undefined;
  const dest2 = id2 ? destinations.find((d) => d.id === id2) : undefined;
  const name1 = dest1?.name ?? id1 ?? "Destination 1";
  const name2 = dest2?.name ?? id2 ?? "Destination 2";
  const days1 = allocations[id1] || 1;
  const days2 = allocations[id2] || 1;

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-white p-6 shadow-clay">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Your Trip</p>
            <p className="font-display text-3xl font-extrabold">{totalDays} Days Total</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Allocation</p>
            <p className={cn("font-display text-3xl font-extrabold tabular", isValid ? "text-success" : allocatedSum > totalDays ? "text-danger" : "text-amber-600")}>
              {allocatedSum} / {totalDays}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className={cn("h-full transition-all duration-300", isValid ? "bg-success" : allocatedSum > totalDays ? "bg-danger" : "bg-purple")}
            style={{ width: `${Math.min(100, (allocatedSum / totalDays) * 100)}%` }}
          />
        </div>

        <div className="mt-3">
          {isValid ? (
            <p className="text-xs font-bold text-success flex items-center gap-1.5">
              <CheckCircleIcon size={16} weight="fill" />
              All {totalDays} days allocated across your destinations.
            </p>
          ) : allocatedSum > totalDays ? (
            <p className="text-xs font-bold text-danger">
              Your destination split exceeds the trip length by {allocatedSum - totalDays} day{allocatedSum - totalDays > 1 ? "s" : ""}.
            </p>
          ) : (
            <p className="text-xs font-bold text-amber-600">
              {totalDays - allocatedSum} day{totalDays - allocatedSum > 1 ? "s" : ""} still need to be assigned.
            </p>
          )}
        </div>
      </div>

      {destIds.length === 2 && (
        <>
          {/* Quick presets for 2 destinations (only distinct splits are offered) */}
          <div className="flex flex-wrap gap-2">
            {splitPresets(totalDays, name1, name2).map((o) => (
              <Chip key={o.d1} selected={days1 === o.d1} onClick={() => set({ destinationAllocations: { [id1]: o.d1, [id2]: totalDays - o.d1 } })}>
                {o.label}
              </Chip>
            ))}
          </div>

          {/* Interactive Split Slider */}
          <div className="rounded-[24px] bg-white p-4 shadow-clay-sm space-y-2">
            <div className="flex justify-between text-xs font-bold text-muted">
              <span>{name1}: <b className="text-ink text-sm">{days1} days</b></span>
              <span>{name2}: <b className="text-ink text-sm">{days2} days</b></span>
            </div>
            <Slider
              value={days1}
              min={1}
              max={totalDays - 1}
              step={1}
              onChange={(newDays1) => {
                const newDays2 = totalDays - newDays1;
                set({
                  destinationAllocations: {
                    [id1]: newDays1,
                    [id2]: newDays2,
                  },
                });
              }}
              label="Split days slider"
            />
            <p className="text-[11px] text-center text-muted">
              Drag slider to rebalance days between {name1} and {name2}
            </p>
          </div>
        </>
      )}

      <div className="space-y-3">
        {destIds.map((id, index) => {
          const dest = destinations.find((d) => d.id === id);
          const days = allocations[id] || 1;
          return (
            <div key={id} className="flex items-center justify-between rounded-[24px] bg-white p-4 shadow-clay-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-soft font-display text-xs font-bold text-purple-deep">
                  {index + 1}
                </span>
                <div>
                  <p className="font-display text-base font-bold">{dest?.name ?? id}</p>
                  <p className="text-xs text-muted">{dest?.state ?? "India"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-2xl border-2 border-line bg-canvas p-1">
                  <button
                    type="button"
                    disabled={days <= 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateAllocation(id, -1);
                    }}
                    className="h-9 w-9 rounded-xl font-extrabold text-base text-ink hover:bg-white hover:shadow-sm active:scale-95 disabled:opacity-25 transition flex items-center justify-center cursor-pointer select-none"
                    aria-label={`Decrease days in ${dest?.name ?? id}`}
                  >
                    −
                  </button>
                  <span className="w-16 text-center font-display text-sm font-extrabold tabular text-ink select-none">
                    {days} {days === 1 ? "day" : "days"}
                  </span>
                  <button
                    type="button"
                    disabled={destIds.length === 2 && days >= totalDays - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateAllocation(id, 1);
                    }}
                    className="h-9 w-9 rounded-xl font-extrabold text-base text-ink hover:bg-white hover:shadow-sm active:scale-95 disabled:opacity-25 transition flex items-center justify-center cursor-pointer select-none"
                    aria-label={`Increase days in ${dest?.name ?? id}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GROUPS: { id: OnboardingAnswers["groupType"]; label: string; emoji: string; adults: number; kids: number }[] = [
  { id: "solo", label: "Solo", emoji: "🎒", adults: 1, kids: 0 },
  { id: "couple", label: "Couple", emoji: "💑", adults: 2, kids: 0 },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧", adults: 2, kids: 2 },
  { id: "friends", label: "Friends", emoji: "🧑‍🤝‍🧑", adults: 4, kids: 0 },
];

export function WhoStep({ a, set }: P) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Who is travelling">
        {GROUPS.map((g) => (
          <OptionCard key={g.id} selected={a.groupType === g.id} onClick={() => set({ groupType: g.id, adults: g.adults, kids: g.kids })} title={g.label} emoji={g.emoji} tone="bg-pink-soft" className="flex-col !items-start" />
        ))}
      </div>
      <div className="divide-y divide-line rounded-[24px] bg-white px-5 shadow-clay-sm">
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-semibold">Adults</p>
            <p className="text-xs text-muted">13 years and above</p>
          </div>
          <Stepper value={a.adults} onChange={(v) => set({ adults: v })} min={1} max={12} label="adults" />
        </div>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-semibold">Kids</p>
            <p className="text-xs text-muted">2 to 12 years · we pick kid-friendly plans</p>
          </div>
          <Stepper value={a.kids} onChange={(v) => set({ kids: v })} min={0} max={8} label="kids" />
        </div>
      </div>
    </div>
  );
}

export function BudgetStep({ a, set }: P) {
  const travelers = a.adults + a.kids;
  const level = a.budgetPerPerson < 15000 ? "Backpacker" : a.budgetPerPerson < 30000 ? "Comfortable" : a.budgetPerPerson < 60000 ? "Premium" : "Luxury";
  const pct = ((a.budgetPerPerson - 8000) / (150000 - 8000)) * 100;
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-white p-6 shadow-clay">
        <p className="text-sm font-semibold text-muted">Budget per person</p>
        <p className="mt-1 font-display text-4xl font-extrabold tabular">{rupees(a.budgetPerPerson)}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {rupees(a.budgetPerPerson * travelers)} for {travelers} {travelers === 1 ? "traveler" : "travelers"} · <b>{level}</b>
        </p>
        <Slider className="mt-6" value={a.budgetPerPerson} onChange={(v) => set({ budgetPerPerson: v })} min={8000} max={150000} step={1000} label="Budget per person" />
        <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted">
          <span>₹8k</span>
          <span>₹1.5L</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gradient-to-r from-mint via-sun to-coral opacity-60">
          <div className="h-full w-1 bg-ink" style={{ marginLeft: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[15000, 25000, 30000, 45000, 75000].map((b) => (
          <Chip key={b} size="sm" selected={a.budgetPerPerson === b} onClick={() => set({ budgetPerPerson: b })}>
            {rupees(b)}
          </Chip>
        ))}
      </div>
      <p className="text-xs text-muted">Includes stay, travel from your city, local cab, activities, meals, fees and GST. You&apos;ll see the live price as you edit.</p>
    </div>
  );
}

const STAY_META: Record<StayType, { label: string; emoji: string; tone: string }> = {
  hostel: { label: "Hostel", emoji: "🛏️", tone: "bg-lavender-soft" },
  budget: { label: "Budget hotel", emoji: "🏨", tone: "bg-sky-soft" },
  homestay: { label: "Homestay", emoji: "🏡", tone: "bg-mint-soft" },
  boutique: { label: "Boutique", emoji: "🛋️", tone: "bg-sun-soft" },
  luxury: { label: "Luxury", emoji: "👑", tone: "bg-pink-soft" },
};

export function StayStep({ a, set }: P) {
  const list = a.destinationId ? staysFor(a.destinationId) : [];
  const types: StayType[] = ["hostel", "budget", "homestay", "boutique", "luxury"];
  return (
    <div className="grid gap-3" role="radiogroup" aria-label="Accommodation">
      {types.map((t) => {
        const match = list.find((s) => s.type === t);
        const m = STAY_META[t];
        return (
          <OptionCard
            key={t}
            selected={a.stayType === t}
            onClick={() => set({ stayType: t })}
            title={m.label}
            emoji={m.emoji}
            tone={m.tone}
            subtitle={match ? `e.g. ${match.name} · ${rupees(match.nightlyPrice)}/night` : "Closest match will be picked"}
          />
        );
      })}
    </div>
  );
}

const MODE_META: Record<TransportMode, { label: string; emoji: string; hub: string }> = {
  flight: { label: "Flight", emoji: "✈️", hub: "airport" },
  train: { label: "Train", emoji: "🚆", hub: "railway station" },
  bus: { label: "Volvo bus", emoji: "🚌", hub: "bus terminal" },
  car: { label: "Private car", emoji: "🚗", hub: "" },
};

type GeoStatus = "idle" | "locating" | "denied" | "unsupported" | "timeout" | "unavailable" | "unresolved";

const GEO_MESSAGE: Record<Exclude<GeoStatus, "idle" | "locating">, string> = {
  denied: "Location access is blocked.",
  unsupported: "Your browser doesn't support location detection.",
  timeout: "Couldn't determine your location.",
  unavailable: "Couldn't determine your location.",
  unresolved: "We found your coordinates but couldn't name the place.",
};

const sameCity = (a?: string, b?: string) => {
  const x = (a ?? "").trim().toLowerCase();
  const y = (b ?? "").trim().toLowerCase();
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

function HubLine({ icon, label, hub, near }: { icon: string; label: string; hub?: TransportHub; near: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-sm">{icon}</span>
      <div className="min-w-0">
        <span className="font-bold text-ink">{label}: </span>
        {hub ? (
          <>
            <span className="text-ink">{hub.name}</span>
            <span className="block truncate text-[11px] text-muted">
              {hub.address} · {hub.distanceKm.toFixed(1)} km from {near}
            </span>
          </>
        ) : (
          <span className="text-muted">None found near {near}</span>
        )}
      </div>
    </div>
  );
}

export function TransportStep({ a, set }: P) {
  const dest = a.destinationId ? destinationMap[a.destinationId] : undefined;
  const destPlace = a.destinationPlaces?.find((p) => p.placeId === a.destinationId || p.name.toLowerCase().replace(/\s+/g, "-") === a.destinationId);
  const destName = dest?.name ?? destPlace?.name ?? a.destinationId ?? "Destination";
  const destPoint = useMemo(() => {
    const p = dest ? { lat: dest.lat, lng: dest.lng } : destPlace ? { lat: destPlace.lat, lng: destPlace.lng } : null;
    return validPoint(p) ? p : null;
  }, [dest, destPlace]);
  const originPoint = useMemo(() => {
    const p = a.originPlace ? { lat: a.originPlace.lat, lng: a.originPlace.lng } : { lat: a.fromLat, lng: a.fromLng };
    return validPoint(p) ? { lat: p.lat, lng: p.lng } : null;
  }, [a.originPlace, a.fromLat, a.fromLng]);
  const originName = a.originPlace?.name ?? a.fromCity;

  const [geo, setGeo] = useState<GeoStatus>("idle");
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<PlaceAutocompleteResult[]>([]);
  const [manualError, setManualError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const cityDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Hubs for every public mode, so each card shows its own real stations.
  const flight = useModeHubs("flight", originPoint, destPoint);
  const train = useModeHubs("train", originPoint, destPoint);
  const bus = useModeHubs("bus", originPoint, destPoint);
  const hubsByMode: Partial<Record<TransportMode, ReturnType<typeof useModeHubs>>> = { flight, train, bus };

  // Catalog fares are priced from the destination's usual departure city. Show them only when
  // the traveller really starts there; otherwise say so instead of quoting a wrong fare.
  const catalog = useMemo(() => (a.destinationId ? transportFor(a.destinationId) : []), [a.destinationId]);
  const modes: TransportMode[] = ["flight", "train", "bus", "car"];

  const handleCityInput = (val: string) => {
    setCityInput(val);
    setManualError(null);
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (val.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }
    cityDebounce.current = setTimeout(async () => {
      try {
        setCitySuggestions((await getPlaceAutocomplete(val)) || []);
      } catch {
        setManualError("Place search is unavailable right now. Try again in a moment.");
      }
    }, 300);
  };

  const detectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("unsupported");
      return;
    }
    setGeo("locating");
    setGeoCoords(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeoCoords({ lat, lng });
        try {
          const r = await getReverseGeocode(lat, lng);
          if (!r.resolved || !r.city) {
            setGeo("unresolved");
            return;
          }
          set({
            fromCity: r.city,
            fromLat: lat,
            fromLng: lng,
            originPlace: {
              placeId: r.placeId,
              name: r.city,
              formattedAddress: r.formattedAddress,
              lat,
              lng,
              city: r.city,
              state: r.state,
              country: r.country,
            },
          });
          setGeo("idle");
        } catch {
          setGeo("unresolved");
        }
      },
      (err) => {
        setGeo(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 }
    );
  };

  const selectCitySuggestion = async (s: PlaceAutocompleteResult) => {
    setResolving(true);
    setManualError(null);
    try {
      const d = await getPlaceDetails(s.placeId);
      if (!validPoint(d)) throw new Error("no coordinates");
      set({
        fromCity: d.city || d.name,
        fromLat: d.lat,
        fromLng: d.lng,
        originPlace: {
          placeId: d.id,
          name: d.name,
          formattedAddress: d.formattedAddress,
          lat: d.lat,
          lng: d.lng,
          city: d.city,
          state: d.state,
          country: d.country,
        },
      });
      setCityInput("");
      setCitySuggestions([]);
      setShowManual(false);
      setGeo("idle");
    } catch {
      setManualError("Couldn't look up that place. Pick another suggestion or try again.");
    } finally {
      setResolving(false);
    }
  };

  const applyTyped = () => {
    if (citySuggestions.length > 0) selectCitySuggestion(citySuggestions[0]);
    else if (cityInput.trim().length >= 2) setManualError("Pick your place from the suggestions.");
  };

  const geoError = geo !== "idle" && geo !== "locating" ? GEO_MESSAGE[geo] : null;

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-white p-4 shadow-clay-sm">
        <p className="mb-2 text-sm font-bold">Where are you travelling from?</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={detectLocation}
            disabled={geo === "locating"}
            className="flex items-center gap-2 rounded-2xl bg-sky-soft px-4 py-2.5 text-sm font-semibold transition hover:bg-sky disabled:opacity-70"
          >
            <CrosshairIcon size={16} weight="bold" />
            {geo === "locating" ? "Detecting your location…" : "Use my location"}
          </button>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="flex items-center gap-2 rounded-2xl bg-lavender-soft px-4 py-2.5 text-sm font-semibold transition hover:bg-lavender"
          >
            <PencilSimpleIcon size={16} weight="bold" />
            Enter manually
          </button>
        </div>

        {originPoint && a.originPlace && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
            <MapPinIcon size={14} className="mt-0.5 shrink-0 text-purple" />
            <span>
              <b className="text-ink">{a.originPlace.name}</b>
              {a.originPlace.formattedAddress && a.originPlace.formattedAddress !== a.originPlace.name ? ` · ${a.originPlace.formattedAddress}` : ""}
            </span>
          </p>
        )}

        {geoError && (
          <div role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-xs text-ink">
            <p className="font-bold">{geoError}</p>
            {geo === "unresolved" && geoCoords && (
              <p className="mt-0.5 text-ink-soft">
                Coordinates: {geoCoords.lat.toFixed(5)}, {geoCoords.lng.toFixed(5)}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {(geo === "timeout" || geo === "unavailable" || geo === "unresolved") && (
                <button type="button" onClick={detectLocation} className="rounded-lg bg-white px-2.5 py-1 font-semibold">
                  Try again
                </button>
              )}
              <button type="button" onClick={() => setShowManual(true)} className="rounded-lg bg-ink px-2.5 py-1 font-semibold text-white">
                Enter manually
              </button>
            </div>
          </div>
        )}

        {showManual && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => handleCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyTyped();
                  }
                }}
                placeholder="Type your city or area (e.g. Navi Mumbai, Pune)…"
                className="flex-1 rounded-xl border-2 border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-purple"
                autoFocus
              />
              <button type="button" onClick={applyTyped} disabled={resolving} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800">
                {resolving ? "…" : "Apply"}
              </button>
            </div>
            {manualError && <p className="text-xs font-semibold text-coral-deep">{manualError}</p>}
            {citySuggestions.length > 0 && (
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-pop">
                {citySuggestions.slice(0, 5).map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    onClick={() => selectCitySuggestion(s)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-lavender-soft"
                  >
                    <MapPinIcon size={14} className="shrink-0 text-purple" />
                    <span className="font-semibold text-ink">{s.primaryText || s.text}</span>
                    <span className="truncate text-xs text-muted">{s.secondaryText}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-muted">
        Travelling from <b className="text-ink">{originPoint ? originName : ""}</b> to <b className="text-ink">{destName}</b>
        {!originPoint && <span className="ml-1 text-coral-deep">· set your starting point to see real stations</span>}
      </p>

      <div className="grid gap-3" role="radiogroup" aria-label="Transport">
        {modes.map((mode) => {
          const meta = MODE_META[mode];
          const hubs = hubsByMode[mode];
          const from = hubs?.data?.origin.hubs[0];
          const to = hubs?.data?.destination.hubs[0];
          const opt = catalog.find((o) => o.mode === mode);
          const fareValid = !!opt && sameCity(opt.from, a.originPlace?.city ?? a.fromCity);
          const roadKm = originPoint && destPoint ? haversineKm(originPoint, destPoint) : null;
          const selected = a.transport === mode;

          let subtitle: React.ReactNode;
          if (mode === "car") subtitle = originPoint ? `${originName} → ${destName} by road` : `Door to door to ${destName}`;
          else if (!originPoint || !destPoint) subtitle = `Set your starting point to find the ${meta.hub}s`;
          else if (hubs?.loading) subtitle = "Finding nearby transport…";
          else if (hubs?.error) subtitle = hubs.error;
          else if (from && to) subtitle = `${from.name} → ${to.name}`;
          else subtitle = `No ${meta.hub} found near ${!from ? originName : destName}`;

          return (
            <OptionCard key={mode} selected={selected} onClick={() => set({ transport: mode })} title={meta.label} emoji={meta.emoji} tone="bg-sky-soft" subtitle={subtitle}>
              <span className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold text-ink-soft">
                {fareValid && opt ? (
                  <>
                    <span>{rupees(opt.pricePerPerson)} / person each way</span>
                    <span>· {duration(opt.durationMin)}</span>
                    <span className="font-normal text-muted">· catalog fare from {opt.from}</span>
                  </>
                ) : (
                  <span className="font-normal text-muted">Fare available during booking</span>
                )}
              </span>

              {hubs?.error && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    hubs.retry();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      hubs.retry();
                    }
                  }}
                  className="mt-1 inline-block text-xs font-bold text-purple-deep underline"
                >
                  Retry
                </span>
              )}

              <div
                className={cn(
                  "mt-2.5 overflow-hidden transition-all duration-300 ease-out",
                  selected ? "max-h-60 opacity-100" : "max-h-0 opacity-0 group-hover:max-h-60 group-hover:opacity-100 group-focus-visible:max-h-60 group-focus-visible:opacity-100"
                )}
              >
                <div className="space-y-1.5 rounded-xl border border-line bg-canvas/90 p-2.5 text-xs text-ink-soft shadow-inner">
                  {mode === "car" ? (
                    <>
                      <div>
                        <span className="font-bold text-ink">From: </span>
                        {originPoint ? a.originPlace?.formattedAddress ?? originName : "Starting point not set"}
                      </div>
                      <div>
                        <span className="font-bold text-ink">To: </span>
                        {destName}
                      </div>
                      {roadKm !== null && <div className="text-muted">{Math.round(roadKm)} km straight-line · road route is shown on the plan map</div>}
                    </>
                  ) : hubs?.data ? (
                    <>
                      <HubLine icon="🛫" label="From" hub={from} near={originName} />
                      <div className="border-t border-line/60 pt-1.5">
                        <HubLine icon="🛬" label="To" hub={to} near={destName} />
                      </div>
                      {hubs.data.hubDistanceKm !== undefined && (
                        <div className="text-muted">
                          {hubs.data.hubDistanceKm} km between {meta.hub}s (straight-line){mode === "flight" ? "" : " · actual track/road distance is longer"}
                        </div>
                      )}
                      <div className="text-[10px] text-muted">Stations from Google Places</div>
                    </>
                  ) : (
                    <div className="text-muted">{hubs?.loading ? "Finding nearby transport…" : "Station details unavailable."}</div>
                  )}
                </div>
              </div>
            </OptionCard>
          );
        })}
      </div>
    </div>
  );
}

export const INTEREST_META: Record<Interest, { label: string; emoji: string; tone: "coral" | "mint" | "lavender" | "sun" | "pink" | "sky" | "cream" }> = {
  nature: { label: "Nature", emoji: "🌿", tone: "mint" },
  adventure: { label: "Adventure", emoji: "🪂", tone: "coral" },
  culture: { label: "Culture & history", emoji: "🏛️", tone: "lavender" },
  food: { label: "Food", emoji: "🍛", tone: "sun" },
  luxury: { label: "A little luxury", emoji: "✨", tone: "pink" },
  social: { label: "Nightlife & people", emoji: "🎉", tone: "pink" },
  relax: { label: "Slow & relaxing", emoji: "🧘", tone: "sky" },
  photo: { label: "Views & photos", emoji: "📸", tone: "cream" },
};

export function InterestsStep({ a, set }: P) {
  const toggle = (i: Interest) => set({ interests: a.interests.includes(i) ? a.interests.filter((x) => x !== i) : [...a.interests, i] });
  return (
    <div className="grid grid-cols-2 gap-3">
      {(Object.keys(INTEREST_META) as Interest[]).map((i) => {
        const m = INTEREST_META[i];
        const on = a.interests.includes(i);
        return (
          <motion.button
            key={i}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => toggle(i)}
            aria-pressed={on}
            className={cn("flex items-center gap-3 rounded-[22px] p-4 text-left font-semibold transition", on ? "bg-lavender ring-2 ring-ink shadow-pop" : "bg-white shadow-clay-sm hover:-translate-y-0.5")}
          >
            <Glyph emoji={m.emoji} size={26} />
            <span className="text-sm">{m.label}</span>
            {on && <CheckCircleIcon size={18} weight="fill" className="ml-auto text-purple-deep" />}
          </motion.button>
        );
      })}
    </div>
  );
}

export function StyleStep({ a, set }: P) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-bold">Pace</p>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Pace">
          {[
            { id: "relaxed", label: "Slow & easy", sub: "2 things a day", emoji: "🐢" },
            { id: "balanced", label: "Balanced", sub: "3 things + evenings", emoji: "⚖️" },
            { id: "packed", label: "Pack it in", sub: "4+ things a day", emoji: "🚀" },
          ].map((p) => (
            <OptionCard key={p.id} selected={a.pace === p.id} onClick={() => set({ pace: p.id as OnboardingAnswers["pace"] })} title={p.label} subtitle={p.sub} emoji={p.emoji} tone="bg-mint-soft" />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold">Your rhythm</p>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Rhythm">
          <OptionCard selected={a.rhythm === "early-bird"} onClick={() => set({ rhythm: "early-bird" })} title="Early bird" subtitle="Start at 9, early nights" emoji="🌅" tone="bg-sun-soft" />
          <OptionCard selected={a.rhythm === "night-owl"} onClick={() => set({ rhythm: "night-owl" })} title="Night owl" subtitle="Start at 10, late dinners" emoji="🌙" tone="bg-lavender-soft" />
        </div>
      </div>
    </div>
  );
}

const SPECIAL = ["Vegetarian", "Jain food", "Limited mobility", "Travelling with elders", "Wheelchair access", "Motion sickness", "Pet with us", "Women-only guides"];

export function SpecialStep({ a, set }: P) {
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const toggle = (s: string) => set({ special: a.special.includes(s) ? a.special.filter((x) => x !== s) : [...a.special, s] });
  const addCustom = () => {
    const v = otherText.trim();
    if (v && !a.special.includes(v)) set({ special: [...a.special, v] });
    setOtherText("");
    setShowOther(false);
  };
  const customNeeds = a.special.filter((s) => !SPECIAL.includes(s));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2.5">
        {SPECIAL.map((s) => (
          <Chip key={s} selected={a.special.includes(s)} onClick={() => toggle(s)} tone="sky">
            {s}
          </Chip>
        ))}
        {customNeeds.map((s) => (
          <Chip key={s} selected onClick={() => toggle(s)} tone="lavender">
            {s} ✕
          </Chip>
        ))}
        <Chip selected={showOther} onClick={() => setShowOther(!showOther)} tone="cream">
          <PlusIcon size={14} weight="bold" className="mr-1 inline" />
          Any other
        </Chip>
      </div>
      {showOther && (
        <div className="flex gap-2">
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="e.g. Diabetic diet, fear of heights…"
            className="flex-1 rounded-xl border-2 border-line bg-white px-3 py-2 text-sm outline-none focus:border-purple"
            autoFocus
            maxLength={60}
          />
          <button type="button" onClick={addCustom} className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white">
            Add
          </button>
        </div>
      )}
      <p className="text-xs text-muted">Safety checks use these before any change is made to your trip (e.g. “Does this activity need a lot of walking?”).</p>
    </div>
  );
}

const PROMPTS = [
  "Quiet places, great food, my dad can't walk much",
  "Adventure every morning, cafés in the evening",
  "Honeymoon, sunsets, spa, a little luxury",
  "Kids love animals and boats, early nights",
];

export function WordsStep({ a, set }: P) {
  const wishes = parseWishes(a.ownWords);
  return (
    <div className="space-y-4">
      <Textarea
        value={a.ownWords}
        onChange={(e) => set({ ownWords: e.target.value })}
        placeholder="e.g. 5 days in Manali, nature and adventure, great food, quiet cafés in the evening"
        aria-label="Describe your dream trip"
        maxLength={400}
        className="min-h-36 text-base"
      />
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button key={p} type="button" onClick={() => set({ ownWords: p })} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-clay-sm hover:bg-lavender-soft">
            <PencilSimpleIcon size={12} className="mr-1 inline" />
            {p}
          </button>
        ))}
      </div>
      <div className="rounded-[24px] border-2 border-dashed border-purple/30 bg-lavender-soft/50 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-deep">
          <SparkleIcon size={14} weight="fill" /> AI is reading your words
        </p>
        {wishes.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {wishes.map((w) => (
              <motion.span key={w.text} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-clay-sm">
                <CheckCircleIcon size={16} weight="fill" className="text-success" /> {w.text}
              </motion.span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Type anything, we&apos;ll turn it into wishes that score every experience.</p>
        )}
        <p className="mt-3 text-[11px] text-muted">Groq or Gemini reads your words on the server; if AI is unavailable, keyword rules take over.</p>
      </div>
    </div>
  );
}

export function ReviewStep({ a, goTo, goKey }: { a: OnboardingAnswers; goTo?: (step: number) => void; goKey?: (key: string) => void }) {
  const dest = a.destinationId ? destinationMap[a.destinationId] : undefined;
  const primaryPlace = a.destinationPlaces?.find((p) => p.placeId === a.destinationId || p.name.toLowerCase().replace(/\s+/g, "-") === a.destinationId);
  const destTitle = dest?.name ?? primaryPlace?.name ?? a.destinationId ?? "Destination";
  const destArt = dest?.art ?? "beach";
  const destNames = a.destinationIds?.length
    ? a.destinationIds
        .map((id) => {
          const d = destinationMap[id]?.name ?? a.destinationPlaces?.find((p) => p.placeId === id || p.name.toLowerCase().replace(/\s+/g, "-") === id)?.name ?? id;
          const days = a.destinationAllocations?.[id];
          return days ? `${d} (${days}d)` : d;
        })
        .join(" → ")
    : destTitle;
  const rows: [string, string, string][] = [
    ["Destination", a.destinationIds && a.destinationIds.length > 1 ? `${destNames} (Multi-city)` : destNames, "where"],
    ["From", a.fromAddress || a.fromCity, "transport"],
    ["Dates", `${formatDate(a.startDate, { day: "numeric", month: "short", year: "numeric" })} · ${a.nights + 1} days`, "when"],
    ["Travelers", `${a.adults} adult${a.adults > 1 ? "s" : ""}${a.kids ? ` + ${a.kids} kid${a.kids > 1 ? "s" : ""}` : ""}`, "who"],
    ["Budget", `${rupees(a.budgetPerPerson)} per person`, "budget"],
    ["Stay", STAY_META[a.stayType].label, "stay"],
    ["Transport", `${MODE_META[a.transport].label} from ${a.fromCity}`, "transport"],
    ["Interests", a.interests.map((i) => INTEREST_META[i].label).join(", ") || "Surprise me", "interests"],
    ["Style", `${a.pace} · ${a.rhythm.replace("-", " ")}`, "style"],
    ["Needs", a.special.join(", ") || "None", "special"],
    ["Your words", a.ownWords || "", "words"],
  ];
  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-clay">
      {destTitle && (
        <div className="relative h-32">
          <DestinationArt kind={destArt} />
          <span className="absolute bottom-3 left-4 rounded-full border-2 border-ink bg-white px-3 py-1 font-display text-sm font-bold shadow-pop">{destTitle}</span>
        </div>
      )}
      <dl className="divide-y divide-line">
        {rows.map(([k, v, stepKey]) => (
          <div key={k} className="flex items-start gap-3 px-5 py-3">
            <dt className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">{k}</dt>
            <dd className="flex-1 text-sm font-medium">{v}</dd>
            <button
              type="button"
              onClick={() => (goKey ? goKey(stepKey) : goTo ? goTo(1) : undefined)}
              className="text-xs font-bold text-purple-deep hover:underline"
              aria-label={`Edit ${k}`}
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Distinct day splits between two places: an even split when possible, and more time in each. */
function splitPresets(total: number, name1: string, name2: string) {
  const few = Math.max(1, Math.floor(total / 3));
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const out: { d1: number; label: string }[] = [];
  if (total % 2 === 0) out.push({ d1: total / 2, label: `Even split · ${days(total / 2)} each` });
  out.push({ d1: total - few, label: `More in ${name1} · ${days(total - few)} ${name1}, ${days(few)} ${name2}` });
  out.push({ d1: few, label: `More in ${name2} · ${days(total - few)} ${name2}, ${days(few)} ${name1}` });
  const seen = new Set<number>();
  return out.filter((o) => o.d1 >= 1 && o.d1 < total && !seen.has(o.d1) && !!seen.add(o.d1));
}
