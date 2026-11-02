"use client";
import type { Tone } from "@/types";
import { cn } from "@/lib/format";
import { toneBg, toneDeepHex } from "@/components/ui/tone";
import { iconFor } from "./icons";

/** Soft 3D clay tile with a duotone glyph — used for every itinerary item. */
export function ArtTile({ icon, tone, size = 48, className, muted }: { icon: string; tone: Tone; size?: number; className?: string; muted?: boolean }) {
  const Icon = iconFor(icon);
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[30%] shadow-clay-sm", toneBg[tone], muted && "opacity-50 grayscale", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-white/45 blur-[2px]" />
      <Icon size={size * 0.52} weight="duotone" color={toneDeepHex[tone]} className="relative drop-shadow-[0_2px_0_rgba(255,255,255,0.6)]" />
    </span>
  );
}
