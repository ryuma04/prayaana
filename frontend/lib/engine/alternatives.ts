import type { Activity, Stay, Trip, TripItem } from "@/types";
import { activitiesFor, activityMap } from "@/data/activities";
import { staysFor } from "@/data/stays";
import { haversineKm } from "@/lib/format";
import { vendorMap } from "@/data/vendors";
import { matchPercent } from "./planner";
import { itemCost } from "./pricing";
import { tripDayWeather, isWet } from "./weather";

export type Availability = "Available" | "Partner paused";

export interface Alternative {
  activity: Activity;
  isCurrent: boolean;
  totalCost: number;
  priceDelta: number;
  distanceKm: number;
  match: number;
  weatherSafe: boolean;
  weatherLabel: string;
  availability: Availability;
}

/** Whether the partner is taking bookings (the operator's Available switch). Confirmed per booking by the partner. */
function availabilityFor(a: Activity): Availability {
  return vendorMap[a.vendorId]?.available === false ? "Partner paused" : "Available";
}

export function activityAlternatives(trip: Trip, item: TripItem, limit = 4): Alternative[] {
  const current = item.refId ? activityMap[item.refId] : undefined;
  const taken = new Set(trip.items.filter((i) => i.status !== "cancelled" && i.refId).map((i) => i.refId));
  const weather = tripDayWeather(trip, item.day);
  const wet = isWet(weather);
  const qty = item.costMode === "per-person" ? item.qty : 1;
  const origin = { lat: item.lat ?? 0, lng: item.lng ?? 0 };
  const toAlt = (a: Activity, isCurrent: boolean): Alternative => {
    const totalCost = a.price * qty;
    return {
      activity: a,
      isCurrent,
      totalCost,
      priceDelta: isCurrent ? 0 : totalCost - itemCost(item),
      distanceKm: Math.round(haversineKm(origin, a) * 10) / 10,
      match: matchPercent(a, trip.prefs),
      weatherSafe: !a.outdoor || !wet,
      weatherLabel: !a.outdoor ? "Rain-safe (indoor)" : wet ? `Rain forecast (${weather.rainChance}%)` : "Clear day",
      availability: isCurrent ? "Available" : availabilityFor(a),
    };
  };
  const pool = activitiesFor(trip.destinationId)
    .filter((a) => a.id !== item.refId && !taken.has(a.id))
    .map((a) => {
      const shared = current ? a.interests.filter((x) => current.interests.includes(x)).length : 0;
      const sameSlot = current && a.slot === current.slot ? 1 : 0;
      const km = haversineKm(origin, a);
      return { a, score: shared * 12 + sameSlot * 10 + matchPercent(a, trip.prefs) * 0.4 - Math.min(km, 60) * 0.3 };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => toAlt(x.a, false));
  return current ? [toAlt(current, true), ...pool] : pool;
}

export interface StayAlternative {
  stay: Stay;
  isCurrent: boolean;
  total: number;
  delta: number;
}

export function stayAlternatives(trip: Trip): StayAlternative[] {
  const rooms = Math.max(1, Math.ceil(trip.prefs.adults / 2));
  const current = staysFor(trip.destinationId).find((s) => s.id === trip.stayId);
  const currentTotal = (current?.nightlyPrice ?? 0) * rooms * trip.prefs.nights;
  return staysFor(trip.destinationId).map((s) => {
    const total = s.nightlyPrice * rooms * trip.prefs.nights;
    return { stay: s, isCurrent: s.id === trip.stayId, total, delta: total - currentTotal };
  });
}
