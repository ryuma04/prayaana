"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, RobotIcon, PlayIcon, ShieldCheckIcon, CheckCircleIcon, XCircleIcon, ArrowCounterClockwiseIcon, SparkleIcon } from "@phosphor-icons/react";
import { useIncident } from "@/stores/incidentStore";
import { useTrip } from "@/stores/tripStore";
import { useAgentStore } from "@/stores/agentStore";
import { toast } from "@/stores/notificationStore";
import { getImpactAndPlans, resolveIncident } from "@/lib/api/incidents";
import { startAgentRun, type StartOptions } from "@/lib/api/agent";
import { errorMessage } from "@/lib/api/client";
import { runSafetyChecks } from "@/lib/engine/fixes";
import { PageHead, Panel } from "./opsKit";
import { ImpactMap, incidentIcon } from "@/components/adapt/ImpactMap";
import { FixPlanCard } from "@/components/adapt/FixPlanCard";
import { AgentTimeline, VendorBoard } from "@/components/adapt/AgentTimeline";
import { ReceiptCard } from "@/components/traveler/TripBits";
import { DayCard } from "@/components/traveler/Itinerary";
import { Button } from "@/components/ui/Button";
import { Skeleton, StatusBadge } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { destinationMap } from "@/data/destinations";
import { cn, timeAgo } from "@/lib/format";
import type { FixStrategy } from "@/types";

export function IncidentDetail({ id }: { id: string }) {
  const incident = useIncident(id);
  const trip = useTrip(incident?.tripId);
  const run = useAgentStore((s) => (incident?.agentRunId ? s.runs[incident.agentRunId] : undefined));
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<FixStrategy | null>(null);
  const showAnalysis = !!incident && incident.status !== "resolved" && (!run || run.status === "needs_human" || run.status === "failed");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["impact", id, incident?.status, run?.id], queryFn: () => getImpactAndPlans(id), enabled: showAnalysis });
  const selected = data?.plans.find((p) => p.strategy === (picked ?? data.plans.find((x) => x.recommended)?.strategy));
  const checks = useMemo(() => (data && selected ? runSafetyChecks(data.trip, selected) : []), [data, selected]);

  if (!incident || !trip) return <EmptyState title="Incident not found" action={<Button href="/ops/incidents">Incident center</Button>} />;
  const Icon = incidentIcon(incident.kind);
  const receipt = trip.receipts.find((r) => r.id === incident.receiptId);
  const running = run && (run.status === "running" || run.status === "waiting");
  const act = (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    fn()
      .catch((e) => toast({ tone: "error", title: errorMessage(e) }))
      .finally(() => setBusy(null));
  };
  const fix = (key: string, opts: StartOptions) => act(key, () => startAgentRun(incident.id, { scope: "operator", ...opts }));

  return (
    <div>
      <Link href="/ops/incidents" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon size={14} /> Incident center
      </Link>
      <PageHead
        kicker={`${incident.id.toUpperCase()} · ${incident.source} · ${timeAgo(incident.createdAt)}`}
        title={
          <span className="inline-flex items-center gap-2">
            <Icon size={28} weight="duotone" className="text-danger" /> {incident.title}
          </span>
        }
        sub={
          <>
            {incident.detail} ·{" "}
            <Link href={`/ops/tours/${trip.id}`} className="font-semibold text-purple-deep hover:underline">
              {trip.code} {trip.groupName} ({destinationMap[trip.destinationId]?.name ?? trip.destinationId}, Day {incident.day})
            </Link>
          </>
        }
        actions={
          <>
            <StatusBadge kind={incident.status === "resolved" ? "success" : incident.status === "escalated" ? "danger" : "warning"} pulse={incident.status !== "resolved"}>
              {incident.status.replace("_", " ")}
            </StatusBadge>
            <span className="rounded-lg bg-white px-2 py-1 text-xs font-extrabold shadow-clay-sm">Severity {incident.severity}/5</span>
            <Button size="sm" variant="soft" href={`/ops/assistant?incident=${encodeURIComponent(incident.id)}`} icon={<SparkleIcon size={14} weight="fill" />}>
              Ask AI to explain
            </Button>
          </>
        }
      />

      {showAnalysis && (
        <div className="space-y-5">
          {isLoading ? (
            <Panel title="Analyzing disruption…">
              <div className="space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            </Panel>
          ) : error || !data ? (
            <ErrorState title="Impact analysis failed" error={error} onRetry={() => refetch()} />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
              <Panel title="Change Impact Map">
                <ImpactMap trip={data.trip} incident={data.incident} impact={data.impact} />
              </Panel>
              <div className="space-y-4">
                <Panel title="3 fix plans">
                  <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="Fix plans">
                    {data.plans.map((p, i) => (
                      <FixPlanCard key={p.id} plan={p} index={i} selected={selected?.id === p.id} onSelect={() => setPicked(p.strategy)} />
                    ))}
                  </div>
                </Panel>
                {selected && (
                  <Panel title={`Safety checks · ${checks.filter((c) => c.passed).length}/${checks.length} passed`}>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {checks.map((c) => (
                        <p key={c.id} className="flex items-center gap-1.5 text-xs" title={c.detail}>
                          {c.passed ? <CheckCircleIcon size={15} weight="fill" className="text-success" /> : <XCircleIcon size={15} weight="fill" className="text-danger" />}
                          {c.label}
                          <span className="ml-auto font-mono text-[10px] text-muted">
                            {c.engine} · {c.tookMs}ms
                          </span>
                        </p>
                      ))}
                    </div>
                  </Panel>
                )}
                <Panel>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="lg" variant="purple" onClick={() => fix("agent", {})} loading={busy === "agent"} icon={<RobotIcon size={18} weight="fill" />}>
                      Let the agent fix it
                    </Button>
                    <Button size="lg" variant="outline" disabled={!selected} onClick={() => selected && fix("plan", { strategy: selected.strategy })} loading={busy === "plan"} icon={<PlayIcon size={16} weight="fill" />}>
                      Apply {selected?.title ?? "plan"}
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-canvas p-3 text-xs">
                    <span className="text-muted">Vendors answer on their reply link; you can record an answer after a call in Requests.</span>
                    <span className="flex items-center gap-1 text-muted">
                      <ShieldCheckIcon size={14} /> Agent acts alone only inside the traveler&apos;s rules
                    </span>
                  </div>
                </Panel>
              </div>
            </div>
          )}
          {run && (
            <Panel title="Previous agent attempt">
              <AgentTimeline runId={run.id} compact />
            </Panel>
          )}
        </div>
      )}

      {run && !showAnalysis && (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <AgentTimeline runId={run.id} dark />
            {run.impact && (
              <Panel title="Impact snapshot">
                <ImpactMap trip={trip} incident={incident} impact={run.impact} animate={false} compact />
              </Panel>
            )}
          </div>
          <div className="space-y-5">
            <Panel title="All-or-nothing vendor confirmation" action={running ? <span className="text-[11px] font-semibold text-purple-deep">Open a vendor link in a new tab to answer live</span> : undefined}>
              <VendorBoard runId={run.id} />
            </Panel>
            {receipt && <ReceiptCard r={receipt} />}
            {incident.status === "resolved" && (
              <Panel title={`Updated Day ${incident.day}`}>
                <DayCard trip={trip} day={incident.day} readOnly />
              </Panel>
            )}
          </div>
        </div>
      )}

      {!run && incident.status === "resolved" && (
        <Panel title="Resolved">
          <p className="text-sm text-muted">This incident was handled before the agent timeline was recorded.</p>
          {receipt && <div className="mt-3"><ReceiptCard r={receipt} /></div>}
        </Panel>
      )}

      {incident.status !== "resolved" && !running && (
        <div className="mt-5 flex justify-end">
          <button onClick={() => act("resolve", () => resolveIncident(incident.id))} disabled={busy === "resolve"} className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink")}>
            <ArrowCounterClockwiseIcon size={12} /> Dismiss as resolved manually
          </button>
        </div>
      )}
    </div>
  );
}
