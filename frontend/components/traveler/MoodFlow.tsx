"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircleIcon, ArrowRightIcon, LightningIcon } from "@phosphor-icons/react";
import type { Mood, Trip } from "@/types";
import { MOODS, type MoodProposal } from "@/lib/engine/mood";
import { proposeMood, acceptMood } from "@/lib/api/trips";
import { PACE_LIMIT } from "@/lib/engine/schedule";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { EnergyBattery } from "./Itinerary";
import { Zippy } from "@/components/art/Zippy";
import { cn, rupees } from "@/lib/format";
import { toast } from "@/stores/notificationStore";
import { Glyph } from "@/lib/icons";

export function MoodButtons({ onPick, disabled }: { onPick: (m: Mood) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {MOODS.map((m) => (
        <motion.button
          key={m.id}
          type="button"
          whileTap={{ scale: 0.92 }}
          disabled={disabled}
          onClick={() => onPick(m.id)}
          className="flex flex-col items-center gap-1 rounded-[22px] bg-white px-2 py-3 shadow-clay-sm transition hover:-translate-y-0.5 hover:bg-sun-soft disabled:opacity-50"
          aria-label={`${m.label}: ${m.hint}`}
        >
          <Glyph emoji={m.emoji} size={30} />
          <span className="text-xs font-bold">{m.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

/** Tap a mood → watch the adaptation → approve the proposed change. */
export function MoodSheet({ trip, mood, onClose, day, nowMin }: { trip: Trip; mood: Mood | null; onClose: () => void; day: number; nowMin: number }) {
  const [phase, setPhase] = useState<"thinking" | "proposal" | "applying" | "done" | "error">("thinking");
  const [proposal, setProposal] = useState<MoodProposal | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const meta = MOODS.find((m) => m.id === mood);

  useEffect(() => {
    if (!mood) return;
    let cancelled = false;
    setPhase("thinking");
    setShown(0);
    setProposal(null);
    (async () => {
      try {
        const p = await proposeMood(trip.id, mood, day, nowMin);
        if (cancelled) return;
        setProposal(p);
        for (let i = 1; i <= p.thinking.length; i++) {
          await new Promise((r) => setTimeout(r, 650));
          if (cancelled) return;
          setShown(i);
        }
        await new Promise((r) => setTimeout(r, 300));
        if (!cancelled) setPhase("proposal");
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  const accept = async () => {
    if (!proposal) return;
    setPhase("applying");
    try {
      await acceptMood(trip.id, proposal.mood, day, nowMin);
      setPhase("done");
      toast({ tone: "success", title: "Plan updated", body: proposal.headline });
    } catch (e) {
      setError(e);
      setPhase("error");
    }
  };

  const limit = PACE_LIMIT[trip.prefs.pace];
  return (
    <Sheet open={!!mood} onOpenChange={(v) => !v && onClose()} title={meta?.label ?? ""} description={meta?.hint}>
      <AnimatePresence mode="wait">
        {phase === "thinking" && (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-4" role="status" aria-live="polite">
            <div className="flex justify-center">
              <motion.div animate={{ rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                <Zippy mood="thinking" size={96} />
              </motion.div>
            </div>
            <ul className="mx-auto mt-5 max-w-xs space-y-2">
              {(proposal?.thinking ?? ["Understanding…"]).map((t, i) => (
                <li key={t} className={cn("flex items-center gap-2 text-sm transition-opacity", i < shown ? "opacity-100" : i === shown ? "opacity-100" : "opacity-30")}>
                  {i < shown ? <CheckCircleIcon size={18} weight="fill" className="text-success" /> : <span className="h-4 w-4 animate-spin rounded-full border-2 border-lavender border-t-purple" />}
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        {(phase === "proposal" || phase === "applying") && proposal && (
          <motion.div key="p" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-[24px] border-2 border-ink bg-mint p-4 shadow-pop">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <LightningIcon size={14} weight="fill" /> Proposed change
              </p>
              <p className="mt-1 font-display text-lg font-extrabold">{proposal.headline}</p>
            </div>
            {proposal.plan.actions.length > 0 ? (
              <ul className="space-y-2">
                {proposal.plan.actions.map((a, i) => (
                  <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-white p-3 text-sm shadow-clay-sm">
                    <span className="truncate text-muted line-through">{a.fromLabel}</span>
                    <ArrowRightIcon size={14} className="text-muted" />
                    <span className="truncate font-semibold">{a.toLabel}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-white p-4 text-sm text-muted">Nothing needs to change right now.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3 shadow-clay-sm">
                <p className="text-[11px] font-semibold uppercase text-muted">Today&apos;s energy</p>
                <div className="mt-1 flex items-center gap-2">
                  <EnergyBattery value={proposal.energyBefore} limit={limit} compact />
                  <ArrowRightIcon size={12} />
                  <EnergyBattery value={proposal.energyAfter} limit={limit} compact />
                </div>
              </div>
              <div className="rounded-2xl bg-white p-3 shadow-clay-sm">
                <p className="text-[11px] font-semibold uppercase text-muted">Price change</p>
                <p className={cn("font-display text-lg font-bold", proposal.plan.costDelta < 0 ? "text-success" : proposal.plan.costDelta > 0 ? "text-danger" : "")}>{rupees(proposal.plan.costDelta, { sign: true })}</p>
              </div>
            </div>
            <p className="text-xs text-muted">Must-Do items are never touched. Vendors are told automatically.</p>
            <div className="flex gap-2">
              <Button full size="lg" onClick={accept} loading={phase === "applying"} disabled={!proposal.plan.actions.length}>
                Yes, update my day
              </Button>
              <Button size="lg" variant="secondary" onClick={onClose}>
                Not now
              </Button>
            </div>
          </motion.div>
        )}
        {phase === "done" && (
          <motion.div key="d" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-6 text-center">
            <Zippy mood="celebrate" size={100} />
            <p className="mt-3 font-display text-xl font-extrabold">Done! Your day is updated.</p>
            <p className="mt-1 text-sm text-muted">A Change Receipt was added to your trip.</p>
            <Button className="mt-5" onClick={onClose}>
              Back to today
            </Button>
          </motion.div>
        )}
        {phase === "error" && (
          <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ErrorState title="Couldn't re-plan right now" error={error} onRetry={() => { setError(null); setPhase("proposal"); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
