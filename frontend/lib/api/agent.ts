"use client";
import type { AgentRun, FixStrategy, VendorRequest } from "@/types";
import { useAgentStore } from "@/stores/agentStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { get, post } from "./client";

export interface StartOptions {
  scope?: AgentRun["scope"];
  /** Force a plan (the traveler picked one); otherwise the agent chooses inside the traveler's rules. */
  strategy?: FixStrategy;
  /** An adaptive swap the traveler picked (SwapCandidate.id). Route swaps are never applied without this. */
  planId?: string;
  /** "auto" simulates vendor replies; "manual" waits for real answers on /v/{token}. */
  mode?: AgentRun["mode"];
  noDecline?: boolean;
}

/** POST /incidents/{id}/agent: starts the Trip Fixer Agent (or returns the one already running). */
export async function startAgentRun(incidentId: string, opts: StartOptions = {}) {
  const run = await post<AgentRun>(`/incidents/${encodeURIComponent(incidentId)}/agent`, opts);
  useAgentStore.getState().putRun(run);
  useIncidentStore.getState().update(incidentId, { agentRunId: run.id, status: "analyzing" });
  return run.id;
}

export async function getRun(runId: string) {
  const run = await get<AgentRun>(`/agent/runs/${encodeURIComponent(runId)}`);
  useAgentStore.getState().putRun(run);
  return run;
}

export async function getRunRequests(runId: string) {
  const list = await get<VendorRequest[]>(`/agent/runs/${encodeURIComponent(runId)}/requests`);
  useAgentStore.getState().putRequests(list);
  return list;
}

export async function listRuns() {
  const list = await get<AgentRun[]>("/ops/agent/runs");
  useAgentStore.getState().putRuns(list);
  return list;
}

/** The operator takes over: the agent stops and nothing changes without every vendor's yes. */
export async function takeOver(runId: string) {
  const run = await post<AgentRun>(`/ops/agent/runs/${encodeURIComponent(runId)}/takeover`);
  useAgentStore.getState().putRun(run);
  return run;
}
