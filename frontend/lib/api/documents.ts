"use client";
import type { InboxMessage, InboxThread, TripDocument } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { useCommsStore } from "@/stores/commsStore";
import { API_URL, ApiError, get, post } from "./client";
import type { TravelerMessage } from "./trips";

const path = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;

/** Every issued PDF for the trip, newest first (booked trips get their first set on demand). */
export const listDocuments = (tripId: string) => get<TripDocument[]>(path(tripId, "/documents"));

/** Issues fresh versions of every document. */
export const reissueDocuments = (tripId: string) => post<TripDocument[]>(path(tripId, "/documents"));

/** Latest version of each kind, in reading order. */
export function latestDocuments(list: TripDocument[]) {
  const order: TripDocument["kind"][] = ["confirmation", "invoice", "itinerary", "voucher"];
  return order.map((k) => list.find((d) => d.kind === k && d.latest)).filter((d): d is TripDocument => !!d);
}

/**
 * Opens (or downloads) a PDF. The file needs the session token, so it is fetched
 * with the Authorization header and handed to the browser as a blob URL.
 */
export async function openDocument(tripId: string, docId: string, opts: { download?: boolean; fileName?: string } = {}) {
  const token = useAuthStore.getState().token;
  // Open the tab synchronously (inside the click) so pop-up blockers allow it.
  const tab = opts.download ? null : window.open("", "_blank");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path(tripId, `/documents/${encodeURIComponent(docId)}`)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch {
    tab?.close();
    throw new ApiError("We can't reach Prayaana right now. Check your connection and try again.", "network");
  }
  if (!res.ok) {
    tab?.close();
    if (res.status === 401) useAuthStore.getState().logout();
    throw new ApiError(res.status === 404 ? "That document no longer exists." : `Couldn't open the document (${res.status}).`, res.status === 404 ? "not_found" : "internal", res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  if (opts.download || !tab) {
    const a = document.createElement("a");
    a.href = url;
    a.download = opts.fileName ?? "prayaana-document.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else tab.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const sizeLabel = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Traveler WhatsApp (mock channel unless Meta keys are configured on the server).

export const getTripWhatsApp = (tripId: string) => get<InboxThread>(path(tripId, "/chat"));

export const sendTripWhatsApp = (tripId: string, text: string, voice = false) =>
  post<{ sent: InboxMessage; reply: InboxMessage; understood: TravelerMessage }>(path(tripId, "/chat"), { text, voice });

/** Loads the trip's documents into the comms store. */
export async function loadDocuments(tripId: string) {
  const s = useCommsStore.getState();
  if (!s.docs[tripId]) s.setDocsState(tripId, "loading");
  try {
    const list = await listDocuments(tripId);
    useCommsStore.getState().setDocs(tripId, list);
    return list;
  } catch (e) {
    useCommsStore.getState().setDocsState(tripId, "error");
    throw e;
  }
}

/** Loads the trip's WhatsApp conversation into the comms store. */
export async function loadWhatsApp(tripId: string) {
  const s = useCommsStore.getState();
  if (!s.whatsapp[tripId]) s.setWhatsAppState(tripId, "loading");
  try {
    const th = await getTripWhatsApp(tripId);
    useCommsStore.getState().setWhatsApp(tripId, th.messages);
    return th;
  } catch (e) {
    useCommsStore.getState().setWhatsAppState(tripId, "error");
    throw e;
  }
}
