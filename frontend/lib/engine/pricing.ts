import type { PriceBreakdown, Trip, TripItem } from "@/types";
import { stayMap, transportMap } from "@/data/stays";
import { roomsFor } from "./planner";

export interface PromoCode {
  code: string;
  label: string;
  apply: (subtotal: number) => number;
  minSubtotal?: number;
}

export const PROMOS: PromoCode[] = [
  { code: "PRAYAANA10", label: "10% off, up to ₹2,500", apply: (s) => Math.min(2500, Math.round(s * 0.1)) },
  { code: "KARNATAKA10", label: "10% off, up to ₹2,500", apply: (s) => Math.min(2500, Math.round(s * 0.1)) },
  { code: "TRIZPYY10", label: "10% off, up to ₹2,500", apply: (s) => Math.min(2500, Math.round(s * 0.1)) },
  { code: "FIRSTTRIP", label: "₹1,000 off your first trip", apply: () => 1000, minSubtotal: 15000 },
  { code: "MONSOON500", label: "₹500 off monsoon getaways", apply: () => 500 },
];

/** Popular activities where a Team-up deal is currently unlocked (5% off). */
export const TEAM_UP = new Set([
  "crg-abbey",
  "hmp-virupaksha",
  "gok-ombeach",
  "dan-rafting",
  "ban-safari",
  "ckm-mullayanagiri",
  "mys-palace",
  "blr-food-walk",
]);

export const itemCost = (i: TripItem) => (i.status === "cancelled" ? 0 : i.unitCost * (i.costMode === "per-person" ? i.qty : 1));

export function priceTrip(trip: Trip): PriceBreakdown {
  const p = trip.prefs;
  const travelers = p.adults + p.kids;
  const rooms = roomsFor(p);
  const stay = stayMap[trip.stayId];
  const live = trip.items.filter((i) => i.status !== "cancelled");
  const sum = (pred: (i: TripItem) => boolean) => live.filter(pred).reduce((s, i) => s + itemCost(i), 0);

  const stayCost = (stay?.nightlyPrice ?? 0) * rooms * p.nights;
  const travel = sum((i) => ["flight", "train", "bus", "car"].includes(i.kind));
  const local = sum((i) => i.kind === "transfer");
  const activities = sum((i) => i.kind === "activity" || i.kind === "rest");
  const meals = sum((i) => i.kind === "meal");
  const subtotal = stayCost + travel + local + activities + meals;
  const teamUp = Math.round(
    live.filter((i) => i.refId && TEAM_UP.has(i.refId)).reduce((s, i) => s + itemCost(i), 0) * 0.05,
  );
  const promoDef = PROMOS.find((x) => x.code === trip.promoCode);
  const promo = promoDef && subtotal >= (promoDef.minSubtotal ?? 0) ? promoDef.apply(subtotal) : 0;
  const discounted = subtotal - teamUp - promo;
  const serviceFee = Math.min(1500, Math.round(discounted * 0.03));
  const tax = Math.round((discounted + serviceFee) * 0.05);
  const total = discounted + serviceFee + tax;
  const budget = p.budgetPerPerson * travelers;
  const ratio = total / Math.max(1, budget);
  return {
    stay: stayCost,
    travel,
    local,
    activities,
    meals,
    subtotal,
    teamUp,
    promo,
    serviceFee,
    tax,
    total,
    perPerson: Number((total / Math.max(1, travelers)).toFixed(2)),
    budget,
    budgetStatus: ratio <= 0.88 ? "roomy" : ratio <= 1 ? "on-budget" : "over",
    travelers,
    rooms,
  };
}

export function validatePromo(code: string, trip: Trip): { ok: true; label: string } | { ok: false; error: string } {
  const def = PROMOS.find((x) => x.code === code.trim().toUpperCase());
  if (!def) return { ok: false, error: "That code isn't valid. Try PRAYAANA10." };
  const { subtotal } = priceTrip({ ...trip, promoCode: undefined });
  if (def.minSubtotal && subtotal < def.minSubtotal) {
    return { ok: false, error: `Needs a trip above ₹${def.minSubtotal.toLocaleString("en-IN")}.` };
  }
  return { ok: true, label: def.label };
}

/** Vendor-wise split of the booking, used on checkout and the operator side. */
export function vendorBreakdown(trip: Trip) {
  const map = new Map<string, { vendorId: string; items: TripItem[]; amount: number }>();
  for (const i of trip.items) {
    if (!i.vendorId || i.status === "cancelled") continue;
    const row = map.get(i.vendorId) ?? { vendorId: i.vendorId, items: [], amount: 0 };
    row.items.push(i);
    row.amount += itemCost(i);
    map.set(i.vendorId, row);
  }
  const stay = stayMap[trip.stayId];
  if (stay) {
    const row = map.get(stay.vendorId) ?? { vendorId: stay.vendorId, items: [], amount: 0 };
    row.amount += stay.nightlyPrice * roomsFor(trip.prefs) * trip.prefs.nights;
    map.set(stay.vendorId, row);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface PriceRange {
  low: number;
  high: number;
  current: number;
  /** Every priced stay × transport combination for this trip, cheapest first. */
  totals: number[];
}

/**
 * The real price range for this trip: the same pricing engine run over every catalog stay and
 * inter-city transport option at the trip's destination. No history, no invented points —
 * returns null when there are no alternatives to compare against.
 */
export function tripPriceRange(trip: Trip): PriceRange | null {
  const current = priceTrip(trip).total;
  const stays = Object.values(stayMap).filter((s) => s.destinationId === trip.destinationId);
  const transports = Object.values(transportMap).filter((t) => t.destinationId === trip.destinationId);
  const currentT = transportMap[trip.transportId];
  const stayIds = stays.length ? stays.map((s) => s.id) : [trip.stayId];
  const transportOpts = currentT && transports.length ? transports : [null];
  if (stayIds.length * transportOpts.length < 2) return null;
  const totals: number[] = [];
  for (const stayId of stayIds) {
    for (const t of transportOpts) {
      const items = t ? trip.items.map((i) => (i.refId === trip.transportId ? { ...i, unitCost: t.pricePerPerson } : i)) : trip.items;
      totals.push(priceTrip({ ...trip, stayId, transportId: t?.id ?? trip.transportId, items }).total);
    }
  }
  totals.sort((a, b) => a - b);
  const low = Math.min(totals[0], current);
  const high = Math.max(totals[totals.length - 1], current);
  if (high - low < 1) return null;
  return { low, high, current, totals };
}
