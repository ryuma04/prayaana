"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { HeartIcon, CloudRainIcon, SunIcon, CloudIcon } from "@phosphor-icons/react";
import type { DayForecast, Destination } from "@/types";
import { DestinationArt } from "@/components/art/DestinationArt";
import { Stars } from "@/components/ui/primitives";
import { cn, rupees } from "@/lib/format";
import { useTravelerStore } from "@/stores/travelerStore";

export function WeatherChip({ f, className }: { f: DayForecast; className?: string }) {
  const Icon = f.condition === "rain" || f.condition === "storm" ? CloudRainIcon : f.condition === "cloudy" ? CloudIcon : SunIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-bold text-ink backdrop-blur", className)}>
      <Icon size={13} weight="fill" className={f.condition === "rain" ? "text-sky-deep" : "text-sun-deep"} />
      {f.tempC}° · {f.rainChance}%
    </span>
  );
}

export function DestinationCard({
  d,
  match,
  because,
  price,
  weather,
  tall,
  index = 0,
}: {
  d: Destination;
  match?: number;
  because?: string[];
  price: number;
  weather: DayForecast;
  tall?: boolean;
  index?: number;
}) {
  const saved = useTravelerStore((s) => s.savedPlaces.includes(d.id));
  const toggleSaved = useTravelerStore((s) => s.toggleSaved);
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="group relative overflow-hidden rounded-[30px] bg-white shadow-clay transition-transform duration-300 hover:-translate-y-1"
    >
      <Link href={`/discover/${d.id}`} className="block" aria-label={`${d.name}, ${d.state}`}>
        <div className={cn("relative overflow-hidden", tall ? "h-56" : "h-40")}>
          <DestinationArt kind={d.art} className="transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <WeatherChip f={weather} />
            {match != null && <span className="rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-[11px] font-extrabold">{match}% match</span>}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-bold">{d.name}</h3>
              <p className="truncate text-xs text-muted">{d.state} · {d.idealDays}</p>
            </div>
            <Stars value={d.rating} reviews={d.reviews} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{d.tagline}</p>
          {because && because.length > 0 && (
            <p className="mt-3 rounded-2xl bg-lavender-soft px-3 py-2 text-xs text-purple-deep">
              <span className="font-bold">Because you love:</span> {because.join(" + ")}
            </p>
          )}
          <div className="mt-3 flex items-end justify-between">
            <p className="text-xs text-muted">
              from <span className="font-display text-base font-bold text-ink">{rupees(price)}</span> / person
            </p>
            <span className="text-xs font-semibold text-muted">5 days</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => toggleSaved(d.id)}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${d.name} from saved` : `Save ${d.name}`}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-clay-sm transition active:scale-90"
      >
        <HeartIcon size={18} weight={saved ? "fill" : "regular"} className={saved ? "text-coral" : "text-ink"} />
      </button>
    </motion.article>
  );
}
