"use client";
import { create } from "zustand";
import type { InboxMessage, TripDocument } from "@/types";

type Load = "idle" | "loading" | "ready" | "error";

interface CommsState {
  /** Trip PDFs (GET /trips/{id}/documents), every version. */
  docs: Record<string, TripDocument[]>;
  docsState: Record<string, Load>;
  /** The trip's WhatsApp conversation (GET /trips/{id}/whatsapp). */
  whatsapp: Record<string, InboxMessage[]>;
  whatsappState: Record<string, Load>;
  setDocs: (tripId: string, list: TripDocument[]) => void;
  setDocsState: (tripId: string, s: Load) => void;
  setWhatsApp: (tripId: string, list: InboxMessage[]) => void;
  setWhatsAppState: (tripId: string, s: Load) => void;
  /** Adds a message from a realtime event or a send (ignores duplicates). */
  receive: (tripId: string, m: InboxMessage) => void;
  reset: () => void;
}

/** Server data for documents and traveler WhatsApp; never persisted. */
export const useCommsStore = create<CommsState>()((set, get) => ({
  docs: {},
  docsState: {},
  whatsapp: {},
  whatsappState: {},
  setDocs: (tripId, list) => set({ docs: { ...get().docs, [tripId]: list }, docsState: { ...get().docsState, [tripId]: "ready" } }),
  setDocsState: (tripId, s) => set({ docsState: { ...get().docsState, [tripId]: s } }),
  setWhatsApp: (tripId, list) => set({ whatsapp: { ...get().whatsapp, [tripId]: list }, whatsappState: { ...get().whatsappState, [tripId]: "ready" } }),
  setWhatsAppState: (tripId, s) => set({ whatsappState: { ...get().whatsappState, [tripId]: s } }),
  receive: (tripId, m) => {
    const list = get().whatsapp[tripId];
    if (!list) return; // not loaded yet: the next load includes it
    if (list.some((x) => x.id === m.id)) return;
    set({ whatsapp: { ...get().whatsapp, [tripId]: [...list, m] } });
  },
  reset: () => set({ docs: {}, docsState: {}, whatsapp: {}, whatsappState: {} }),
}));
