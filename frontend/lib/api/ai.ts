"use client";
import type { TripPreferences } from "@/types";
import { destinationMap } from "@/data/destinations";
import { rupees } from "@/lib/format";
import type { Planning } from "./trips";

export interface GenerationStep {
  id: string;
  running: string;
  done: (p: Planning) => string;
  ms: number;
}

/** The narrated steps shown while the server builds a trip; each result comes from the server's planning report. */
export function generationSteps(prefs: TripPreferences): GenerationStep[] {
  const dest = destinationMap[prefs.destinationId];
  const days = prefs.nights + 1;
  return [
    { id: "style", running: "Understanding your travel style…", done: () => `Travel preferences analyzed · ${prefs.interests.slice(0, 3).join(" + ") || "all-rounder"}, ${prefs.pace} pace`, ms: 900 },
    {
      id: "wishes",
      running: "Reading your own words with AI…",
      done: (p) => (p.wishes.length ? `${p.wishes.length} wishes understood (${p.wishEngine === "rules" ? "rules" : "AI"}): ${p.wishes.map((w) => w.text).join(", ")}` : "No special wishes. Using your Travel DNA"),
      ms: 800,
    },
    { id: "match", running: `Finding experiences in ${dest.name}…`, done: (p) => `${p.matched} experiences matched out of ${p.scored} scored`, ms: 800 },
    { id: "budget", running: "Checking your budget…", done: (p) => `${p.stayName} + ${p.transport} keep you within ${rupees(p.totalBudget)}`, ms: 700 },
    { id: "route", running: "Optimizing your route…", done: () => "Route optimized · nearby places grouped by day", ms: 700 },
    { id: "energy", running: "Balancing your energy…", done: () => `Schedule balanced for a ${prefs.pace} pace`, ms: 600 },
    { id: "weather", running: "Checking the weather…", done: (p) => (p.wetDays ? `Rain likely on ${p.wetDays} day(s). Outdoor plans kept flexible` : "Clear skies ahead · outdoor activities arranged"), ms: 700 },
    { id: "build", running: "Building your itinerary…", done: () => `Complete · ${days} days, ${prefs.nights} nights`, ms: 600 },
  ];
}

/** Sample Hindi voice notes a vendor can "send" from the reply page; the server transcript flow reads them. */
export const VOICE_SAMPLES = [
  { id: "yes-9", label: "“Haan, kal subah 9 baje aa jaunga.”", transcript: "Haan, kal subah 9 baje aa jaunga." },
  { id: "other-1030", label: "“9 nahi ho payega, saadhe das baje chalega?”", transcript: "9 nahi ho payega, saadhe das baje chalega?" },
  { id: "no", label: "“Kal gaadi service mein hai, nahi ho payega.”", transcript: "Kal gaadi service mein hai, nahi ho payega." },
  { id: "call", label: "“Ek baar phone kar lo, baat karte hain.”", transcript: "Ek baar phone kar lo, baat karte hain." },
] as const;
