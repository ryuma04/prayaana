"use client";
import type { Tone } from "@/types";
import { get, post } from "./client";

/** Super Admin API (GET/POST /admin/*). The server checks the role on every call. */

export type GuideVerification = "pending" | "verified" | "rejected" | "suspended";
export type AccountStatus = "active" | "suspended";

export interface PlatformStats {
  users: number;
  travelers: number;
  operators: number;
  operatorCompanies: number;
  suspendedAccounts: number;
  demoAccounts: number;
  guides: number;
  verifiedGuides: number;
  pendingGuides: number;
  rejectedGuides: number;
  suspendedGuides: number;
  liveTrips: number;
  upcomingTrips: number;
  activeIncidents: number;
  demoActiveIncidents: number;
}

export interface AdminGuide {
  id: string;
  name: string;
  region: string;
  phone: string;
  languages: string[];
  dutyStatus: string;
  rating: number;
  tone: Tone;
  operatorId: string;
  operatorName: string;
  verification: GuideVerification;
  verificationNote: string;
  verifiedAt?: string;
  verificationChangedAt?: string;
  destinations: string[];
  toursLed: number;
  activeTours: number;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: "traveler" | "operator";
  phone?: string;
  avatarTone: Tone;
  emailVerified: boolean;
  createdAt: string;
  status: AccountStatus;
  statusChangedAt?: string;
  operatorId?: string;
  operatorName?: string;
  trips: number;
  demo: boolean;
}

export const getOverview = () => get<{ stats: PlatformStats; generatedAt: string }>("/admin/overview");

export const listGuides = (status?: GuideVerification) => get<AdminGuide[]>(`/admin/guides${status ? `?status=${status}` : ""}`);

export const setGuideVerification = (id: string, status: GuideVerification, note: string) =>
  post<AdminGuide>(`/admin/guides/${encodeURIComponent(id)}/verification`, { status, note });

export const listAccounts = (role?: AdminAccount["role"], q?: string) => {
  const p = new URLSearchParams();
  if (role) p.set("role", role);
  if (q) p.set("q", q);
  p.set("limit", "200");
  return get<{ accounts: AdminAccount[]; total: number }>(`/admin/accounts?${p}`);
};

export const setAccountStatus = (id: string, status: AccountStatus) =>
  post<AdminAccount>(`/admin/accounts/${encodeURIComponent(id)}/status`, { status });
