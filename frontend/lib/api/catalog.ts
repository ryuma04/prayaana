"use client";
import type { Activity, DayForecast, Destination, DestinationReview, Interest, Stay, TransportOption } from "@/types";
import { get } from "./client";

export interface DestinationCard {
  destination: Destination;
  match: { score: number; because: string[] };
  estimatePerPerson: number;
  weather: DayForecast;
  searchScore?: number;
}

export interface DestinationDetail {
  card: DestinationCard;
  destination: Destination;
  activities: Activity[];
  stays: Stay[];
  transport: TransportOption[];
  reviews: DestinationReview[];
}

/** GET /destinations: match scores use the traveler's Travel DNA when signed in. */
export const listDestinationCards = (query = "") => get<DestinationCard[]>(`/destinations${query ? `?q=${encodeURIComponent(query)}` : ""}`);

export const listDestinations = async () => (await listDestinationCards()).map((c) => c.destination);

export const getDestination = (id: string) => get<DestinationDetail>(`/destinations/${encodeURIComponent(id)}`);

const FEELINGS: { re: RegExp; interests: Interest[]; moods: string[] }[] = [
  { re: /quiet|calm|peace|slow/i, interests: ["relax", "nature"], moods: ["Slow travel", "Backwaters"] },
  { re: /mountain|snow|hill|cold/i, interests: ["nature", "adventure"], moods: ["Mountains"] },
  { re: /beach|sea|island|sun/i, interests: ["relax"], moods: ["Beaches", "Islands"] },
  { re: /food|eat|cafe|café/i, interests: ["food"], moods: ["Food", "Cafés", "Seafood"] },
  { re: /history|fort|palace|heritage|culture/i, interests: ["culture"], moods: ["Heritage"] },
  { re: /adventure|thrill|raft|trek|dive|scuba/i, interests: ["adventure"], moods: ["Adventure", "Scuba"] },
  { re: /romantic|honeymoon|couple/i, interests: ["luxury"], moods: ["Romance", "Honeymoon"] },
  { re: /party|nightlife|friends/i, interests: ["social"], moods: ["Nightlife"] },
];

/** "Search by feeling" for instant filtering while typing (same rules as the server). */
export function scoreByFeeling(d: Destination, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let score = 0;
  const nameLower = d.name.toLowerCase();
  const stateLower = d.state.toLowerCase();
  const descLower = d.description.toLowerCase();
  const taglineLower = d.tagline.toLowerCase();

  // Exact whole-query substring matches
  if (nameLower.includes(q) || stateLower.includes(q)) score += 120;
  if (taglineLower.includes(q)) score += 40;
  if (descLower.includes(q)) score += 25;

  // Token-level matching for multi-word searches (e.g. "mumbai beaches", "ooty tea", "hampi ruins")
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  for (const tok of tokens) {
    if (nameLower.includes(tok)) score += 100;
    if (stateLower.includes(tok)) score += 50;
    if (taglineLower.includes(tok)) score += 20;
    if (d.highlights?.some((h) => h.toLowerCase().includes(tok))) score += 30;
    if (d.moods?.some((m) => m.toLowerCase().includes(tok))) score += 25;
    if (d.clusters?.some((c) => c.name.toLowerCase().includes(tok))) score += 25;
  }

  // Feelings / theme regex match
  for (const f of FEELINGS) {
    if (!f.re.test(query)) continue;
    score += f.interests.filter((i) => d.interests.includes(i)).length * 20;
    score += f.moods.filter((m) => d.moods.includes(m)).length * 25;
  }
  return score;
}
