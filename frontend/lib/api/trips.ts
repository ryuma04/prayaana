"use client";
import type { Booking, CrowdReport, DayForecast, Incident, Mood, PriceBreakdown, Trip, TripPreferences, TripFeedback, TripReview } from "@/types";
import type { Alternative, StayAlternative } from "@/lib/engine/alternatives";
import type { MoodProposal } from "@/lib/engine/mood";
import { useTripStore } from "@/stores/tripStore";
import { useBookingStore } from "@/stores/bookingStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { del, get, patch, post } from "./client";

export interface TripView {
  trip: Trip;
  price: PriceBreakdown;
}

export interface Planning {
  wishes: { text: string; boosts: string[]; lowWalking?: boolean; kids?: boolean }[];
  wishEngine: string;
  matched: number;
  scored: number;
  wetDays: number;
  stayName: string;
  transport: string;
  totalBudget: number;
}

export interface TravelerMessage {
  kind: "late" | "tired" | "hungry" | "unwell" | "money" | "weather" | "other";
  seriousness: number;
  confidence: number;
  reply: string;
  engine: string;
}

export interface PrepItem {
  id: string;
  group: string;
  label: string;
  why: string;
}

export type ItemEdit =
  | { op: "heart" | "remove" }
  | { op: "move"; day: number }
  | { op: "time"; startMin: number }
  | { op: "qty"; qty: number }
  | { op: "swap"; activityId: string };

export interface TripPatch {
  stayId?: string;
  transportId?: string;
  adults?: number;
  kids?: number;
  groupName?: string;
  startDate?: string;
  budgetPerPerson?: number;
}

const path = (id: string, rest = "") => `/trips/${encodeURIComponent(id)}${rest}`;

/** Every trip the API returns replaces the local copy. */
function keep(v: TripView) {
  useTripStore.getState().upsert(v.trip);
  return v;
}

export async function listMyTrips() {
  const list = await get<TripView[]>("/trips");
  useTripStore.getState().replaceAll(list.map((v) => v.trip), true);
  return list;
}

export async function generateTrip(prefs: TripPreferences) {
  const res = await post<TripView & { planning: Planning }>("/trips", { prefs });
  keep(res);
  useTripStore.getState().addMine(res.trip.id);
  useTripStore.getState().setDraft(res.trip.id);
  return res;
}

export const getTrip = async (id: string) => keep(await get<TripView>(path(id))).trip;

export async function deleteTrip(id: string) {
  await del(path(id));
  useTripStore.getState().remove(id);
}

export const editItem = async (tripId: string, itemId: string, edit: ItemEdit) =>
  keep(await patch<TripView>(path(tripId, `/items/${encodeURIComponent(itemId)}`), edit));

export const addActivity = async (tripId: string, activityId: string, day: number) => keep(await post<TripView>(path(tripId, "/items"), { activityId, day }));

export const patchTrip = async (tripId: string, body: TripPatch) => keep(await patch<TripView>(path(tripId), body));

export async function getAlternatives(tripId: string, itemId: string) {
  const res = await get<{ item: Trip["items"][number]; list: Alternative[] }>(path(tripId, `/alternatives?item=${encodeURIComponent(itemId)}`));
  return { ...res, trip: useTripStore.getState().trips[tripId] };
}

export const getStayAlternatives = (tripId: string) => get<StayAlternative[]>(path(tripId, "/stays"));

export async function optimize(tripId: string) {
  const res = await post<TripView & { savedMin: number; movedOutdoor: number }>(path(tripId, "/optimize"));
  keep(res);
  return res;
}

export async function optimizeBudget(tripId: string) {
  const res = await post<TripView & { saved: number; changes: string[] }>(path(tripId, "/optimize-budget"));
  keep(res);
  return res;
}


export const quote = (tripId: string) => get<PriceBreakdown>(path(tripId, "/price"));

export async function applyPromo(tripId: string, code: string) {
  const res = await post<TripView & { label: string }>(path(tripId, "/promo"), { code: code.trim().toUpperCase() });
  keep(res);
  return res.label;
}

export const removePromo = async (tripId: string) => keep(await del<TripView>(path(tripId, "/promo")));

export const getInsights = (tripId: string) =>
  get<{ forecast: DayForecast[]; prep: PrepItem[]; vendors: { vendorId: string; amount: number }[]; heartsMax: number }>(path(tripId, "/insights"));

export const proposeMood = (tripId: string, mood: Mood, day: number, nowMin: number) => post<MoodProposal>(path(tripId, "/mood"), { mood, day, nowMin });

export const acceptMood = async (tripId: string, mood: Mood, day: number, nowMin: number) => keep(await post<TripView>(path(tripId, "/mood/accept"), { mood, day, nowMin })).trip;

export const submitReview = async (tripId: string, review: Omit<TripReview, "createdAt"> & { feedback?: TripFeedback }) => keep(await post<TripView>(path(tripId, "/review"), review));

/** Demo helper: shift a booked trip so that day N is today. */
export const startTripNow = async (tripId: string, day = 1) => keep(await post<TripView>(path(tripId, "/start"), { day })).trip;

export const sendTravelerMessage = (tripId: string, text: string) => post<TravelerMessage>(path(tripId, "/message"), { text });

export function sendTravelerVoice(tripId: string, audio: Blob) {
  const form = new FormData();
  form.append("audio", audio, "voice.webm");
  return post<{ transcript: string; language: string; transcribedBy: string; understood: TravelerMessage }>(path(tripId, "/voice"), form);
}

export async function loadTripBookings(tripId: string) {
  const list = await get<Booking[]>(path(tripId, "/bookings"));
  useBookingStore.getState().setTripBookings(tripId, list);
  return list;
}

export async function loadTripIncidents(tripId: string) {
  const list = await get<Incident[]>(path(tripId, "/incidents"));
  useIncidentStore.getState().setForTrip(tripId, list);
  return list;
}

export const reportAtPlace = (tripId: string, report: { place: string; type: CrowdReport["type"]; text: string; role?: CrowdReport["reporterRole"] }) =>
  post<CrowdReport>(path(tripId, "/reports"), report);
