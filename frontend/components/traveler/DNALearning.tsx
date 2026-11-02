"use client";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, BrainIcon } from "@phosphor-icons/react";
import { getDNAHistory, getProfile, getRecommendations } from "@/lib/api/profile";
import { useTravelerStore } from "@/stores/travelerStore";
import { Card, SectionTitle } from "@/components/ui/Card";
import { cn, timeAgo } from "@/lib/format";
import type { DNAChange } from "@/types";

const LABEL: Record<DNAChange["dimension"], string> = {
  adventure: "Adventure", nature: "Nature", culture: "Culture", food: "Food", luxury: "Comfort", social: "Social", pace: "Pace",
};
const PACE = ["Relaxed", "Balanced", "Packed"];

type Step = { key: string; what: string; at: string; changes: DNAChange[] };

/** One learning step per thing the traveler did, with the traits it moved. */
function group(history: DNAChange[]): Step[] {
  const out: Step[] = [];
  for (const c of history) {
    const key = c.eventId || c.id;
    const what = c.reason.replace(/^[+-]\d+\s*/, "");
    const last = out[out.length - 1];
    if (last && last.key === key) last.changes.push(c);
    else out.push({ key, what: what.charAt(0).toUpperCase() + what.slice(1), at: c.createdAt, changes: [c] });
  }
  return out;
}

function Delta({ c }: { c: DNAChange }) {
  const up = c.new > c.old;
  const text = c.dimension === "pace" ? `${PACE[c.old] ?? c.old} to ${PACE[c.new] ?? c.new}` : `${Math.abs(c.new - c.old)}`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", up ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      {up ? <ArrowUpIcon size={10} weight="bold" /> : <ArrowDownIcon size={10} weight="bold" />}
      {LABEL[c.dimension]} {text}
    </span>
  );
}

/** How the Travel DNA has learned from trips, and picks that follow the current DNA. */
export function DNALearning({ tripId, destinationId }: { tripId?: string; destinationId?: string }) {
  const setDNA = useTravelerStore((s) => s.setDNA);
  // The server owns the DNA and changes it as the traveler behaves; refresh the local copy.
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile, staleTime: 15_000 });
  useEffect(() => {
    if (profile.data?.dna) setDNA(profile.data.dna);
  }, [profile.data, setDNA]);
  const history = useQuery({ queryKey: ["dna-history"], queryFn: getDNAHistory, staleTime: 15_000 });
  const recs = useQuery({
    queryKey: ["dna-recs", tripId, destinationId],
    queryFn: () => getRecommendations({ tripId, destinationId }),
    enabled: !!(tripId || destinationId) && !!profile.data?.dna,
    staleTime: 60_000,
  });
  const steps = useMemo(() => group(history.data ?? []).slice(0, 8), [history.data]);
  const net = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of history.data ?? []) if (c.dimension !== "pace") m.set(c.dimension, (m.get(c.dimension) ?? 0) + c.new - c.old);
    return [...m.entries()].filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [history.data]);

  return (
    <>
      <section>
        <SectionTitle title="Your DNA is learning" />
        <Card pad="md">
          {history.isLoading ? (
            <p className="text-sm text-muted">Loading</p>
          ) : steps.length === 0 ? (
            <div className="flex items-center gap-3">
              <BrainIcon size={28} weight="duotone" className="shrink-0 text-purple-deep" />
              <p className="text-sm text-ink-soft">Heart, remove or swap experiences and rate your trips. Your Travel DNA adjusts a little each time.</p>
            </div>
          ) : (
            <>
              {net.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2 border-b border-line pb-3">
                  {net.map(([d, v]) => (
                    <span key={d} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", v > 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                      {v > 0 ? <ArrowUpIcon size={12} weight="bold" /> : <ArrowDownIcon size={12} weight="bold" />}
                      {LABEL[d as DNAChange["dimension"]]} {Math.abs(v)}
                    </span>
                  ))}
                </div>
              )}
              <ul className="space-y-3">
                {steps.map((s) => (
                  <li key={s.key} className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{s.what}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {s.changes.map((c) => (
                          <Delta key={c.id} c={c} />
                        ))}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(s.at)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>
      {(tripId || destinationId) && profile.data?.dna && (recs.data?.items.length ?? 0) > 0 && (
        <section>
          <SectionTitle title="Picked for you" />
          <div className="grid gap-3 sm:grid-cols-2">
            {(recs.data?.items ?? []).slice(0, 6).map((r) => (
              <Card key={r.activity.id} pad="md">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold leading-tight">{r.activity.title}</p>
                  <span className="shrink-0 rounded-full bg-lavender-soft px-2 py-0.5 text-[11px] font-bold text-purple-deep">{r.fit}%</span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">{r.because}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
