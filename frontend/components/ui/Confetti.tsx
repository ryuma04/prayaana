"use client";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

const COLORS = ["#f08a6c", "#fad47f", "#c6b5f6", "#d0e8ba", "#c4def8", "#f9cbc9", "#7b5cf0"];

/** Confetti only for big moments (booking, trip repaired). */
export function Confetti({ count = 70 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (i * 97) % 100,
        delay: (i % 12) * 0.05,
        dur: 1.8 + ((i * 13) % 10) / 10,
        rot: (i * 47) % 360,
        drift: ((i * 29) % 40) - 20,
        color: COLORS[i % COLORS.length],
        w: 6 + (i % 3) * 3,
        round: i % 4 === 0,
      })),
    [count],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[85] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block"
          style={{ left: `${p.x}%`, width: p.w, height: p.round ? p.w : p.w * 1.8, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ y: -40, opacity: 1, rotate: 0, x: 0 }}
          animate={{ y: "105vh", opacity: [1, 1, 0], rotate: p.rot + 360, x: p.drift * 4 }}
          transition={{ duration: p.dur, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
