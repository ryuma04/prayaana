"use client";
import { motion } from "motion/react";
import { CheckCircleIcon, HeartIcon, StorefrontIcon, ClockIcon, CloudRainIcon, SunIcon, ArrowsLeftRightIcon, ShieldCheckIcon, CircleIcon } from "@phosphor-icons/react";
import type { FixPlan } from "@/types";
import { vendorMap } from "@/data/vendors";
import { cn, duration, rupees } from "@/lib/format";

const STYLE: Record<FixPlan["strategy"], { letter: string; tone: string; soft: string }> = {
  cheapest: { letter: "A", tone: "bg-mint", soft: "bg-mint-soft" },
  fastest: { letter: "B", tone: "bg-sky", soft: "bg-sky-soft" },
  favourites: { letter: "C", tone: "bg-pink", soft: "bg-pink-soft" },
  day_swap: { letter: "D", tone: "bg-sun", soft: "bg-sun-soft" },
  route_swap: { letter: "R", tone: "bg-lavender", soft: "bg-lavender-soft" },
  activity_swap: { letter: "S", tone: "bg-mint", soft: "bg-mint-soft" },
};

export function FixPlanCard({ plan, selected, onSelect, index = 0, disabled }: { plan: FixPlan; selected: boolean; onSelect: () => void; index?: number; disabled?: boolean }) {
  const s = STYLE[plan.strategy];
  const saving = plan.costDelta < 0;
  const allHearts = plan.heartsKept === plan.heartsTotal;
  const main = plan.actions.filter((a) => a.type !== "shift" || !a.label.includes("pickup")).slice(0, 4);
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.12 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex h-full w-full flex-col rounded-[28px] p-4 text-left transition disabled:opacity-60",
        selected ? cn(s.soft, "ring-[3px] ring-ink shadow-pop-lg") : "bg-white shadow-clay hover:-translate-y-1",
      )}
    >
      {plan.recommended && <span className="absolute -top-3 right-4 rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 text-[10px] font-extrabold shadow-pop">Recommended</span>}
      <div className="flex items-center gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-ink font-display text-lg font-extrabold", s.tone)}>{s.letter}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Plan {s.letter}</p>
          <p className="font-display text-base font-extrabold leading-tight">{plan.title}</p>
        </div>
        {selected ? <CheckCircleIcon size={26} weight="fill" className="text-purple" /> : <CircleIcon size={26} className="text-faint" />}
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold">
        {saving ? `${rupees(-plan.costDelta)} saved` : plan.costDelta === 0 ? "₹0 extra" : `${rupees(plan.costDelta)} extra`}
      </p>
      <p className="text-xs text-muted">{plan.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold shadow-clay-sm">
          <ArrowsLeftRightIcon size={12} /> {plan.swaps} swap{plan.swaps === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold shadow-clay-sm">
          <ClockIcon size={12} /> {plan.timeDeltaMin ? `${duration(plan.timeDeltaMin)} shifted` : "Same times"}
        </span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold", allHearts ? "bg-coral text-white" : "bg-danger-soft text-danger")}>
          <HeartIcon size={12} weight="fill" /> {allHearts ? `All ${plan.heartsTotal} Must-Dos kept` : `${plan.heartsTotal - plan.heartsKept} Must-Dos lost`}
        </span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold", plan.weatherOk ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
          {plan.weatherOk ? <SunIcon size={12} /> : <CloudRainIcon size={12} />} {plan.weatherOk ? "Weather-safe" : "Some rain risk"}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {main.map((a, i) => (
          <li key={i} className="flex gap-1.5">
            <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", a.type === "cancel" ? "bg-danger" : a.type === "move" ? "bg-purple" : "bg-mint-deep")} />
            <span className="text-ink-soft">{a.label}</span>
          </li>
        ))}
        {plan.actions.length > main.length && <li className="pl-3 text-muted">+{plan.actions.length - main.length} timing updates</li>}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1">
          <StorefrontIcon size={13} /> {plan.vendors.length} vendor{plan.vendors.length === 1 ? "" : "s"}: {plan.vendors.slice(0, 2).map((v) => vendorMap[v]?.name.split(" ")[0]).join(", ")}
          {plan.vendors.length > 2 ? "…" : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheckIcon size={13} /> {plan.confidence}% sure
        </span>
      </div>
    </motion.button>
  );
}
