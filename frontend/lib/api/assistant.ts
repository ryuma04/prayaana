"use client";
import { post } from "./client";
import type { WhatIfResult } from "./incidents";

/** A link the assistant suggests. It never acts: the operator acts on the page it opens. */
export interface AssistantAction {
  kind: "open" | "simulate";
  label: string;
  href: string;
}

export interface AssistantAnswer {
  answer: string;
  /** ai-service: the Python AI agent · gateway: the backend's Groq/Gemini · rules: no AI available. */
  source: "ai-service" | "gateway" | "rules";
  engine: string;
  tools: string[];
  actions: AssistantAction[];
  /** Present when the question was a "what if" the backend could simulate. */
  simulation?: WhatIfResult;
  note?: string;
}

export interface AssistantTurn {
  from: "operator" | "assistant";
  text: string;
}

/** POST /ops/ai/ask: answers from live trips, problems, vendor confirmations and agent runs. */
export const askAssistant = (question: string, opts: { incidentId?: string; history?: AssistantTurn[] } = {}) =>
  post<AssistantAnswer>("/ops/ai/ask", { question, incidentId: opts.incidentId, history: opts.history ?? [] });
