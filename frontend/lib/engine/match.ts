import { rated } from "@/data/catalog";
import type { Destination, Interest, TravelDNA } from "@/types";
import { dnaToInterests } from "./dna";
import { forecastFor } from "./weather";
import { addDays, todayISO } from "@/lib/format";
import { buildTrip } from "./planner";
import { priceTrip } from "./pricing";
import { transportFor } from "@/data/stays";

const LABEL: Record<Interest, string> = {
  nature: "Nature",
  adventure: "Adventure",
  culture: "Culture",
  food: "Food",
  luxury: "Luxury",
  social: "Nightlife",
  relax: "Quiet places",
  photo: "Views",
};

/** How well a destination fits the traveler (DNA or chosen interests). */
export function destinationMatch(d: Destination, dna: TravelDNA | null, interests: Interest[] = []) {
  const wants = interests.length ? interests : dna ? dnaToInterests(dna) : [];
  if (!wants.length) return { score: Math.round(62 + rated(d.rating) * 5), because: d.interests.slice(0, 3).map((i) => LABEL[i]) };
  const shared = d.interests.filter((i) => wants.includes(i));
  const month = new Date().getMonth() + 1;
  const season = d.bestMonths.includes(month) ? 8 : d.rainyMonths.includes(month) ? -10 : 0;
  const score = Math.max(40, Math.min(98, Math.round(48 + shared.length * 14 + rated(d.rating) * 3 + season)));
  return { score, because: (shared.length ? shared : d.interests.slice(0, 2)).map((i) => LABEL[i]) };
}

const estimateCache = new Map<string, number>();

/** Real planner + pricing run for a typical trip (2 adults, 4 nights, balanced, cheapest transport). */
export function estimatedPerPerson(d: Destination) {
  const hit = estimateCache.get(d.id);
  if (hit) return hit;
  const transportList = transportFor(d.id);
  const cheapest = [...transportList].sort((a, b) => a.pricePerPerson - b.pricePerPerson)[0];
  const mode = cheapest?.mode ?? "train";
  try {
    const trip = buildTrip(
      { destinationId: d.id, startDate: addDays(todayISO(), 21), nights: 4, adults: 2, kids: 0, budgetPerPerson: 30000, stayType: "boutique", transport: mode, interests: d.interests.slice(0, 3), pace: "balanced", rhythm: "early-bird", special: [], ownWords: "", fromCity: d.fromCity, fromAddress: "", fromLat: null, fromLng: null },
      { id: `est-${d.id}`, code: "EST", customerId: "est", customerName: "Estimate", coordinatorId: "" },
    );
    const pp = priceTrip(trip).perPerson;
    estimateCache.set(d.id, pp);
    return pp;
  } catch {
    return 24500;
  }
}

export function todaysWeather(d: Destination) {
  return forecastFor(d.id, todayISO());
}

export const interestLabel = LABEL;
