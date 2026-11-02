"use client";
import { motion } from "motion/react";
import type { TravelDNA as DNA } from "@/types";
import { TRAIT_META } from "@/lib/engine/dna";
import { cn } from "@/lib/format";

export function TravelDNABars({ dna, animate = true, compact }: { dna: DNA; animate?: boolean; compact?: boolean }) {
  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3.5")} role="list" aria-label="Travel DNA traits">
      {TRAIT_META.map((t, i) => (
        <div key={t.key} className="grid grid-cols-[84px_1fr_32px] items-center gap-3" role="listitem" aria-label={`${t.label} ${dna.traits[t.key]} out of 100`}>
          <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{t.label}</span>
          <div className={cn("overflow-hidden rounded-full bg-ink/5", compact ? "h-2.5" : "h-3.5")}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: t.color }}
              initial={animate ? { width: 0 } : false}
              animate={{ width: `${dna.traits[t.key]}%` }}
              transition={{ duration: 0.9, delay: animate ? 0.2 + i * 0.1 : 0, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
          <span className={cn("tabular text-right font-bold", compact ? "text-xs" : "text-sm")}>{dna.traits[t.key]}</span>
        </div>
      ))}
    </div>
  );
}

/** Six-point radar for the profile page. */
export function DNARadar({ dna, size = 220 }: { dna: DNA; size?: number }) {
  const c = size / 2;
  const r = size / 2 - 26;
  const pts = TRAIT_META.map((t, i) => {
    const a = (Math.PI * 2 * i) / TRAIT_META.length - Math.PI / 2;
    const v = dna.traits[t.key] / 100;
    return { x: c + Math.cos(a) * r * v, y: c + Math.sin(a) * r * v, lx: c + Math.cos(a) * (r + 16), ly: c + Math.sin(a) * (r + 16), label: t.label, color: t.color };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Travel DNA radar: ${TRAIT_META.map((t) => `${t.label} ${dna.traits[t.key]}`).join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={TRAIT_META.map((_, i) => {
            const a = (Math.PI * 2 * i) / TRAIT_META.length - Math.PI / 2;
            return `${c + Math.cos(a) * r * k},${c + Math.sin(a) * r * k}`;
          }).join(" ")}
          fill="none"
          stroke="#1c1b2b"
          strokeOpacity={0.08}
        />
      ))}
      <motion.polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="#c6b5f6"
        fillOpacity={0.55}
        stroke="#5a3dd4"
        strokeWidth={2.5}
        strokeLinejoin="round"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ transformOrigin: `${c}px ${c}px` }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
      />
      {pts.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r={4.5} fill={p.color} stroke="#1c1b2b" strokeWidth={1.5} />
          <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="#3a3850">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
