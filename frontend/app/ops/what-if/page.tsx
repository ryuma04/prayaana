"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CaretDownIcon,
  ClockIcon,
  CurrencyInrIcon,
  FlaskIcon,
  MapTrifoldIcon,
  PlayIcon,
  RobotIcon,
  ShieldCheckIcon,
  SparkleIcon,
  UsersThreeIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import type { ImpactLevel, IncidentKind } from "@/types";
import { fixAllWithAgent, listScenarios, runWhatIf, whatIfInsight, type LaunchedFix, type Scenario, type WhatIfInsight, type WhatIfResult, type WhatIfTour } from "@/lib/api/incidents";
import { errorMessage } from "@/lib/api/client";
import { toast } from "@/stores/notificationStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { PageHead, Panel, StatCard, FilterPill } from "@/components/ops/opsKit";
import { LEVEL, incidentIcon } from "@/components/adapt/ImpactMap";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { destinations, destinationMap } from "@/data/destinations";
import { vendors } from "@/data/vendors";
import { activities } from "@/data/catalog";
import { cn, dayDate, duration, minToTime, rupees } from "@/lib/format";

type Kind = Extract<IncidentKind, "weather" | "closure" | "flight_delay" | "vendor_unavailable">;

const KINDS: { kind: Kind; label: string; emoji: string }[] = [
  { kind: "weather", label: "Heavy rain / storm", emoji: "🌧" },
  { kind: "closure", label: "Place closed", emoji: "🚧" },
  { kind: "flight_delay", label: "Flights delayed", emoji: "✈" },
  { kind: "vendor_unavailable", label: "Vendor unavailable", emoji: "🚕" },
];

const LEVELS: ImpactLevel[] = ["cannot_happen", "at_risk", "moves", "safe"];

const REC_LABEL: Record<WhatIfInsight["recommendation"]["action"], string> = {
  fix_all: "Fix all with the agent",
  fix_some: "Fix the trips inside the rules, review the rest",
  monitor: "Watch and review before fixing",
  no_action: "No action needed",
};

interface Draft {
  destinationId: string;
  kind: Kind;
  when: "today" | "tomorrow";
  place: string;
  vendorId: string;
  delayHours: number;
}

const emptyDraft = (destinationId = destinations[0]?.id ?? ""): Draft => ({ destinationId, kind: "weather", when: "tomorrow", place: "", vendorId: "", delayHours: 3 });

/** Builds the custom scenario the backend validates (POST /ops/simulate with { scenario }). */
function toScenario(d: Draft): Scenario {
  const name = destinationMap[d.destinationId]?.name ?? d.destinationId;
  const vendor = vendors.find((v) => v.id === d.vendorId);
  const k = KINDS.find((x) => x.kind === d.kind)!;
  const title =
    d.kind === "weather" ? `Heavy rain in ${name}` : d.kind === "closure" ? `${d.place || "Place"} closed` : d.kind === "flight_delay" ? `${name} flights ${d.delayHours}h late` : `${vendor?.name ?? "Vendor"} unavailable`;
  return {
    id: "custom",
    title: title.slice(0, 80),
    question: `What if ${title.charAt(0).toLowerCase()}${title.slice(1)} ${d.when}?`.slice(0, 160),
    destinationId: d.destinationId,
    kind: d.kind,
    emoji: k.emoji,
    when: d.when,
    place: d.kind === "closure" ? d.place.trim() : undefined,
    vendorId: d.kind === "vendor_unavailable" ? d.vendorId : undefined,
    delayMin: d.kind === "flight_delay" ? Math.round(d.delayHours * 60) : undefined,
  };
}

function draftProblem(d: Draft): string | null {
  if (!d.destinationId) return "Pick a destination.";
  if (d.kind === "closure" && !d.place.trim()) return "Name the place that closes.";
  if (d.kind === "vendor_unavailable" && !d.vendorId) return "Pick the vendor.";
  if (d.kind === "flight_delay" && (d.delayHours < 0.25 || d.delayHours > 24)) return "Delay must be between 15 minutes and 24 hours.";
  return null;
}

function WhatIfInner() {
  const params = useSearchParams();
  const scenarios = useQuery({ queryKey: ["ops-scenarios"], queryFn: listScenarios });
  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [preset, setPreset] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [ran, setRan] = useState<Scenario | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [insight, setInsight] = useState<{ loading: boolean; data?: WhatIfInsight; failed?: boolean }>({ loading: false });
  const [confirmFix, setConfirmFix] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [launched, setLaunched] = useState<LaunchedFix[] | null>(null);
  const wx = useWeatherStore((s) => s.byDest);
  const seq = useRef(0);

  const run = async (s: Scenario) => {
    const id = ++seq.current;
    setRan(s);
    setLoading(true);
    setError(null);
    setResult(null);
    setLaunched(null);
    setConfirmFix(false);
    setInsight({ loading: true });
    try {
      const res = await runWhatIf(s);
      if (id !== seq.current) return;
      setResult(res);
      // The explanation is extra: the result above is complete without it.
      whatIfInsight(s)
        .then((data) => id === seq.current && setInsight({ loading: false, data }))
        .catch(() => id === seq.current && setInsight({ loading: false, failed: true }));
    } catch (e) {
      if (id !== seq.current) return;
      setError(e);
      setInsight({ loading: false });
    } finally {
      if (id === seq.current) setLoading(false);
    }
  };

  // Links from the AI assistant ("Open in the What-If simulator") arrive with the scenario in the URL.
  const fromLink = useRef(false);
  useEffect(() => {
    if (fromLink.current || !params.get("destination")) return;
    fromLink.current = true;
    const kind = (KINDS.find((k) => k.kind === params.get("kind"))?.kind ?? "weather") as Kind;
    const d: Draft = {
      destinationId: params.get("destination") ?? "",
      kind,
      when: params.get("when") === "today" ? "today" : "tomorrow",
      place: params.get("place") ?? "",
      vendorId: params.get("vendor") ?? "",
      delayHours: Number(params.get("delay") ?? 180) / 60 || 3,
    };
    setMode("custom");
    setDraft(d);
    if (!draftProblem(d)) void run(toScenario(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const reset = () => {
    seq.current++;
    setRan(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setInsight({ loading: false });
    setLaunched(null);
    setConfirmFix(false);
    setPreset(null);
    setDraft(emptyDraft(draft.destinationId));
  };

  const fixAll = async () => {
    if (!ran || !result) return;
    if (!confirmFix) return setConfirmFix(true);
    setFixing(true);
    try {
      const list = await fixAllWithAgent(ran);
      setLaunched(list);
      toast({ tone: "agent", title: `Trip Fixer started on ${list.length} trip${list.length === 1 ? "" : "s"}`, body: "Every change waits for every vendor's yes." });
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e) });
    } finally {
      setFixing(false);
      setConfirmFix(false);
    }
  };

  const problem = draftProblem(draft);
  const destVendors = useMemo(() => vendors.filter((v) => v.destinationId === draft.destinationId), [draft.destinationId]);
  const destPlaces = useMemo(() => [...new Set(activities.filter((a) => a.destinationId === draft.destinationId).map((a) => a.title))], [draft.destinationId]);

  return (
    <div>
      <PageHead
        title="What-If simulator"
        sub="Try a disruption on a copy of every booked and live trip. Nothing real changes until you press Fix all."
        actions={
          ran ? (
            <Button size="sm" variant="secondary" onClick={reset} icon={<ArrowCounterClockwiseIcon size={14} />}>
              Reset
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Panel title="Scenario">
            <div className="mb-4 flex gap-2" role="group" aria-label="Scenario source">
              <FilterPill active={mode === "presets"} onClick={() => setMode("presets")}>
                Ready-made
              </FilterPill>
              <FilterPill active={mode === "custom"} onClick={() => setMode("custom")}>
                Build your own
              </FilterPill>
            </div>

            {mode === "presets" ? (
              scenarios.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : scenarios.error ? (
                <ErrorState title="Couldn't load scenarios" error={scenarios.error} onRetry={() => scenarios.refetch()} />
              ) : !scenarios.data?.length ? (
                <EmptyState compact title="No ready-made scenarios" body="Build your own instead." />
              ) : (
                <>
                  {(() => {
                    const activeDestId = scenarios.data?.find((s) => s.id === preset)?.destinationId ?? "manali";
                    const activeDays = Object.values(wx[activeDestId] ?? {});
                    const liveWx = activeDays[0];
                    const tomorrowWx = activeDays[1];
                    if (!liveWx) return null;
                    return (
                      <div className="mb-3 rounded-2xl border-2 border-line bg-canvas p-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                            </span>
                            Live Open-Meteo Radar · {destinationMap[activeDestId]?.name ?? activeDestId}
                          </span>
                          <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-bold text-mint-deep uppercase">
                            Live Feed
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black">{liveWx.tempC}°C</span>
                            <span className="text-xs font-semibold capitalize text-ink-soft">{liveWx.condition}</span>
                          </div>
                          <span className="text-xs font-medium text-muted">
                            Rain: <b className={(liveWx.rainChance ?? 0) > 70 ? "text-danger" : "text-ink"}>{liveWx.rainChance}%</b>
                            {tomorrowWx ? ` · Tomorrow: ${tomorrowWx.rainChance}%` : ""}
                          </span>
                        </div>
                        {(liveWx.rainChance > 50 || (tomorrowWx?.rainChance ?? 0) > 50) && (
                          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-danger-soft/60 px-2.5 py-1.5 text-[11px] font-semibold text-danger">
                            <span>⚠️ Open-Meteo Alert: High precipitation risk detected!</span>
                            <button
                              type="button"
                              onClick={() => {
                                const target = scenarios.data?.find((x) => x.destinationId === activeDestId && x.kind === "weather");
                                if (target) {
                                  setPreset(target.id);
                                  void run(target);
                                }
                              }}
                              className="shrink-0 rounded-lg bg-danger px-2 py-0.5 text-[10px] font-bold text-white transition hover:bg-danger/90"
                            >
                              Simulate Alert
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <ul className="space-y-2" role="radiogroup" aria-label="Ready-made scenarios">
                  {scenarios.data.map((s) => (
                    <li key={s.id}>
                      <button
                        role="radio"
                        aria-checked={preset === s.id}
                        onClick={() => setPreset(s.id)}
                        className={cn("flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition", preset === s.id ? "border-purple bg-lavender-soft/60" : "border-transparent bg-canvas hover:border-line")}
                      >
                        <span className="text-xl" aria-hidden>
                          {s.emoji}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{s.title}</span>
                          <span className="block text-xs text-muted">{s.question}</span>
                          <span className="mt-1 block text-[11px] font-semibold text-ink-soft">
                            {destinationMap[s.destinationId]?.name ?? s.destinationId} · {s.when}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
              <div className="space-y-4">
                <Field label="Destination" htmlFor="wi-dest">
                  <Select id="wi-dest" value={draft.destinationId} onChange={(e) => setDraft({ ...draft, destinationId: e.target.value, vendorId: "", place: "" })}>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Disruption" htmlFor="wi-kind">
                  <div id="wi-kind" className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Disruption">
                    {KINDS.map((k) => {
                      const Icon = incidentIcon(k.kind);
                      return (
                        <button
                          key={k.kind}
                          role="radio"
                          aria-checked={draft.kind === k.kind}
                          onClick={() => setDraft({ ...draft, kind: k.kind })}
                          className={cn("flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-xs font-semibold transition", draft.kind === k.kind ? "border-purple bg-lavender-soft/60" : "border-transparent bg-canvas hover:border-line")}
                        >
                          <Icon size={18} weight="duotone" className="shrink-0" /> {k.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="When" htmlFor="wi-when">
                  <div id="wi-when" className="flex gap-2">
                    {(["today", "tomorrow"] as const).map((w) => (
                      <FilterPill key={w} active={draft.when === w} onClick={() => setDraft({ ...draft, when: w })}>
                        {w[0].toUpperCase() + w.slice(1)}
                      </FilterPill>
                    ))}
                  </div>
                </Field>
                {draft.kind === "closure" && (
                  <Field label="Place that closes" htmlFor="wi-place" hint="Matches trip items by place or title.">
                    <Input id="wi-place" list="wi-places" maxLength={80} value={draft.place} placeholder="e.g. Solang" onChange={(e) => setDraft({ ...draft, place: e.target.value })} />
                    <datalist id="wi-places">
                      {destPlaces.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </Field>
                )}
                {draft.kind === "vendor_unavailable" && (
                  <Field label="Vendor" htmlFor="wi-vendor" hint={destVendors.length ? undefined : "No vendors at this destination."}>
                    <Select id="wi-vendor" value={draft.vendorId} onChange={(e) => setDraft({ ...draft, vendorId: e.target.value })}>
                      <option value="">Pick a vendor</option>
                      {destVendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} · {v.kind}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {draft.kind === "flight_delay" && (
                  <Field label={`Delay · ${duration(Math.round(draft.delayHours * 60))}`} htmlFor="wi-delay">
                    <input
                      id="wi-delay"
                      type="range"
                      min={0.5}
                      max={12}
                      step={0.5}
                      value={draft.delayHours}
                      onChange={(e) => setDraft({ ...draft, delayHours: Number(e.target.value) })}
                      className="w-full accent-purple"
                    />
                  </Field>
                )}
                <p className="rounded-xl bg-canvas p-3 text-xs text-ink-soft">
                  <span className="font-semibold">Question:</span> {toScenario(draft).question}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="purple"
                loading={loading}
                disabled={mode === "presets" ? !preset : !!problem}
                onClick={() => {
                  const s = mode === "presets" ? scenarios.data?.find((x) => x.id === preset) : toScenario(draft);
                  if (s) void run(s);
                }}
                icon={<PlayIcon size={16} weight="fill" />}
              >
                Run simulation
              </Button>
              {mode === "custom" && problem && <span className="text-xs text-muted">{problem}</span>}
            </div>
          </Panel>

          <Panel title="How it stays safe">
            <ul className="space-y-1.5 text-xs text-ink-soft">
              {[
                "Runs on in-memory copies; no trip, booking or price changes",
                "Uses the same Change Impact Map and fix plans as the Trip Fixer",
                "Fix all creates real problems and starts the Trip Fixer on each",
                "Every change still needs safety checks and every vendor's yes",
              ].map((g) => (
                <li key={g} className="flex items-start gap-1.5">
                  <ShieldCheckIcon size={13} weight="fill" className="mt-0.5 shrink-0 text-success" /> {g}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-5">
          {!ran ? (
            <EmptyState title="Pick a scenario and run it" body="See which trips break, what it costs and how the Trip Fixer would repair each one." mood="happy" />
          ) : loading ? (
            <Panel title={`Simulating: ${ran.title}`}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <Skeleton className="mt-4 h-40" />
            </Panel>
          ) : error ? (
            <ErrorState title="The simulation didn't run" error={error} onRetry={() => ran && void run(ran)} />
          ) : result ? (
            <Result result={result} insight={insight} confirmFix={confirmFix} fixing={fixing} launched={launched} onFix={fixAll} onCancelFix={() => setConfirmFix(false)} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Result({
  result,
  insight,
  confirmFix,
  fixing,
  launched,
  onFix,
  onCancelFix,
}: {
  result: WhatIfResult;
  insight: { loading: boolean; data?: WhatIfInsight; failed?: boolean };
  confirmFix: boolean;
  fixing: boolean;
  launched: LaunchedFix[] | null;
  onFix: () => void;
  onCancelFix: () => void;
}) {
  const t = result.totals;
  const lv = t.levels;
  const Icon = incidentIcon(result.scenario.kind);
  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger">
            <Icon size={24} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{result.scenario.title}</p>
            <p className="text-xs text-muted">
              {result.scenario.question} · {destinationMap[result.scenario.destinationId]?.name ?? result.scenario.destinationId}
            </p>
          </div>
          <StatusBadge kind="purple" icon={<FlaskIcon size={12} weight="fill" />}>
            Simulation only
          </StatusBadge>
        </div>
        {result.scenario.kind === "weather" && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-sky-soft px-3 py-1.5 text-xs font-semibold text-sky-deep">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-deep"></span>
            </span>
            <span>Verified with real-time Open-Meteo atmospheric radar feed (Open-Meteo.com CC BY 4.0)</span>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Trips affected" value={t.tours} hint={`${t.autoFixable} fixable inside the rules`} icon={<MapTrifoldIcon size={16} weight="duotone" />} alert={t.tours > 0} />
        <StatCard label="Travelers" value={t.travelers} icon={<UsersThreeIcon size={16} weight="duotone" />} tone="bg-sky-soft" delay={0.04} />
        <StatCard label="Money at risk" value={rupees(t.moneyAtRisk)} hint={t.fixCost != null ? `fixes: ${rupees(t.fixCost, { sign: true })}` : undefined} icon={<CurrencyInrIcon size={16} weight="duotone" />} tone="bg-coral-soft" delay={0.08} />
        <StatCard label="Time lost" value={t.minutesLost ? duration(t.minutesLost) : "0 min"} icon={<ClockIcon size={16} weight="duotone" />} tone="bg-sun-soft" delay={0.12} />
      </div>

      {lv && (
        <div className="flex flex-wrap gap-2" aria-label="Plan items by impact">
          {LEVELS.map((l) => (
            <span key={l} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", LEVEL[l].cls)}>
              <span className={cn("h-2 w-2 rounded-full", LEVEL[l].dot)} />
              {LEVEL[l].label} · {l === "safe" ? lv.safe : l === "moves" ? lv.moves : l === "at_risk" ? lv.atRisk : lv.cannotHappen}
            </span>
          ))}
        </div>
      )}

      <InsightPanel insight={insight} />

      {result.tours.length === 0 ? (
        <EmptyState compact title="No trip is affected" body="No booked or live trip depends on this. Nothing to fix." mood="happy" />
      ) : (
        <Panel title={`Affected trips · ${result.tours.length}`}>
          <ul className="space-y-2.5">
            {result.tours.map((tour) => (
              <TourRow key={tour.trip.id} tour={tour} />
            ))}
          </ul>
        </Panel>
      )}

      {result.tours.length > 0 && (
        <Panel>
          {launched ? (
            <div>
              <p className="flex items-center gap-2 font-display font-bold">
                <RobotIcon size={18} weight="fill" className="text-purple" /> Trip Fixer started on {launched.length} trip{launched.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-3 space-y-1.5">
                {launched.map((l) => (
                  <li key={l.incidentId} className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold">{l.tripCode}</span>
                    <Link href={`/ops/incidents/${l.incidentId}`} className="text-purple-deep hover:underline">
                      Problem
                    </Link>
                    <Link href={`/ops/agent?run=${l.runId}`} className="text-purple-deep hover:underline">
                      Live timeline
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={confirmFix ? "danger" : "purple"} size="lg" loading={fixing} onClick={onFix} icon={<WrenchIcon size={18} weight="fill" />}>
                {confirmFix ? `Yes, create ${result.tours.length} real problem${result.tours.length === 1 ? "" : "s"} and fix` : "Fix all with the Trip Fixer"}
              </Button>
              {confirmFix && (
                <Button variant="ghost" onClick={onCancelFix}>
                  Cancel
                </Button>
              )}
              <p className="basis-full text-xs text-muted">
                This raises a real problem on each affected trip, tells the travelers, and starts the Trip Fixer. Nothing is changed until every vendor says yes.
              </p>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

function InsightPanel({ insight }: { insight: { loading: boolean; data?: WhatIfInsight; failed?: boolean } }) {
  if (insight.loading) {
    return (
      <Panel title="AI reading">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="mt-2 h-12" />
      </Panel>
    );
  }
  if (insight.failed || !insight.data) {
    return insight.failed ? <p className="px-1 text-xs text-muted">The AI explanation isn&apos;t available right now; the simulation above is complete.</p> : null;
  }
  const d = insight.data;
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <SparkleIcon size={16} weight="fill" className="text-purple" /> {d.headline}
        </span>
      }
      action={<span className="rounded-lg bg-canvas px-2 py-1 font-mono text-[10px] text-muted">{d.source === "ai-service" ? `AI agent · ${d.engine}` : "rules"}</span>}
    >
      <p className="text-sm text-ink-soft">{d.summary}</p>
      {d.consequences.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {d.consequences.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 rounded-xl bg-lavender-soft/60 p-3 text-sm">
        <p className="font-semibold">Recommended: {REC_LABEL[d.recommendation.action]}</p>
        <p className="text-xs text-ink-soft">{d.recommendation.reason}</p>
      </div>
      {d.priorities.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          <span className="font-semibold text-ink">Look at first:</span> {d.priorities.map((p) => `${p.trip_code} (${p.reason})`).join(" · ")}
        </p>
      )}
    </Panel>
  );
}

function TourRow({ tour }: { tour: WhatIfTour }) {
  const [open, setOpen] = useState(false);
  const items = (tour.items ?? []).slice().sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  return (
    <li className="rounded-[22px] bg-canvas p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/ops/tours/${tour.trip.id}`} className="text-sm font-bold hover:underline">
            {tour.trip.code} · {tour.trip.groupName}
          </Link>
          <p className="text-xs text-muted">
            Day {tour.day} ({dayDate(tour.trip.prefs.startDate, tour.day)}) · {tour.travelers} travelers · {rupees(tour.moneyAtRisk)} at risk
            {tour.minutesLost ? ` · ${duration(tour.minutesLost)} lost` : ""}
          </p>
        </div>
        <StatusBadge kind={tour.autoFixable ? "success" : "warning"}>{tour.autoFixable ? "Agent can fix" : "Needs approval"}</StatusBadge>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-purple-deep">
        <ArrowRightIcon size={12} /> Best fix: {tour.bestPlan}
        {tour.fixTimeMin ? ` · ${tour.fixTimeMin > 0 ? "+" : ""}${duration(Math.abs(tour.fixTimeMin))}` : ""}
      </p>
      {items.length > 0 && (
        <>
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
            <CaretDownIcon size={12} className={cn("transition", open && "rotate-180")} /> {open ? "Hide" : "Show"} {items.length} plan items
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5">
              {items.map((i) => (
                <li key={i.itemId} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 font-bold", LEVEL[i.level].cls)}>{LEVEL[i.level].label}</span>
                  <span className="font-semibold">{i.title}</span>
                  <span className="text-muted">
                    {minToTime(i.startMin)} · {i.reason}
                    {i.costAtRisk ? ` · ${rupees(i.costAtRisk)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

export default function WhatIfPage() {
  return (
    <Suspense fallback={null}>
      <WhatIfInner />
    </Suspense>
  );
}
