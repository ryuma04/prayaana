import { rated } from "@/data/catalog";
import type { Activity, FixAction, FixPlan, Mood, Trip, TripItem } from "@/types";
import { activitiesFor, activityMap } from "@/data/activities";
import { destinationMap } from "@/data/destinations";
import { minToTime, rupees } from "@/lib/format";
import { itemCost } from "./pricing";
import { dayEnergy, dayItems, isTransport, roundTo5 } from "./schedule";
import { simulate } from "./fixes";

export const MOODS: { id: Mood; emoji: string; label: string; hint: string }[] = [
  { id: "tired", emoji: "😴", label: "Tired", hint: "Swap hard plans for easy ones + a rest break" },
  { id: "hungry", emoji: "🍴", label: "Hungry", hint: "Find the best food stop nearby, now" },
  { id: "raining", emoji: "🌧", label: "Raining", hint: "Move outdoor plans indoors" },
  { id: "late", emoji: "🏃", label: "Running late", hint: "Shift the rest of today" },
  { id: "over_budget", emoji: "💰", label: "Over budget", hint: "Cheaper swaps for the rest of the trip" },
  { id: "bored", emoji: "🥱", label: "Bored", hint: "Add something more exciting" },
];

export interface MoodProposal {
  mood: Mood;
  plan: FixPlan;
  headline: string;
  energyBefore: number;
  energyAfter: number;
  thinking: string[];
}

const qty = (i: TripItem) => (i.costMode === "per-person" ? i.qty : 1);

function swapTo(item: TripItem, alt: Activity, note?: string): FixAction {
  return {
    type: "swap",
    itemId: item.id,
    label: note ?? `Swap “${item.title}” → “${alt.title}”`,
    fromLabel: item.title,
    toLabel: alt.title,
    toRefId: alt.id,
    costDelta: alt.price * qty(item) - itemCost(item),
    vendorId: item.vendorId,
    newVendorId: alt.vendorId,
  };
}

export function moodAdapt(trip: Trip, mood: Mood, day: number, nowMin: number): MoodProposal {
  const dest = destinationMap[trip.destinationId];
  const remaining = dayItems(trip.items, day).filter((i) => i.startMin + i.durationMin > nowMin && !isTransport(i));
  const taken = new Set(trip.items.filter((i) => i.refId && i.status !== "cancelled").map((i) => i.refId));
  const used = new Set<string>();
  const pool = activitiesFor(trip.destinationId).filter((a) => !taken.has(a.id));
  const pickAlt = (filter: (a: Activity) => boolean, sort: (a: Activity, b: Activity) => number = (a, b) => rated(b.rating) - rated(a.rating)) => {
    const alt = pool.filter((a) => !used.has(a.id) && filter(a)).sort(sort)[0];
    if (alt) used.add(alt.id);
    return alt;
  };
  const actions: FixAction[] = [];
  let headline = "";
  const thinking = ["Understanding how you feel…", "Checking the rest of today…"];

  switch (mood) {
    case "tired": {
      for (const item of remaining.filter((i) => i.kind === "activity" && i.energy >= 3 && !i.hearted)) {
        const alt = pickAlt((a) => a.energy <= 1 && (a.slot !== "evening" || item.startMin >= 17 * 60));
        if (alt) actions.push(swapTo(item, alt));
      }
      headline = actions.length ? "Swapped the hard stuff for something gentle, plus a rest break" : "Added a rest break, today is already easy";
      thinking.push("Finding calm places nearby…", "Protecting your Must-Do items…");
      break;
    }
    case "raining": {
      for (const item of remaining.filter((i) => i.kind === "activity" && i.outdoor && !i.hearted)) {
        const orig = item.refId ? activityMap[item.refId] : undefined;
        const backup = orig?.backupId ? activityMap[orig.backupId] : undefined;
        const alt = backup && !taken.has(backup.id) && !used.has(backup.id) && !backup.outdoor ? (used.add(backup.id), backup) : pickAlt((a) => !a.outdoor);
        if (alt) actions.push(swapTo(item, alt));
      }
      headline = actions.length ? "Moved today's outdoor plans indoors" : "Everything left today is already indoors";
      thinking.push("Checking the radar…", "Finding covered places nearby…");
      break;
    }
    case "late": {
      for (const item of remaining.filter((i) => i.startMin >= nowMin)) {
        actions.push({
          type: "shift",
          itemId: item.id,
          label: `${item.title}: ${minToTime(item.startMin)} → ${minToTime(item.startMin + 45)}`,
          fromLabel: `${item.title} · ${minToTime(item.startMin)}`,
          toLabel: minToTime(item.startMin + 45),
          toStartMin: roundTo5(item.startMin + 45),
          toDay: day,
          costDelta: 0,
          vendorId: item.vendorId,
        });
      }
      headline = "Pushed the rest of today by 45 minutes and told every vendor";
      thinking.push("Recalculating travel times…", "Asking vendors for later slots…");
      break;
    }
    case "over_budget": {
      const pricey = trip.items
        .filter((i) => i.day >= day && i.kind === "activity" && i.status !== "cancelled" && !i.hearted && itemCost(i) > 0)
        .sort((a, b) => itemCost(b) - itemCost(a))
        .slice(0, 2);
      for (const item of pricey) {
        const alt = pickAlt((a) => a.price * qty(item) < itemCost(item) * 0.5 && (a.slot !== "evening" || item.startMin >= 17 * 60), (a, b) => rated(b.rating) - rated(a.rating));
        if (alt) actions.push(swapTo(item, alt));
      }
      const saved = -actions.reduce((s, a) => s + a.costDelta, 0);
      headline = saved > 0 ? `Found cheaper swaps that save ${rupees(saved)}` : "Your remaining plan is already the best value";
      thinking.push("Scanning the rest of the trip…", "Keeping your Must-Dos untouched…");
      break;
    }
    case "bored": {
      const target = remaining.filter((i) => i.kind === "activity" && !i.hearted).sort((a, b) => a.energy - b.energy)[0];
      if (target) {
        const alt = pickAlt((a) => a.energy >= 3 && rated(a.rating) >= 4.5 && (a.slot !== "evening" || target.startMin >= 17 * 60), (a, b) => b.energy - a.energy || rated(b.rating) - rated(a.rating));
        if (alt) actions.push(swapTo(target, alt));
      }
      headline = actions.length ? "Swapped in something with more buzz" : "Nothing to swap, try the Discover tab for extras";
      thinking.push("Looking for top-rated thrills nearby…");
      break;
    }
    case "hungry": {
      headline = `Booked a table at ${dest.clusters[0].lunch.name} in 20 minutes`;
      thinking.push("Finding the best-rated food stop nearby…");
      break;
    }
  }

  let next = simulate(trip, actions);
  // Mood extras that add a new item.
  const travelers = trip.prefs.adults + trip.prefs.kids;
  const addItem = (partial: Partial<TripItem> & Pick<TripItem, "title" | "kind" | "startMin" | "durationMin">) => {
    const item: TripItem = {
      id: `${trip.id}-d${day}-m${Math.random().toString(36).slice(2, 6)}`,
      day,
      subtitle: "",
      place: dest.name,
      unitCost: 0,
      qty: travelers,
      costMode: "per-person",
      hearted: false,
      outdoor: false,
      energy: 0,
      status: "changed",
      dependsOn: [],
      bufferMin: 10,
      icon: "rest",
      tone: "sky",
      ...partial,
    };
    next = { ...next, items: [...next.items, item] };
    return item;
  };
  if (mood === "tired") {
    const rest = addItem({ kind: "rest", title: "Rest break at your stay", subtitle: "Feet up, chai on the way", startMin: roundTo5(Math.max(nowMin + 15, 14 * 60)), durationMin: 60, icon: "rest", tone: "sky" });
    actions.push({ type: "shift", itemId: rest.id, label: "Add a 1-hour rest break", fromLabel: "", toLabel: `Rest break · ${minToTime(rest.startMin)}`, costDelta: 0 });
  }
  if (mood === "hungry") {
    const lunch = dest.clusters[0].lunch;
    const meal = addItem({ kind: "meal", title: `Quick bite · ${lunch.name}`, subtitle: "Table held for 20 min", startMin: roundTo5(nowMin + 20), durationMin: 45, unitCost: lunch.pricePerPerson, icon: "food", tone: "sun" });
    actions.push({ type: "shift", itemId: meal.id, label: `Table at ${lunch.name}`, fromLabel: "", toLabel: `${lunch.name} · ${minToTime(meal.startMin)}`, costDelta: lunch.pricePerPerson * travelers });
  }

  const costDelta = actions.reduce((s, a) => s + a.costDelta, 0);
  const plan: FixPlan = {
    id: `mood-${mood}-${Date.now().toString(36)}`,
    incidentId: `mood-${mood}`,
    strategy: "fastest",
    title: MOODS.find((m) => m.id === mood)?.label ?? mood,
    tagline: headline,
    costDelta,
    timeDeltaMin: mood === "late" ? 45 : 0,
    heartsKept: trip.items.filter((i) => i.hearted).length,
    heartsTotal: trip.items.filter((i) => i.hearted).length,
    swaps: actions.filter((a) => a.type === "swap").length,
    actions,
    vendors: [...new Set(actions.map((a) => a.newVendorId ?? a.vendorId).filter((v): v is string => !!v))],
    confidence: 94,
    weatherOk: true,
    score: { cost: 70, time: 80, happiness: 85 },
  };
  thinking.push("Replanning…");
  return {
    mood,
    plan,
    headline,
    energyBefore: dayEnergy(trip.items, day),
    energyAfter: dayEnergy(next.items, day),
    thinking,
  };
}

/** Apply a mood proposal (adds synthetic rest/meal items that simulate() cannot express). */
export function applyMood(trip: Trip, proposal: MoodProposal, day: number, nowMin: number): Trip {
  const fresh = moodAdapt(trip, proposal.mood, day, nowMin);
  let next = simulate(trip, fresh.plan.actions.filter((a) => trip.items.some((i) => i.id === a.itemId)));
  const added = fresh.plan.actions.filter((a) => !trip.items.some((i) => i.id === a.itemId));
  if (added.length) {
    const dest = destinationMap[trip.destinationId];
    const travelers = trip.prefs.adults + trip.prefs.kids;
    for (const a of added) {
      const isMeal = a.costDelta > 0;
      next = {
        ...next,
        items: [
          ...next.items,
          {
            id: a.itemId,
            day,
            kind: isMeal ? "meal" : "rest",
            title: isMeal ? `Quick bite · ${dest.clusters[0].lunch.name}` : "Rest break at your stay",
            subtitle: isMeal ? "Table held for 20 min" : "Feet up, chai on the way",
            place: dest.name,
            startMin: roundTo5(isMeal ? nowMin + 20 : Math.max(nowMin + 15, 14 * 60)),
            durationMin: isMeal ? 45 : 60,
            unitCost: isMeal ? dest.clusters[0].lunch.pricePerPerson : 0,
            qty: travelers,
            costMode: "per-person",
            hearted: false,
            outdoor: false,
            energy: 0,
            status: "changed",
            dependsOn: [],
            bufferMin: 10,
            icon: isMeal ? "food" : "rest",
            tone: isMeal ? "sun" : "sky",
            note: isMeal ? "Added: you were hungry" : "Added: you were tired",
          },
        ],
      };
    }
  }
  return next;
}
