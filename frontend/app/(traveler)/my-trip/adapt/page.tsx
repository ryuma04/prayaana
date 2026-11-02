"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ShieldCheckIcon, CheckCircleIcon, ArrowRightIcon, RobotIcon, SparkleIcon } from "@phosphor-icons/react";
import { useShallow } from "zustand/react/shallow";
import { useActiveTrip } from "@/stores/tripStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { useAgentStore } from "@/stores/agentStore";
import { useTravelerStore } from "@/stores/travelerStore";
import { getImpactAndPlans } from "@/lib/api/incidents";
import { startAgentRun } from "@/lib/api/agent";
import { errorMessage } from "@/lib/api/client";
import { toast } from "@/stores/notificationStore";
import { runSafetyChecks } from "@/lib/engine/fixes";
import { ImpactMap } from "@/components/adapt/ImpactMap";
import { FixPlanCard } from "@/components/adapt/FixPlanCard";
import { SwapOptions } from "@/components/adapt/SwapOptions";
import { AgentTimeline, VendorBoard } from "@/components/adapt/AgentTimeline";
import { ReceiptCard } from "@/components/traveler/TripBits";
import { DayCard } from "@/components/traveler/Itinerary";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/primitives";
import { Confetti } from "@/components/ui/Confetti";
import { Zippy } from "@/components/art/Zippy";
import { cn, rupees } from "@/lib/format";
import type { FixStrategy, SwapCandidate } from "@/types";

export default function AdaptPage() {
  const trip = useActiveTrip();
  const incidents = useIncidentStore(useShallow((s) => s.incidents.filter((i) => i.tripId === trip?.id)));
  const incident = incidents.find((i) => i.status !== "resolved") ?? incidents.find((i) => i.status === "resolved" && i.receiptId);
  const run = useAgentStore((s) => (incident?.agentRunId ? s.runs[incident.agentRunId] : undefined));
  const autoLimit = useTravelerStore((s) => s.autoApproveLimit);
  const [picked, setPicked] = useState<FixStrategy | null>(null);
  const [approving, setApproving] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);

  const open = incident && incident.status !== "resolved" && !run;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["impact", incident?.id, incident?.status],
    queryFn: () => getImpactAndPlans(incident!.id),
    enabled: !!open,
  });
  const selected = data?.plans.find((p) => p.strategy === (picked ?? data.plans.find((x) => x.recommended)?.strategy));
  const checks = useMemo(() => (data && selected ? runSafetyChecks(data.trip, selected) : []), [data, selected]);

  if (!trip) return <div className="py-10"><EmptyState title="No trip to adapt" body="Book a trip first, then disruptions get fixed here." action={<Button href="/onboarding">Plan a trip</Button>} /></div>;

  const approve = async () => {
    if (!incident || !selected) return;
    setApproving(true);
    try {
      await startAgentRun(incident.id, { scope: "traveler", strategy: selected.strategy });
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e) });
    } finally {
      setApproving(false);
    }
  };

  // A swap goes through the same agent: safety checks → every vendor says yes → commit (or undo).
  const applySwap = async (c: SwapCandidate) => {
    if (!incident) return;
    setSwapping(c.id);
    try {
      await startAgentRun(incident.id, { scope: "traveler", planId: c.id });
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e) });
    } finally {
      setSwapping(null);
    }
  };

  // ── No disruption ──
  if (!incident) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        <div className="flex flex-col items-center rounded-[36px] bg-mint-soft p-8 text-center">
          <Zippy mood="happy" size={110} />
          <h1 className="mt-4 text-2xl font-extrabold">Everything&apos;s on track</h1>
          <p className="mt-2 max-w-md text-sm text-ink-soft">We watch weather, flights, vendors and crowd reports for {trip.title}. If anything changes, you&apos;ll see what&apos;s affected and your options right here.</p>
        </div>
      </div>
    );
  }

  const resolved = incident.status === "resolved";
  const receipt = trip.receipts.find((r) => r.id === incident.receiptId);

  return (
    <div className="space-y-6 pb-10">
      {resolved && <Confetti count={50} />}
      <div className={cn("flex flex-wrap items-center gap-4 rounded-[30px] border-2 border-ink p-5 shadow-pop-lg", resolved ? "bg-mint" : "bg-sky")}>
        <Zippy mood={resolved ? "celebrate" : run ? "thinking" : "worried"} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider">{resolved ? "Fixed" : run ? "Fixing your trip" : "Heads up"}</p>
          <h1 className="font-display text-2xl font-extrabold">{resolved ? "Your plan just fixed itself ✅" : `${incident.title} · Day ${incident.day}`}</h1>
          <p className="text-sm text-ink-soft">{resolved ? run?.summary ?? receipt?.reason : incident.detail}</p>
        </div>
      </div>

      {open && (
        <>
          {isLoading ? (
            <Card pad="lg" className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-lavender border-t-purple" /> Analyzing disruption…
              </p>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </Card>
          ) : error || !data ? (
            <ErrorState title="Couldn't analyze the disruption" error={error} onRetry={() => refetch()} />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
              <Card pad="lg">
                <SectionTitle title="Change Impact Map" kicker="What this change affects" />
                <ImpactMap trip={data.trip} incident={data.incident} impact={data.impact} />
              </Card>
              <div className="space-y-4">
                <SectionTitle title="3 ways to fix it" kicker="Pick one, we'll ask every vendor" />
                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3" role="radiogroup" aria-label="Fix plans">
                  {data.plans.map((p, i) => (
                    <FixPlanCard key={p.id} plan={p} index={i} selected={selected?.id === p.id} onSelect={() => setPicked(p.strategy)} />
                  ))}
                </div>
                {selected && (
                  <Card pad="md">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <ShieldCheckIcon size={18} weight="duotone" className="text-success" /> {checks.filter((c) => c.passed).length}/{checks.length} safety checks passed
                    </p>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {checks.map((c) => (
                        <p key={c.id} className={cn("flex items-center gap-1.5 text-xs", c.passed ? "text-ink-soft" : "text-danger")}>
                          <CheckCircleIcon size={14} weight="fill" className={c.passed ? "text-success" : "text-danger"} /> {c.label}
                          <span className="ml-auto font-mono text-[10px] text-muted">{c.engine === "jev" ? "meaning check" : "code rule"}</span>
                        </p>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button size="lg" onClick={approve} loading={approving} icon={<ArrowRightIcon size={18} weight="bold" />}>
                        Approve {selected.title}
                      </Button>
                      <p className="text-xs text-muted">
                        {selected.costDelta <= autoLimit ? `Inside your ${rupees(autoLimit)} auto-approve limit.` : `Above your ${rupees(autoLimit)} limit, you're approving it manually.`} Applied only when every vendor says yes.
                      </p>
                    </div>
                  </Card>
                )}
              </div>
              {data.swaps && (
                <div className="xl:col-span-2">
                  <SwapOptions swaps={data.swaps} onApply={applySwap} busyId={swapping} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {run && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <AgentTimeline runId={run.id} compact />
            {run.impact && !resolved && (
              <Card pad="md">
                <SectionTitle title="Impact" />
                <ImpactMap trip={trip} incident={incident} impact={run.impact} animate={false} compact />
              </Card>
            )}
          </div>
          <div className="space-y-4">
            <SectionTitle title="Vendor confirmations" kicker="Nothing changes until everyone says yes" />
            <VendorBoard runId={run.id} allowReply={false} />
            <AnimatePresence>
              {receipt && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <ReceiptCard r={receipt} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {resolved && (
        <section>
          <SectionTitle title="Your updated day" kicker={`Day ${incident.day}`} action={<Button size="sm" variant="secondary" href={`/my-trip/${trip.id}`}>Full itinerary</Button>} />
          <DayCard trip={trip} day={incident.day} readOnly />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/my-trip/live" icon={<SparkleIcon size={16} weight="fill" />}>
              Back to live trip
            </Button>
            <Button variant="outline" onClick={() => useIncidentStore.getState().update(incident.id, { receiptId: undefined })} icon={<RobotIcon size={16} weight="bold" />}>
              Done
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
