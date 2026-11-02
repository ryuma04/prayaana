"use client";
import { useMemo } from "react";
import type { Activity, Trip } from "@/types";
import { useTripStore } from "@/stores/tripStore";
import { usePricingStore } from "@/stores/pricingStore";
import { toast } from "@/stores/notificationStore";
import { priceTrip } from "@/lib/engine/pricing";
import * as edit from "@/lib/engine/edit";
import { addActivity, editItem, getTrip, patchTrip, type TripView } from "@/lib/api/trips";
import { errorMessage } from "@/lib/api/client";

type Local = (t: Trip) => Trip | { trip: Trip; error?: string };

/** Edits run one at a time per trip so the server always applies them in order. */
const queues = new Map<string, Promise<unknown>>();

function enqueue(tripId: string, job: () => Promise<unknown>) {
  const next = (queues.get(tripId) ?? Promise.resolve()).then(job, job);
  queues.set(tripId, next.catch(() => undefined));
  return next;
}

/**
 * Every plan edit goes through here: the change shows instantly (same engine as the server),
 * the live price ticker animates, then the server's saved trip replaces the local copy.
 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function apply(tripId: string, reason: string, local: Local, remote: () => Promise<TripView>, debounceMs = 0) {
  const store = useTripStore.getState();
  const before = store.trips[tripId];
  if (!before) return;
  const res = local(before);
  const next = "items" in res ? res : res.trip;
  const error = "items" in res ? undefined : res.error;
  if (error) {
    toast({ tone: "warning", title: error });
    return;
  }
  store.upsert(next);
  const from = priceTrip(before).total;
  const to = priceTrip(next).total;
  if (from !== to) {
    usePricingStore.getState().setRecalculating(true);
    usePricingStore.getState().record({ tripId, from, to, reason });
  }
  const save = () =>
    enqueue(tripId, remote)
      .catch((e) => {
        toast({ tone: "error", title: "Couldn't save that change", body: errorMessage(e) });
        return getTrip(tripId).catch(() => undefined);
      })
      .finally(() => usePricingStore.getState().setRecalculating(false));
  if (!debounceMs) return void save();
  const key = `${tripId}:${reason}`;
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => void save(), debounceMs));
}

export function useTripEditor(tripId: string | undefined) {
  return useMemo(() => {
    const run = (reason: string, local: Local, remote: (id: string) => Promise<TripView>, debounceMs?: number) => {
      if (tripId) apply(tripId, reason, local, () => remote(tripId), debounceMs);
    };
    return {
      heart: (itemId: string) => run("heart", (t) => edit.toggleHeart(t, itemId), (id) => editItem(id, itemId, { op: "heart" })),
      remove: (itemId: string, title: string) => run(`Removed ${title}`, (t) => edit.removeItem(t, itemId), (id) => editItem(id, itemId, { op: "remove" })),
      move: (itemId: string, day: number) => run(`Moved to Day ${day}`, (t) => edit.moveItem(t, itemId, day), (id) => editItem(id, itemId, { op: "move", day })),
      time: (itemId: string, startMin: number) => run("Time changed", (t) => edit.changeTime(t, itemId, startMin), (id) => editItem(id, itemId, { op: "time", startMin })),
      qty: (itemId: string, qty: number) => run("Tickets changed", (t) => edit.changeQty(t, itemId, qty), (id) => editItem(id, itemId, { op: "qty", qty })),
      add: (a: Activity, day: number) => run(`Added ${a.title}`, (t) => edit.addActivity(t, a, day), (id) => addActivity(id, a.id, day)),
      swap: (itemId: string, a: Activity) => run(`Swapped to ${a.title}`, (t) => edit.swapActivity(t, itemId, a), (id) => editItem(id, itemId, { op: "swap", activityId: a.id })),
      stay: (stayId: string) => run("Stay changed", (t) => edit.changeStay(t, stayId), (id) => patchTrip(id, { stayId })),
      transport: (transportId: string) => run("Transport changed", (t) => edit.changeTransport(t, transportId), (id) => patchTrip(id, { transportId })),
      travelers: (adults: number, kids: number) => run("Travelers changed", (t) => edit.setTravelers(t, adults, kids), (id) => patchTrip(id, { adults, kids })),
      startDate: (startDate: string) => run("Dates changed", (t) => ({ ...t, prefs: { ...t.prefs, startDate } }), (id) => patchTrip(id, { startDate })),
      budget: (budgetPerPerson: number) => run("Budget changed", (t) => ({ ...t, prefs: { ...t.prefs, budgetPerPerson } }), (id) => patchTrip(id, { budgetPerPerson }), 500),
    };
  }, [tripId]);
}
