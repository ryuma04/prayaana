"use client";
import { useWeatherVersion } from "@/stores/weatherStore";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  HeartIcon,
  ArrowsLeftRightIcon,
  DotsThreeVerticalIcon,
  TrashIcon,
  CalendarBlankIcon,
  ClockIcon,
  InfoIcon,
  PlusIcon,
  CloudRainIcon,
  SunIcon,
  CloudIcon,
  ArrowBendDownRightIcon,
  ProhibitIcon,
} from "@phosphor-icons/react";
import type { Activity, Trip, TripItem } from "@/types";
import { ArtTile } from "@/components/art/ArtTile";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge, Chip, Stars, Stepper } from "@/components/ui/primitives";
import { ActivityCard } from "./Cards";
import { activityMap, activitiesFor } from "@/data/activities";
import { vendorMap } from "@/data/vendors";
import { itemCost } from "@/lib/engine/pricing";
import { PACE_LIMIT, dayEnergy, dayItems } from "@/lib/engine/schedule";
import { tripDayWeather, conditionLabel } from "@/lib/engine/weather";
import { matchPercent } from "@/lib/engine/planner";
import { MAX_HEARTS, heartsUsed } from "@/lib/engine/edit";
import { cn, dayDate, duration, minToTime, rupees } from "@/lib/format";
import type { useTripEditor } from "@/hooks/useTripEditor";

type Editor = ReturnType<typeof useTripEditor>;

// ─── Energy battery + hearts ───────────────────────────────────────────

export function EnergyBattery({ value, limit, compact }: { value: number; limit: number; compact?: boolean }) {
  const ratio = value / limit;
  const segs = 5;
  const filled = Math.max(1, Math.min(segs, Math.round(ratio * segs)));
  const color = ratio > 1 ? "bg-danger" : ratio > 0.8 ? "bg-coral" : ratio > 0.5 ? "bg-sun" : "bg-mint-deep";
  const label = ratio > 1 ? "Exhausting" : ratio > 0.8 ? "Full day" : ratio > 0.5 ? "Balanced" : "Easy";
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Energy: ${label} (${value} of ${limit})`} title={`Energy ${value}/${limit}`}>
      <span className="flex h-4 items-center gap-[2px] rounded-md border-2 border-ink p-[2px]">
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} className={cn("h-full w-1.5 rounded-[2px]", i < filled ? color : "bg-ink/10")} />
        ))}
      </span>
      {!compact && <span className="text-[11px] font-semibold text-muted">{label}</span>}
    </span>
  );
}

export function HeartCounter({ trip }: { trip: Trip }) {
  const used = heartsUsed(trip);
  return (
    <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-clay-sm" aria-label={`${used} of ${MAX_HEARTS} Must-Do hearts used`}>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: MAX_HEARTS }).map((_, i) => (
          <motion.span key={i} animate={{ scale: i < used ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.3 }}>
            <HeartIcon size={16} weight={i < used ? "fill" : "regular"} className={i < used ? "text-coral" : "text-faint"} />
          </motion.span>
        ))}
      </span>
      <span className="text-xs font-bold">
        {used} / {MAX_HEARTS} <span className="hidden font-medium text-muted sm:inline">Must-Do hearts used</span>
      </span>
    </div>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────

const STATUS: Record<TripItem["status"], { label: string; cls: string } | null> = {
  planned: null,
  confirmed: { label: "Confirmed", cls: "bg-success-soft text-success" },
  done: { label: "Done", cls: "bg-ink/5 text-muted" },
  live: { label: "Now", cls: "bg-purple text-white" },
  changed: { label: "Changed", cls: "bg-lavender-soft text-purple-deep" },
  cancelled: { label: "Cancelled", cls: "bg-danger-soft text-danger" },
};

export function ItemRow({
  trip,
  item,
  editor,
  readOnly,
  highlight,
  onOpen,
  onMove,
  onTime,
}: {
  trip: Trip;
  item: TripItem;
  editor?: Editor;
  readOnly?: boolean;
  highlight?: "now" | "next" | "risk";
  onOpen?: (i: TripItem) => void;
  onMove?: (i: TripItem) => void;
  onTime?: (i: TripItem) => void;
}) {
  const isActivity = item.kind === "activity";
  const cancelled = item.status === "cancelled";
  const st = STATUS[item.status];
  const cost = itemCost(item);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className="relative flex gap-3"
    >
      <div className="w-14 shrink-0 pt-3 text-right">
        <p className={cn("text-xs font-bold tabular", cancelled && "text-faint line-through")}>{minToTime(item.startMin).replace(" ", " ")}</p>
        <p className="text-[10px] text-muted">{duration(item.durationMin)}</p>
      </div>
      <div className="relative flex flex-col items-center" aria-hidden>
        <span className={cn("mt-4 h-3 w-3 rounded-full border-2 border-ink", item.status === "done" ? "bg-ink" : highlight === "now" ? "bg-purple" : "bg-white")} />
        <span className="w-0.5 flex-1 bg-ink/10" />
      </div>
      <div
        className={cn(
          "mb-3 flex min-w-0 flex-1 items-start gap-3 rounded-[22px] bg-white p-3 shadow-clay-sm transition",
          cancelled && "opacity-60",
          highlight === "now" && "ring-2 ring-purple",
          highlight === "next" && "ring-2 ring-sun",
          highlight === "risk" && "ring-2 ring-danger",
          item.hearted && !cancelled && "bg-gradient-to-br from-white to-pink-soft",
        )}
      >
        <button type="button" onClick={() => onOpen?.(item)} className="shrink-0" aria-label={`Details for ${item.title}`}>
          <ArtTile icon={item.icon} tone={item.tone} size={46} muted={cancelled} />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpen?.(item)} className="block w-full text-left">
            <p className={cn("text-sm font-bold leading-snug", cancelled && "line-through")}>{item.title}</p>
            <p className="truncate text-xs text-muted">{item.subtitle}</p>
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.hearted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">
                <HeartIcon size={10} weight="fill" /> Must-Do
              </span>
            )}
            {st && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", st.cls)}>{st.label}</span>}
            {isActivity && item.outdoor && <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-bold text-mint-deep">Outdoor</span>}
            {item.note && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-deep">
                <ArrowBendDownRightIcon size={10} /> {item.note}
              </span>
            )}
          </div>
          {editor && !readOnly && isActivity && !cancelled && (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => editor.heart(item.id)}
                aria-pressed={item.hearted}
                aria-label={item.hearted ? "Remove Must-Do heart" : "Mark as Must-Do"}
                className={cn("grid h-8 w-8 place-items-center rounded-full transition active:scale-90", item.hearted ? "bg-coral text-white" : "bg-canvas hover:bg-pink-soft")}
              >
                <HeartIcon size={15} weight={item.hearted ? "fill" : "bold"} />
              </button>
              <Link href={`/compare?trip=${trip.id}&item=${item.id}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-canvas px-3 text-xs font-semibold hover:bg-lavender-soft">
                <ArrowsLeftRightIcon size={14} weight="bold" /> Swap
              </Link>
              {item.costMode === "per-person" && (
                <span className="ml-1 hidden items-center sm:inline-flex">
                  <Stepper value={item.qty} onChange={(v) => editor.qty(item.id, v)} min={1} max={trip.prefs.adults + trip.prefs.kids} label={`tickets for ${item.title}`} />
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className={cn("font-display text-sm font-bold tabular", cancelled && "text-faint line-through")}>{cost ? rupees(cost) : item.kind === "checkin" ? "Incl." : ""}</p>
          {item.costMode === "per-person" && cost > 0 && <p className="text-[10px] text-muted">× {item.qty}</p>}
          {editor && !readOnly && !cancelled && (item.kind === "activity" || item.kind === "meal" || item.kind === "rest") && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5" aria-label={`More actions for ${item.title}`}>
                <DotsThreeVerticalIcon size={18} weight="bold" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-[70] min-w-48 rounded-3xl border-2 border-ink bg-white p-1.5 shadow-pop-lg">
                  <Mi icon={<InfoIcon size={16} />} onSelect={() => onOpen?.(item)}>
                    View details
                  </Mi>
                  {isActivity && (
                    <Mi icon={<ArrowsLeftRightIcon size={16} />} href={`/compare?trip=${trip.id}&item=${item.id}`}>
                      Compare & swap
                    </Mi>
                  )}
                  <Mi icon={<CalendarBlankIcon size={16} />} onSelect={() => onMove?.(item)}>
                    Move to another day
                  </Mi>
                  <Mi icon={<ClockIcon size={16} />} onSelect={() => onTime?.(item)}>
                    Change time
                  </Mi>
                  {isActivity && (
                    <Mi icon={<HeartIcon size={16} />} onSelect={() => editor.heart(item.id)}>
                      {item.hearted ? "Remove Must-Do" : "Mark as Must-Do"}
                    </Mi>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <Mi icon={<TrashIcon size={16} />} danger onSelect={() => editor.remove(item.id, item.title)}>
                    Remove
                  </Mi>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function Mi({ children, icon, onSelect, href, danger }: { children: ReactNode; icon: ReactNode; onSelect?: () => void; href?: string; danger?: boolean }) {
  const cls = cn("flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium outline-none data-[highlighted]:bg-lavender-soft", danger && "text-danger data-[highlighted]:bg-danger-soft");
  if (href) {
    return (
      <DropdownMenu.Item asChild className={cls}>
        <Link href={href}>
          {icon}
          {children}
        </Link>
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item onSelect={onSelect} className={cls}>
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

// ─── Day card ──────────────────────────────────────────────────────────

export function DayCard({
  trip,
  day,
  editor,
  readOnly,
  showCancelled = true,
  highlight,
  onAdd,
  onOpen,
  onMove,
  onTime,
  titleSuffix,
}: {
  trip: Trip;
  day: number;
  editor?: Editor;
  readOnly?: boolean;
  showCancelled?: boolean;
  highlight?: Record<string, "now" | "next" | "risk">;
  onAdd?: (day: number) => void;
  onOpen?: (i: TripItem) => void;
  onMove?: (i: TripItem) => void;
  onTime?: (i: TripItem) => void;
  titleSuffix?: ReactNode;
}) {
  useWeatherVersion();
  const items = dayItems(trip.items, day, showCancelled);
  const w = tripDayWeather(trip, day);
  const energy = dayEnergy(trip.items, day);
  const limit = PACE_LIMIT[trip.prefs.pace];
  const WIcon = w.condition === "rain" || w.condition === "storm" ? CloudRainIcon : w.condition === "cloudy" ? CloudIcon : SunIcon;
  const cost = items.reduce((s, i) => s + itemCost(i), 0);
  const current = trip.status === "live" && trip.currentDay === day;
  return (
    <section className={cn("rounded-[30px] bg-white/60 p-3 sm:p-4", current && "bg-lavender-soft/70 ring-2 ring-purple/40")} aria-label={`Day ${day}`}>
      <header className="mb-3 flex flex-wrap items-center gap-2 px-1">
        <span className="rounded-full border-2 border-ink bg-sun px-3 py-1 font-display text-sm font-extrabold shadow-pop">Day {day}</span>
        <span className="text-sm font-semibold text-ink-soft">{dayDate(trip.prefs.startDate, day)}</span>
        {current && <Badge tone="lavender" solid>Today</Badge>}
        {titleSuffix}
        <span className="ml-auto flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold", w.condition === "rain" || w.condition === "storm" ? "bg-sky text-sky-deep" : "bg-white text-ink-soft")} title={conditionLabel[w.condition]}>
            <WIcon size={13} weight="fill" /> {w.tempC}° · {w.rainChance}%
          </span>
          <EnergyBattery value={energy} limit={limit} />
        </span>
      </header>
      <ul>
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <ItemRow key={i.id} trip={trip} item={i} editor={editor} readOnly={readOnly} highlight={highlight?.[i.id]} onOpen={onOpen} onMove={onMove} onTime={onTime} />
          ))}
        </AnimatePresence>
      </ul>
      {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted">Free day, add something you love.</p>}
      <footer className="flex items-center justify-between px-1 pt-1">
        {editor && !readOnly && onAdd ? (
          <button type="button" onClick={() => onAdd(day)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-ink/25 px-3.5 py-2 text-xs font-bold text-ink-soft hover:border-purple hover:text-purple-deep">
            <PlusIcon size={14} weight="bold" /> Add to Day {day}
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs font-semibold text-muted">Day total {rupees(cost)}</span>
      </footer>
    </section>
  );
}

// ─── Sheets ───────────────────────────────────────────────────────────

export function ItemDetailsSheet({ trip, item, onClose, editor }: { trip: Trip; item: TripItem | null; onClose: () => void; editor?: Editor }) {
  const a = item?.refId ? activityMap[item.refId] : undefined;
  const vendor = item?.vendorId ? vendorMap[item.vendorId] : undefined;
  const backup = a?.backupId ? activityMap[a.backupId] : undefined;
  return (
    <Sheet open={!!item} onOpenChange={(v) => !v && onClose()} title={item?.title ?? ""} description={item ? `Day ${item.day} · ${minToTime(item.startMin)} to ${minToTime(item.startMin + item.durationMin)}` : undefined}>
      {item && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-[24px] bg-white p-4 shadow-clay-sm">
            <ArtTile icon={item.icon} tone={item.tone} size={64} />
            <div className="min-w-0">
              <p className="text-sm text-muted">{item.place}</p>
              {a && <Stars value={a.rating} reviews={a.reviews} />}
              <p className="mt-1 font-display text-xl font-bold">{itemCost(item) ? rupees(itemCost(item)) : "Included"}</p>
            </div>
          </div>
          {a && <p className="text-sm leading-relaxed text-ink-soft">{a.description}</p>}
          {a && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Duration", duration(a.durationMin)],
                ["Setting", a.outdoor ? "Outdoor" : "Indoor · rain-safe"],
                ["Energy", `${a.energy}/5`],
                ["Walking", a.walking],
                ["Kids", a.kidFriendly ? "Kid-friendly" : "Not for kids"],
                ["Your match", `${matchPercent(a, trip.prefs)}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white p-3 shadow-clay-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</p>
                  <p className="font-semibold capitalize">{v}</p>
                </div>
              ))}
            </div>
          )}
          {vendor && (
            <div className="rounded-[24px] bg-white p-4 shadow-clay-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Run by</p>
              <p className="font-bold">{vendor.name}</p>
              <p className="text-xs text-muted">
                Trust score {vendor.trustScore} · replies in ~{vendor.avgReplyMin} min · {vendor.language}
              </p>
            </div>
          )}
          {backup && (
            <div className="rounded-[24px] border-2 border-dashed border-purple/30 bg-lavender-soft/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-deep">Plan B ready</p>
              <p className="mt-1 text-sm">
                If the weather turns, we swap to <b>{backup.title}</b> in one tap.
              </p>
            </div>
          )}
          {editor && item.kind === "activity" && item.status !== "cancelled" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-white p-4 shadow-clay-sm">
              <div>
                <p className="text-sm font-semibold">Tickets</p>
                <p className="text-xs text-muted">Not everyone has to join</p>
              </div>
              <Stepper value={item.qty} onChange={(v) => editor.qty(item.id, v)} min={1} max={trip.prefs.adults + trip.prefs.kids} label="tickets" />
            </div>
          )}
          {editor && item.kind === "activity" && item.status !== "cancelled" && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant={item.hearted ? "secondary" : "primary"} onClick={() => editor.heart(item.id)} icon={<HeartIcon size={16} weight="fill" />}>
                {item.hearted ? "Un-heart" : "Must-Do"}
              </Button>
              <Button variant="outline" href={`/compare?trip=${trip.id}&item=${item.id}`} icon={<ArrowsLeftRightIcon size={16} weight="bold" />}>
                Compare
              </Button>
            </div>
          )}
          {item.status === "cancelled" && (
            <p className="flex items-center gap-2 rounded-2xl bg-danger-soft p-3 text-sm text-danger">
              <ProhibitIcon size={16} /> {item.note ?? "Cancelled"}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function MoveSheet({ trip, item, onClose, editor }: { trip: Trip; item: TripItem | null; onClose: () => void; editor: Editor }) {
  const days = Array.from({ length: trip.prefs.nights + 1 }, (_, i) => i + 1);
  return (
    <Sheet open={!!item} onOpenChange={(v) => !v && onClose()} title="Move to another day" description={item?.title} side="center" size="sm">
      <div className="grid gap-2">
        {days.map((d) => {
          const w = tripDayWeather(trip, d);
          const wet = w.condition === "rain" || w.condition === "storm";
          return (
            <button
              key={d}
              type="button"
              disabled={item?.day === d}
              onClick={() => {
                if (item) editor.move(item.id, d);
                onClose();
              }}
              className="flex items-center justify-between rounded-2xl bg-white p-3.5 text-left shadow-clay-sm transition hover:-translate-y-0.5 disabled:opacity-40"
            >
              <span>
                <span className="block font-bold">Day {d}</span>
                <span className="text-xs text-muted">{dayDate(trip.prefs.startDate, d)} · energy {dayEnergy(trip.items, d)}</span>
              </span>
              <span className={cn("text-xs font-bold", wet && item?.outdoor ? "text-danger" : "text-muted")}>
                {w.tempC}° · {w.rainChance}% rain {wet && item?.outdoor ? " · rain risk" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function TimeSheet({ item, onClose, editor }: { item: TripItem | null; onClose: () => void; editor: Editor }) {
  const slots = useMemo(() => Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30), []);
  return (
    <Sheet open={!!item} onOpenChange={(v) => !v && onClose()} title="Change time" description={item ? `${item.title} · ${duration(item.durationMin)}` : undefined} side="center" size="sm">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (item) editor.time(item.id, m);
              onClose();
            }}
            className={cn("rounded-2xl py-2.5 text-sm font-semibold transition", item?.startMin === m ? "bg-ink text-white" : "bg-white shadow-clay-sm hover:bg-lavender-soft")}
          >
            {minToTime(m)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Later items shift automatically so there&apos;s always time to travel.</p>
    </Sheet>
  );
}

export function AddSheet({ trip, day, onClose, editor }: { trip: Trip; day: number | null; onClose: () => void; editor: Editor }) {
  const [filter, setFilter] = useState<string>("all");
  const taken = new Set(trip.items.filter((i) => i.refId && i.status !== "cancelled").map((i) => i.refId));
  const list: Activity[] = activitiesFor(trip.destinationId)
    .filter((a) => !taken.has(a.id))
    .filter((a) => filter === "all" || a.interests.includes(filter as Activity["interests"][number]) || (filter === "indoor" && !a.outdoor))
    .sort((a, b) => matchPercent(b, trip.prefs) - matchPercent(a, trip.prefs));
  return (
    <Sheet open={day != null} onOpenChange={(v) => !v && onClose()} title={`Add to Day ${day ?? ""}`} description="Sorted by how well each experience matches you" size="lg">
      <div className="scrollbar-none -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {["all", "adventure", "nature", "culture", "food", "relax", "indoor"].map((f) => (
          <Chip key={f} size="sm" selected={filter === f} onClick={() => setFilter(f)} className="shrink-0 capitalize">
            {f === "indoor" ? "Rain-safe" : f}
          </Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Everything here is already in your plan</p>
      ) : (
        <div className="grid gap-3">
          {list.map((a) => (
            <ActivityCard
              key={a.id}
              a={a}
              match={matchPercent(a, trip.prefs)}
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    if (day != null) editor.add(a, day);
                    onClose();
                  }}
                  icon={<PlusIcon size={14} weight="bold" />}
                >
                  Add
                </Button>
              }
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}

export function useItinerarySheets() {
  const [details, setDetails] = useState<TripItem | null>(null);
  const [moving, setMoving] = useState<TripItem | null>(null);
  const [timing, setTiming] = useState<TripItem | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  return { details, setDetails, moving, setMoving, timing, setTiming, adding, setAdding };
}

