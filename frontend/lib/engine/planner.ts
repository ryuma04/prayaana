import { rated } from "@/data/catalog";
import type {
  Activity,
  Destination,
  Interest,
  Stay,
  TransportOption,
  Trip,
  TripItem,
  TripPreferences,
} from "@/types";
import { destinationMap } from "@/data/destinations";
import { activitiesFor } from "@/data/activities";
import { staysFor, transportFor } from "@/data/stays";
import { cabVendorFor } from "@/data/vendors";
import { duration, minToTime, timeToMin } from "@/lib/format";
import { roundTo5 } from "./schedule";

// ─── Wishes in the traveler's own words (stand-in for "Jev Match") ──────────

export interface Wish {
  text: string;
  boosts: Interest[];
  lowWalking?: boolean;
  kids?: boolean;
}

const WISH_RULES: { re: RegExp; wish: Omit<Wish, "text">; label: string }[] = [
  { re: /quiet|calm|peace|slow|offbeat/i, wish: { boosts: ["relax", "nature"] }, label: "Quiet places" },
  { re: /food|eat|cuisine|caf[eé]|dhaba|thali|street/i, wish: { boosts: ["food"] }, label: "Great food" },
  { re: /adventure|thrill|adrenaline|rafting|paraglid|trek/i, wish: { boosts: ["adventure"] }, label: "Adventure" },
  { re: /can'?t walk|knee|elderly|dad|father|mother|mom|grand|wheel/i, wish: { boosts: [], lowWalking: true }, label: "Easy on walking" },
  { re: /kid|child|son|daughter|family/i, wish: { boosts: [], kids: true }, label: "Kid-friendly" },
  { re: /photo|instagram|view|sunset|sunrise/i, wish: { boosts: ["photo"] }, label: "Views & photos" },
  { re: /history|heritage|culture|temple|fort|museum/i, wish: { boosts: ["culture"] }, label: "Culture & history" },
  { re: /party|nightlife|friends|social|music/i, wish: { boosts: ["social"] }, label: "Social evenings" },
  { re: /luxury|spa|pamper|honeymoon|romantic/i, wish: { boosts: ["luxury", "relax"] }, label: "A little luxury" },
  { re: /nature|mountain|forest|river|lake|beach|snow/i, wish: { boosts: ["nature"] }, label: "Nature" },
];

export function parseWishes(text: string): Wish[] {
  if (!text.trim()) return [];
  return WISH_RULES.filter((r) => r.re.test(text)).map((r) => ({ text: r.label, ...r.wish }));
}

export function scoreActivity(a: Activity, prefs: TripPreferences, wishes = parseWishes(prefs.ownWords)) {
  const matches = a.interests.filter((i) => prefs.interests.includes(i)).length;
  let score = (matches / Math.max(1, Math.min(a.interests.length, 2))) * 55 + rated(a.rating) * 7;
  for (const w of wishes) {
    if (w.boosts.some((b) => a.interests.includes(b))) score += 8;
    if (w.lowWalking && a.walking === "high") score -= 35;
    if (w.lowWalking && a.energy >= 4) score -= 15;
    if (w.kids && !a.kidFriendly) score -= 30;
  }
  if (prefs.kids > 0 && !a.kidFriendly) score -= 30;
  if (prefs.special.includes("Limited mobility") && a.walking === "high") score -= 35;
  if (prefs.pace === "relaxed" && a.energy >= 4) score -= 14;
  if (prefs.pace === "packed" && a.energy >= 3) score += 4;
  const perPersonDay = prefs.budgetPerPerson / Math.max(1, prefs.nights + 1);
  if (a.price > perPersonDay * 0.9) score -= 12;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function matchPercent(a: Activity, prefs: TripPreferences) {
  return Math.max(35, Math.min(99, scoreActivity(a, prefs)));
}

// ─── Choices ────────────────────────────────────────────────────────────────

const STAY_RANK = ["hostel", "budget", "homestay", "boutique", "luxury"] as const;

export function pickStay(dest: Destination, prefs: TripPreferences): Stay {
  const list = staysFor(dest.id);
  const travelers = prefs.adults + prefs.kids;
  const rooms = roomsFor(prefs);
  const cap = (prefs.budgetPerPerson * travelers * 0.4) / Math.max(1, prefs.nights) / rooms;
  const exact = list.find((s) => s.type === prefs.stayType);
  if (exact && exact.nightlyPrice <= cap * 1.2) return exact;
  const affordable = list.filter((s) => s.nightlyPrice <= cap).sort((a, b) => b.nightlyPrice - a.nightlyPrice);
  if (affordable[0]) return affordable[0];
  const wanted = STAY_RANK.indexOf(prefs.stayType);
  return [...list].sort(
    (a, b) => Math.abs(STAY_RANK.indexOf(a.type) - wanted) - Math.abs(STAY_RANK.indexOf(b.type) - wanted) || a.nightlyPrice - b.nightlyPrice,
  )[0];
}

export function pickTransport(dest: Destination, prefs: TripPreferences): TransportOption {
  const list = transportFor(dest.id);
  return list.find((t) => t.mode === prefs.transport) ?? list[0];
}

export const roomsFor = (p: Pick<TripPreferences, "adults">) => Math.max(1, Math.ceil(p.adults / 2));
export const vehiclesFor = (p: Pick<TripPreferences, "adults" | "kids">) => Math.max(1, Math.ceil((p.adults + p.kids) / 5));

export function reverseRoute(label: string) {
  return label.replace(/([A-Za-z]+) → ([A-Za-z]+)/, "$2 → $1");
}

// ─── Plan builder (allaboutourproject.md §12.1) ─────────────────────────────

export interface BuildOptions {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  coordinatorId: string;
  groupName?: string;
  status?: Trip["status"];
  paymentStatus?: Trip["paymentStatus"];
  stayId?: string;
  transportId?: string;
}

export function buildTrip(prefs: TripPreferences, opts: BuildOptions): Trip {
  const dest = destinationMap[prefs.destinationId];
  const stay = opts.stayId ? staysFor(dest.id).find((s) => s.id === opts.stayId) ?? pickStay(dest, prefs) : pickStay(dest, prefs);
  const transport = opts.transportId
    ? transportFor(dest.id).find((t) => t.id === opts.transportId) ?? pickTransport(dest, prefs)
    : pickTransport(dest, prefs);
  const items = buildItems(prefs, dest, stay, transport, opts.id);
  return {
    id: opts.id,
    code: opts.code,
    title: `${prefs.nights + 1} days in ${dest.name}`,
    destinationId: dest.id,
    prefs,
    stayId: stay.id,
    transportId: transport.id,
    items,
    status: opts.status ?? "draft",
    paymentStatus: opts.paymentStatus ?? "unpaid",
    createdAt: new Date().toISOString(),
    receipts: [],
    coordinatorId: opts.coordinatorId,
    customerId: opts.customerId,
    customerName: opts.customerName,
    groupName: opts.groupName ?? `${opts.customerName.split(" ")[1] ?? opts.customerName} party`,
  };
}

function buildItems(prefs: TripPreferences, dest: Destination, stay: Stay, transport: TransportOption, tripId: string): TripItem[] {
  const travelers = prefs.adults + prefs.kids;
  const vehicles = vehiclesFor(prefs);
  const wishes = parseWishes(prefs.ownWords);
  const cab = cabVendorFor(dest.id);
  const vehicleName = travelers > 5 ? "Tempo Traveller" : "Innova Crysta";
  const days = prefs.nights + 1;
  const pool = activitiesFor(dest.id)
    .map((a) => ({ a, s: scoreActivity(a, prefs, wishes) }))
    .sort((x, y) => y.s - x.s);
  const used = new Set<string>();
  const items: TripItem[] = [];
  let n = 0;
  const nextId = (day: number) => `${tripId}-d${day}-${++n}`;

  const push = (partial: Omit<TripItem, "id" | "status" | "hearted" | "bufferMin"> & { bufferMin?: number }) => {
    const item: TripItem = { status: "planned", hearted: false, bufferMin: 15, ...partial, id: nextId(partial.day) };
    items.push(item);
    return item;
  };

  const activityItem = (a: Activity, day: number, startMin: number, dependsOn: string[]) => {
    used.add(a.id);
    return push({
      day,
      kind: "activity",
      refId: a.id,
      title: a.title,
      subtitle: `${duration(a.durationMin)} · ${a.outdoor ? "Outdoor" : "Indoor"}`,
      place: dest.clusters.find((c) => c.id === a.cluster)?.name ?? dest.name,
      startMin: roundTo5(startMin),
      durationMin: a.durationMin,
      unitCost: a.price,
      qty: travelers,
      costMode: "per-person",
      vendorId: a.vendorId,
      outdoor: a.outdoor,
      energy: a.energy,
      dependsOn,
      lat: a.lat,
      lng: a.lng,
      icon: a.icon,
      tone: a.tone,
      bufferMin: a.outdoor ? 20 : 15,
    });
  };

  const best = (filter: (a: Activity) => boolean) => pool.find((p) => !used.has(p.a.id) && filter(p.a))?.a;
  const light = (a: Activity) => a.energy <= 2;
  const town = dest.clusters[0];

  // Cluster ranking for middle days
  const clusterScore = (cid: string) =>
    pool
      .filter((p) => p.a.cluster === cid && p.a.slot !== "evening")
      .slice(0, 2)
      .reduce((s, p) => s + p.s, 0);
  const middleClusters = dest.clusters
    .slice(1)
    .map((c) => ({ c, s: clusterScore(c.id) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);

  // ── Day 1: arrival ──
  const departs = timeToMin(transport.departs);
  const overnight = departs + transport.durationMin >= 24 * 60;
  const arrival = (departs + transport.durationMin) % (24 * 60);
  const arrive = push({
    day: 1,
    kind: transport.mode,
    refId: transport.id,
    title: transport.label,
    subtitle: overnight
      ? `Overnight · departs ${minToTime(departs)} the evening before · arrives ${minToTime(arrival)}`
      : `Departs ${minToTime(departs)} · ${duration(transport.durationMin)}`,
    place: transport.from,
    startMin: overnight ? 0 : departs,
    durationMin: overnight ? arrival : transport.durationMin,
    unitCost: transport.pricePerPerson,
    qty: travelers,
    costMode: "per-person",
    vendorId: transport.vendorId,
    outdoor: false,
    energy: 1,
    dependsOn: [],
    icon: transport.mode,
    tone: "sky",
    bufferMin: 30,
  });

  let cursor = arrival;
  let lastDep = arrive.id;
  if (transport.mode !== "car") {
    const pickupMin = transport.mode === "flight" ? 60 : 20;
    const pickup = push({
      day: 1,
      kind: "transfer",
      title: transport.mode === "flight" ? "Airport pickup" : "Station pickup",
      subtitle: `${vehicleName} · ${pickupMin === 60 ? dest.gateway.split(",")[0] : "to your stay"}`,
      place: transport.mode === "flight" ? dest.gateway.split(",")[0] : `${dest.name} station`,
      startMin: roundTo5(arrival + 20),
      durationMin: pickupMin,
      unitCost: (transport.mode === "flight" ? dest.airportTransfer : 700) * vehicles,
      qty: 1,
      costMode: "flat",
      vendorId: cab,
      outdoor: false,
      energy: 1,
      dependsOn: [arrive.id],
      lat: stay.lat,
      lng: stay.lng,
      icon: "cab",
      tone: "cream",
      bufferMin: 15,
    });
    cursor = pickup.startMin + pickup.durationMin;
    lastDep = pickup.id;
  }
  const checkin = push({
    day: 1,
    kind: "checkin",
    refId: stay.id,
    title: `Check-in · ${stay.name}`,
    subtitle: `${stay.area} · ${prefs.nights} ${prefs.nights === 1 ? "night" : "nights"}`,
    place: stay.area,
    startMin: roundTo5(Math.max(cursor + 10, 11 * 60)),
    durationMin: 45,
    unitCost: 0,
    qty: 1,
    costMode: "flat",
    vendorId: stay.vendorId,
    outdoor: false,
    energy: 1,
    dependsOn: [lastDep],
    lat: stay.lat,
    lng: stay.lng,
    icon: "hotel",
    tone: "pink",
    bufferMin: 60,
  });
  const firstLight = best((a) => a.cluster === town.id && light(a) && a.slot !== "evening") ?? best((a) => light(a) && a.slot !== "evening");
  let lastDay1 = checkin.id;
  if (firstLight) {
    const it = activityItem(firstLight, 1, Math.max(checkin.startMin + 105, 16 * 60), [checkin.id]);
    lastDay1 = it.id;
  }
  if (town.dinner) {
    push({
      day: 1,
      kind: "meal",
      title: `Welcome dinner · ${town.dinner.name}`,
      subtitle: "Table for your group, booked",
      place: town.name,
      startMin: 20 * 60,
      durationMin: 75,
      unitCost: town.dinner.pricePerPerson,
      qty: travelers,
      costMode: "per-person",
      outdoor: false,
      energy: 1,
      dependsOn: [lastDay1],
      lat: stay.lat,
      lng: stay.lng,
      icon: "food",
      tone: "sun",
      bufferMin: 30,
    });
  }

  // ── Middle days ──
  const pickupStart = prefs.rhythm === "night-owl" ? 10 * 60 : 9 * 60;
  for (let day = 2; day <= days - 1; day++) {
    const cluster = middleClusters[(day - 2) % Math.max(1, middleClusters.length)];
    const inCluster = (a: Activity) => a.cluster === cluster.id;
    const morning =
      best((a) => inCluster(a) && a.slot === "morning") ??
      best((a) => inCluster(a) && a.slot !== "evening") ??
      best((a) => a.slot === "morning");
    const dayCluster = morning ? dest.clusters.find((c) => c.id === morning.cluster) ?? cluster : cluster;
    const pickup = push({
      day,
      kind: "transfer",
      title: "Hotel pickup",
      subtitle: `${vehicleName} · full-day cab to ${dayCluster.name}`,
      place: stay.name,
      startMin: pickupStart,
      durationMin: 40,
      unitCost: dest.localCabPerDay * vehicles,
      qty: 1,
      costMode: "flat",
      vendorId: cab,
      outdoor: false,
      energy: 1,
      dependsOn: [],
      lat: stay.lat,
      lng: stay.lng,
      icon: "cab",
      tone: "cream",
      bufferMin: 10,
    });
    let prev = pickup.id;
    let end = pickup.startMin + 60;
    if (morning) {
      const m = activityItem(morning, day, Math.max(end, pickupStart + 60), [pickup.id]);
      prev = m.id;
      end = m.startMin + m.durationMin;
    }
    const lunch = push({
      day,
      kind: "meal",
      title: `Lunch · ${dayCluster.lunch.name}`,
      subtitle: "Local favourite, pre-booked",
      place: dayCluster.name,
      startMin: roundTo5(Math.max(end + 20, 13 * 60)),
      durationMin: 60,
      unitCost: dayCluster.lunch.pricePerPerson,
      qty: travelers,
      costMode: "per-person",
      outdoor: false,
      energy: 1,
      dependsOn: [prev],
      icon: "food",
      tone: "sun",
      bufferMin: 30,
      lat: morning?.lat,
      lng: morning?.lng,
    });
    prev = lunch.id;
    end = lunch.startMin + lunch.durationMin;

    if (prefs.pace === "relaxed") {
      const easy =
        best((a) => a.cluster === dayCluster.id && a.slot === "afternoon" && light(a)) ??
        best((a) => a.slot === "afternoon" && light(a) && a.cluster === town.id);
      if (easy) activityItem(easy, day, Math.max(end + 30, 15 * 60), [prev]);
      continue;
    }

    const afternoon =
      best((a) => a.cluster === dayCluster.id && a.slot === "afternoon") ??
      best((a) => a.cluster === dayCluster.id && a.slot !== "evening") ??
      best((a) => a.slot === "afternoon" && a.cluster === town.id) ??
      best((a) => a.slot === "afternoon");
    if (afternoon) {
      const it = activityItem(afternoon, day, Math.max(end + 30, 15 * 60), [prev]);
      prev = it.id;
      end = it.startMin + it.durationMin;
    }
    if (prefs.pace === "packed") {
      const extra = best((a) => a.slot === "afternoon" && light(a));
      if (extra && end < 17 * 60) {
        const it = activityItem(extra, day, end + 30, [prev]);
        prev = it.id;
        end = it.startMin + it.durationMin;
      }
    }
    const evening =
      best((a) => a.cluster === dayCluster.id && a.slot === "evening") ??
      best((a) => a.cluster === town.id && a.slot === "evening") ??
      best((a) => a.slot === "evening");
    if (evening) activityItem(evening, day, Math.max(end + 45, 18 * 60), [prev]);
  }

  // ── Last day: departure ──
  const last = days;
  const checkout = push({
    day: last,
    kind: "checkout",
    refId: stay.id,
    title: "Breakfast & check-out",
    subtitle: stay.name,
    place: stay.area,
    startMin: 9 * 60 + 30,
    durationMin: 45,
    unitCost: 0,
    qty: 1,
    costMode: "flat",
    vendorId: stay.vendorId,
    outdoor: false,
    energy: 1,
    dependsOn: [],
    lat: stay.lat,
    lng: stay.lng,
    icon: "hotel",
    tone: "pink",
  });
  const returnDepart = transport.mode === "flight" ? 15 * 60 : transport.mode === "car" ? 12 * 60 : 18 * 60;
  let prev = checkout.id;
  const morningLight = best((a) => light(a) && a.slot !== "evening" && a.durationMin <= 120 && a.cluster === town.id);
  if (morningLight && returnDepart >= 15 * 60) {
    const it = activityItem(morningLight, last, 10 * 60 + 30, [checkout.id]);
    prev = it.id;
  }
  let dropId = prev;
  if (transport.mode !== "car") {
    const drop = push({
      day: last,
      kind: "transfer",
      title: transport.mode === "flight" ? `Drop to ${dest.gateway.split(",")[0].split("(")[0].trim()}` : "Drop to station",
      subtitle: vehicleName,
      place: stay.name,
      startMin: returnDepart - (transport.mode === "flight" ? 150 : 60),
      durationMin: transport.mode === "flight" ? 75 : 25,
      unitCost: (transport.mode === "flight" ? dest.airportTransfer : 700) * vehicles,
      qty: 1,
      costMode: "flat",
      vendorId: cab,
      outdoor: false,
      energy: 1,
      dependsOn: [prev],
      lat: stay.lat,
      lng: stay.lng,
      icon: "cab",
      tone: "cream",
      bufferMin: 20,
    });
    dropId = drop.id;
  }
  push({
    day: last,
    kind: transport.mode,
    refId: transport.id,
    title: `Return · ${reverseRoute(transport.label)}`,
    subtitle: `Departs ${minToTime(returnDepart)} · ${duration(transport.durationMin)}`,
    place: dest.name,
    startMin: returnDepart,
    durationMin: Math.min(transport.durationMin, 24 * 60 - returnDepart - 1),
    unitCost: transport.pricePerPerson,
    qty: travelers,
    costMode: "per-person",
    vendorId: transport.vendorId,
    outdoor: false,
    energy: 1,
    dependsOn: [dropId],
    icon: transport.mode,
    tone: "sky",
    bufferMin: 30,
  });

  return items;
}

/** Count of catalogue experiences that clear the match threshold — shown during generation. */
export function matchedExperiences(prefs: TripPreferences) {
  const wishes = parseWishes(prefs.ownWords);
  return activitiesFor(prefs.destinationId).filter((a) => scoreActivity(a, prefs, wishes) >= 45).length;
}

/** Build a fresh item for an activity the traveler adds manually. */
export function itemFromActivity(a: Activity, day: number, startMin: number, travelers: number, tripId: string): TripItem {
  const dest = destinationMap[a.destinationId];
  return {
    id: `${tripId}-d${day}-a${Math.random().toString(36).slice(2, 7)}`,
    day,
    kind: "activity",
    refId: a.id,
    title: a.title,
    subtitle: `${duration(a.durationMin)} · ${a.outdoor ? "Outdoor" : "Indoor"}`,
    place: dest.clusters.find((c) => c.id === a.cluster)?.name ?? dest.name,
    startMin: roundTo5(startMin),
    durationMin: a.durationMin,
    unitCost: a.price,
    qty: travelers,
    costMode: "per-person",
    hearted: false,
    vendorId: a.vendorId,
    outdoor: a.outdoor,
    energy: a.energy,
    status: "planned",
    dependsOn: [],
    bufferMin: 15,
    lat: a.lat,
    lng: a.lng,
    icon: a.icon,
    tone: a.tone,
  };
}
