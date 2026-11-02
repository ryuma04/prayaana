"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import type { IncidentKind } from "@/types";
import { useIncidentStore } from "@/stores/incidentStore";
import { useTripStore } from "@/stores/tripStore";
import { FilterPill, PageHead } from "@/components/ops/opsKit";
import { incidentIcon } from "@/components/adapt/ImpactMap";
import { StatusBadge } from "@/components/ui/primitives";

import { EmptyState } from "@/components/ui/States";
import { analyzeImpact } from "@/lib/engine/impact";
import { makeFixPlans } from "@/lib/engine/fixes";
import { destinationMap } from "@/data/destinations";
import { cn, rupees, timeAgo } from "@/lib/format";

const KIND_LABEL: Record<IncidentKind, string> = {
  weather: "Weather",
  flight_delay: "Flight delay",
  vendor_unavailable: "Vendor unavailable",
  traveler_request: "Traveler request",
  closure: "Closure",
  running_late: "Running late",
  crowd_report: "Crowd report",
  health: "Health",
};

export default function IncidentsPage() {
  const incidents = useIncidentStore((s) => s.incidents);
  const trips = useTripStore((s) => s.trips);
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [kind, setKind] = useState<IncidentKind | "all">("all");

  const rows = useMemo(
    () =>
      incidents
        .filter((i) => (status === "all" ? true : status === "open" ? i.status !== "resolved" : i.status === "resolved"))
        .filter((i) => kind === "all" || i.kind === kind)
        .map((i) => {
          const trip = trips[i.tripId];
          if (!trip) return null;
          const impact = i.status === "resolved" ? null : analyzeImpact(trip, i);
          const plans = impact ? makeFixPlans(trip, i, impact) : [];
          return { i, trip, impact, best: plans.find((p) => p.recommended) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x),
    [incidents, trips, status, kind],
  );
  const kinds = [...new Set(incidents.map((i) => i.kind))];

  return (
    <div>
      <PageHead
        title="Incident center"
        sub="Every disruption across every tour, with impact, money at risk and a recommended fix."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["open", "resolved", "all"] as const).map((s) => (
          <FilterPill key={s} active={status === s} onClick={() => setStatus(s)} count={s === "all" ? incidents.length : incidents.filter((i) => (s === "open" ? i.status !== "resolved" : i.status === "resolved")).length}>
            {s[0].toUpperCase() + s.slice(1)}
          </FilterPill>
        ))}
        <span className="mx-1 w-px bg-line" />
        <FilterPill active={kind === "all"} onClick={() => setKind("all")}>
          All types
        </FilterPill>
        {kinds.map((k) => (
          <FilterPill key={k} active={kind === k} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </FilterPill>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={status === "open" ? "No problems right now" : "No problems"} body="Weather, flight delays, partner replies and traveler reports create problems here automatically." mood="happy" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ i, trip, impact, best }) => {
            const Icon = incidentIcon(i.kind);
            const affected = impact ? impact.items.filter((x) => x.level !== "safe").length : 0;
            return (
              <Link key={i.id} href={`/ops/incidents/${i.id}`} className="group rounded-2xl border border-line bg-white p-4 shadow-clay-sm transition hover:-translate-y-0.5">
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", i.status === "resolved" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    <Icon size={22} weight="duotone" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{i.title}</p>
                      <StatusBadge kind={i.status === "resolved" ? "success" : i.status === "escalated" ? "danger" : i.status === "awaiting_vendors" ? "purple" : "warning"} pulse={i.status !== "resolved"}>
                        {i.status.replace("_", " ")}
                      </StatusBadge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {KIND_LABEL[i.kind]} · {trip.code} {trip.groupName} · {destinationMap[trip.destinationId]?.name ?? trip.destinationId} · Day {i.day} · {timeAgo(i.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-lg bg-canvas px-2 py-1 text-[10px] font-extrabold">SEV {i.severity}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-canvas p-2">
                    <p className="font-display text-base font-extrabold">{impact ? affected : ""}</p>
                    <p className="text-[10px] text-muted">items affected</p>
                  </div>
                  <div className="rounded-xl bg-canvas p-2">
                    <p className="font-display text-base font-extrabold">{trip.prefs.adults + trip.prefs.kids}</p>
                    <p className="text-[10px] text-muted">travelers</p>
                  </div>
                  <div className="rounded-xl bg-canvas p-2">
                    <p className="font-display text-base font-extrabold">{impact ? rupees(impact.moneyAtRisk) : "₹0"}</p>
                    <p className="text-[10px] text-muted">at risk</p>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-purple-deep">
                  {i.status === "resolved" ? "Resolved with a Change Receipt" : best ? `Recommended: ${best.title} (${rupees(best.costDelta, { sign: true })})` : "Open"}
                  <ArrowRightIcon size={12} className="ml-auto transition group-hover:translate-x-0.5" />
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
