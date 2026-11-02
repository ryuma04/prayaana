"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RobotIcon, CheckCircleIcon, HourglassMediumIcon, WarningIcon, XCircleIcon, LightningIcon, WrenchIcon, ShieldCheckIcon, PlayIcon } from "@phosphor-icons/react";
import { useAgentStore } from "@/stores/agentStore";
import { toast } from "@/stores/notificationStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { useTripStore } from "@/stores/tripStore";
import { startAgentRun } from "@/lib/api/agent";
import { errorMessage } from "@/lib/api/client";
import { PageHead, Panel, StatCard, FilterPill } from "@/components/ops/opsKit";
import { AgentTimeline, VendorBoard } from "@/components/adapt/AgentTimeline";
import { incidentIcon } from "@/components/adapt/ImpactMap";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { cn, timeAgo } from "@/lib/format";
import type { AgentRun } from "@/types";

const TOOLS = ["get_trip", "analyze_impact", "make_fix_plans", "run_safety_checks", "ask_vendors", "read_replies", "commit_or_undo", "message_traveler"];

function bucket(r: AgentRun) {
  if (r.status === "running") return "active";
  if (r.status === "waiting") return "waiting";
  if (r.status === "succeeded") return "completed";
  if (r.status === "needs_human") return "human";
  return "failed";
}

function AgentInner() {
  const params = useSearchParams();
  const runs = useAgentStore((s) => s.runs);
  const incidents = useIncidentStore((s) => s.incidents);
  const trips = useTripStore((s) => s.trips);
  const list = useMemo(() => Object.values(runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [runs]);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(params.get("run"));
  const current = runs[selected ?? ""] ?? list[0];
  const counts = { active: 0, waiting: 0, completed: 0, human: 0, failed: 0 } as Record<string, number>;
  list.forEach((r) => (counts[bucket(r)] += 1));
  const open = incidents.filter((i) => i.status !== "resolved" && (!i.agentRunId || !runs[i.agentRunId] || bucket(runs[i.agentRunId]) === "failed" || bucket(runs[i.agentRunId]) === "human"));
  const shown = list.filter((r) => filter === "all" || bucket(r) === filter);

  return (
    <div>
      <PageHead title="Trip Fixer Agent" sub="Finds the impact, builds 3 fix plans, checks them, asks every partner and applies the change only when all say yes. Every step is saved and shown live." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Active tasks" value={counts.active} icon={<LightningIcon size={16} weight="duotone" />} />
        <StatCard label="Waiting for vendors" value={counts.waiting} icon={<HourglassMediumIcon size={16} weight="duotone" />} tone="bg-sun-soft" delay={0.04} />
        <StatCard label="Completed" value={counts.completed} icon={<CheckCircleIcon size={16} weight="duotone" />} tone="bg-mint-soft" delay={0.08} />
        <StatCard label="Needs human approval" value={counts.human} icon={<WarningIcon size={16} weight="duotone" />} tone="bg-coral-soft" delay={0.12} alert={counts.human > 0} />
        <StatCard label="Failed / interrupted" value={counts.failed} icon={<XCircleIcon size={16} weight="duotone" />} tone="bg-danger-soft" delay={0.16} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Panel title="Waiting for the agent">
            {open.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">No open problems.</p>
            ) : (
              <ul className="space-y-2">
                {open.map((i) => {
                  const Icon = incidentIcon(i.kind);
                  const t = trips[i.tripId];
                  return (
                    <li key={i.id} className="flex items-center gap-2 rounded-xl border border-line p-2.5">
                      <Icon size={18} weight="duotone" className="text-danger" />
                      <Link href={`/ops/incidents/${i.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{i.title}</p>
                        <p className="truncate text-[11px] text-muted">{t?.code} · {t?.groupName}</p>
                      </Link>
                      <Button
                        size="sm"
                        variant="purple"
                        onClick={() =>
                          startAgentRun(i.id, {})
                            .then(setSelected)
                            .catch((e) => toast({ tone: "error", title: errorMessage(e) }))
                        }
                        icon={<PlayIcon size={12} weight="fill" />}
                      >
                        Fix
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Runs" pad={false}>
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto p-3">
              {["all", "active", "waiting", "completed", "human", "failed"].map((f) => (
                <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)}>
                  {f === "human" ? "needs human" : f}
                </FilterPill>
              ))}
            </div>
            {shown.length === 0 ? (
              <p className="px-4 pb-6 text-center text-sm text-muted">No runs yet.</p>
            ) : (
              <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {shown.map((r) => {
                  const inc = incidents.find((i) => i.id === r.incidentId);
                  const b = bucket(r);
                  return (
                    <li key={r.id}>
                      <button onClick={() => setSelected(r.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas", current?.id === r.id && "bg-lavender-soft/60")}>
                        <RobotIcon size={18} weight={b === "active" || b === "waiting" ? "fill" : "regular"} className={b === "active" || b === "waiting" ? "text-purple" : "text-muted"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{inc?.title ?? r.incidentId}</p>
                          <p className="truncate text-[11px] text-muted">
                            {trips[r.tripId]?.code} · {r.steps.length} steps · {timeAgo(r.startedAt)} · {r.scope}
                          </p>
                        </div>
                        <StatusBadge kind={b === "completed" ? "success" : b === "human" || b === "failed" ? "danger" : b === "waiting" ? "warning" : "purple"} pulse={b === "active" || b === "waiting"}>
                          {b === "human" ? "human" : b}
                        </StatusBadge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Tools & guardrails">
            <div className="flex flex-wrap gap-1.5">
              {TOOLS.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-canvas px-2 py-1 font-mono text-[11px]">
                  <WrenchIcon size={11} /> {t}
                </span>
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-ink-soft">
              {["≤ 12 steps per problem", "Extra cost under the traveler's auto-approve limit", "No Must-Do lost", "All 10 safety checks pass", "2 failed attempts → human coordinator"].map((g) => (
                <li key={g} className="flex items-center gap-1.5">
                  <ShieldCheckIcon size={13} weight="fill" className="text-success" /> {g}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="space-y-5">
          {current ? (
            <>
              <AgentTimeline runId={current.id} dark />
              <Panel title="Vendor confirmations">
                <VendorBoard runId={current.id} />
              </Panel>
              <Link href={`/ops/incidents/${current.incidentId}`} className="inline-block text-sm font-semibold text-purple-deep hover:underline">
                Open the incident →
              </Link>
            </>
          ) : (
            <EmptyState title="The agent hasn't run yet" body="Open a problem and tap “Let the agent fix it”." mood="sleepy" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentInner />
    </Suspense>
  );
}
