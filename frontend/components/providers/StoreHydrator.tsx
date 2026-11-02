"use client";
import { useEffect } from "react";
import { create } from "zustand";
import { useAuthStore } from "@/stores/authStore";
import { useTravelerStore } from "@/stores/travelerStore";
import { useQuizStore } from "@/stores/quizStore";
import { useTripStore } from "@/stores/tripStore";
import { STORE_KEYS } from "@/stores/storage";
import { toast } from "@/stores/notificationStore";
import { clearSession, loadSession } from "@/lib/session";
import { startWeather } from "@/stores/weatherStore";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime/socket";
import type { Role } from "@/types";

/** `ready` turns true once local state is restored and the signed-in user's data is loaded. */
export const useAppReady = create<{ ready: boolean; setReady: (v: boolean) => void }>()((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));

const persisted = [useAuthStore, useTravelerStore, useQuizStore, useTripStore];

let loadedFor: string | null = null;

async function startSession(token: string, role: Role) {
  if (loadedFor === token) return;
  loadedFor = token;
  clearSession();
  const reload = () =>
    loadSession(role).catch(() => toast({ tone: "error", title: "Couldn't load your data", body: "Check your connection. We'll retry when it's back." }));
  await reload();
  connectRealtime(token, role, () => void reload());
}

function endSession() {
  loadedFor = null;
  disconnectRealtime();
  clearSession();
}

export function StoreHydrator() {
  useEffect(() => {
    let cancelled = false;
    startWeather();
    Promise.all(persisted.map((s) => s.persist.rehydrate())).then(async () => {
      const { token, user } = useAuthStore.getState();
      if (token && user) await startSession(token, user.role);
      if (!cancelled) useAppReady.getState().setReady(true);
    });

    const unsubscribe = useAuthStore.subscribe((s, prev) => {
      if (s.token === prev.token) return;
      if (s.token && s.user) {
        useAppReady.getState().setReady(false);
        void startSession(s.token, s.user.role).then(() => useAppReady.getState().setReady(true));
      } else endSession();
    });

    // Signing in or out in another tab applies here too.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEYS.auth) void useAuthStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
