"use client";
import { create } from "zustand";
import type { AgentRun, AgentStep, VendorRequest } from "@/types";

interface AgentState {
  runs: Record<string, AgentRun>;
  /** Vendor requests per token (GET /agent/runs/{id}/requests). */
  requests: Record<string, VendorRequest>;
  putRun: (run: AgentRun) => void;
  putRuns: (runs: AgentRun[]) => void;
  patchRun: (id: string, patch: Partial<AgentRun>) => void;
  /** Insert or update a streamed step (WebSocket `agent.step`). */
  upsertStep: (runId: string, step: AgentStep) => void;
  putRequests: (r: VendorRequest[]) => void;
  reset: () => void;
}

/** Agent runs are executed and persisted by the Go backend; this is the live view of them. */
export const useAgentStore = create<AgentState>()((set, get) => ({
  runs: {},
  requests: {},
  putRun: (run) => set({ runs: { ...get().runs, [run.id]: run } }),
  putRuns: (list) => set({ runs: { ...get().runs, ...Object.fromEntries(list.map((r) => [r.id, r])) } }),
  patchRun: (id, patch) => {
    const r = get().runs[id];
    if (r) set({ runs: { ...get().runs, [id]: { ...r, ...patch } } });
  },
  upsertStep: (runId, step) => {
    const r = get().runs[runId];
    if (!r) return;
    const exists = r.steps.some((s) => s.id === step.id);
    const steps = exists ? r.steps.map((s) => (s.id === step.id ? step : s)) : [...r.steps, step];
    set({ runs: { ...get().runs, [runId]: { ...r, steps } } });
  },
  putRequests: (list) => set({ requests: { ...get().requests, ...Object.fromEntries(list.map((r) => [r.token, r])) } }),
  reset: () => set({ runs: {}, requests: {} }),
}));

/** The server closes interrupted runs on restart, so a run is never stale in the browser. */
export const isStale = (run: AgentRun) => {
  void run;
  return false;
};
