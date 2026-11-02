"use client";
import { create } from "zustand";
import type { Incident } from "@/types";
import { DEMO_INCIDENTS } from "@/data/demoIncidents";

interface IncidentState {
  incidents: Incident[];
  setAll: (list: Incident[]) => void;
  /** Merge a trip's incidents (travelers only see their own trips). */
  setForTrip: (tripId: string, list: Incident[]) => void;
  upsert: (i: Incident) => void;
  update: (id: string, patch: Partial<Incident>) => void;
  reset: () => void;
}

const newestFirst = (a: Incident, b: Incident) => b.createdAt.localeCompare(a.createdAt);

/** Server data (GET /ops/incidents, /trips/{id}/incidents); never persisted. */
export const useIncidentStore = create<IncidentState>()((set, get) => ({
  incidents: DEMO_INCIDENTS,
  setAll: (incidents) => {
    const merged = incidents.length === 0
      ? DEMO_INCIDENTS
      : [...incidents, ...DEMO_INCIDENTS.filter((d) => !incidents.some((x) => x.id === d.id))];
    set({ incidents: merged });
  },
  setForTrip: (tripId, list) => set({ incidents: [...list, ...get().incidents.filter((i) => i.tripId !== tripId)].sort(newestFirst) }),
  upsert: (i) => {
    const exists = get().incidents.some((x) => x.id === i.id);
    set({ incidents: exists ? get().incidents.map((x) => (x.id === i.id ? { ...x, ...i } : x)) : [i, ...get().incidents] });
  },
  update: (id, patch) => set({ incidents: get().incidents.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
  reset: () => set({ incidents: DEMO_INCIDENTS }),
}));

export const useIncident = (id: string | undefined) => useIncidentStore((s) => s.incidents.find((i) => i.id === id));
export const useOpenIncidentFor = (tripId: string | undefined) =>
  useIncidentStore((s) => s.incidents.find((i) => i.tripId === tripId && i.status !== "resolved"));
