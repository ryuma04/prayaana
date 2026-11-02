"use client";
import { CarProfileIcon } from "@phosphor-icons/react";
import { useTripRoute } from "@/hooks/queries";
import { MapView, type MapLine, type MapPoint } from "./MapView";

/** A trip day on the map with the real road route (OSRM) between its stops. */
export function RoutedMap({
  tripId,
  day,
  points,
  height,
  mover,
  extraPoints,
  lines,
}: {
  tripId: string;
  day: number;
  points: MapPoint[];
  height?: number;
  mover?: { lat: number; lng: number };
  /** Points outside the day's road route, e.g. the trip's airports or stations. */
  extraPoints?: MapPoint[];
  lines?: MapLine[];
}) {
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";");
  const { data: route, isError } = useTripRoute(tripId, day, key);
  return (
    <div>
      <MapView points={extraPoints?.length ? [...points, ...extraPoints] : points} height={height} mover={mover} geometry={day > 0 ? route?.geometry : undefined} lines={lines} />
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted" aria-live="polite">
        <CarProfileIcon size={14} weight="duotone" />
        {day === 0
          ? "All days · pick a day to see its road route"
          : route
          ? `${route.distanceKm} km · ${route.durationMin} min on the road · ${route.source === "osrm" ? "live road route (OSRM)" : "estimated (routing service unavailable)"}`
          : isError
            ? "Road route unavailable, showing straight lines"
            : "Finding the road route…"}
        <span className="ml-auto">© OpenFreeMap © OpenStreetMap</span>
      </p>
    </div>
  );
}
