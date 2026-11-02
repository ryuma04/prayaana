// Produces engine parity fixtures from the frontend TypeScript engine.
//   cd frontend && bun --tsconfig-override=./tsconfig.json ../backend/scripts/golden.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Incident, IncidentKind, Mood, TripPreferences } from "@/types";
import { buildTrip } from "@/lib/engine/planner";
import { priceTrip } from "@/lib/engine/pricing";
import { analyzeImpact } from "@/lib/engine/impact";
import { makeFixPlans, runSafetyChecks } from "@/lib/engine/fixes";
import { optimizeTrip } from "@/lib/engine/edit";
import { moodAdapt } from "@/lib/engine/mood";
import { activityAlternatives } from "@/lib/engine/alternatives";
import { prepChecklist } from "@/lib/engine/prep";
import { computeDNA } from "@/lib/engine/dna";
import { tripForecast } from "@/lib/engine/weather";
import { hydrateCatalog, type CatalogData } from "@/data/catalog";
import catalogJson from "../internal/seed/data/catalog.json";

// The catalog lives only in the backend; load the same file the Go engine embeds.
const raw = catalogJson as unknown as CatalogData;
const unrated = <T,>(list: T[]) => list.map((x) => ({ rating: 0, reviews: 0, ...x })); // what the API sends before Google ratings arrive
hydrateCatalog({
  ...raw,
  destinations: unrated(raw.destinations),
  activities: unrated(raw.activities),
  stays: unrated(raw.stays),
  vendors: raw.vendors.map((v) => ({ ...v, available: true, trustScore: undefined as unknown as number })),
});

const base = (p: Partial<TripPreferences>): TripPreferences => ({
  destinationId: "manali", startDate: "2026-10-12", nights: 4, adults: 2, kids: 0, budgetPerPerson: 30000,
  stayType: "boutique", transport: "bus", interests: ["nature", "adventure", "food"], pace: "balanced",
  rhythm: "early-bird", special: [], ownWords: "", fromCity: "Delhi", ...p,
});

const prefsList: TripPreferences[] = [
  base({ ownWords: "Manali, 5 days, nature and adventure, great food, quiet cafés in the evening" }),
  base({ destinationId: "goa", transport: "flight", stayType: "luxury", pace: "relaxed", interests: ["relax", "food"], budgetPerPerson: 60000 }),
  base({ destinationId: "jaipur", transport: "train", stayType: "budget", adults: 3, kids: 1, interests: ["culture", "food"], ownWords: "vegetarian food, my mother can't walk much", special: ["Vegetarian"] }),
  base({ destinationId: "leh", transport: "car", adults: 6, nights: 6, pace: "packed", interests: ["adventure", "nature"], budgetPerPerson: 52000, stayType: "budget" }),
  base({ destinationId: "havelock", transport: "flight", nights: 3, interests: ["adventure", "relax"], rhythm: "night-owl", startDate: "2026-07-20" }),
  base({ destinationId: "rishikesh", adults: 12, pace: "packed", interests: ["adventure", "social"], budgetPerPerson: 18000, stayType: "budget", nights: 3 }),
  base({ destinationId: "alleppey", transport: "flight", pace: "relaxed", interests: ["relax", "food"], ownWords: "my knees hurt, quiet backwaters", nights: 3 }),
  base({ destinationId: "udaipur", transport: "flight", stayType: "luxury", interests: ["luxury", "culture", "food"], budgetPerPerson: 55000, nights: 3 }),
];

const kinds: IncidentKind[] = ["weather", "flight_delay", "vendor_unavailable", "traveler_request", "closure", "running_late", "crowd_report", "health"];
const moods: Mood[] = ["tired", "hungry", "raining", "late", "over_budget", "bored"];

const cases = prefsList.map((prefs, n) => {
  const trip = buildTrip(prefs, { id: `trp-g${n}`, code: `TRZ-G${n}`, customerId: "cus-g", customerName: "Golden Tester", coordinatorId: "tm-priya", groupName: "Golden group" });
  const acts = trip.items.filter((i) => i.kind === "activity");
  if (acts[0]) acts[0].hearted = true;
  if (acts[2]) acts[2].hearted = true;
  const incidents = kinds.map((kind, k) => {
    const actItem = acts[k % Math.max(1, acts.length)];
    const inc: Incident = {
      id: `inc-g${n}-${k}`, tripId: trip.id, kind, title: `Golden ${kind}`, detail: "fixture", day: kind === "flight_delay" ? 1 : 2,
      severity: k % 2 ? 3 : 4, source: "simulator", status: "open", createdAt: "2026-10-01T00:00:00.000Z",
      delayMin: kind === "flight_delay" ? 180 : kind === "running_late" ? 45 : undefined,
      vendorId: kind === "vendor_unavailable" ? actItem?.vendorId : undefined,
      place: kind === "closure" || kind === "crowd_report" ? actItem?.place.split(" ")[0] : undefined,
    };
    const impact = analyzeImpact(trip, inc);
    const plans = makeFixPlans(trip, inc, impact);
    return { incident: inc, impact, plans, checks: plans.map((p) => runSafetyChecks(trip, p)) };
  });
  const moodResults = moods.map((m) => {
    const r = moodAdapt(trip, m, 2, 11 * 60);
    return { mood: m, headline: r.headline, energyBefore: r.energyBefore, energyAfter: r.energyAfter, costDelta: r.plan.costDelta, actions: r.plan.actions.map((a) => ({ type: a.type, itemId: a.itemId.includes("-m") ? "" : a.itemId, toRefId: a.toRefId ?? "", costDelta: a.costDelta })) };
  });
  const opt = optimizeTrip(trip);
  return {
    prefs,
    trip,
    price: priceTrip(trip),
    forecast: tripForecast(trip).map((f) => ({ ...f, day: 0 })),
    incidents,
    moods: moodResults,
    optimized: { savedMin: opt.savedMin, movedOutdoor: opt.movedOutdoor, items: opt.trip.items.map((i) => ({ id: i.id, day: i.day, startMin: i.startMin })) },
    alternatives: acts[0] ? activityAlternatives(trip, acts[0]) : [],
    prep: prepChecklist(trip),
  };
});

const dna = computeDNA({ morning: "trek", view: "peaks", thrill: 80, food: "locals", pace: "packed", crew: "meet", sleep: "homestay", culture: 30, evening: ["stars", "music"], "never-skip": ["wild", "sport"] });

const dir = resolve(import.meta.dir, "../internal/engine/testdata");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "golden.json"), JSON.stringify({ cases, dna }));
console.log(`wrote ${cases.length} golden cases`);
