"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  BackpackIcon,
  NavigationArrowIcon,
  WarningIcon,
  StarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  StorefrontIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { useTrip } from "@/stores/tripStore";
import { useBookingStore } from "@/stores/bookingStore";
import { useOpenIncidentFor } from "@/stores/incidentStore";

import { DestinationArt } from "@/components/art/DestinationArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { DayCard, ItemDetailsSheet } from "@/components/traveler/Itinerary";
import { HotelCard, TransportRow } from "@/components/traveler/Cards";
import { ReceiptCard, WeatherStrip } from "@/components/traveler/TripBits";
import { TripPass } from "@/components/traveler/TripPass";
import { TripDocuments } from "@/components/traveler/TripDocuments";
import { WhatsAppThread } from "@/components/traveler/WhatsAppThread";
import { FlightStatusCard } from "@/components/traveler/LiveInfo";
import { PriceBreakdown } from "@/components/traveler/PriceBreakdown";
import { destinationMap } from "@/data/destinations";
import { stayMap, transportMap } from "@/data/stays";
import { vendorMap } from "@/data/vendors";

import { priceTrip } from "@/lib/engine/pricing";

import { addDays, cn, daysBetween, formatDate, todayISO } from "@/lib/format";

import type { TripItem } from "@/types";

export function TripDashboard({ id }: { id: string }) {
  const trip = useTrip(id);
  const bookings = useBookingStore((s) => s.bookings);
  const incident = useOpenIncidentFor(id);
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("doc") ? "docs" : "itinerary");
  const [details, setDetails] = useState<TripItem | null>(null);
  const mine = useMemo(() => bookings.filter((b) => b.tripId === id), [bookings, id]);

  if (!trip) return <EmptyState title="Trip not found" body="It may have been removed." action={<Button href="/my-trip">My trips</Button>} />;
  const d = destinationMap[trip.destinationId];
  const price = priceTrip(trip);
  const toGo = daysBetween(todayISO(), trip.prefs.startDate);
  const days = Array.from({ length: trip.prefs.nights + 1 }, (_, i) => i + 1);
  const byVendor = [...new Map(mine.map((b) => [b.vendorId, b])).values()];

  return (
    <div className="space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-[36px] border-2 border-ink shadow-pop-lg">
        <div className="h-56 sm:h-64">
          <DestinationArt kind={d.art} rain={!!incident && incident.kind === "weather"} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3 text-white">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {trip.status === "live" && <StatusBadge kind="success" pulse>Live · Day {trip.currentDay} of {trip.prefs.nights + 1}</StatusBadge>}
              {trip.status === "booked" && <StatusBadge kind="info">Confirmed</StatusBadge>}
              {trip.status === "completed" && <StatusBadge kind="purple">Completed</StatusBadge>}
              {trip.status === "draft" && <StatusBadge kind="neutral">Draft</StatusBadge>}
              <span className="text-xs font-semibold opacity-80">{trip.code}</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{trip.title}</h1>
            <p className="text-sm opacity-90">
              {formatDate(trip.prefs.startDate, { weekday: "short", day: "numeric", month: "short" })} to {formatDate(addDays(trip.prefs.startDate, trip.prefs.nights), { weekday: "short", day: "numeric", month: "short" })} · {trip.prefs.adults + trip.prefs.kids} travelers
            </p>
          </div>
          {trip.status === "booked" && (
            <div className="rounded-2xl border-2 border-ink bg-sun px-4 py-2 text-center text-ink shadow-pop">
              <p className="font-display text-3xl font-extrabold leading-none">{Math.max(0, toGo)}</p>
              <p className="text-[11px] font-bold uppercase">{toGo === 1 ? "day to go" : "days to go"}</p>
            </div>
          )}
        </div>
      </div>

      {incident && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-[26px] border-2 border-ink bg-sky p-4 shadow-pop">
          <WarningIcon size={26} weight="duotone" className="text-sky-deep" />
          <div className="flex-1">
            <p className="font-bold">
              {incident.title} · Day {incident.day}
            </p>
            <p className="text-sm text-ink-soft">{incident.status === "awaiting_vendors" ? "We're confirming a fix with your vendors right now." : "Some plans are affected. Pick a fix or let us handle it."}</p>
          </div>
          <Button href="/my-trip/adapt" icon={<ArrowRightIcon size={16} weight="bold" />}>
            See fix plans
          </Button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/prepare", label: "Prepare", sub: "Smart checklist", Icon: BackpackIcon, tone: "bg-mint" },
          { href: "/my-trip/live", label: "Live mode", sub: trip.status === "live" ? "Today's plan" : "Starts on trip day", Icon: NavigationArrowIcon, tone: "bg-lavender" },
          { href: "/my-trip/adapt", label: "Adapt", sub: incident ? "Fix needed" : "All good", Icon: WarningIcon, tone: "bg-sky" },
          { href: "/review", label: "Review", sub: trip.review ? "Thanks!" : "After your trip", Icon: StarIcon, tone: "bg-sun" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="group rounded-[24px] bg-white p-4 shadow-clay-sm transition hover:-translate-y-1">
            <span className={cn("grid h-11 w-11 place-items-center rounded-2xl border-2 border-ink", a.tone)}>
              <a.Icon size={20} weight="duotone" />
            </span>
            <p className="mt-3 font-bold">{a.label}</p>
            <p className="text-xs text-muted">{a.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Tabs
            value={tab}
            onValueChange={setTab}
            layoutId="trip-tabs"
            items={[
              { value: "itinerary", label: "Itinerary" },
              { value: "bookings", label: "Bookings", badge: <span className="rounded-full bg-mint px-1.5 text-[10px] text-ink">{byVendor.length}</span> },
              { value: "stay", label: "Stay & transport" },
              { value: "receipts", label: "Changes", badge: trip.receipts.length ? <span className="rounded-full bg-coral px-1.5 text-[10px] text-white">{trip.receipts.length}</span> : undefined },
              { value: "docs", label: "Documents" },
              ...(trip.status !== "draft" ? [{ value: "whatsapp", label: "Messages" }] : []),
            ]}
          />
          {tab === "itinerary" && (
            <div className="space-y-4">
              <WeatherStrip trip={trip} />
              {days.map((day) => (
                <DayCard key={day} trip={trip} day={day} readOnly onOpen={setDetails} />
              ))}
            </div>
          )}
          {tab === "bookings" && (
            <Card pad="md">
              {byVendor.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No bookings yet, they appear once you pay.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {byVendor.map((b) => {
                    const all = mine.filter((x) => x.vendorId === b.vendorId);
                    const status = all.some((x) => x.status === "declined") ? "declined" : all.every((x) => x.status === "confirmed") ? "confirmed" : "requested";
                    return (
                      <li key={b.vendorId} className="flex items-center gap-3 py-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas">
                          <StorefrontIcon size={18} weight="duotone" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{vendorMap[b.vendorId]?.name ?? b.vendorId}</p>
                          <p className="truncate text-xs text-muted">{all.map((x) => x.itemTitle).slice(0, 2).join(", ")}</p>
                        </div>
                        {status === "confirmed" ? (
                          <StatusBadge kind="success" icon={<CheckCircleIcon size={12} weight="fill" />}>Confirmed</StatusBadge>
                        ) : status === "declined" ? (
                          <StatusBadge kind="danger" icon={<XCircleIcon size={12} weight="fill" />}>Replaced</StatusBadge>
                        ) : (
                          <StatusBadge kind="warning" icon={<ClockIcon size={12} weight="fill" />}>Waiting</StatusBadge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
          {tab === "stay" && (
            <div className="space-y-3">
              {stayMap[trip.stayId] && <HotelCard s={stayMap[trip.stayId]} nights={trip.prefs.nights} rooms={price.rooms} />}
              {transportMap[trip.transportId] && <TransportRow t={transportMap[trip.transportId]} travelers={trip.prefs.adults + trip.prefs.kids} />}
            </div>
          )}
          {tab === "receipts" && (
            <div className="space-y-3">
              {trip.receipts.length === 0 ? (
                <EmptyState compact title="No changes yet" body="Every change to your trip gets a Change Receipt: what changed, who approved it and the price difference." mood="happy" />
              ) : (
                trip.receipts.map((r) => <ReceiptCard key={r.id} r={r} />)
              )}
            </div>
          )}
          {tab === "docs" && <TripDocuments tripId={trip.id} booked={trip.status !== "draft"} />}
          {tab === "whatsapp" && <WhatsAppThread tripId={trip.id} height={440} />}
        </div>

        <aside className="space-y-4">
          <TripPass trip={trip} />
          <FlightStatusCard trip={trip} />
          <Card pad="md">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Emergency help</p>
            <div className="mt-3 space-y-1.5">
              {d.emergency.map((e) => (
                <a key={e.label} href={`tel:${e.phone.replace(/\s/g, "")}`} className="flex justify-between rounded-xl bg-pink-soft px-3 py-2 text-xs">
                  <span className="font-semibold">{e.label}</span>
                  <span>{e.phone}</span>
                </a>
              ))}
            </div>
          </Card>
          <Card pad="md">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Total cost</p>
            <PriceBreakdown price={price} compact />
          </Card>
        </aside>
      </div>
      <ItemDetailsSheet trip={trip} item={details} onClose={() => setDetails(null)} />
    </div>
  );
}
