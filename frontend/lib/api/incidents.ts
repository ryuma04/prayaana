"use client";
import type { AgentRun, DestinationId, FixPlan, FixStrategy, ImpactLevel, ImpactSummary, Incident, IncidentKind, SwapReport, Trip } from "@/types";
import { useIncidentStore } from "@/stores/incidentStore";
import { useTripStore } from "@/stores/tripStore";
import { useAgentStore } from "@/stores/agentStore";
import { get, post } from "./client";
import { getTrip } from "./trips";
import { analyzeImpact } from "@/lib/engine/impact";
import { makeFixPlans } from "@/lib/engine/fixes";

export interface CreateIncidentOptions {
  day?: number;
  title?: string;
  detail?: string;
  severity?: Incident["severity"];
  source?: Incident["source"];
  delayMin?: number;
  vendorId?: string;
  place?: string;
}

/**
 * POST /trips/{id}/incidents. The server picks the day, title and severity when they are
 * left out, and notifies the operator and traveler over the live connection.
 */
export async function createIncident(tripId: string, kind: IncidentKind, opts: CreateIncidentOptions = {}) {
  const incident = await post<Incident>(`/trips/${encodeURIComponent(tripId)}/incidents`, { kind, ...opts });
  useIncidentStore.getState().upsert(incident);
  // Weather problems also mark the day as rainy on the trip.
  if (kind === "weather") void getTrip(tripId).catch(() => undefined);
  return incident;
}

export interface IncidentDetail {
  incident: Incident;
  trip: Trip;
  impact: ImpactSummary;
  plans: FixPlan[];
  /** Validated day / route / activity swaps; applied by starting the agent with their id as planId. */
  swaps?: SwapReport;
  run?: AgentRun;
}

/** GET /incidents/{id}: the Change Impact Map and the 3 fix plans, computed on the latest trip. */
export async function getImpactAndPlans(incidentId: string) {
  try {
    const res = await get<IncidentDetail>(`/incidents/${encodeURIComponent(incidentId)}`);
    useIncidentStore.getState().upsert(res.incident);
    useTripStore.getState().upsert(res.trip);
    if (res.run) useAgentStore.getState().putRun(res.run);
    return res;
  } catch (err) {
    const inc = useIncidentStore.getState().incidents.find((x) => x.id === incidentId);
    if (inc) {
      const trip = useTripStore.getState().trips[inc.tripId];
      if (trip) {
        const impact = analyzeImpact(trip, inc);
        const plans = makeFixPlans(trip, inc, impact);
        return { incident: inc, trip, impact, plans };
      }
    }
    throw err;
  }
}

export async function listIncidents() {
  const list = await get<Incident[]>("/ops/incidents");
  useIncidentStore.getState().setAll(list);
  return list;
}

// What-If simulator (never touches real data unless "Fix all" is pressed).

export interface Scenario {
  id: string;
  title: string;
  question: string;
  destinationId: DestinationId;
  kind: IncidentKind;
  emoji: string;
  when: "tomorrow" | "today";
  place?: string;
  vendorId?: string;
  delayMin?: number;
}

export interface WhatIfLevels {
  safe: number;
  moves: number;
  atRisk: number;
  cannotHappen: number;
}

/** One plan item on the simulated Change Impact Map. */
export interface WhatIfItem {
  itemId: string;
  title: string;
  day: number;
  startMin: number;
  level: ImpactLevel;
  reason: string;
  costAtRisk: number;
}

export interface WhatIfTour {
  trip: Trip;
  day: number;
  affectedItems: number;
  moneyAtRisk: number;
  travelers: number;
  autoFixable: boolean;
  bestPlan: string;
  levels?: WhatIfLevels;
  minutesLost?: number;
  heartsAtRisk?: number;
  bestStrategy?: FixStrategy;
  fixCost?: number;
  fixTimeMin?: number;
  items?: WhatIfItem[];
}

export interface WhatIfResult {
  scenario: Scenario;
  tours: WhatIfTour[];
  totals: { tours: number; travelers: number; moneyAtRisk: number; activities: number; autoFixable: number; levels?: WhatIfLevels; minutesLost?: number; fixCost?: number };
}

/** The AI's reading of a What-If result (rules when the AI service is off). Advice only. */
export interface WhatIfInsight {
  headline: string;
  summary: string;
  consequences: string[];
  recommendation: { action: "fix_all" | "fix_some" | "monitor" | "no_action"; reason: string };
  priorities: { trip_code: string; reason: string }[];
  engine: string;
  confidence: number;
  source: "ai-service" | "rules";
}

export interface LaunchedFix {
  tripId: string;
  tripCode: string;
  incidentId: string;
  runId: string;
}

/** Presets are sent by id; a scenario built in the console is sent whole. */
const scenarioBody = (s: Scenario) => (s.id.startsWith("custom") ? { scenario: s } : { scenarioId: s.id });

export const listScenarios = () => get<Scenario[]>("/ops/scenarios");
export const runWhatIf = (s: Scenario) => post<WhatIfResult>("/ops/simulate", scenarioBody(s));
export const fixAllWithAgent = (s: Scenario) => post<LaunchedFix[]>("/ops/simulate/fix", scenarioBody(s));
export const whatIfInsight = (s: Scenario) => post<WhatIfInsight>("/ops/simulate/insight", scenarioBody(s));

/** Closes a problem the operator handled by hand. */
export async function resolveIncident(id: string) {
  const inc = await post<Incident>(`/ops/incidents/${encodeURIComponent(id)}/resolve`);
  useIncidentStore.getState().upsert(inc);
  return inc;
}
