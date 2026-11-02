"use client";
import { useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { get } from "@/lib/api/client";
import { hydrateCatalog, type CatalogData } from "@/data/catalog";
import { ErrorState, PageLoader } from "@/components/ui/States";

const CACHE_KEY = "prayaana-catalog-v2";

interface CatalogState {
  status: "loading" | "ready" | "error";
  error?: unknown;
  /** Bumps whenever a fresh catalog arrives, so screens can re-read it. */
  version: number;
}

export const useCatalog = create<CatalogState>()(() => ({ status: "loading", version: 0 }));

function fromCache(): CatalogData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CatalogData) : null;
  } catch {
    return null;
  }
}

let inflight: Promise<void> | null = null;

/** Loads the operator's catalog from the Go API (GET /catalog) and keeps a copy for offline use. */
export function loadCatalog() {
  inflight ??= get<CatalogData>("/catalog", { anonymous: true })
    .then((data) => {
      hydrateCatalog(data);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        // Storage full or blocked: the catalog still works for this visit.
      }
      useCatalog.setState((s) => ({ status: "ready", version: s.version + 1, error: undefined }));
    })
    .catch((error) => {
      if (useCatalog.getState().status !== "ready") useCatalog.setState({ status: "error", error });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Renders the app once the catalog is available (from the device cache at once, then refreshed). */
export function CatalogGate({ children }: { children: ReactNode }) {
  const status = useCatalog((s) => s.status);
  useEffect(() => {
    const cached = fromCache();
    if (cached) {
      hydrateCatalog(cached);
      useCatalog.setState((s) => ({ status: "ready", version: s.version + 1 }));
    }
    void loadCatalog();
    const every = setInterval(() => void loadCatalog(), 10 * 60_000);
    return () => clearInterval(every);
  }, []);
  if (status === "ready") return <>{children}</>;
  if (status === "error")
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <ErrorState title="We can't reach Prayaana" error={useCatalog.getState().error} onRetry={() => void loadCatalog()} />
      </div>
    );
  return <PageLoader label="Loading destinations…" />;
}
