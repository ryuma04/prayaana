"use client";
import type { ReactNode } from "react";
import { AirplaneTiltIcon, BusIcon, CarIcon, TrainIcon, ClockIcon, UmbrellaIcon, SunIcon, PersonSimpleWalkIcon } from "@phosphor-icons/react";
import type { Activity, Stay, TransportOption } from "@/types";
import { ArtTile } from "@/components/art/ArtTile";
import { Badge, Stars } from "@/components/ui/primitives";
import { cn, duration, rupees } from "@/lib/format";
import { toneSoft } from "@/components/ui/tone";

export function ActivityCard({ a, match, action, compact }: { a: Activity; match?: number; action?: ReactNode; compact?: boolean }) {
  return (
    <article className={cn("flex gap-3 rounded-[24px] bg-white p-3.5 shadow-clay-sm", compact && "p-3")}>
      <ArtTile icon={a.icon} tone={a.tone} size={compact ? 44 : 56} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 text-sm font-bold leading-snug">{a.title}</h4>
          {match != null && <span className="shrink-0 rounded-full bg-lavender-soft px-2 py-0.5 text-[10px] font-bold text-purple-deep">{match}%</span>}
        </div>
        {!compact && <p className="mt-1 line-clamp-2 text-xs text-muted">{a.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-ink-soft">
          <Stars value={a.rating} />
          <span className="inline-flex items-center gap-1">
            <ClockIcon size={12} /> {duration(a.durationMin)}
          </span>
          <span className="inline-flex items-center gap-1">
            {a.outdoor ? <SunIcon size={12} /> : <UmbrellaIcon size={12} />} {a.outdoor ? "Outdoor" : "Rain-safe"}
          </span>
          {a.walking === "high" && (
            <span className="inline-flex items-center gap-1 text-warning">
              <PersonSimpleWalkIcon size={12} /> Lots of walking
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-display text-sm font-bold">{a.price ? `${rupees(a.price)}` : "Free"}<span className="text-[11px] font-medium text-muted">{a.price ? " / person" : ""}</span></span>
          {action}
        </div>
      </div>
    </article>
  );
}

export function HotelCard({ s, selected, onSelect, nights, rooms, delta }: { s: Stay; selected?: boolean; onSelect?: () => void; nights?: number; rooms?: number; delta?: number }) {
  const Tag = onSelect ? "button" : "article";
  return (
    <Tag
      {...(onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": selected } : {})}
      className={cn("flex w-full gap-3 rounded-[24px] p-3.5 text-left transition", toneSoft[s.tone], selected ? "ring-2 ring-ink shadow-pop" : "shadow-clay-sm", onSelect && !selected && "hover:-translate-y-0.5")}
    >
      <ArtTile icon="hotel" tone={s.tone} size={56} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold leading-snug">{s.name}</h4>
          <Badge tone={s.tone} solid className="capitalize">
            {s.type}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted">{s.area}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {s.amenities.map((x) => (
            <span key={x} className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
              {x}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Stars value={s.rating} reviews={s.reviews} />
          <span className="text-right">
            <span className="font-display text-sm font-bold">{rupees(s.nightlyPrice)}</span>
            <span className="text-[11px] text-muted"> /night</span>
            {nights != null && rooms != null && <span className="block text-[11px] text-muted">{rupees(s.nightlyPrice * nights * rooms)} total</span>}
            {delta != null && delta !== 0 && <span className={cn("block text-[11px] font-bold", delta < 0 ? "text-success" : "text-danger")}>{rupees(delta, { sign: true })}</span>}
          </span>
        </div>
      </div>
    </Tag>
  );
}

export const MODE_ICON = { flight: AirplaneTiltIcon, train: TrainIcon, bus: BusIcon, car: CarIcon } as const;

export function TransportRow({ t, selected, onSelect, travelers }: { t: TransportOption; selected?: boolean; onSelect?: () => void; travelers?: number }) {
  const Icon = MODE_ICON[t.mode];
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      {...(onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": selected } : {})}
      className={cn("flex w-full items-center gap-3 rounded-[22px] bg-white p-3.5 text-left", selected ? "ring-2 ring-ink shadow-pop" : "shadow-clay-sm", onSelect && !selected && "transition hover:-translate-y-0.5")}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky">
        <Icon size={20} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{t.label}</p>
        <p className="text-xs text-muted">
          From {t.from} · departs {t.departs} · {duration(t.durationMin)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-sm font-bold">{rupees(t.pricePerPerson)}</p>
        <p className="text-[11px] text-muted">{travelers ? `${rupees(t.pricePerPerson * travelers * 2)} return` : "per person"}</p>
      </div>
    </Tag>
  );
}
