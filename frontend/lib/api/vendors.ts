"use client";
import type { Booking, Incident, Vendor, VendorAnswer, VendorRequest, VoiceInterpretation } from "@/types";
import { useOperatorStore } from "@/stores/operatorStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { get, patch, post } from "./client";

export async function listVendors() {
  const list = await get<Vendor[]>("/ops/vendors");
  useOperatorStore.getState().setVendors(list);
  return list;
}

export interface VendorDetail {
  vendor: Vendor;
  bookings: Booking[];
  requests: VendorRequest[];
}

export async function getVendorDetail(id: string) {
  const res = await get<VendorDetail>(`/ops/vendors/${encodeURIComponent(id)}`);
  useOperatorStore.getState().putVendor(res.vendor);
  return res;
}

export const getVendor = async (id: string) => (await getVendorDetail(id)).vendor;

/** The operator keeps a partner's real contact details (used for calls and emailed requests). */
export async function updateVendorContact(id: string, body: { contactName?: string; phone?: string; email?: string; language?: string }) {
  const v = await patch<Vendor>(`/ops/vendors/${encodeURIComponent(id)}`, body);
  useOperatorStore.getState().putVendor(v);
  return v;
}

/** A vendor request still waiting for an answer, with its reply link and the partner's contact. */
export interface PendingRequest {
  request: VendorRequest;
  link: string;
  vendorName: string;
  vendorKind: string;
  contactName: string;
  phone: string;
  email: string;
}

export const listPendingRequests = () => get<PendingRequest[]>("/ops/requests");

/** The operator records a partner's answer after calling them (same path as a reply on the link). */
export const recordVendorAnswer = (token: string, answer: "yes" | "no" | "other_time", altTime?: string) =>
  post<VendorPage>(`/ops/requests/${encodeURIComponent(token)}/answer`, { answer, altTime });

/** Pausing a vendor raises a problem on every trip that depends on them. */
export async function setAvailability(id: string, available: boolean) {
  const res = await patch<{ vendor: Vendor; incidents: Incident[] }>(`/ops/vendors/${encodeURIComponent(id)}/availability`, { available });
  useOperatorStore.getState().putVendor(res.vendor);
  for (const i of res.incidents) useIncidentStore.getState().upsert(i);
  return res.incidents;
}

// Public vendor link (/v/{token}): no login.

export interface VendorPage {
  req: VendorRequest;
  vendor: Vendor | null;
  open: boolean;
}

const link = (token: string, rest = "") => `/v/${encodeURIComponent(token)}${rest}`;

export const getVendorRequest = (token: string) => get<VendorPage>(link(token), { anonymous: true });

export const replyToRequest = (token: string, answer: Exclude<VendorAnswer, "pending" | "timeout" | "cancelled">, altTime?: string) =>
  post<VendorPage>(link(token, "/reply"), { answer, altTime }, { anonymous: true });

/** A recorded voice note, or a typed reply (the server transcribes with Whisper and the AI reads what it means). */
export function sendVoiceReply(token: string, note: Blob | string) {
  const body = typeof note === "string" ? { transcript: note } : withAudio(note);
  return post<VendorPage & { voice: VoiceInterpretation; applied: boolean }>(link(token, "/voice"), body, { anonymous: true });
}

function withAudio(audio: Blob) {
  const form = new FormData();
  form.append("audio", audio, "voice.webm");
  return form;
}
