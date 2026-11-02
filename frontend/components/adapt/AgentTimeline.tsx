"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  MagnifyingGlassIcon,
  LightningIcon,
  TreeStructureIcon,
  ArrowsSplitIcon,
  CrosshairIcon,
  ShieldCheckIcon,
  ChatCircleDotsIcon,
  HourglassMediumIcon,
  StorefrontIcon,
  MicrophoneIcon,
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  ChatCircleTextIcon,
  PhoneCallIcon,
  RobotIcon,
  XCircleIcon,
  WarningIcon,
  CaretDownIcon,
  ArrowSquareOutIcon,
  PlayIcon,
  WaveformIcon,
} from "@phosphor-icons/react";
import type { AgentStep, VendorRequest } from "@/types";
import { useAgentStore } from "@/stores/agentStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/notificationStore";
import { vendorMap } from "@/data/vendors";
import { replyToRequest } from "@/lib/api/vendors";
import { getRun, getRunRequests, takeOver } from "@/lib/api/agent";
import { errorMessage } from "@/lib/api/client";
import { clockTime, cn } from "@/lib/format";

const TOOL_ICON: Record<string, typeof RobotIcon> = {
  detect_problem: MagnifyingGlassIcon,
  "jev.decide": LightningIcon,
  analyze_impact: TreeStructureIcon,
  make_fix_plans: ArrowsSplitIcon,
  choose_plan: CrosshairIcon,
  run_safety_checks: ShieldCheckIcon,
  ask_vendors: ChatCircleDotsIcon,
  "yesflow.wait": HourglassMediumIcon,
  "yesflow.read_reply": StorefrontIcon,
  "whatsapp.voice_note": MicrophoneIcon,
  commit_or_undo: CheckCircleIcon,
  message_traveler: ChatCircleTextIcon,
  escalate: PhoneCallIcon,
  request_approval: WarningIcon,
  done: CheckCircleIcon,
};

function stepColor(s: AgentStep) {
  if (s.status === "failed") return "bg-danger text-white";
  if (s.status === "warning" || s.kind === "rollback") return "bg-warning text-white";
  if (s.status === "running" || s.status === "waiting") return "bg-lavender text-purple-deep";
  if (s.kind === "success") return "bg-success text-white";
  if (s.kind === "voice") return "bg-mint text-ink";
  return "bg-purple text-white";
}

function Elapsed({ from, to }: { from: string; to?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (to) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [to]);
  const secs = Math.max(0, Math.round(((to ? new Date(to).getTime() : now) - new Date(from).getTime()) / 1000));
  return <span className="tabular">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span>;
}

export function AgentTimeline({ runId, compact, dark }: { runId: string; compact?: boolean; dark?: boolean }) {
  const run = useAgentStore((s) => s.runs[runId]);
  const isOperator = useAuthStore((s) => s.user?.role === "operator");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [stopping, setStopping] = useState(false);
  const known = !!run;
  useEffect(() => {
    if (!known) void getRun(runId).catch(() => undefined);
  }, [known, runId]);
  if (!run) return null;
  const status = run.status;
  const chip: Record<string, string> = {
    running: "bg-purple text-white",
    waiting: "bg-sun text-ink",
    succeeded: "bg-success text-white",
    failed: "bg-danger text-white",
    needs_human: "bg-coral text-white",
  };
  const label: Record<string, string> = { running: "Working", waiting: "Waiting for vendors", succeeded: "Trip repaired", failed: "Failed", needs_human: "Needs a human" };
  const stop = () => {
    setStopping(true);
    takeOver(run.id)
      .catch((e) => toast({ tone: "error", title: errorMessage(e) }))
      .finally(() => setStopping(false));
  };
  const steps = compact ? run.steps.filter((s) => s.kind !== "vendor") : run.steps;

  return (
    <div className={cn("rounded-[28px] p-4 sm:p-5", dark ? "bg-ink text-white" : "border-2 border-ink bg-white shadow-pop-lg")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-lavender text-ink">
          <RobotIcon size={20} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold">Trip Fixer Agent</p>
          <p className={cn("text-[11px]", dark ? "text-white/60" : "text-muted")}>
            Attempt {run.attempt} · <Elapsed from={run.startedAt} to={run.finishedAt} /> · {run.mode === "auto" ? "simulated vendors" : "live vendor links"}
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold", chip[status])}>
          {(status === "running" || status === "waiting") && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {label[status]}
        </span>
        {!compact && isOperator && (status === "running" || status === "waiting") && (
          <button onClick={stop} disabled={stopping} className={cn("rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-60", dark ? "bg-white/10 hover:bg-white/20" : "bg-canvas hover:bg-pink-soft")}>
            {stopping ? "Stopping…" : "Take over"}
          </button>
        )}
      </div>
      <ol className="relative mt-4 space-y-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {steps.map((s) => {
            const Icon = s.status === "failed" ? XCircleIcon : s.kind === "rollback" ? ArrowCounterClockwiseIcon : TOOL_ICON[s.tool] ?? RobotIcon;
            const expanded = open[s.id];
            return (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className={cn(
                  "rounded-2xl p-2.5",
                  dark ? "bg-white/[0.05]" : "bg-canvas",
                  s.kind === "rollback" && (dark ? "ring-1 ring-warning/60" : "bg-warning-soft/60"),
                  s.kind === "success" && (dark ? "ring-1 ring-success/60" : "bg-success-soft/70"),
                  s.kind === "voice" && (dark ? "ring-1 ring-mint/60" : "bg-mint-soft"),
                )}
              >
                <button type="button" onClick={() => setOpen({ ...open, [s.id]: !expanded })} className="flex w-full items-start gap-3 text-left" aria-expanded={expanded} disabled={!s.detail?.length}>
                  <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", stepColor(s))}>
                    {s.status === "running" || s.status === "waiting" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <Icon size={16} weight="bold" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-bold">{s.label}</span>
                      <span className={cn("font-mono text-[10px]", dark ? "text-white/40" : "text-muted")}>{s.tool}</span>
                    </span>
                    {s.result && <span className={cn("block text-xs", dark ? "text-white/75" : "text-ink-soft")}>{s.result}</span>}
                  </span>
                  <span className={cn("shrink-0 text-right font-mono text-[10px]", dark ? "text-white/45" : "text-muted")}>
                    {clockTime(s.ts)}
                    {s.tookMs != null && <span className="block">{s.tookMs < 1000 ? `${s.tookMs} ms` : `${(s.tookMs / 1000).toFixed(1)} s`}</span>}
                  </span>
                  {!!s.detail?.length && <CaretDownIcon size={14} className={cn("mt-2 shrink-0 transition", expanded && "rotate-180")} />}
                </button>
                <AnimatePresence>
                  {expanded && s.detail && (
                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-11">
                      {s.detail.map((d, i) => (
                        <li key={i} className={cn("pt-1 font-mono text-[11px]", dark ? "text-white/60" : "text-ink-soft")}>
                          {d}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}

const ANSWER: Record<VendorRequest["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-sun-soft text-sun-deep" },
  yes: { label: "Confirmed", cls: "bg-success-soft text-success" },
  no: { label: "Declined", cls: "bg-danger-soft text-danger" },
  other_time: { label: "Other time", cls: "bg-lavender-soft text-purple-deep" },
  timeout: { label: "No reply", cls: "bg-danger-soft text-danger" },
  cancelled: { label: "Request cancelled", cls: "bg-ink/5 text-muted" },
};

/** All-or-Nothing progress per vendor, with the /v/[token] link each vendor received. */
export function VendorBoard({ runId, allowReply = true }: { runId: string; allowReply?: boolean }) {
  const requests = useAgentStore((s) => s.requests);
  const steps = useAgentStore((s) => s.runs[runId]?.steps.length ?? 0);
  useEffect(() => {
    void getRunRequests(runId).catch(() => undefined);
  }, [runId, steps]);
  const list = Object.values(requests)
    .filter((r) => r.runId === runId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.vendorId.localeCompare(b.vendorId));
  if (!list.length) return null;
  const rounds = [...new Set(list.map((r) => r.confirmationId ?? "1"))];
  const answer = (token: string, a: "yes" | "no") => replyToRequest(token, a).catch((e) => toast({ tone: "error", title: errorMessage(e) }));
  return (
    <div className="space-y-3">
      {rounds.map((round, idx) => {
        const att = idx + 1;
        const rows = list.filter((r) => (r.confirmationId ?? "1") === round);
        const yes = rows.filter((r) => r.status === "yes").length;
        return (
          <div key={round} className="rounded-[24px] bg-white p-4 shadow-clay-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Attempt {att} · all-or-nothing</p>
              <p className="text-xs font-bold">
                {yes}/{rows.length} yes
              </p>
            </div>
            <div className="mb-3 flex gap-1">
              {rows.map((r) => (
                <span key={r.token} className={cn("h-1.5 flex-1 rounded-full", r.status === "yes" ? "bg-success" : r.status === "pending" ? "bg-sun animate-pulse" : r.status === "cancelled" ? "bg-ink/15" : "bg-danger")} />
              ))}
            </div>
            <ul className="space-y-2">
              {rows.map((r) => {
                const v = vendorMap[r.vendorId];
                const a = ANSWER[r.status];
                return (
                  <li key={r.token} className="rounded-2xl bg-canvas p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{v?.name ?? r.vendorId}</p>
                        <p className="line-clamp-2 whitespace-pre-line text-[11px] text-muted">{r.proposed}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", a.cls)}>
                        {r.channel === "voice" && r.status === "yes" ? "Voice: " : ""}
                        {a.label}
                      </span>
                    </div>
                    {r.voice && (
                      <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-mint-soft px-2 py-1.5 text-[11px]">
                        <WaveformIcon size={14} className="text-mint-deep" /> “{r.voice.transcript}”
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link href={`/v/${r.token}`} target="_blank" className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-deep hover:underline">
                        <ArrowSquareOutIcon size={12} /> Vendor link /v/{r.token.slice(0, 12)}…
                      </Link>
                      {allowReply && r.status === "pending" && (
                        <>
                          <button onClick={() => void answer(r.token, "yes")} className="rounded-full bg-success px-2.5 py-0.5 text-[10px] font-bold text-white">
                            Reply yes
                          </button>
                          <button onClick={() => void answer(r.token, "no")} className="rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold text-white">
                            Reply no
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function StartAgentButtonIcon() {
  return <PlayIcon size={16} weight="fill" />;
}
