"use client";
import { useCallback, useEffect, useState } from "react";
import type { TransportMode } from "@/types";
import { getModeHubs, type ModeHubsResponse } from "@/lib/api/geo";

type LatLng = { lat: number; lng: number };

export const validPoint = (p?: { lat?: number | null; lng?: number | null } | null): p is LatLng =>
  !!p && typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0);

export interface ModeHubsState {
  loading: boolean;
  data: ModeHubsResponse | null;
  error: string | null;
  retry: () => void;
}

/**
 * Real transport hubs for a public mode between two resolved points. Car needs no hubs.
 * Results reset whenever the mode or either point changes, so stale hubs never linger.
 */
export function useModeHubs(mode: TransportMode | null | undefined, from: LatLng | null, to: LatLng | null): ModeHubsState {
  const [nonce, setNonce] = useState(0);
  const key = mode && mode !== "car" && from && to ? `${mode}|${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}|${nonce}` : "";
  // Results are stored with the request key they answer, so a changed mode/point never shows old hubs.
  const [result, setResult] = useState<{ key: string; data: ModeHubsResponse | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!key || !from || !to || !mode || mode === "car") return;
    let cancelled = false;
    getModeHubs(mode, from, to)
      .then((data) => {
        if (cancelled) return;
        const failed = data.origin.error && data.destination.error;
        setResult({ key, data, error: failed ? "Nearby transport locations unavailable." : null });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, data: null, error: "Nearby transport locations unavailable." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures mode/from/to
  }, [key]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  if (!key) return { loading: false, data: null, error: null, retry };
  if (result?.key !== key) return { loading: true, data: null, error: null, retry };
  return { loading: false, data: result.data, error: result.error, retry };
}
