"use client";
import type { DNAChange, DNARecommendation, TravelDNA } from "@/types";
import { get, patch, post } from "./client";

export interface Profile {
  dna: TravelDNA | null;
  quizAnswers: Record<string, unknown>;
  onboarding: Record<string, unknown>;
  xp: number;
  badges: string[];
  savedPlaces: string[];
  autoApproveLimit: number;
  language: string;
  prepDone: Record<string, string[]>;
}

export interface ProfilePatch {
  onboarding?: Record<string, unknown>;
  savedPlaces?: string[];
  autoApproveLimit?: number;
  language?: string;
}

export const getProfile = () => get<Profile>("/profile");
export const updateProfile = (body: ProfilePatch) => patch<Profile>("/profile", body);
export const submitQuiz = (answers: Record<string, unknown>) => post<{ dna: TravelDNA; interests: string[]; profile: Profile }>("/profile/quiz", { answers });
export const getDNAHistory = () => get<DNAChange[]>("/profile/dna/history");
export const getRecommendations = (q: { tripId?: string; destinationId?: string }) =>
  get<{ dna: TravelDNA | null; items: DNARecommendation[]; decider: string }>(
    `/profile/recommendations?${new URLSearchParams(Object.entries(q).filter(([, v]) => !!v) as [string, string][])}`,
  );
export const togglePrep = (tripId: string, itemId: string) => post<Profile>("/profile/prep", { tripId, itemId });
