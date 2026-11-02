"use client";
import type { AgentStep, AppNotification, CrowdReport, InboxMessage, Incident, IncidentStatus, Role, Vendor } from "@/types";
import { API_URL } from "@/lib/api/client";
import { getTrip, loadTripBookings } from "@/lib/api/trips";
import { getRun, getRunRequests } from "@/lib/api/agent";
import { loadBookings, loadInbox, loadLedger } from "@/lib/api/ops";
import { listVendors } from "@/lib/api/vendors";
import { useAgentStore } from "@/stores/agentStore";
import { useCommsStore } from "@/stores/commsStore";
import { loadDocuments } from "@/lib/api/documents";
import { useIncidentStore } from "@/stores/incidentStore";
import { useNotificationStore, toast } from "@/stores/notificationStore";
import { useOperatorStore } from "@/stores/operatorStore";
import { usePricingStore } from "@/stores/pricingStore";

/** A server event from GET /ws (allaboutourproject.md §16.6). */
interface ServerEvent {
  type: string;
  tripId?: string;
  data?: Record<string, unknown>;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Runs `fn` once after a burst of events with the same key. */
function soon(key: string, fn: () => Promise<unknown>, ms = 300) {
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      fn().catch(() => undefined);
    }, ms),
  );
}

function refreshTrip(tripId: string, role: Role) {
  soon(`trip:${tripId}`, () => getTrip(tripId));
  if (role === "traveler") soon(`bookings:${tripId}`, () => loadTripBookings(tripId));
  else {
    soon("ops:bookings", loadBookings, 600);
    soon("ops:ledger", loadLedger, 600);
  }
}

function refreshRun(runId: string) {
  soon(`run:${runId}`, () => getRun(runId));
}

function handle(e: ServerEvent, role: Role) {
  const d = e.data ?? {};
  switch (e.type) {
    case "trip.updated": {
      if (!e.tripId) return;
      refreshTrip(e.tripId, role);
      if (typeof d.priceFrom === "number" && typeof d.priceTo === "number" && d.priceFrom !== d.priceTo) {
        usePricingStore.getState().record({ tripId: e.tripId, from: d.priceFrom, to: d.priceTo, reason: String(d.reason ?? "") });
      }
      return;
    }
    case "booking.status":
      if (e.tripId) refreshTrip(e.tripId, role);
      if (role === "operator") soon("ops:vendors", listVendors, 800);
      return;
    case "incident.created":
      useIncidentStore.getState().upsert(d as unknown as Incident);
      if (e.tripId) refreshTrip(e.tripId, role);
      return;
    case "incident.updated": {
      const patch: Partial<Incident> = { status: d.status as IncidentStatus };
      if (d.agentRunId) patch.agentRunId = String(d.agentRunId);
      useIncidentStore.getState().update(String(d.incidentId), patch);
      if (d.agentRunId) refreshRun(String(d.agentRunId));
      return;
    }
    case "agent.step": {
      const runId = String(d.runId);
      if (useAgentStore.getState().runs[runId]) useAgentStore.getState().upsertStep(runId, d.step as AgentStep);
      refreshRun(runId);
      return;
    }
    case "confirm.progress":
      if (d.runId) soon(`requests:${d.runId}`, () => getRunRequests(String(d.runId)));
      return;
    case "confirm.saved":
    case "confirm.undone":
      if (d.runId) {
        refreshRun(String(d.runId));
        soon(`requests:${d.runId}`, () => getRunRequests(String(d.runId)));
      }
      if (e.tripId) refreshTrip(e.tripId, role);
      return;
    case "notice.new": {
      const n = d as unknown as AppNotification;
      useNotificationStore.getState().receive(n);
      toast({ tone: n.kind === "agent" ? "agent" : n.kind === "risk" || n.kind === "weather" ? "warning" : "info", title: n.title, body: n.body, action: n.href ? { label: "Open", href: n.href } : undefined });
      return;
    }
    case "inbox.message": {
      const threadId = String(d.threadId);
      if (useOperatorStore.getState().inbox.some((t) => t.id === threadId)) useOperatorStore.getState().appendMessage(threadId, d.message as InboxMessage);
      else soon("ops:inbox", loadInbox);
      return;
    }
    case "alert.new":
    case "alert.verified":
      useOperatorStore.getState().putCrowdReport(d as unknown as CrowdReport);
      return;
    case "vendor.updated":
      useOperatorStore.getState().putVendor(d as unknown as Vendor);
      return;
    case "chat.message": {
      // Traveler-only event: a message in this trip's conversation.
      if (!e.tripId) return;
      const m = d.message as InboxMessage;
      useCommsStore.getState().receive(e.tripId, m);
      if (m.from !== "them" && m.type !== "attachment") toast({ tone: "info", title: "New message", body: m.body.split("\n")[0], action: { label: "Open", href: `/my-trip/${e.tripId}` } });
      return;
    }
    case "documents.updated":
      if (e.tripId && useCommsStore.getState().docs[e.tripId]) soon(`docs:${e.tripId}`, () => loadDocuments(e.tripId!));
      return;
  }
}

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
let wanted: { token: string; role: Role; onReconnect: () => void } | null = null;

function open(attempt: number) {
  if (!wanted) return;
  const { token, role, onReconnect } = wanted;
  const ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
  socket = ws;
  ws.onopen = () => {
    // Events may have been missed while offline: reload once connected again.
    if (attempt > 0) onReconnect();
    attempt = 0;
  };
  ws.onmessage = (m) => {
    try {
      handle(JSON.parse(String(m.data)) as ServerEvent, role);
    } catch {
      // Ignore malformed frames.
    }
  };
  ws.onclose = () => {
    if (socket !== ws || !wanted) return;
    retry = setTimeout(() => open(attempt + 1), Math.min(15_000, 1000 * 2 ** attempt));
  };
}

/** Opens the live connection for this session (idempotent for the same token). */
export function connectRealtime(token: string, role: Role, onReconnect: () => void) {
  if (wanted?.token === token && socket) return;
  disconnectRealtime();
  wanted = { token, role, onReconnect };
  open(0);
}

export function disconnectRealtime() {
  wanted = null;
  clearTimeout(retry);
  const ws = socket;
  socket = null;
  ws?.close();
}
