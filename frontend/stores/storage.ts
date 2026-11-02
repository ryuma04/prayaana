import { createJSONStorage } from "zustand/middleware";

/** Shared persist config: localStorage, skip auto-hydration (hydrated by <StoreHydrator/>). */
export const persistStorage = createJSONStorage(() => {
  if (typeof window === "undefined") {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
  return window.localStorage;
});

export const STORE_KEYS = {
  auth: "prayaana-auth",
  traveler: "prayaana-traveler",
  quiz: "prayaana-quiz",
  trips: "prayaana-trips",
  demo: "prayaana-demo",
} as const;
