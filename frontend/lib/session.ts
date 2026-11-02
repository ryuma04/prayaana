"use client";
import type { Role } from "@/types";
import { useTripStore } from "@/stores/tripStore";
import { useBookingStore } from "@/stores/bookingStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { useAgentStore } from "@/stores/agentStore";
import { useOperatorStore } from "@/stores/operatorStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useTravelerStore } from "@/stores/travelerStore";
import { useQuizStore } from "@/stores/quizStore";
import { useCommsStore } from "@/stores/commsStore";
import { listNotifications } from "@/lib/api/notifications";
import { getProfile } from "@/lib/api/profile";
import { listMyTrips, loadTripBookings, loadTripIncidents } from "@/lib/api/trips";
import { listIncidents } from "@/lib/api/incidents";
import { listRuns } from "@/lib/api/agent";
import { listVendors } from "@/lib/api/vendors";
import { loadAlerts, loadBookings, loadInbox, loadLedger, loadTours } from "@/lib/api/ops";

/** Everything the traveler app shows: their trips, profile and notices. */
async function loadTraveler() {
  const [trips] = await Promise.all([
    listMyTrips(),
    getProfile()
      .then((p) => useTravelerStore.getState().applyProfile(p))
      .catch((err) => {
        console.warn("Could not load traveler profile:", err);
      }),
    listNotifications().then((n) => useNotificationStore.getState().setAll(n)),
  ]);
  const active = trips ? trips.map((v) => v.trip).filter((t) => t.status !== "draft") : [];
  await Promise.all(active.flatMap((t) => [loadTripBookings(t.id), loadTripIncidents(t.id)]));
}

/** Everything the operator console shows. */
async function loadOperator() {
  await Promise.all([
    loadTours(),
    loadBookings(),
    loadLedger(),
    listIncidents(),
    listRuns(),
    listVendors(),
    loadInbox(),
    loadAlerts(),
    listNotifications().then((n) => useNotificationStore.getState().setAll(n)),
  ]);
}

/** The Super Admin pages fetch their own data (lib/api/admin.ts). */
export const loadSession = (role: Role) => (role === "super_admin" ? Promise.resolve() : role === "operator" ? loadOperator() : loadTraveler());

/** Forget every server record (on logout or when another account signs in). */
export function clearSession() {
  useTripStore.getState().reset();
  useBookingStore.getState().reset();
  useIncidentStore.getState().reset();
  useAgentStore.getState().reset();
  useOperatorStore.getState().reset();
  useNotificationStore.getState().reset();
  useTravelerStore.getState().resetProfile();
  useQuizStore.getState().reset();
  useCommsStore.getState().reset();
}
