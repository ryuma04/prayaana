"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { StoreHydrator } from "./StoreHydrator";
import { ServiceWorker } from "./ServiceWorker";
import { Toaster } from "@/components/shell/Toaster";
import { CatalogGate } from "./CatalogGate";
import { TravelGuruFloatingWidget } from "@/components/travel-guru/components/TravelGuruFloatingWidget";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <ServiceWorker />
        <CatalogGate>
          <StoreHydrator />
          {children}
        </CatalogGate>
        <Toaster />
        <TravelGuruFloatingWidget initialCity="Ahmedabad" />
      </MotionConfig>
    </QueryClientProvider>
  );
}
