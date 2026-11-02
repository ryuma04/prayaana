"use client";
import { useWeatherStore, useWeatherVersion } from "@/stores/weatherStore";
import { motion } from "motion/react";
import { CloudRainIcon, SunIcon, CloudIcon, ReceiptIcon, ArrowRightIcon, CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";
import type { ChangeReceipt, Trip } from "@/types";
import { JOURNEY } from "@/components/landing/Sections";
import { tripForecast } from "@/lib/engine/weather";
import qrcode from "qrcode-generator";
import { cn, dayDate, rupees, timeAgo } from "@/lib/format";

export function lifecycleIndex(trip: Trip, hasIncident: boolean) {
  if (trip.status === "draft") return 3; // Price
  if (trip.status === "booked") return 5; // Prepare
  if (trip.status === "live") return hasIncident ? 8 : trip.receipts.length ? 8 : 6;
  return trip.review ? 10 : 9;
}

export function LifecycleBar({ trip, hasIncident }: { trip: Trip; hasIncident?: boolean }) {
  const current = lifecycleIndex(trip, !!hasIncident);
  return (
    <div className="scrollbar-none -mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-center gap-1" aria-label="Trip lifecycle">
        {JOURNEY.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s.t} className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition",
                  done ? "bg-mint text-ink" : now ? "border-2 border-ink bg-sun text-ink shadow-pop" : "bg-white text-muted",
                )}
                aria-current={now ? "step" : undefined}
              >
                <s.I size={13} weight={done || now ? "fill" : "regular"} />
                {s.t}
              </span>
              {i < JOURNEY.length - 1 && <span className={cn("h-0.5 w-3", done ? "bg-mint-deep" : "bg-ink/10")} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function WeatherStrip({ trip }: { trip: Trip }) {
  useWeatherVersion();
  const live = useWeatherStore((s) => s.source === "open-meteo");
  const days = tripForecast(trip);
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
      {days.map((f, i) => {
        const Icon = f.condition === "rain" || f.condition === "storm" ? CloudRainIcon : f.condition === "cloudy" ? CloudIcon : SunIcon;
        const wet = f.condition === "rain" || f.condition === "storm";
        return (
          <div key={i} className={cn("w-20 shrink-0 rounded-2xl p-2.5 text-center", wet ? "bg-sky" : "bg-white shadow-clay-sm", trip.currentDay === i + 1 && "ring-2 ring-ink")}>
            <p className="text-[10px] font-bold text-muted">Day {i + 1}</p>
            <p className="text-[10px] text-muted">{dayDate(trip.prefs.startDate, i + 1, { weekday: "short" })}</p>
            <Icon size={22} weight="duotone" className={cn("mx-auto my-1", wet ? "text-sky-deep" : "text-sun-deep")} />
            <p className="text-sm font-bold">{f.tempC}°</p>
            <p className="text-[10px] text-muted">{f.rainChance}% rain</p>
          </div>
        );
      })}
      <p className="self-end whitespace-nowrap px-1 text-[10px] text-muted">{live && days.some((f) => f.source) ? "Live · Open-Meteo" : "Climate estimate"}</p>
    </div>
  );
}

export function ReceiptCard({ r, compact }: { r: ChangeReceipt; compact?: boolean }) {
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[24px] border-2 border-ink bg-white shadow-pop">
      <div className="flex items-center gap-3 bg-lavender-soft px-4 py-3">
        <ReceiptIcon size={20} weight="duotone" className="text-purple-deep" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">Change Receipt · {r.id}</p>
          <p className="text-[11px] text-muted">
            {r.title} · {timeAgo(r.createdAt)}
          </p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", r.costDelta < 0 ? "bg-success-soft text-success" : r.costDelta > 0 ? "bg-warning-soft text-warning" : "bg-white text-muted")}>
          {r.costDelta === 0 ? "₹0" : rupees(r.costDelta, { sign: true })}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted">{r.reason}</p>
        <ul className="mt-3 space-y-2">
          {r.changes.slice(0, compact ? 3 : 20).map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
              <span className="truncate rounded-xl bg-canvas px-2 py-1.5 text-muted line-through">{c.before}</span>
              <ArrowRightIcon size={12} className="text-muted" />
              <span className="truncate rounded-xl bg-mint-soft px-2 py-1.5 font-semibold">{c.after}</span>
            </li>
          ))}
        </ul>
        {r.approvedBy.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-muted">
            <CheckCircleIcon size={13} weight="fill" className="text-success" /> Approved by {r.approvedBy.join(", ")}
          </p>
        )}
      </div>
    </motion.article>
  );
}

/** A real, scannable QR code (encodes the trip link) for the Offline Trip Pass. */
export function TripQR({ value, size = 120 }: { value: string; size?: number }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const s = size / (n + quiet * 2);
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.isDark(y, x)) cells.push(<rect key={`${x}-${y}`} x={(x + quiet) * s} y={(y + quiet) * s} width={s + 0.15} height={s + 0.15} fill="#1c1b2b" />);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code for ${value}`} className="rounded-xl bg-white">
      {cells}
    </svg>
  );
}

export function StepDot({ done }: { done: boolean }) {
  return done ? <CheckCircleIcon size={18} weight="fill" className="text-success" /> : <CircleIcon size={18} className="text-faint" />;
}
