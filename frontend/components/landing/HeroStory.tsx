"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircleIcon, CloudRainIcon, HeartIcon, RobotIcon, ChatCircleDotsIcon } from "@phosphor-icons/react";
import { ArtTile } from "@/components/art/ArtTile";
import { Burst } from "./Burst";
import { cn } from "@/lib/format";

type Phase = "plan" | "rain" | "fixing" | "fixed";
const ORDER: Phase[] = ["plan", "rain", "fixing", "fixed"];
const DURATION: Record<Phase, number> = { plan: 2600, rain: 2400, fixing: 3000, fixed: 3200 };

const rows = [
  { time: "9:00", title: "Hotel pickup", icon: "cab", tone: "cream" as const },
  { time: "10:00", title: "Abbey Falls Trail walk", icon: "waves", tone: "coral" as const, heart: true, outdoor: true },
  { time: "13:00", title: "Lunch · Coorg Cuisine", icon: "food", tone: "sun" as const },
  { time: "15:00", title: "Dubare Elephant Camp", icon: "mountain", tone: "mint" as const, outdoor: true },
  { time: "18:00", title: "Raintree Heritage Dinner", icon: "cafe", tone: "pink" as const },
];

const fixed: Record<string, { time: string; title: string; icon: string; tone: "lavender" | "sky" }> = {
  "Abbey Falls Trail walk": { time: "Sat 8:00", title: "Abbey Falls → moved to Saturday", icon: "waves", tone: "sky" },
  "Dubare Elephant Camp": { time: "15:00", title: "Golden Temple Bylakuppe (indoor)", icon: "lotus", tone: "lavender" },
};

/** Looping story for the hero: a plan → rain hits → agent fixes → confirmed. */
export function HeroStory() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? "fixed" : "plan");
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setPhase(ORDER[(ORDER.indexOf(phase) + 1) % ORDER.length]), DURATION[phase]);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  const rainy = phase === "rain" || phase === "fixing";
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div className="absolute -left-10 top-10 hidden h-24 w-24 rounded-[32%] bg-lavender shadow-clay sm:block" style={{ transform: "rotate(-12deg)" }} aria-hidden />
      <div className="absolute -right-8 bottom-16 hidden h-20 w-20 rounded-full bg-mint shadow-clay sm:block" aria-hidden />
      <motion.div
        className="relative rounded-[40px] border-2 border-ink bg-white p-3 shadow-pop-lg"
        animate={rainy ? { rotate: [0, -0.6, 0.6, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={cn("rounded-[30px] p-4 transition-colors duration-700", rainy ? "bg-sky-soft" : phase === "fixed" ? "bg-mint-soft" : "bg-canvas")}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Day 2 · Coorg</p>
              <p className="font-display text-base font-bold">Misty Hills & Coffee day</p>
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={phase}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-1 text-[11px] font-bold",
                  phase === "plan" && "bg-white",
                  phase === "rain" && "bg-sky",
                  phase === "fixing" && "bg-lavender",
                  phase === "fixed" && "bg-mint",
                )}
              >
                {phase === "plan" && "18°C"}
                {phase === "rain" && (
                  <>
                    <CloudRainIcon size={12} weight="bold" /> 92% rain
                  </>
                )}
                {phase === "fixing" && (
                  <>
                    <RobotIcon size={12} weight="bold" /> Fixing…
                  </>
                )}
                {phase === "fixed" && (
                  <>
                    <CheckCircleIcon size={12} weight="bold" /> Fixed
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </div>
          <ul className="space-y-2">
            {rows.map((r) => {
              const broken = r.outdoor && (phase === "rain" || phase === "fixing");
              const f = phase === "fixed" && fixed[r.title];
              return (
                <motion.li
                  key={r.title}
                  layout
                  className={cn(
                    "flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-clay-sm transition-all",
                    broken && "ring-2 ring-danger/70",
                    f && "ring-2 ring-success/70",
                  )}
                >
                  <ArtTile icon={f ? f.icon : r.icon} tone={f ? f.tone : r.tone} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-muted">{f ? f.time : r.time}</p>
                    <p className={cn("truncate text-[13px] font-semibold", broken && "text-danger line-through decoration-2")}>{f ? f.title : r.title}</p>
                  </div>
                  {r.heart && <HeartIcon size={16} weight="fill" className="shrink-0 text-coral" aria-label="Must-do" />}
                  {broken && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">At risk</span>}
                </motion.li>
              );
            })}
          </ul>
          <AnimatePresence>
            {(phase === "fixing" || phase === "fixed") && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden rounded-2xl border-2 border-ink bg-white p-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <ChatCircleDotsIcon size={16} weight="fill" className="text-success" />
                  {phase === "fixing" ? "Asking 3 vendors instantly…" : "3/3 vendors said yes · ₹0 extra · Must-Dos kept"}
                </div>
                <div className="mt-2 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 flex-1 rounded-full"
                      initial={{ backgroundColor: "#e8e2d6" }}
                      animate={{ backgroundColor: phase === "fixed" ? "#23864b" : ["#e8e2d6", "#7b5cf0", "#e8e2d6"] }}
                      transition={phase === "fixed" ? { duration: 0.3, delay: i * 0.15 } : { duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      <AnimatePresence>
        {phase === "rain" && (
          <motion.div key="rain" className="absolute -right-6 -top-8" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
            <Burst text="RAIN!" color="#c4def8" size={110} />
          </motion.div>
        )}
        {phase === "fixed" && (
          <motion.div key="fixed" className="absolute -left-8 -bottom-6" initial={{ scale: 0, rotate: 30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
            <Burst text="FIXED!" color="#d0e8ba" size={116} rotate={8} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
