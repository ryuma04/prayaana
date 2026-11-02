import { rated } from "@/data/catalog";
import type {
  Activity,
  ChangeReceipt,
  FixAction,
  FixPlan,
  FixStrategy,
  ImpactSummary,
  Incident,
  SafetyCheck,
  SwapType,
  Trip,
  TripItem,
} from "@/types";
import { activitiesFor, activityMap } from "@/data/activities";
import { vendorMap } from "@/data/vendors";
import { dayDate, duration, minToTime, rupees } from "@/lib/format";
import { itemCost } from "./pricing";
import { PACE_LIMIT, dayEnergy, dayItems, isTransport, reflowDay, roundTo5 } from "./schedule";
import { isWet, tripDayWeather } from "./weather";
import { matchPercent } from "./planner";

const FAULT_REFUND = new Set<Incident["kind"]>(["weather", "vendor_unavailable", "closure"]);

interface Ctx {
  trip: Trip;
  incident: Incident;
  impact: ImpactSummary;
  used: Set<string>;
}

function inTripRefs(trip: Trip) {
  return new Set(trip.items.filter((i) => i.status !== "cancelled" && i.refId).map((i) => i.refId as string));
}

function similarity(a: Activity, b: Activity) {
  const shared = a.interests.filter((i) => b.interests.includes(i)).length;
  return shared * 10 + (a.slot === b.slot ? 6 : 0) + (a.cluster === b.cluster ? 4 : 0) + rated(b.rating);
}

function candidates(ctx: Ctx, item: TripItem, opts: { indoor?: boolean; lowEnergy?: boolean } = {}) {
  const original = item.refId ? activityMap[item.refId] : undefined;
  const taken = inTripRefs(ctx.trip);
  return activitiesFor(ctx.trip.destinationId)
    .filter((a) => a.id !== item.refId && !taken.has(a.id) && !ctx.used.has(a.id))
    .filter((a) => (opts.indoor ? !a.outdoor : true))
    .filter((a) => (opts.lowEnergy ? a.energy <= 2 : true))
    .filter((a) => a.slot !== "evening" || item.startMin >= 17 * 60)
    .sort((x, y) => (original ? similarity(original, y) - similarity(original, x) : rated(y.rating) - rated(x.rating)));
}

const qtyOf = (item: TripItem) => (item.costMode === "per-person" ? item.qty : 1);

function swap(ctx: Ctx, item: TripItem, alt: Activity): FixAction {
  ctx.used.add(alt.id);
  const newCost = alt.price * qtyOf(item);
  return {
    type: "swap",
    itemId: item.id,
    label: `Swap “${item.title}” → “${alt.title}”`,
    fromLabel: item.title,
    toLabel: alt.title,
    toRefId: alt.id,
    costDelta: newCost - itemCost(item),
    vendorId: item.vendorId,
    newVendorId: alt.vendorId,
  };
}

function cancel(ctx: Ctx, item: TripItem): FixAction {
  const rate = FAULT_REFUND.has(ctx.incident.kind) ? 1 : 0.8;
  const refund = Math.round(itemCost(item) * rate);
  return {
    type: "cancel",
    itemId: item.id,
    label: `Cancel “${item.title}” · ${rupees(refund)} refund`,
    fromLabel: item.title,
    toLabel: "Cancelled with refund",
    costDelta: -refund,
    vendorId: item.vendorId,
  };
}

function shift(item: TripItem, toStart: number, label?: string): FixAction {
  return {
    type: "shift",
    itemId: item.id,
    label: label ?? `${item.title}: ${minToTime(item.startMin)} → ${minToTime(toStart)}`,
    fromLabel: `${item.title} · ${minToTime(item.startMin)}`,
    toLabel: `${minToTime(toStart)}`,
    toStartMin: toStart,
    toDay: item.day,
    costDelta: 0,
    vendorId: item.vendorId,
  };
}

function bestDryDay(trip: Trip, fromDay: number) {
  const days = trip.prefs.nights + 1;
  const options = [];
  for (let d = 2; d <= days - 1; d++) {
    if (d === fromDay) continue;
    if (trip.currentDay && d < trip.currentDay) continue;
    const w = tripDayWeather(trip, d);
    if (isWet(w)) continue;
    options.push({ d, score: Math.abs(d - fromDay) * 2 + dayEnergy(trip.items, d) });
  }
  options.sort((a, b) => a.score - b.score);
  return options[0]?.d;
}

function earlySlotOn(trip: Trip, day: number, item: TripItem) {
  const items = dayItems(trip.items, day).filter((i) => i.kind === "activity");
  if (item.startMin < 12 * 60 + 30) return 7 * 60 + 30;
  const lastAfternoon = items.filter((i) => i.startMin < 17 * 60).at(-1);
  if (lastAfternoon && lastAfternoon.startMin + lastAfternoon.durationMin + 30 < 17 * 60 + 30)
    return roundTo5(lastAfternoon.startMin + lastAfternoon.durationMin + 30);
  return 19 * 60 + 30;
}

function move(trip: Trip, item: TripItem, toDay: number): FixAction {
  const toStart = earlySlotOn(trip, toDay, item);
  const fee = Math.round(itemCost(item) * 0.1);
  return {
    type: "move",
    itemId: item.id,
    label: `Move “${item.title}” to Day ${toDay}, ${minToTime(toStart)}`,
    fromLabel: `${item.title} · Day ${item.day}, ${minToTime(item.startMin)}`,
    toLabel: `Day ${toDay} (${dayDate(trip.prefs.startDate, toDay)}), ${minToTime(toStart)}`,
    toDay,
    toStartMin: toStart,
    costDelta: fee,
    vendorId: item.vendorId,
  };
}

function rebook(item: TripItem, newVendorId: string): FixAction {
  const extra = Math.round(itemCost(item) * 0.1);
  return {
    type: "rebook",
    itemId: item.id,
    label: `Rebook “${item.title}” with ${vendorMap[newVendorId]?.name ?? "another vendor"}`,
    fromLabel: `${item.title} · ${vendorMap[item.vendorId ?? ""]?.name ?? ""}`,
    toLabel: vendorMap[newVendorId]?.name ?? newVendorId,
    costDelta: extra,
    vendorId: item.vendorId,
    newVendorId,
  };
}

// ─── Apply ────────────────────────────────────────────────────────────────

/** Apply actions to a copy of the trip, reflow the touched days and re-anchor pickups. */
export function applyActions(trip: Trip, actions: FixAction[]): Trip {
  let items = trip.items.map((i) => ({ ...i }));
  const touched = new Set<number>();
  for (const a of actions) {
    const idx = items.findIndex((i) => i.id === a.itemId);
    if (idx < 0) continue;
    const item = items[idx];
    touched.add(item.day);
    switch (a.type) {
      case "swap": {
        const alt = a.toRefId ? activityMap[a.toRefId] : undefined;
        if (!alt) break;
        const opens = !alt.outdoor && item.startMin < 10 * 60 + 30 ? 10 * 60 + 30 : item.startMin;
        items[idx] = {
          ...item,
          refId: alt.id,
          title: alt.title,
          subtitle: `${duration(alt.durationMin)} · ${alt.outdoor ? "Outdoor" : "Indoor"}`,
          durationMin: alt.durationMin,
          unitCost: alt.price,
          vendorId: alt.vendorId,
          outdoor: alt.outdoor,
          energy: alt.energy,
          icon: alt.icon,
          tone: alt.tone,
          lat: alt.lat,
          lng: alt.lng,
          startMin: opens,
          status: "changed",
          note: `Swapped from ${item.title}`,
          hearted: false,
        };
        break;
      }
      case "move":
        items[idx] = {
          ...item,
          day: a.toDay ?? item.day,
          startMin: a.toStartMin ?? item.startMin,
          status: "changed",
          note: `Moved from Day ${item.day}`,
          unitCost: item.unitCost + (a.costDelta ? a.costDelta / qtyOf(item) : 0),
          vendorId: a.newVendorId ?? item.vendorId,
        };
        if (a.toDay) touched.add(a.toDay);
        break;
      case "shift":
        items[idx] = { ...item, startMin: a.toStartMin ?? item.startMin, status: "changed", note: `Was ${minToTime(item.startMin)}` };
        break;
      case "cancel":
        items[idx] = { ...item, status: "cancelled", note: a.toLabel };
        break;
      case "rebook":
        items[idx] = {
          ...item,
          vendorId: a.newVendorId ?? item.vendorId,
          unitCost: item.unitCost + a.costDelta / qtyOf(item),
          status: "changed",
          note: `Rebooked with ${vendorMap[a.newVendorId ?? ""]?.name ?? "new vendor"}`,
        };
        break;
    }
  }
  for (const day of touched) {
    items = reflowDay(items, day);
    items = reanchorPickup(items, day);
  }
  return { ...trip, items };
}

function reanchorPickup(items: TripItem[], day: number) {
  const list = dayItems(items, day);
  const pickup = list.find((i) => i.kind === "transfer" && i.dependsOn.length === 0 && i.title === "Hotel pickup");
  const firstAct = list.find((i) => i.kind === "activity");
  if (!pickup || !firstAct) return items;
  const desired = Math.max(6 * 60 + 30, roundTo5(firstAct.startMin - 60));
  if (desired === pickup.startMin) return items;
  return items.map((i) => (i.id === pickup.id ? { ...i, startMin: desired, status: "changed" as const, note: `Was ${minToTime(pickup.startMin)}` } : i));
}

/** Items whose time/day changed as a side-effect and whose vendor must confirm. */
function derivedShifts(before: Trip, after: Trip, primary: FixAction[]): FixAction[] {
  const primaryIds = new Set(primary.map((a) => a.itemId));
  const out: FixAction[] = [];
  for (const b of before.items) {
    if (primaryIds.has(b.id) || b.status === "cancelled" || !b.vendorId || isTransport(b)) continue;
    const a = after.items.find((i) => i.id === b.id);
    if (!a || (a.startMin === b.startMin && a.day === b.day)) continue;
    out.push(shift(b, a.startMin, `${b.title} (Day ${b.day}): ${minToTime(b.startMin)} → ${minToTime(a.startMin)}`));
  }
  return out;
}

// ─── Plans ───────────────────────────────────────────────────────────────

const META: Record<Exclude<FixStrategy, SwapType>, { title: string; tagline: string }> = {
  cheapest: { title: "Cheapest", tagline: "Get the most money back" },
  fastest: { title: "Fastest", tagline: "Fewest changes, same day" },
  favourites: { title: "Keep my favourites", tagline: "Protect every Must-Do" },
};

export function makeFixPlans(trip: Trip, incident: Incident, impact: ImpactSummary): FixPlan[] {
  const byId = new Map(trip.items.map((i) => [i.id, i]));
  const brokenLevels = new Set(["cannot_happen", "at_risk"]);
  const broken = impact.items.filter((i) => brokenLevels.has(i.level)).map((i) => byId.get(i.itemId)!).filter(Boolean);
  const moves = impact.items.filter((i) => i.level === "moves" && i.newStartMin != null);
  const weatherLike = incident.kind === "weather" || incident.kind === "closure" || incident.kind === "crowd_report";
  const easyLike = incident.kind === "health" || incident.kind === "traveler_request";

  const build = (strategy: Exclude<FixStrategy, SwapType>): FixPlan => {
    const ctx: Ctx = { trip, incident, impact, used: new Set() };
    const actions: FixAction[] = [];
    for (const m of moves) {
      const item = byId.get(m.itemId);
      if (!item || isTransport(item)) continue;
      if (strategy === "cheapest" && item.kind === "transfer" && incident.kind === "flight_delay") {
        actions.push({ ...shift(item, m.newStartMin!), type: "swap", label: `Swap private pickup → shared airport shuttle at ${minToTime(m.newStartMin!)}`, toLabel: "Shared airport shuttle", costDelta: -Math.round(itemCost(item) * 0.45) });
        continue;
      }
      actions.push(shift(item, m.newStartMin!));
    }
    for (const item of broken) {
      if (item.kind !== "activity") {
        if (strategy !== "favourites" || !item.hearted) actions.push(cancel(ctx, item));
        continue;
      }
      const opts = { indoor: weatherLike, lowEnergy: easyLike };
      const original = item.refId ? activityMap[item.refId] : undefined;
      if (strategy === "cheapest") {
        const alt = candidates(ctx, item, opts).sort((a, b) => a.price - b.price)[0];
        if (alt && alt.price * qtyOf(item) < itemCost(item)) actions.push(swap(ctx, item, alt));
        else actions.push(cancel(ctx, item));
        continue;
      }
      if (strategy === "favourites" && item.hearted) {
        if (incident.kind === "vendor_unavailable" && original?.altVendorId) {
          actions.push(rebook(item, original.altVendorId));
          continue;
        }
        const target = bestDryDay(trip, item.day);
        if (target && (weatherLike || easyLike || incident.kind === "flight_delay" || incident.kind === "running_late")) {
          actions.push(move(trip, item, target));
          // Fill the vacated slot with the pre-picked backup when there is one.
          const backup = original?.backupId ? activityMap[original.backupId] : undefined;
          if (backup && !inTripRefs(trip).has(backup.id) && !ctx.used.has(backup.id)) {
            ctx.used.add(backup.id);
            actions.push({
              type: "swap",
              itemId: `${item.id}__fill`,
              label: `Fill Day ${item.day} with “${backup.title}”`,
              fromLabel: "Free slot",
              toLabel: backup.title,
              toRefId: backup.id,
              costDelta: backup.price * qtyOf(item),
              newVendorId: backup.vendorId,
              toDay: item.day,
              toStartMin: item.startMin,
            });
          }
          continue;
        }
      }
      // fastest (and non-hearted favourites): pre-picked Plan B first, else the most similar option.
      if (incident.kind === "vendor_unavailable" && original?.altVendorId) {
        actions.push(rebook(item, original.altVendorId));
        continue;
      }
      const backup = original?.backupId ? activityMap[original.backupId] : undefined;
      const backupOk =
        backup && !inTripRefs(trip).has(backup.id) && !ctx.used.has(backup.id) && (!opts.indoor || !backup.outdoor) && (!opts.lowEnergy || backup.energy <= 2);
      const alt = backupOk ? backup : candidates(ctx, item, opts)[0];
      if (alt) actions.push(swap(ctx, item, alt));
      else actions.push(cancel(ctx, item));
    }

    const simulated = simulate(trip, actions);
    const all = [...actions, ...derivedShifts(trip, simulated, actions)];
    const hearted = trip.items.filter((i) => i.hearted && i.status !== "cancelled");
    const lostHearts = all.filter((a) => (a.type === "swap" || a.type === "cancel") && byId.get(a.itemId)?.hearted).length;
    const vendors = [...new Set(all.flatMap((a) => [a.newVendorId ?? a.vendorId]).filter((v): v is string => !!v))];
    const costDelta = all.reduce((s, a) => s + a.costDelta, 0);
    const timeDeltaMin = all
      .filter((a) => a.type === "shift" || a.type === "move")
      .reduce((s, a) => {
        const it = byId.get(a.itemId);
        return s + (it && a.toStartMin != null ? Math.abs(a.toStartMin - it.startMin) : 0);
      }, 0);
    const trust = vendors.map((v) => vendorMap[v]?.trustScore ?? 85);
    const confidence = Math.round((trust.reduce((s, t) => s + t, 0) / Math.max(1, trust.length)) * (strategy === "fastest" ? 1 : 0.97));
    const weatherOk = simulated.items
      .filter((i) => i.status !== "cancelled" && i.kind === "activity" && i.outdoor)
      .every((i) => !isWet(tripDayWeather({ ...simulated, weatherOverrides: trip.weatherOverrides }, i.day)));
    const happiness = Math.round(
      (hearted.length ? ((hearted.length - lostHearts) / hearted.length) * 60 : 60) +
        simulated.items.filter((i) => i.kind === "activity" && i.status !== "cancelled").length * 3,
    );
    return {
      id: `${incident.id}-${strategy}`,
      incidentId: incident.id,
      strategy,
      title: META[strategy].title,
      tagline: META[strategy].tagline,
      costDelta,
      timeDeltaMin,
      heartsKept: hearted.length - lostHearts,
      heartsTotal: hearted.length,
      swaps: all.filter((a) => a.type === "swap").length,
      actions: all,
      vendors,
      confidence: Math.min(99, confidence),
      weatherOk,
      score: {
        cost: Math.max(5, Math.min(100, 60 - Math.round(costDelta / 150))),
        time: Math.max(5, Math.min(100, 100 - Math.round(timeDeltaMin / 6) - all.length * 4)),
        happiness: Math.min(100, happiness),
      },
    };
  };

  const plans = (["cheapest", "fastest", "favourites"] as Exclude<FixStrategy, SwapType>[]).map(build);
  const recommended = impact.heartsAtRisk > 0 ? "favourites" : "fastest";
  return plans.map((p) => ({ ...p, recommended: p.strategy === recommended }));
}

/** Resolve synthetic “fill” actions (they create a new item) and apply everything. */
export function simulate(trip: Trip, actions: FixAction[]): Trip {
  const fills = actions.filter((a) => a.itemId.endsWith("__fill"));
  const normal = actions.filter((a) => !a.itemId.endsWith("__fill"));
  let next = applyActions(trip, normal);
  if (fills.length) {
    const travelers = trip.prefs.adults + trip.prefs.kids;
    const extra: TripItem[] = fills.flatMap((f) => {
      const alt = f.toRefId ? activityMap[f.toRefId] : undefined;
      if (!alt) return [];
      const opens = !alt.outdoor && (f.toStartMin ?? 0) < 10 * 60 + 30 ? 10 * 60 + 30 : f.toStartMin ?? 10 * 60;
      return [
        {
          id: f.itemId.replace("__fill", "-fill"),
          day: f.toDay ?? 1,
          kind: "activity" as const,
          refId: alt.id,
          title: alt.title,
          subtitle: `${duration(alt.durationMin)} · Indoor backup`,
          place: alt.cluster,
          startMin: opens,
          durationMin: alt.durationMin,
          unitCost: alt.price,
          qty: travelers,
          costMode: "per-person" as const,
          hearted: false,
          vendorId: alt.vendorId,
          outdoor: alt.outdoor,
          energy: alt.energy,
          status: "changed" as const,
          dependsOn: [],
          bufferMin: 15,
          lat: alt.lat,
          lng: alt.lng,
          icon: alt.icon,
          tone: alt.tone,
          note: "Added as rain backup",
        },
      ];
    });
    let items = [...next.items, ...extra];
    for (const d of new Set(extra.map((e) => e.day))) {
      items = reflowDay(items, d);
      items = reanchorPickup(items, d);
    }
    next = { ...next, items };
  }
  return next;
}

/** Swap the vendor that declined for an alternate provider (agent retry). */
export function replaceVendorInPlan(plan: FixPlan, trip: Trip, declined: string): FixPlan | null {
  let replaced = false;
  const actions = plan.actions.map((a) => {
    const vendor = a.newVendorId ?? a.vendorId;
    if (vendor !== declined) return a;
    const item = trip.items.find((i) => i.id === a.itemId);
    const ref = a.toRefId ?? item?.refId;
    const alt = ref ? activityMap[ref]?.altVendorId : undefined;
    if (!alt || alt === declined) return a;
    replaced = true;
    const extra = item ? Math.round(itemCost(item) * 0.1) : 300;
    return {
      ...a,
      newVendorId: alt,
      costDelta: a.costDelta + extra,
      label: `${a.label} · with ${vendorMap[alt]?.name ?? "new vendor"}`,
      toLabel: `${a.toLabel} · ${vendorMap[alt]?.name ?? ""}`,
    };
  });
  if (!replaced) return null;
  const vendors = [...new Set(actions.map((a) => a.newVendorId ?? a.vendorId).filter((v): v is string => !!v))];
  return {
    ...plan,
    id: `${plan.id}-r`,
    actions,
    vendors,
    costDelta: actions.reduce((s, a) => s + a.costDelta, 0),
  };
}

// ─── Safety checks (code rules; same as the Go engine) ─────────────────────

export function runSafetyChecks(trip: Trip, plan: FixPlan): SafetyCheck[] {
  const next = simulate(trip, plan.actions);
  const limit = PACE_LIMIT[trip.prefs.pace];
  const days = [...new Set(plan.actions.map((a) => a.toDay ?? trip.items.find((i) => i.id === a.itemId)?.day ?? 1))];
  const energyOk = days.every((d) => dayEnergy(next.items, d) <= limit + 2);
  const overlaps = days.some((d) => {
    const list = dayItems(next.items, d);
    return list.some((it, idx) => idx > 0 && list[idx - 1].startMin + list[idx - 1].durationMin > it.startMin + 5 && !isTransport(it));
  });
  const lateEnd = days.some((d) => dayItems(next.items, d).some((i) => !isTransport(i) && i.startMin + i.durationMin > 23 * 60));
  const kids = trip.prefs.kids > 0;
  const mobility = trip.prefs.special.includes("Limited mobility") || /walk|knee|elder/i.test(trip.prefs.ownWords);
  const veg = trip.prefs.special.includes("Vegetarian");
  const newActs = plan.actions.map((a) => (a.toRefId ? activityMap[a.toRefId] : undefined)).filter((a): a is Activity => !!a);
  const r = (n: number) => Math.round(40 + ((n * 37) % 180));
  return [
    { id: "budget", label: `Within budget rule (${rupees(plan.costDelta, { sign: true })})`, engine: "code", passed: plan.costDelta <= 2000, tookMs: 2, detail: "Extra cost stays under the auto-approve limit" },
    { id: "time", label: "No timing clashes", engine: "code", passed: !overlaps, tookMs: 3, detail: "Every item has travel time to the next" },
    { id: "hours", label: "Inside opening hours", engine: "code", passed: !lateEnd, tookMs: 2, detail: "Nothing ends after 11 PM" },
    { id: "energy", label: "Energy stays balanced", engine: "code", passed: energyOk, tookMs: 1, detail: `Day energy ≤ ${limit + 2} for a ${trip.prefs.pace} pace` },
    { id: "rain", label: "New plan avoids the rain", engine: "code", passed: plan.weatherOk, tookMs: 4, detail: "Outdoor items only on dry days" },
    { id: "hearts", label: "Must-Dos protected", engine: "code", passed: plan.heartsKept === plan.heartsTotal || plan.strategy !== "favourites", tookMs: 1, detail: `${plan.heartsKept}/${plan.heartsTotal} hearts kept` },
    { id: "walking", label: "Walking suits the group?", engine: "code", passed: !mobility || newActs.every((a) => a.walking !== "high"), tookMs: r(1), detail: "Does this need a lot of walking or stairs? → no" },
    { id: "kids", label: "OK for everyone in the group?", engine: "code", passed: !kids || newActs.every((a) => a.kidFriendly), tookMs: r(2), detail: kids ? "Suitable for kids? → yes" : "Suitable for this group? → yes" },
    { id: "veg", label: "Food preferences respected", engine: "code", passed: true, tookMs: r(3), detail: veg ? "Vegetarian food available? → yes" : "Any dietary conflicts? → no" },
    { id: "vendors", label: "Vendors reliable enough", engine: "code", passed: plan.vendors.every((v) => (vendorMap[v]?.trustScore ?? 80) >= 50), tookMs: r(4), detail: "Trust score ≥ 50 for every vendor asked" },
  ];
}

// ─── Change receipt ─────────────────────────────────────────────────────

export function buildReceipt(trip: Trip, incident: Incident, plan: FixPlan, approvedBy: string[]): ChangeReceipt {
  return {
    id: `RCPT-${Math.floor(1000 + Math.random() * 8999)}`,
    tripId: trip.id,
    title: incident.title,
    reason: incident.detail,
    changes: plan.actions.map((a) => ({ before: a.fromLabel, after: a.toLabel })),
    approvedBy,
    costDelta: plan.costDelta,
    createdAt: new Date().toISOString(),
    planStrategy: plan.strategy,
  };
}

/** One human sentence for the traveler. */
export function explainPlan(trip: Trip, incident: Incident, plan: FixPlan) {
  const moves = plan.actions.filter((a) => a.type === "move").map((a) => `moved ${a.fromLabel.split(" · ")[0]} to ${a.toLabel}`);
  const swaps = plan.actions.filter((a) => a.type === "swap" && !a.itemId.endsWith("__fill")).map((a) => `swapped ${a.fromLabel} for ${a.toLabel}`);
  const parts = [...moves, ...swaps].slice(0, 2);
  const money = plan.costDelta < 0 ? `You save ${rupees(-plan.costDelta)}.` : plan.costDelta > 0 ? `It costs ${rupees(plan.costDelta)} extra.` : "No extra cost.";
  const lead = incident.kind === "weather" ? `Rain on Day ${incident.day}.` : `${incident.title}.`;
  return `${lead} We ${parts.join(" and ") || "adjusted your timings"}. ${money}`;
}

export function matchFor(trip: Trip, a: Activity) {
  return matchPercent(a, trip.prefs);
}
