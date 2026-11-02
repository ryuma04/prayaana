"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "motion/react";
import type { TourStatus } from "@/types";
import { useTripStore } from "@/stores/tripStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { useBookingStore } from "@/stores/bookingStore";
import { tourRow, type TourRow } from "@/lib/api/ops";
import { StatusBadge, type StatusKind } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

/** All tours as operator rows, live from the stores. */
export function useTourRows(): TourRow[] {
  const trips = useTripStore((s) => s.trips);
  const incidents = useIncidentStore((s) => s.incidents);
  const bookings = useBookingStore((s) => s.bookings);
  return useMemo(
    () =>
      Object.values(trips)
        .filter((t) => !t.id.startsWith("sample-") && !t.id.startsWith("est-"))
        .map((t) => tourRow(t, incidents, bookings))
        .sort((a, b) => a.trip.prefs.startDate.localeCompare(b.trip.prefs.startDate)),
    [trips, incidents, bookings],
  );
}

export function useOpsData() {
  return {
    ...useBookingStore(useShallow((s) => ({ bookings: s.bookings, ledger: s.ledger }))),
    incidents: useIncidentStore((s) => s.incidents),
  };
}

export const TOUR_STATUS: Record<TourStatus, { label: string; kind: StatusKind }> = {
  planning: { label: "Planning", kind: "neutral" },
  confirmed: { label: "Confirmed", kind: "info" },
  live: { label: "Live", kind: "success" },
  at_risk: { label: "At risk", kind: "danger" },
  completed: { label: "Completed", kind: "purple" },
};

export function TourStatusBadge({ status }: { status: TourStatus }) {
  const s = TOUR_STATUS[status];
  return (
    <StatusBadge kind={s.kind} pulse={status === "live" || status === "at_risk"}>
      {s.label}
    </StatusBadge>
  );
}

export function RiskBar({ risk }: { risk: number }) {
  const cls = risk >= 55 ? "bg-danger" : risk >= 30 ? "bg-warning" : "bg-success";
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Risk ${risk} of 100`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink/10">
        <span className={cn("block h-full rounded-full", cls)} style={{ width: `${Math.max(6, risk)}%` }} />
      </span>
      <span className="tabular text-xs font-semibold text-ink-soft">{risk}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "bg-lavender-soft",
  href,
  delay = 0,
  alert,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: string;
  href?: string;
  delay?: number;
  alert?: boolean;
}) {
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn("h-full rounded-[24px] bg-white p-4 shadow-clay-sm transition", href && "hover:-translate-y-1 hover:shadow-clay", alert && "ring-2 ring-danger/40")}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <span className={cn("grid h-10 w-10 place-items-center rounded-2xl border-2 border-ink", tone)}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold tabular">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </motion.div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function PageHead({ title, sub, actions, kicker }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; kicker?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{kicker}</p>}
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn("rounded-[28px] bg-white shadow-clay", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          <h2 className="font-display text-base font-bold">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-5 pt-3" : "pb-2"}>{children}</div>
    </section>
  );
}

export function FilterPill({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition", active ? "bg-ink text-white" : "bg-white text-ink-soft shadow-clay-sm hover:text-ink")}
    >
      {children}
      {count != null && <span className={cn("rounded-full px-1.5 text-[11px]", active ? "bg-white/20" : "bg-canvas")}>{count}</span>}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-11 w-full rounded-full bg-white px-5 text-sm shadow-clay-sm outline-none focus:ring-2 focus:ring-purple/40 sm:w-72"
    />
  );
}
