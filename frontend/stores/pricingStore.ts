"use client";
import { create } from "zustand";

export interface PriceChange {
  tripId: string;
  from: number;
  to: number;
  reason: string;
  at: number;
}

interface PricingState {
  lastChange: PriceChange | null;
  recalculating: boolean;
  record: (c: Omit<PriceChange, "at">) => void;
  setRecalculating: (v: boolean) => void;
}

/** UI-only pricing state (not persisted): drives the "Updating price…" ticker. */
export const usePricingStore = create<PricingState>()((set) => ({
  lastChange: null,
  recalculating: false,
  record: (c) => set({ lastChange: { ...c, at: Date.now() } }),
  setRecalculating: (v) => set({ recalculating: v }),
}));
