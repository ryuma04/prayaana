import type { Slot, TripItem } from "@/types";
import { haversineKm, roadMinutes } from "@/lib/format";

export const SLOT_WINDOWS: Record<Slot, { start: number; end: number }> = {
  morning: { start: 8 * 60, end: 13 * 60 + 30 },
  afternoon: { start: 13 * 60, end: 18 * 60 + 30 },
  evening: { start: 17 * 60, end: 22 * 60 + 30 },
};

const FIXED_KINDS = new Set(["flight", "train", "bus", "car"]);

export const isTransport = (i: TripItem) => FIXED_KINDS.has(i.kind);
export const isActive = (i: TripItem) => i.status !== "cancelled";
export const endOf = (i: TripItem) => i.startMin + i.durationMin;

export function travelGap(a: TripItem, b: TripItem) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 15;
  const km = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
  if (km < 0.8) return 5;
  return Math.min(120, roadMinutes(km));
}

/**
 * Re-time one day: keep order by start time, push items forward so nothing overlaps
 * and there is time to travel between places. Transport legs never move.
 */
export function reflowDay(items: TripItem[], day: number): TripItem[] {
  const dayItems = items
    .filter((i) => i.day === day && isActive(i))
    .sort((a, b) => a.startMin - b.startMin || kindOrder(a) - kindOrder(b));
  const updated = new Map<string, TripItem>();
  let prev: TripItem | undefined;
  for (const item of dayItems) {
    let next = item;
    if (prev && !isTransport(item)) {
      const earliest = endOf(prev) + (item.kind === "meal" || prev.kind === "transfer" ? 0 : travelGap(prev, item));
      if (item.startMin < earliest) next = { ...item, startMin: roundTo5(earliest) };
    }
    updated.set(next.id, next);
    prev = next;
  }
  return items.map((i) => updated.get(i.id) ?? i);
}

function kindOrder(i: TripItem) {
  const order: Record<string, number> = { flight: 0, train: 0, bus: 0, car: 0, transfer: 1, checkin: 2, checkout: 0 };
  return order[i.kind] ?? 3;
}

export const roundTo5 = (m: number) => Math.round(m / 5) * 5;

export function dayItems(items: TripItem[], day: number, includeCancelled = false) {
  return items
    .filter((i) => i.day === day && (includeCancelled || isActive(i)))
    .sort((a, b) => a.startMin - b.startMin);
}

export function dayEnergy(items: TripItem[], day: number) {
  return dayItems(items, day).reduce((s, i) => s + i.energy, 0);
}

export const PACE_LIMIT = { relaxed: 9, balanced: 12, packed: 15 } as const;

export function slotOf(min: number): Slot {
  if (min < 12 * 60 + 30) return "morning";
  if (min < 17 * 60) return "afternoon";
  return "evening";
}

export function slotStart(slot: Slot, rhythm: "early-bird" | "night-owl" = "early-bird") {
  if (slot === "morning") return rhythm === "early-bird" ? 9 * 60 + 30 : 10 * 60 + 30;
  if (slot === "afternoon") return 15 * 60;
  return 18 * 60;
}
