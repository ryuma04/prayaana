import type { Activity, Trip, TripItem } from "@/types";
import { activityMap } from "@/data/activities";
import { stayMap, transportMap } from "@/data/stays";
import { duration, haversineKm, minToTime, roadMinutes } from "@/lib/format";
import { itemFromActivity, reverseRoute } from "./planner";
import { dayItems, isTransport, reflowDay, slotStart } from "./schedule";
import { isWet, tripDayWeather } from "./weather";

export const MAX_HEARTS = 5;

export const heartsUsed = (trip: Trip) => trip.items.filter((i) => i.hearted && i.status !== "cancelled").length;

export function toggleHeart(trip: Trip, itemId: string): { trip: Trip; error?: string } {
  const item = trip.items.find((i) => i.id === itemId);
  if (!item) return { trip };
  if (!item.hearted && heartsUsed(trip) >= MAX_HEARTS) {
    return { trip, error: "All 5 Must-Do hearts are used. Remove one first." };
  }
  return { trip: { ...trip, items: trip.items.map((i) => (i.id === itemId ? { ...i, hearted: !i.hearted } : i)) } };
}

export function removeItem(trip: Trip, itemId: string): Trip {
  const item = trip.items.find((i) => i.id === itemId);
  if (!item) return trip;
  const items = trip.items.filter((i) => i.id !== itemId).map((i) => ({ ...i, dependsOn: i.dependsOn.filter((d) => d !== itemId) }));
  return { ...trip, items };
}

export function moveItem(trip: Trip, itemId: string, toDay: number): Trip {
  const item = trip.items.find((i) => i.id === itemId);
  if (!item || item.day === toDay) return trip;
  const target = dayItems(trip.items, toDay).filter((i) => !isTransport(i));
  const lastEnd = target.length ? Math.max(...target.filter((i) => i.startMin < 20 * 60).map((i) => i.startMin + i.durationMin)) : 10 * 60;
  const start = Math.max(item.startMin, Math.min(lastEnd + 30, 19 * 60));
  let items = trip.items.map((i) => (i.id === itemId ? { ...i, day: toDay, startMin: start, dependsOn: [] } : i));
  items = reflowDay(items, toDay);
  return { ...trip, items };
}

export function changeTime(trip: Trip, itemId: string, startMin: number): Trip {
  const item = trip.items.find((i) => i.id === itemId);
  if (!item) return trip;
  let items = trip.items.map((i) => (i.id === itemId ? { ...i, startMin } : i));
  items = reflowDay(items, item.day);
  return { ...trip, items };
}

export function changeQty(trip: Trip, itemId: string, qty: number): Trip {
  const max = trip.prefs.adults + trip.prefs.kids;
  return {
    ...trip,
    items: trip.items.map((i) => (i.id === itemId ? { ...i, qty: Math.max(1, Math.min(max, qty)) } : i)),
  };
}

export function addActivity(trip: Trip, activity: Activity, day: number): Trip {
  const list = dayItems(trip.items, day).filter((i) => !isTransport(i));
  const preferred = slotStart(activity.slot, trip.prefs.rhythm);
  const clash = list.find((i) => preferred < i.startMin + i.durationMin && preferred + activity.durationMin > i.startMin);
  const start = clash ? clash.startMin + clash.durationMin + 30 : preferred;
  const item = itemFromActivity(activity, day, start, trip.prefs.adults + trip.prefs.kids, trip.id);
  let items = [...trip.items, item];
  items = reflowDay(items, day);
  return { ...trip, items };
}

export function swapActivity(trip: Trip, itemId: string, activity: Activity): Trip {
  let day = 1;
  const items = trip.items.map((i) => {
    if (i.id !== itemId) return i;
    day = i.day;
    return {
      ...i,
      refId: activity.id,
      title: activity.title,
      subtitle: `${duration(activity.durationMin)} · ${activity.outdoor ? "Outdoor" : "Indoor"}`,
      durationMin: activity.durationMin,
      unitCost: activity.price,
      vendorId: activity.vendorId,
      outdoor: activity.outdoor,
      energy: activity.energy,
      icon: activity.icon,
      tone: activity.tone,
      lat: activity.lat,
      lng: activity.lng,
      hearted: i.hearted,
    };
  });
  return { ...trip, items: reflowDay(items, day) };
}

export function changeStay(trip: Trip, stayId: string): Trip {
  const stay = stayMap[stayId];
  if (!stay) return trip;
  return {
    ...trip,
    stayId,
    items: trip.items.map((i) => {
      if (i.kind === "checkin") return { ...i, refId: stay.id, title: `Check-in · ${stay.name}`, subtitle: `${stay.area} · ${trip.prefs.nights} nights`, vendorId: stay.vendorId, lat: stay.lat, lng: stay.lng };
      if (i.kind === "checkout") return { ...i, refId: stay.id, subtitle: stay.name, vendorId: stay.vendorId, lat: stay.lat, lng: stay.lng };
      if (i.kind === "transfer") return { ...i, lat: stay.lat, lng: stay.lng, place: i.title === "Hotel pickup" ? stay.name : i.place };
      return i;
    }),
  };
}

export function changeTransport(trip: Trip, transportId: string): Trip {
  const t = transportMap[transportId];
  if (!t) return trip;
  const legs = trip.items.filter((i) => isTransport(i));
  return {
    ...trip,
    transportId,
    items: trip.items.map((i) => {
      if (!legs.includes(i)) return i;
      const outbound = i.day === 1;
      return {
        ...i,
        kind: t.mode,
        refId: t.id,
        title: outbound ? t.label : `Return · ${reverseRoute(t.label)}`,
        subtitle: outbound ? `Departs ${minToTime(Number(t.departs.split(":")[0]) * 60 + Number(t.departs.split(":")[1]))} · ${duration(t.durationMin)}` : i.subtitle,
        unitCost: t.pricePerPerson,
        vendorId: t.vendorId,
        icon: t.mode,
      };
    }),
  };
}

export function setTravelers(trip: Trip, adults: number, kids: number): Trip {
  const travelers = adults + kids;
  return {
    ...trip,
    prefs: { ...trip.prefs, adults, kids },
    items: trip.items.map((i) => (i.costMode === "per-person" ? { ...i, qty: travelers } : i)),
  };
}

// ─── Optimizer (quick version of §12.3) ────────────────────────────────────

function travelFor(items: TripItem[]) {
  let total = 0;
  for (let k = 1; k < items.length; k++) {
    const a = items[k - 1];
    const b = items[k];
    if (a.lat == null || b.lat == null || a.lng == null || b.lng == null) continue;
    total += roadMinutes(haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }));
  }
  return total;
}

export function optimizeTrip(trip: Trip): { trip: Trip; savedMin: number; movedOutdoor: number } {
  let items = [...trip.items];
  let saved = 0;
  let movedOutdoor = 0;
  const days = trip.prefs.nights + 1;

  // 1. Move outdoor plans off rainy days (swap with an indoor item of the same slot on a dry day).
  for (let d = 1; d <= days; d++) {
    if (!isWet(tripDayWeather(trip, d))) continue;
    for (const out of dayItems(items, d).filter((i) => i.kind === "activity" && i.outdoor && !i.hearted)) {
      for (let d2 = 2; d2 < days; d2++) {
        if (d2 === d || isWet(tripDayWeather(trip, d2))) continue;
        const indoor = dayItems(items, d2).find((i) => i.kind === "activity" && !i.outdoor && Math.abs(i.startMin - out.startMin) < 240);
        if (!indoor) continue;
        items = items.map((i) =>
          i.id === out.id ? { ...i, day: d2, startMin: indoor.startMin } : i.id === indoor.id ? { ...i, day: d, startMin: out.startMin } : i,
        );
        movedOutdoor++;
        break;
      }
    }
  }

  // 2. Within each day, order activities in the same time window by nearest-next.
  for (let d = 1; d <= days; d++) {
    const list = dayItems(items, d);
    const before = travelFor(list);
    const acts = list.filter((i) => i.kind === "activity" && i.startMin < 17 * 60);
    if (acts.length >= 2) {
      const times = acts.map((a) => a.startMin).sort((a, b) => a - b);
      const anchor = list.find((i) => i.kind === "transfer") ?? list[0];
      const remaining = [...acts];
      const ordered: TripItem[] = [];
      let cur = anchor;
      while (remaining.length) {
        remaining.sort((a, b) => dist(cur, a) - dist(cur, b));
        const next = remaining.shift()!;
        ordered.push(next);
        cur = next;
      }
      const retimed = new Map(ordered.map((a, idx) => [a.id, times[idx]]));
      const candidate = items.map((i) => (retimed.has(i.id) ? { ...i, startMin: retimed.get(i.id)! } : i));
      const after = travelFor(dayItems(candidate, d));
      if (after < before) {
        saved += before - after;
        items = candidate;
      }
    }
    items = reflowDay(items, d);
  }

  const summary = { savedMin: saved, movedOutdoor };
  return { trip: { ...trip, items, optimized: summary }, ...summary };
}

function dist(a: TripItem, b: TripItem) {
  if (a.lat == null || b.lat == null || a.lng == null || b.lng == null) return 999;
  return haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
}

export function activityFor(item: TripItem) {
  return item.refId ? activityMap[item.refId] : undefined;
}
