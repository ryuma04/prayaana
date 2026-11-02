"use client";
import type { Booking, CrowdReport, Customer, EarlyWarning, InboxMessage, InboxThread, Incident, LedgerEntry, TeamMember, TourStatus, Trip } from "@/types";
import { priceTrip } from "@/lib/engine/pricing";
import { tripDayWeather, isWet } from "@/lib/engine/weather";
import { vendorMap } from "@/data/vendors";
import { addDays, daysBetween, todayISO } from "@/lib/format";
import { useTripStore } from "@/stores/tripStore";
import { useBookingStore } from "@/stores/bookingStore";
import { useOperatorStore } from "@/stores/operatorStore";
import { get, patch, post } from "./client";
import type { LaunchedFix } from "./incidents";

export function tourStatusOf(trip: Trip, openIncidents: Incident[] = []): TourStatus {
  if (trip.status === "draft") return "planning";
  const today = todayISO();
  const end = addDays(trip.prefs.startDate, trip.prefs.nights);
  if (daysBetween(end, today) > 0 || trip.status === "completed") return "completed";
  if (openIncidents.some((i) => i.tripId === trip.id && i.status !== "resolved")) return "at_risk";
  if (daysBetween(trip.prefs.startDate, today) >= 0) return "live";
  return "confirmed";
}

export interface TourRow {
  trip: Trip;
  status: TourStatus;
  risk: number; // 0-100
  riskReasons: string[];
  revenue: number;
  travelers: number;
  pendingVendors: number;
  endDate: string;
}

export function tourRow(trip: Trip, incidents: Incident[], bookings: Booking[]): TourRow {
  const open = incidents.filter((i) => i.tripId === trip.id && i.status !== "resolved");
  const status = tourStatusOf(trip, open);
  const pending = new Set(bookings.filter((b) => b.tripId === trip.id && b.status === "requested").map((b) => b.vendorId)).size;
  const declined = bookings.filter((b) => b.tripId === trip.id && b.status === "declined").length;
  const reasons: string[] = [];
  let risk = 8;
  if (open.length) {
    risk += 45;
    reasons.push(open.map((o) => o.title).join(", "));
  }
  if (pending) {
    risk += Math.min(20, pending * 6);
    reasons.push(`${pending} vendor${pending > 1 ? "s" : ""} yet to confirm`);
  }
  if (declined) {
    risk += 15;
    reasons.push(`${declined} declined booking${declined > 1 ? "s" : ""}`);
  }
  if (status === "live" || status === "confirmed") {
    const upcoming = Array.from({ length: trip.prefs.nights + 1 }, (_, i) => i + 1).filter((d) => d >= (trip.currentDay ?? 1));
    const wetOutdoor = upcoming.filter((d) => isWet(tripDayWeather(trip, d)) && trip.items.some((i) => i.day === d && i.outdoor && i.kind === "activity" && i.status !== "cancelled"));
    if (wetOutdoor.length) {
      risk += 18;
      reasons.push(`Rain on day ${wetOutdoor.join(", ")} with outdoor plans`);
    }
    const lowTrust = trip.items.filter((i) => i.vendorId && (vendorMap[i.vendorId]?.trustScore ?? 90) < 65 && i.status !== "done");
    if (lowTrust.length) {
      risk += 8;
      reasons.push("Low-trust vendor in plan");
    }
  }
  if (status === "completed" || status === "planning") risk = status === "completed" ? 0 : 5;
  return {
    trip,
    status,
    risk: Math.min(99, risk),
    riskReasons: reasons,
    revenue: trip.status === "draft" ? 0 : priceTrip(trip).total,
    travelers: trip.prefs.adults + trip.prefs.kids,
    pendingVendors: pending,
    endDate: addDays(trip.prefs.startDate, trip.prefs.nights),
  };
}

export function overview(rows: TourRow[], incidents: Incident[], bookings: Booking[], ledger: LedgerEntry[]) {
  const today = todayISO();
  const revenue = ledger.filter((l) => l.kind === "payment" || l.kind === "adjustment").reduce((s, l) => s + l.amount, 0);
  const refunds = ledger.filter((l) => l.kind === "refund").reduce((s, l) => s + Math.abs(l.amount), 0);
  const payouts = ledger.filter((l) => l.kind === "payout").reduce((s, l) => s + Math.abs(l.amount), 0);
  const replied = bookings.filter((b) => b.status !== "requested").length;
  return {
    active: rows.filter((r) => r.status === "live" || r.status === "at_risk").length,
    departuresThisWeek: rows.filter((r) => {
      const d = daysBetween(today, r.trip.prefs.startDate);
      return d >= 0 && d <= 7 && r.status !== "planning";
    }).length,
    bookings: bookings.length,
    atRisk: rows.filter((r) => r.status === "at_risk" || (r.risk >= 40 && r.status !== "completed")).length,
    pendingVendors: new Set(bookings.filter((b) => b.status === "requested").map((b) => `${b.tripId}:${b.vendorId}`)).size,
    revenue,
    refunds,
    payouts,
    openIncidents: incidents.filter((i) => i.status !== "resolved").length,
    replyRate: bookings.length ? Math.round((replied / bookings.length) * 100) : 100,
  };
}

/** 14-day revenue series from the ledger (for charts). */
export function revenueSeries(ledger: LedgerEntry[], days = 14) {
  const today = todayISO();
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const inDay = ledger.filter((l) => l.date.slice(0, 10) === date);
    return {
      date: date.slice(5),
      revenue: inDay.filter((l) => l.kind === "payment" || l.kind === "adjustment").reduce((s, l) => s + l.amount, 0),
      payouts: inDay.filter((l) => l.kind === "payout").reduce((s, l) => s + Math.abs(l.amount), 0),
      refunds: inDay.filter((l) => l.kind === "refund").reduce((s, l) => s + Math.abs(l.amount), 0),
    };
  });
}

// Operator console data (GET /ops/*). Loaders write into the stores the pages read.

export async function loadTours() {
  const rows = await get<{ trip: Trip }[]>("/ops/tours");
  useTripStore.getState().replaceAll(rows.map((r) => r.trip));
  return rows;
}

export async function loadBookings() {
  const list = await get<Booking[]>("/ops/bookings");
  useBookingStore.getState().setBookings(list);
  return list;
}

export async function loadLedger() {
  const list = await get<LedgerEntry[]>("/ops/ledger");
  useBookingStore.getState().setLedger(list);
  return list;
}

export async function loadInbox() {
  const list = await get<InboxThread[]>("/ops/inbox");
  useOperatorStore.getState().setInbox(list);
  return list;
}

export async function loadAlerts() {
  const res = await get<{ crowdReports: CrowdReport[]; warnings: EarlyWarning[] }>("/ops/alerts");
  useOperatorStore.getState().setAlerts(res.crowdReports, res.warnings);
  return res;
}

export const listCustomers = () => get<Customer[]>("/ops/customers");
export const listTeam = () => get<TeamMember[]>("/ops/team");

export async function sendInboxMessage(threadId: string, body: string) {
  const msg = await post<InboxMessage>(`/ops/inbox/${encodeURIComponent(threadId)}/messages`, { body });
  useOperatorStore.getState().appendMessage(threadId, msg);
  return msg;
}

export function markThreadRead(threadId: string) {
  useOperatorStore.getState().markThreadRead(threadId);
  return post(`/ops/inbox/${encodeURIComponent(threadId)}/read`).catch(() => undefined);
}

export async function verifyCrowdReport(id: string) {
  const r = await post<CrowdReport>(`/ops/alerts/reports/${encodeURIComponent(id)}/verify`);
  useOperatorStore.getState().putCrowdReport(r);
  return r;
}

/** Hands an early warning to the Trip Fixer Agent. */
export async function handOffWarning(id: string) {
  const launched = await post<LaunchedFix>(`/ops/alerts/warnings/${encodeURIComponent(id)}/handoff`);
  const w = useOperatorStore.getState().warnings.find((x) => x.id === id);
  if (w) useOperatorStore.getState().putWarning({ ...w, status: "handed-to-agent" });
  return launched;
}

export async function assignCoordinator(tripId: string, memberId: string) {
  const res = await patch<{ row: { trip: Trip } }>(`/ops/tours/${encodeURIComponent(tripId)}/coordinator`, { memberId });
  useTripStore.getState().upsert(res.row.trip);
  return res;
}

/** The operator closes a trip; the traveler is then asked for end-of-trip feedback. */
export async function completeTour(tripId: string) {
  const res = await post<{ trip: Trip }>(`/ops/tours/${encodeURIComponent(tripId)}/complete`);
  useTripStore.getState().upsert(res.trip);
  return res;
}

/** Rebuilds the demo world around today (development only). */
export const resetDemoWorld = () => post<{ ok: boolean }>("/ops/demo/reset");

/** A guide's report from the field; trusted reports are verified at once. */
export async function fileGuideReport(report: { destinationId: string; place: string; type: CrowdReport["type"]; text: string }) {
  const r = await post<CrowdReport>("/ops/alerts/reports", report);
  useOperatorStore.getState().putCrowdReport(r);
  return r;
}

/** Marks a booking confirmed (e.g. after a phone call) or cancelled. */
export async function setBookingStatus(id: string, status: "confirmed" | "cancelled") {
  const b = await patch<Booking>(`/ops/bookings/${encodeURIComponent(id)}`, { status });
  useBookingStore.getState().setBookings(useBookingStore.getState().bookings.map((x) => (x.id === id ? b : x)));
  return b;
}

/** Re-sends a pending booking request to the vendor (notification + fresh reply link). */
export const resendBookingRequest = (id: string) => post<Booking>(`/ops/bookings/${encodeURIComponent(id)}/resend`);

/** Trizpyy's Nugen model pipeline: base model, alignment on our travel corpus, deployment, and use in the app. */
export interface AIModelPipeline {
  configured: boolean;
  baseModel: string;
  alignmentId: string;
  alignmentName: string;
  alignmentStatus: string;
  queuePosition?: number;
  documents: number;
  createdAt?: string;
  completedAt?: string;
  metrics?: Record<string, number>;
  modelId: string;
  deploymentStatus: string;
  inUse: boolean;
  error?: string;
}

export const getAIModel = () => get<AIModelPipeline>("/ops/ai/model");
export const askAIModel = (question: string) => post<{ answer: string; model: string }>("/ops/ai/model/ask", { question });
