"use client";
import { create } from "zustand";
import type { CrowdReport, EarlyWarning, InboxMessage, InboxThread, Vendor } from "@/types";

interface OperatorState {
  /** Live vendor records (GET /ops/vendors): availability, trust and pending counts. */
  vendors: Record<string, Vendor>;
  vendorAvailability: Record<string, boolean>;
  inbox: InboxThread[];
  crowdReports: CrowdReport[];
  warnings: EarlyWarning[];
  setVendors: (v: Vendor[]) => void;
  putVendor: (v: Vendor) => void;
  setInbox: (t: InboxThread[]) => void;
  appendMessage: (threadId: string, msg: InboxMessage) => void;
  markThreadRead: (threadId: string) => void;
  setAlerts: (reports: CrowdReport[], warnings: EarlyWarning[]) => void;
  putCrowdReport: (r: CrowdReport) => void;
  putWarning: (w: EarlyWarning) => void;
  reset: () => void;
}

/** Operator console data from the Go API; never persisted. */
export const useOperatorStore = create<OperatorState>()((set, get) => ({
  vendors: {},
  vendorAvailability: {},
  inbox: [],
  crowdReports: [],
  warnings: [],
  setVendors: (list) =>
    set({ vendors: Object.fromEntries(list.map((v) => [v.id, v])), vendorAvailability: Object.fromEntries(list.map((v) => [v.id, v.available])) }),
  putVendor: (v) => set({ vendors: { ...get().vendors, [v.id]: v }, vendorAvailability: { ...get().vendorAvailability, [v.id]: v.available } }),
  setInbox: (inbox) => set({ inbox }),
  appendMessage: (threadId, msg) =>
    set({ inbox: get().inbox.map((t) => (t.id === threadId && !t.messages.some((m) => m.id === msg.id) ? { ...t, messages: [...t.messages, msg] } : t)) }),
  markThreadRead: (threadId) => set({ inbox: get().inbox.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)) }),
  setAlerts: (crowdReports, warnings) => set({ crowdReports, warnings }),
  putCrowdReport: (r) => {
    const exists = get().crowdReports.some((x) => x.id === r.id);
    set({ crowdReports: exists ? get().crowdReports.map((x) => (x.id === r.id ? r : x)) : [r, ...get().crowdReports] });
  },
  putWarning: (w) => set({ warnings: get().warnings.map((x) => (x.id === w.id ? w : x)) }),
  reset: () => set({ vendors: {}, vendorAvailability: {}, inbox: [], crowdReports: [], warnings: [] }),
}));
