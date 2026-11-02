"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, SessionUser } from "@/types";
import { persistStorage, STORE_KEYS } from "./storage";

interface AuthState {
  user: SessionUser | null;
  /** JWT from the Go API (POST /auth/login, /auth/verify-email). */
  token: string | null;
  expiresAt: string | null;
  /** Email waiting for its 6-digit code (after signup or an unverified login). */
  pendingEmail: string | null;
  login: (user: SessionUser, token: string, expiresAt?: string) => void;
  setUser: (user: SessionUser) => void;
  setPendingEmail: (email: string | null) => void;
  logout: () => void;
}

export const homeForRole: Record<Role, string> = {
  traveler: "/discover",
  operator: "/ops",
  super_admin: "/super-admin",
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      expiresAt: null,
      pendingEmail: null,
      login: (user, token, expiresAt) => set({ user, token, expiresAt: expiresAt ?? null, pendingEmail: null }),
      setUser: (user) => set({ user }),
      setPendingEmail: (email) => set({ pendingEmail: email }),
      logout: () => set({ user: null, token: null, expiresAt: null }),
    }),
    {
      name: STORE_KEYS.auth,
      storage: persistStorage,
      skipHydration: true,
      version: 3,
      // Sessions from the old demo-only build have no token: drop them.
      migrate: (state) => {
        const s = state as Partial<AuthState>;
        const valid = !!s.token && !!s.user && (s.user.role === "traveler" || s.user.role === "operator" || s.user.role === "super_admin");
        return { user: valid ? s.user : null, token: valid ? s.token : null, expiresAt: valid ? (s.expiresAt ?? null) : null, pendingEmail: s.pendingEmail ?? null } as AuthState;
      },
      onRehydrateStorage: () => (state) => {
        if (state?.expiresAt && new Date(state.expiresAt).getTime() < Date.now()) state.logout();
      },
    },
  ),
);
