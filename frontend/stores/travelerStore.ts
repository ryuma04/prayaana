"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DestinationId, Interest, Pace, PlaceIdentity, StayType, TransportMode, TravelDNA } from "@/types";
import { persistStorage, STORE_KEYS } from "./storage";
import { addDays, todayISO } from "@/lib/format";
import { togglePrep, updateProfile, type Profile, type ProfilePatch } from "@/lib/api/profile";
import { toast } from "./notificationStore";

export interface OnboardingAnswers {
  destinationId: DestinationId | null;
  destinationIds: DestinationId[];
  destinationAllocations: Record<string, number>;
  destinationPlaces: PlaceIdentity[];
  originPlace: PlaceIdentity | null;
  startDate: string;
  nights: number;
  adults: number;
  kids: number;
  groupType: "solo" | "couple" | "family" | "friends";
  budgetPerPerson: number;
  stayType: StayType;
  transport: TransportMode;
  fromCity: string;
  /** Full address or locality the traveler typed (e.g. "Indiranagar, Bengaluru"). */
  fromAddress: string;
  /** Latitude of the traveler's origin (geocoded or picked). */
  fromLat: number | null;
  /** Longitude of the traveler's origin (geocoded or picked). */
  fromLng: number | null;
  interests: Interest[];
  pace: Pace;
  rhythm: "early-bird" | "night-owl";
  special: string[];
  ownWords: string;
}

export const defaultAnswers = (): OnboardingAnswers => ({
  destinationId: null,
  destinationIds: [],
  destinationAllocations: {},
  destinationPlaces: [],
  originPlace: null,
  startDate: addDays(todayISO(), 14),
  nights: 4,
  adults: 2,
  kids: 0,
  groupType: "couple",
  budgetPerPerson: 30000,
  stayType: "boutique",
  transport: "bus",
  fromCity: "Bengaluru",
  fromAddress: "",
  fromLat: null,
  fromLng: null,
  interests: [],
  pace: "balanced",
  rhythm: "early-bird",
  special: [],
  ownWords: "",
});

export const BADGES = [
  { id: "dna", label: "Know thyself", emoji: "🧬", hint: "Finished Travel DNA" },
  { id: "planner", label: "Trip architect", emoji: "🗺️", hint: "Built your first trip" },
  { id: "hearts", label: "Heart keeper", emoji: "❤️", hint: "Used Must-Do hearts" },
  { id: "booked", label: "Bags packed", emoji: "🧳", hint: "Booked a trip" },
  { id: "fixed", label: "Unbreakable", emoji: "🛡️", hint: "Survived a disruption" },
  { id: "reviewer", label: "Storyteller", emoji: "✍️", hint: "Reviewed a trip" },
] as const;

interface TravelerState {
  answers: OnboardingAnswers;
  onboardingStep: number;
  dna: TravelDNA | null;
  xp: number;
  badges: string[];
  savedPlaces: string[];
  autoApproveLimit: number;
  language: string;
  prepDone: Record<string, string[]>;
  setAnswers: (patch: Partial<OnboardingAnswers>) => void;
  setStep: (n: number) => void;
  resetOnboarding: () => void;
  setDNA: (dna: TravelDNA) => void;
  applyProfile: (p: Profile) => void;
  toggleSaved: (destId: string) => void;
  setAutoApprove: (n: number) => void;
  setLanguage: (l: string) => void;
  togglePrep: (tripId: string, id: string) => void;
  resetProfile: () => void;
}

const emptyProfile = {
  dna: null,
  xp: 0,
  badges: [] as string[],
  savedPlaces: [] as string[],
  autoApproveLimit: 1000,
  language: "English",
  prepDone: {} as Record<string, string[]>,
};

/** Saves a profile change and keeps the server copy (it owns XP and badges). */
function save(body: ProfilePatch) {
  updateProfile(body)
    .then((p) => useTravelerStore.getState().applyProfile(p))
    .catch(() => toast({ tone: "error", title: "Couldn't save that change", body: "Check your connection and try again." }));
}

export const useTravelerStore = create<TravelerState>()(
  persist(
    (set, get) => ({
      answers: defaultAnswers(),
      onboardingStep: 0,
      ...emptyProfile,
      setAnswers: (patch) => set({ answers: { ...get().answers, ...patch } }),
      setStep: (n) => set({ onboardingStep: n }),
      resetOnboarding: () => set({ answers: defaultAnswers(), onboardingStep: 0 }),
      setDNA: (dna) => set({ dna }),
      applyProfile: (p) =>
        set({
          dna: p.dna,
          xp: p.xp,
          badges: p.badges ?? [],
          savedPlaces: p.savedPlaces ?? [],
          autoApproveLimit: p.autoApproveLimit,
          language: p.language || "English",
          prepDone: p.prepDone ?? {},
        }),
      toggleSaved: (id) => {
        const savedPlaces = get().savedPlaces.includes(id) ? get().savedPlaces.filter((x) => x !== id) : [...get().savedPlaces, id];
        set({ savedPlaces });
        save({ savedPlaces });
      },
      setAutoApprove: (n) => {
        set({ autoApproveLimit: n });
        save({ autoApproveLimit: n });
      },
      setLanguage: (l) => {
        set({ language: l });
        save({ language: l });
      },
      togglePrep: (tripId, id) => {
        const cur = get().prepDone[tripId] ?? [];
        set({ prepDone: { ...get().prepDone, [tripId]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } });
        togglePrep(tripId, id)
          .then((p) => get().applyProfile(p))
          .catch(() => toast({ tone: "error", title: "Couldn't save your checklist" }));
      },
      resetProfile: () => set({ ...emptyProfile, answers: defaultAnswers(), onboardingStep: 0 }),
    }),
    {
      name: STORE_KEYS.traveler,
      storage: persistStorage,
      skipHydration: true,
      version: 2,
      // The profile lives on the server; only the unfinished onboarding form stays on this device.
      partialize: (s) => ({ answers: s.answers, onboardingStep: s.onboardingStep }),
      migrate: () => ({ answers: defaultAnswers(), onboardingStep: 0 }),
      onRehydrateStorage: () => (state) => {
        if (state?.answers?.startDate && state.answers.startDate < todayISO()) {
          state.answers.startDate = addDays(todayISO(), 14);
        }
      },
    },
  ),
);
