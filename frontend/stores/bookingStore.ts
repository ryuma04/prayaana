"use client";
import { create } from "zustand";
import type { Booking, LedgerEntry } from "@/types";

interface BookingState {
  bookings: Booking[];
  ledger: LedgerEntry[];
  setBookings: (b: Booking[]) => void;
  /** Replace one trip's bookings (GET /trips/{id}/bookings). */
  setTripBookings: (tripId: string, b: Booking[]) => void;
  setLedger: (l: LedgerEntry[]) => void;
  reset: () => void;
}

/** Server data (GET /ops/bookings, /ops/ledger, /trips/{id}/bookings); never persisted. */
export const useBookingStore = create<BookingState>()((set, get) => ({
  bookings: [],
  ledger: [],
  setBookings: (bookings) => set({ bookings }),
  setTripBookings: (tripId, b) => set({ bookings: [...b, ...get().bookings.filter((x) => x.tripId !== tripId)] }),
  setLedger: (ledger) => set({ ledger }),
  reset: () => set({ bookings: [], ledger: [] }),
}));
