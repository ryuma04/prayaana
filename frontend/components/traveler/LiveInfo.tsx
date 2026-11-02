"use client";
import { useState } from "react";
import { AirplaneTiltIcon, ArrowClockwiseIcon, MapPinIcon, StarIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import type { DestinationId, Trip } from "@/types";
import { usePlaces, useTripFlights } from "@/hooks/queries";
import type { FlightLeg, PlaceCategory } from "@/lib/api/geo";
import { cn } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";

const clock = (iso?: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : "");

const STATUS: Record<string, { kind: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  scheduled: { kind: "info", label: "Scheduled" },
  active: { kind: "success", label: "In the air" },
  landed: { kind: "success", label: "Landed" },
  delayed: { kind: "warning", label: "Delayed" },
  cancelled: { kind: "danger", label: "Cancelled" },
  diverted: { kind: "danger", label: "Diverted" },
  incident: { kind: "danger", label: "Incident" },
};

/** Live flight status for the trip's flights (Aviationstack through the API; timetable fallback). */
export function FlightStatusCard({ trip, className }: { trip: Trip; className?: string }) {
  const hasFlight = trip.items.some((i) => i.kind === "flight" && i.status !== "cancelled");
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useTripFlights(trip.id, hasFlight && trip.status !== "draft");
  if (!hasFlight || trip.status === "draft") return null;
  return (
    <Card pad="md" className={className}>
      <SectionTitle
        title="Flight status"
        kicker={data?.flights.some((f) => f.live) ? "Live · Aviationstack" : "Timetable · live status opens a day before"}
        action={
          <Button size="sm" variant="ghost" loading={isFetching} onClick={() => void qc.invalidateQueries({ queryKey: ["flights", trip.id] }).then(() => refetch())} icon={<ArrowClockwiseIcon size={14} weight="bold" />}>
            Refresh
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : isError || !data ? (
        <ErrorState title="Flight status unavailable" error="We'll keep showing your timetable." onRetry={() => refetch()} className="py-6" />
      ) : (
        <ul className="space-y-3">
          {data.flights.map((f) => (
            <FlightRow key={f.itemId} f={f} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function FlightRow({ f }: { f: FlightLeg }) {
  const st = STATUS[f.status] ?? { kind: "neutral" as const, label: f.status };
  return (
    <li className="rounded-2xl bg-canvas p-3">
      <div className="flex items-center gap-2">
        <AirplaneTiltIcon size={18} weight="duotone" className="text-purple" />
        <p className="flex-1 truncate text-sm font-bold">
          {f.airline} {f.flight} · {f.leg === "return" ? "Return" : "Outbound"}
        </p>
        <StatusBadge kind={st.kind}>{f.delayMin >= 15 ? `${st.label} · +${f.delayMin} min` : st.label}</StatusBadge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="font-bold">{f.departure.iata || ""}</p>
          <p className="text-muted">
            {clock(f.departure.scheduled)}
            {f.departure.estimated && f.departure.estimated !== f.departure.scheduled ? ` → ${clock(f.departure.estimated)}` : ""}
            {f.departure.terminal ? ` · T${f.departure.terminal}` : ""}
            {f.departure.gate ? ` · Gate ${f.departure.gate}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold">{f.arrival.iata || ""}</p>
          <p className="text-muted">
            {clock(f.arrival.scheduled)}
            {f.arrival.estimated && f.arrival.estimated !== f.arrival.scheduled ? ` → ${clock(f.arrival.estimated)}` : ""}
          </p>
        </div>
      </div>
      {f.note && <p className="mt-2 text-[11px] text-muted">{f.note}</p>}
    </li>
  );
}

const CATEGORIES: { id: PlaceCategory; label: string }[] = [
  { id: "sights", label: "Sights" },
  { id: "food", label: "Food" },
  { id: "cafe", label: "Cafés" },
  { id: "medical", label: "Medical" },
  { id: "atm", label: "ATMs" },
];

/** Places near the destination or the group (Google Places through the API; catalog fallback). */
export function NearbyPlaces({ destinationId, near, className, initial = "sights" }: { destinationId: DestinationId; near?: { lat: number; lng: number }; className?: string; initial?: PlaceCategory }) {
  const [cat, setCat] = useState<PlaceCategory>(initial);
  const { data, isLoading, isError, refetch } = usePlaces(destinationId, cat, near);
  return (
    <Card pad="md" className={className}>
      <SectionTitle title={near ? "Nearby right now" : "Around here"} kicker={data?.source === "google-places" ? "Live · Google Places" : data ? "From our experiences" : "Places"} />
      <div className="scrollbar-none -mx-1 mb-3 flex gap-2 overflow-x-auto px-1" role="tablist" aria-label="Place categories">
        {CATEGORIES.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold", cat === c.id ? "bg-ink text-white" : "bg-canvas")}>
            {c.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : isError || !data ? (
        <ErrorState title="Couldn't load places" error="Check your connection." onRetry={() => refetch()} className="py-6" />
      ) : data.places.length === 0 ? (
        <p className="rounded-2xl bg-canvas p-4 text-sm text-muted">Nothing found for this category nearby.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.places.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-soft">
                <MapPinIcon size={16} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="truncate text-[11px] text-muted">
                  {[p.type, p.distanceKm != null ? `${p.distanceKm} km` : "", p.openNow === true ? "Open now" : p.openNow === false ? "Closed now" : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
              {p.rating ? (
                <span className="flex items-center gap-0.5 text-xs font-bold">
                  <StarIcon size={12} weight="fill" className="text-star" />
                  {p.rating.toFixed(1)}
                </span>
              ) : null}
              {p.mapsUrl && (
                <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.name} in Google Maps`} className="grid h-8 w-8 place-items-center rounded-full hover:bg-canvas">
                  <ArrowSquareOutIcon size={16} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
