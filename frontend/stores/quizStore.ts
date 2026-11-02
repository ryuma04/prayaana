"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuizAnswers } from "@/lib/engine/dna";
import { persistStorage, STORE_KEYS } from "./storage";

interface QuizState {
  answers: QuizAnswers;
  index: number;
  completed: boolean;
  answer: (id: string, value: string | string[] | number) => void;
  go: (i: number) => void;
  complete: () => void;
  reset: () => void;
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      answers: {},
      index: 0,
      completed: false,
      answer: (id, value) => set({ answers: { ...get().answers, [id]: value } }),
      go: (i) => set({ index: i }),
      complete: () => set({ completed: true }),
      reset: () => set({ answers: {}, index: 0, completed: false }),
    }),
    { name: STORE_KEYS.quiz, storage: persistStorage, skipHydration: true, version: 1 },
  ),
);
