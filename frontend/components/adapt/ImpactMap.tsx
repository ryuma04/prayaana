"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { CloudRainIcon, AirplaneTiltIcon, StorefrontIcon, ProhibitIcon, UsersIcon, WarningIcon, HeartIcon, CaretDownIcon, HeartbeatIcon, ClockIcon, CurrencyInrIcon } from "@phosphor-icons/react";
import type { ImpactItem, ImpactLevel, ImpactSummary, Incident, Trip, TripItem } from "@/types";
import { ArtTile } from "@/components/art/ArtTile";
import { cn, duration, minToTime, rupees } from "@/lib/format";

export const LEVEL: Record<ImpactLevel, { label: string; cls: string; dot: string; ring: string }> = {
  safe: { label: "Safe", cls: "bg-success-soft text-success", dot: "bg-success", ring: "ring-success/40" },
  moves: { label: "Moves", cls: "bg-warning-soft text-warning", dot: "bg-sun", ring: "ring-sun" },
  at_risk: { label: "At risk", cls: "bg-coral-soft text-coral-deep", dot: "bg-coral", ring: "ring-coral" },
  cannot_happen: { label: "Cannot happen", cls: "bg-danger-soft text-danger", dot: "bg-danger", ring: "ring-danger" },
};

export function incidentIcon(kind: Incident["kind"]) {
  switch (kind) {
    case "weather":
      return CloudRainIcon;
    case "flight_delay":
      return AirplaneTiltIcon;
    case "vendor_unavailable":
      return StorefrontIcon;
    case "closure":
      return ProhibitIcon;
    case "crowd_report":
      return UsersIcon;
    case "health":
      return HeartbeatIcon;
    default:
      return WarningIcon;
  }
}

interface Node {
  impact: ImpactItem;
  item: TripItem;
  children: Node[];
}

/** Change Impact Map: root cause → affected items, following dependency links. */
export function ImpactMap({ trip, incident, impact, animate = true, compact }: { trip: Trip; incident: Incident; impact: ImpactSummary; animate?: boolean; compact?: boolean }) {
  const [showSafe, setShowSafe] = useState(false);
  const byId = new Map(trip.items.map((i) => [i.id, i]));
  const affected = impact.items.filter((i) => i.level !== "safe" && byId.has(i.itemId));
  const safe = impact.items.filter((i) => i.level === "safe" && byId.has(i.itemId));
  const nodes = new Map<string, Node>(affected.map((i) => [i.itemId, { impact: i, item: byId.get(i.itemId)!, children: [] }]));
  const roots: Node[] = [];
  for (const n of nodes.values()) {
    const parent = n.impact.causeId ? nodes.get(n.impact.causeId) : undefined;
    if (parent && parent !== n) parent.children.push(n);
    else roots.push(n);
  }
  const Icon = incidentIcon(incident.kind);
  const counts = (["cannot_happen", "at_risk", "moves", "safe"] as ImpactLevel[]).map((l) => [l, impact.items.filter((i) => i.level === l).length] as const);
  let seq = 0;

  const renderNode = (n: Node, depth: number) => {
    const idx = seq++;
    const lvl = LEVEL[n.impact.level];
    return (
      <li key={n.item.id} className="relative">
        <motion.div
          initial={animate ? { opacity: 0, x: -14 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: animate ? 0.35 + idx * 0.28 : 0, type: "spring", stiffness: 260, damping: 24 }}
          className={cn("relative flex items-center gap-3 rounded-2xl bg-white p-2.5 pr-3 shadow-clay-sm ring-2", lvl.ring)}
        >
          <ArtTile icon={n.item.icon} tone={n.item.tone} size={compact ? 34 : 40} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-bold">
              {n.item.title}
              {n.item.hearted && <HeartIcon size={13} weight="fill" className="shrink-0 text-coral" aria-label="Must-Do" />}
            </p>
            <p className="truncate text-[11px] text-muted">
              {minToTime(n.item.startMin)}
              {n.impact.newStartMin != null && n.impact.newStartMin !== n.item.startMin ? ` → ${minToTime(n.impact.newStartMin)}` : ""} · {n.impact.reason}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold", lvl.cls)}>{lvl.label}</span>
            {n.impact.costAtRisk > 0 && <p className="mt-0.5 text-[10px] font-semibold text-danger">{rupees(n.impact.costAtRisk)} at risk</p>}
          </div>
        </motion.div>
        {n.children.length > 0 && <ul className="ml-6 mt-2 space-y-2 border-l-2 border-dashed border-ink/20 pl-4">{n.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div>
      {!compact && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [CurrencyInrIcon, "Money at risk", rupees(impact.moneyAtRisk)],
            [ClockIcon, "Time affected", duration(impact.minutesLost)],
            [HeartIcon, "Must-Dos at risk", String(impact.heartsAtRisk)],
            [StorefrontIcon, "Vendors to ask", String(impact.vendorsTouched.length)],
          ].map(([I, k, v]) => {
            const C = I as typeof ClockIcon;
            return (
              <div key={k as string} className="rounded-2xl bg-white p-3 shadow-clay-sm">
                <C size={16} weight="duotone" className="text-purple" />
                <p className="mt-1 font-display text-lg font-extrabold">{v as string}</p>
                <p className="text-[11px] text-muted">{k as string}</p>
              </div>
            );
          })}
        </div>
      )}
      <motion.div initial={animate ? { opacity: 0, scale: 0.95 } : false} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-sky px-3 py-2 shadow-pop">
        <Icon size={20} weight="duotone" />
        <span className="text-sm font-extrabold">{incident.title}</span>
        <span className="text-xs font-semibold text-ink-soft">· Day {incident.day}</span>
      </motion.div>
      <ul className="ml-4 mt-2 space-y-2 border-l-2 border-ink/25 pl-4 pt-2">{roots.map((r) => renderNode(r, 0))}</ul>
      {safe.length > 0 && (
        <div className="ml-4 mt-2 border-l-2 border-ink/10 pl-4 pt-1">
          <button onClick={() => setShowSafe(!showSafe)} className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success">
            {safe.length} item{safe.length > 1 ? "s" : ""} safe <CaretDownIcon size={12} className={cn("transition", showSafe && "rotate-180")} />
          </button>
          {showSafe && (
            <ul className="mt-2 space-y-1.5">
              {safe.map((s) => {
                const it = byId.get(s.itemId)!;
                return (
                  <li key={s.itemId} className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="font-semibold">{minToTime(it.startMin)}</span> {it.title}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {counts.map(([l, c]) => (
          <span key={l} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold", LEVEL[l].cls)}>
            <span className={cn("h-2 w-2 rounded-full", LEVEL[l].dot)} />
            {LEVEL[l].label} · {c}
          </span>
        ))}
      </div>
    </div>
  );
}
