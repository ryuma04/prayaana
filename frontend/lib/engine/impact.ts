import type { ImpactItem, ImpactLevel, ImpactSummary, Incident, Trip, TripItem } from "@/types";
import { dayDate, duration } from "@/lib/format";
import { itemCost } from "./pricing";
import { SLOT_WINDOWS, dayItems, endOf, isTransport, slotOf, travelGap } from "./schedule";
import { activityMap } from "@/data/activities";

/** Latest acceptable end time for an item, used to label shifted items. */
function closingFor(item: TripItem) {
  if (item.kind === "activity" && item.refId) {
    const slot = activityMap[item.refId]?.slot ?? slotOf(item.startMin);
    return SLOT_WINDOWS[slot].end;
  }
  if (item.kind === "meal") return item.startMin < 17 * 60 ? 16 * 60 : 23 * 60;
  return 24 * 60;
}

function levelForShift(item: TripItem, newStart: number): ImpactLevel {
  if (newStart <= item.startMin) return "safe";
  if (item.kind === "transfer" || item.kind === "checkin" || isTransport(item)) return "moves";
  const newEnd = newStart + item.durationMin;
  const close = closingFor(item);
  if (newEnd <= close - 30) return "moves";
  if (newEnd <= close) return "at_risk";
  return "cannot_happen";
}

const matchesPlace = (item: TripItem, place?: string) =>
  !!place && (item.place.toLowerCase().includes(place.toLowerCase()) || item.title.toLowerCase().includes(place.toLowerCase()));

export function analyzeImpact(trip: Trip, incident: Incident): ImpactSummary {
  const D = incident.day;
  const out = new Map<string, ImpactItem>();
  let order = 1;
  const mark = (item: TripItem, level: ImpactLevel, reason: string, extra: Partial<ImpactItem> = {}) => {
    const prev = out.get(item.id);
    const rank: Record<ImpactLevel, number> = { safe: 0, moves: 1, at_risk: 2, cannot_happen: 3 };
    if (prev && rank[prev.level] >= rank[level]) return;
    out.set(item.id, {
      itemId: item.id,
      level,
      reason,
      costAtRisk: level === "cannot_happen" ? itemCost(item) : level === "at_risk" ? Math.round(itemCost(item) * 0.5) : 0,
      order: prev?.order ?? order++,
      ...extra,
    });
  };

  const today = dayItems(trip.items, D);
  const broken: TripItem[] = [];

  switch (incident.kind) {
    case "weather": {
      for (const item of today) {
        if (item.kind === "activity" && item.outdoor) {
          const level: ImpactLevel = incident.severity >= 4 ? "cannot_happen" : "at_risk";
          mark(item, level, level === "cannot_happen" ? "Outdoor activity · heavy rain & gusts forecast" : "Outdoor · light rain possible");
          broken.push(item);
        }
      }
      break;
    }
    case "health":
    case "traveler_request": {
      for (const item of today) {
        if (item.kind !== "activity") continue;
        if (item.energy >= 4) {
          mark(item, "cannot_happen", "Too strenuous for today");
          broken.push(item);
        } else if (item.energy === 3) {
          mark(item, "at_risk", "Moderate effort, may be tiring");
          broken.push(item);
        }
      }
      break;
    }
    case "vendor_unavailable": {
      for (const item of trip.items) {
        if (item.status === "cancelled" || item.day < D) continue;
        if (item.vendorId === incident.vendorId) {
          mark(item, "cannot_happen", "Vendor cannot serve this booking");
          broken.push(item);
        }
      }
      break;
    }
    case "closure":
    case "crowd_report": {
      for (const item of trip.items) {
        if (item.status === "cancelled" || item.day < D) continue;
        if (matchesPlace(item, incident.place)) {
          const level: ImpactLevel = incident.kind === "closure" ? "cannot_happen" : "at_risk";
          mark(item, level, incident.kind === "closure" ? `${incident.place} is closed` : `Crowd report at ${incident.place}`);
          broken.push(item);
        }
      }
      break;
    }
    case "flight_delay":
    case "running_late": {
      const delay = incident.delayMin ?? 60;
      const root =
        incident.kind === "flight_delay"
          ? today.find(isTransport) ?? today[0]
          : today.find((i) => i.status !== "done" && !isTransport(i)) ?? today[0];
      if (!root) break;
      const shifted = new Map<string, number>([[root.id, root.startMin + delay]]);
      mark(root, "moves", incident.kind === "flight_delay" ? `Now lands ${duration(delay)} late` : `Group running ${duration(delay)} late`, {
        newStartMin: root.startMin + delay,
      });
      let prev: TripItem = { ...root, startMin: root.startMin + delay };
      for (const item of today) {
        if (item.startMin <= root.startMin || item.id === root.id) continue;
        const earliest = endOf(prev) + (item.kind === "meal" ? 0 : Math.min(travelGap(prev, item), 30));
        const newStart = Math.max(item.startMin, earliest);
        if (newStart > item.startMin) {
          const level = levelForShift(item, newStart);
          shifted.set(item.id, newStart);
          mark(
            item,
            level,
            level === "cannot_happen"
              ? `Would end after closing if started ${duration(newStart - item.startMin)} late`
              : level === "at_risk"
                ? `Tight, starts ${duration(newStart - item.startMin)} late`
                : `Starts ${duration(newStart - item.startMin)} later`,
            { newStartMin: newStart, causeId: prev.id },
          );
          if (level === "cannot_happen") broken.push(item);
          prev = level === "cannot_happen" ? prev : { ...item, startMin: newStart };
        } else {
          prev = item;
        }
      }
      break;
    }
  }

  // Follow dependency links from broken items (same day): timings move.
  for (const b of broken) {
    for (const item of trip.items) {
      if (item.day !== b.day || item.status === "cancelled" || out.get(item.id)?.level === "cannot_happen") continue;
      if (item.dependsOn.includes(b.id)) {
        mark(item, "moves", `Timing depends on “${b.title}”`, { causeId: b.id });
      }
    }
    // The day's pickup changes if the morning plan changes.
    const pickup = dayItems(trip.items, b.day).find((i) => i.kind === "transfer" && i.dependsOn.length === 0);
    const firstAct = dayItems(trip.items, b.day).find((i) => i.kind === "activity");
    if (pickup && firstAct?.id === b.id && !out.has(pickup.id)) {
      mark(pickup, "moves", "Pickup time will change with the new plan", { causeId: b.id });
    }
  }

  // Everything else on the affected day is shown as safe.
  for (const item of today) if (!out.has(item.id)) out.set(item.id, { itemId: item.id, level: "safe", reason: "Not affected", costAtRisk: 0, order: 99 });

  const items = [...out.values()].sort((a, b) => a.order - b.order);
  const byId = new Map(trip.items.map((i) => [i.id, i]));
  const notSafe = items.filter((i) => i.level !== "safe");
  const minutesLost =
    incident.kind === "flight_delay" || incident.kind === "running_late"
      ? incident.delayMin ?? 0
      : notSafe.filter((i) => i.level === "cannot_happen").reduce((s, i) => s + (byId.get(i.itemId)?.durationMin ?? 0), 0);
  return {
    items,
    moneyAtRisk: notSafe.reduce((s, i) => s + i.costAtRisk, 0),
    minutesLost,
    heartsAtRisk: notSafe.filter((i) => i.level !== "moves" && byId.get(i.itemId)?.hearted).length,
    vendorsTouched: [...new Set(notSafe.map((i) => byId.get(i.itemId)?.vendorId).filter((v): v is string => !!v))],
    root: `${incident.title} · Day ${D}, ${dayDate(trip.prefs.startDate, D)}`,
  };
}
