"use client";
import { useState } from "react";
import { ArrowRightIcon, CalendarIcon, CheckCircleIcon, MapTrifoldIcon, ShuffleIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import type { SwapCandidate, SwapReport, SwapType } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { cn, duration, rupees } from "@/lib/format";

const TABS: { type: SwapType; key: "day" | "route" | "activity"; label: string; Icon: typeof CalendarIcon }[] = [
  { type: "day_swap", key: "day", label: "Day swap", Icon: CalendarIcon },
  { type: "route_swap", key: "route", label: "Route swap", Icon: MapTrifoldIcon },
  { type: "activity_swap", key: "activity", label: "Activity swap", Icon: ShuffleIcon },
];

function signedMin(n: number) {
  return n === 0 ? "No change" : `${n > 0 ? "+" : "−"}${duration(Math.abs(n))}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function SwapCard({ c, busy, onApply, onReject }: { c: SwapCandidate; busy: boolean; onApply: () => void; onReject: () => void }) {
  const [approved, setApproved] = useState(false);
  const x = c.comparison;
  const blocked = c.needsApproval && !approved;
  return (
    <Card pad="md" className="space-y-3">
      <div>
        <p className="font-display text-base font-extrabold leading-tight">{c.title}</p>
        {c.summary && <p className="mt-1 text-xs text-ink-soft">{c.summary}</p>}
      </div>
      <div className="grid gap-2 rounded-2xl bg-cream p-3 text-xs sm:grid-cols-2">
        <p>
          <span className="block font-extrabold uppercase tracking-wider text-muted">Original</span>
          {x.original}
        </p>
        <p>
          <span className="block font-extrabold uppercase tracking-wider text-muted">Proposed</span>
          {x.proposed}
        </p>
      </div>
      <div className="space-y-1">
        <Row label="Price difference" value={x.priceDelta === 0 ? "No change" : rupees(x.priceDelta, { sign: true })} />
        <Row label="Time on those days" value={signedMin(x.timeDeltaMin)} />
        <Row label="Distance" value={x.distanceDeltaKm === 0 ? "No change" : `${x.distanceDeltaKm > 0 ? "+" : ""}${x.distanceDeltaKm} km`} />
        <Row label="Weather" value={x.weatherBefore === x.weatherAfter ? x.weatherAfter : `${x.weatherBefore} → ${x.weatherAfter}`} />
        <Row label="Preference match" value={x.dnaMatchBefore === x.dnaMatchAfter ? `${x.dnaMatchAfter}%` : `${x.dnaMatchBefore}% → ${x.dnaMatchAfter}%`} />
      </div>
      {c.route && (
        <div className="space-y-1 text-xs">
          <p className="text-ink-soft">{c.route.hotel}</p>
          {c.route.dependencies.map((d) => (
            <p key={d} className="text-muted">
              · {d}
            </p>
          ))}
        </div>
      )}
      <ul className="space-y-1 text-xs">
        {c.reasons.map((r) => (
          <li key={r} className="flex gap-1.5">
            <CheckCircleIcon size={14} weight="fill" className="mt-0.5 shrink-0 text-success" /> {r}
          </li>
        ))}
        {x.risks.map((r) => (
          <li key={r} className="flex gap-1.5 text-warning">
            <WarningIcon size={14} weight="fill" className="mt-0.5 shrink-0" /> {r}
          </li>
        ))}
      </ul>
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold">
          {c.hardChecks.filter((h) => h.passed).length}/{c.hardChecks.length} constraints passed · {x.affectedBookings.length} booking changes · {x.affectedVendors.length} vendors to confirm
        </summary>
        <div className="mt-2 space-y-1 text-ink-soft">
          {c.hardChecks.map((h) => (
            <p key={h.id}>✓ {h.label}</p>
          ))}
          {x.affectedBookings.map((b) => (
            <p key={b}>• {b}</p>
          ))}
          {x.affectedVendors.length > 0 && <p>Vendors asked: {x.affectedVendors.join(", ")}</p>}
        </div>
      </details>
      {c.needsApproval && (
        <label className="flex items-start gap-2 rounded-2xl bg-warning-soft p-3 text-xs font-semibold">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-0.5" />
          <span>
            {c.approvalReason} <span className="block font-normal text-ink-soft">Tick to approve the extra cost.</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply} loading={busy} disabled={blocked} icon={<ArrowRightIcon size={14} weight="bold" />}>
          {c.requiresAcceptance ? "Accept route change" : "Use this swap"}
        </Button>
        {c.requiresAcceptance && (
          <Button size="sm" variant="secondary" onClick={onReject} icon={<XIcon size={14} weight="bold" />}>
            Reject
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Adaptive swaps for an incident. Applying one starts the same agent flow as a fix plan. */
export function SwapOptions({ swaps, onApply, busyId }: { swaps: SwapReport; onApply: (c: SwapCandidate) => void; busyId: string | null }) {
  const first = TABS.find((t) => swaps[t.key].length > 0)?.key ?? "day";
  const [tab, setTab] = useState<"day" | "route" | "activity">(first);
  const [rejected, setRejected] = useState<string[]>([]);
  const list = swaps[tab].filter((c) => !rejected.includes(c.id));
  const ruledOut = swaps.rejected.filter((r) => r.type === TABS.find((t) => t.key === tab)!.type);
  return (
    <section className="space-y-3">
      <SectionTitle title="Or rearrange instead" kicker="Adaptive swaps · checked against your real plan" />
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", tab === t.key ? "bg-ink text-white" : "bg-white shadow-clay-sm")}
          >
            <t.Icon size={14} /> {t.label} ({swaps[t.key].length})
          </button>
        ))}
      </div>
      {swaps.dnaSource === "trip-preferences" && <p className="text-xs text-muted">Take the Travel DNA quiz for more personal swaps, ranked by your trip interests for now.</p>}
      {tab === "activity" && swaps.similaritySource === "semantic" && <p className="text-xs text-muted">Similarity read from each experience&apos;s description (AI embeddings).</p>}
      {swaps.notes.map((n) => (
        <p key={n} className="text-xs text-muted">
          {n}
        </p>
      ))}
      {list.length === 0 ? (
        <Card pad="md">
          <p className="text-sm text-ink-soft">No valid {TABS.find((t) => t.key === tab)!.label.toLowerCase()} for this problem.</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((c) => (
            <SwapCard key={c.id} c={c} busy={busyId === c.id} onApply={() => onApply(c)} onReject={() => setRejected((r) => [...r, c.id])} />
          ))}
        </div>
      )}
      {ruledOut.length > 0 && (
        <details className="text-xs text-ink-soft">
          <summary className="cursor-pointer font-semibold">Options we ruled out ({ruledOut.length})</summary>
          <ul className="mt-2 space-y-1">
            {ruledOut.map((r, i) => (
              <li key={i}>
                <span className="font-semibold">{r.label}</span>, {r.reasons.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
