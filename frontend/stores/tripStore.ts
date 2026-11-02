"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Trip } from "@/types";
import { persistStorage, STORE_KEYS } from "./storage";
import { DEMO_TRIPS } from "@/data/demoIncidents";

interface TripState {
  /** Server trips (GET /trips for travelers, GET /ops/tours for operators). */
  trips: Record<string, Trip>;
  draftId: string | null;
  /** The signed-in traveler's trips (ids), newest first. */
  myTrips: string[];
  upsert: (trip: Trip) => void;
  update: (id: string, fn: (t: Trip) => Trip) => void;
  replaceAll: (trips: Trip[], mine?: boolean) => void;
  setDraft: (id: string | null) => void;
  addMine: (id: string) => void;
  remove: (id: string) => void;
  reset: () => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trips: DEMO_TRIPS,
      draftId: null,
      myTrips: [],
      upsert: (trip) => set({ trips: { ...get().trips, [trip.id]: trip } }),
      update: (id, fn) => {
        const t = get().trips[id];
        if (!t) return;
        set({ trips: { ...get().trips, [id]: fn(t) } });
      },
      replaceAll: (list, mine) => {
        const trips = { ...DEMO_TRIPS, ...Object.fromEntries(list.map((t) => [t.id, t])) };
        if (!mine) return set({ trips });
        const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const current = get().draftId;
        const draftId = current && trips[current]?.status === "draft" ? current : (sorted.find((t) => t.status === "draft")?.id ?? null);
        set({ trips, myTrips: sorted.map((t) => t.id), draftId });
      },
      setDraft: (id) => set({ draftId: id }),
      addMine: (id) => set({ myTrips: [id, ...get().myTrips.filter((x) => x !== id)] }),
      remove: (id) => {
        const { [id]: _removed, ...rest } = get().trips;
        void _removed;
        set({ trips: rest, myTrips: get().myTrips.filter((x) => x !== id), draftId: get().draftId === id ? null : get().draftId });
      },
      reset: () => set({ trips: {}, draftId: null, myTrips: [] }),
    }),
    {
      name: STORE_KEYS.trips,
      storage: persistStorage,
      skipHydration: true,
      version: 2,
      // Only the open draft is remembered; trips themselves always come from the server.
      partialize: (s) => ({ draftId: s.draftId }),
      migrate: () => ({ draftId: null }),
    },
  ),
);

export const useTrip = (id: string | null | undefined) => useTripStore((s) => (id ? s.trips[id] : undefined));
export const useDraftTrip = () => useTripStore((s) => (s.draftId ? s.trips[s.draftId] : undefined));
/** The traveler's most relevant booked trip (live first, then upcoming). */
export const useActiveTrip = () =>
  useTripStore((s) => {
    const mine = s.myTrips.map((id) => s.trips[id]).filter((t): t is Trip => !!t && t.status !== "draft");
    return mine.find((t) => t.status === "live") ?? mine.find((t) => t.status === "booked") ?? mine[0];
  });
