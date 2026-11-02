"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  FlagCheckeredIcon,
  ArrowLeftIcon,
  CloudRainIcon,
  AirplaneTiltIcon,
  StorefrontIcon,
  ProhibitIcon,
  ClockIcon,
  CaretDownIcon,
  ChatsCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  HourglassMediumIcon,
  RobotIcon,
  ArrowRightIcon,
  LinkIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import type { IncidentKind } from "@/types";
import { useTrip } from "@/stores/tripStore";
import { useBookingStore } from "@/stores/bookingStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { useAgentStore } from "@/stores/agentStore";
import { PageHead, Panel, RiskBar, TourStatusBadge } from "./opsKit";
import { Tabs } from "@/components/ui/Tabs";
import { TripDocuments } from "@/components/traveler/TripDocuments";
import { Button } from "@/components/ui/Button";
import { Avatar, StatusBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { ArtTile } from "@/components/art/ArtTile";

import { PriceBreakdown } from "@/components/traveler/PriceBreakdown";
import { ReceiptCard } from "@/components/traveler/TripBits";
import { incidentIcon } from "@/components/adapt/ImpactMap";
import { createIncident } from "@/lib/api/incidents";
import { completeTour, resendBookingRequest, setBookingStatus } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/client";
import { tourRow } from "@/lib/api/ops";
import { priceTrip, itemCost } from "@/lib/engine/pricing";
import { dayItems } from "@/lib/engine/schedule";
import { destinationMap } from "@/data/destinations";
import { vendorMap } from "@/data/vendors";

import { useCustomers } from "@/hooks/queries";
import { addDays, cn, formatDate, minToTime, rupees, timeAgo } from "@/lib/format";
import { toast } from "@/stores/notificationStore";

const SIMS: { kind: IncidentKind; label: string; Icon: typeof CloudRainIcon; delayMin?: number }[] = [
  { kind: "weather", label: "Heavy rain tomorrow", Icon: CloudRainIcon },
  { kind: "flight_delay", label: "Flight delayed 3 hours", Icon: AirplaneTiltIcon, delayMin: 180 },
  { kind: "vendor_unavailable", label: "Activity vendor cancels", Icon: StorefrontIcon },
  { kind: "closure", label: "Attraction closed", Icon: ProhibitIcon },
  { kind: "running_late", label: "Group running 45 min late", Icon: ClockIcon, delayMin: 45 },
];

export function TourDetail({ id }: { id: string }) {
  const router = useRouter();
  const trip = useTrip(id);
  const bookings = useBookingStore((s) => s.bookings);
  const ledger = useBookingStore((s) => s.ledger);
  const incidents = useIncidentStore((s) => s.incidents);
  const runs = useAgentStore((s) => s.runs);
  const [tab, setTab] = useState("schedule");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const { data: customers } = useCustomers();
  const row = useMemo(() => (trip ? tourRow(trip, incidents, bookings) : null), [trip, incidents, bookings]);

  if (!trip || !row) return <EmptyState title="Tour not found" action={<Button href="/ops/tours">All tours</Button>} />;
  const dest = destinationMap[trip.destinationId];
  const price = priceTrip(trip);
  const mine = bookings.filter((b) => b.tripId === trip.id);
  const trIncidents = incidents.filter((i) => i.tripId === trip.id);
  const open = trIncidents.find((i) => i.status !== "resolved");
  const trRuns = Object.values(runs).filter((r) => r.tripId === trip.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const customer = customers?.find((c) => c.id === trip.customerId);
  const days = Array.from({ length: trip.prefs.nights + 1 }, (_, i) => i + 1);
  const money = ledger.filter((l) => l.tripId === trip.id);
  const vendorIds = [...new Set(trip.items.filter((i) => i.vendorId && i.status !== "cancelled").map((i) => i.vendorId as string))];

  const simulate = async (s: (typeof SIMS)[number]) => {
    setBusy(s.kind);
    try {
      const vendorId = s.kind === "vendor_unavailable" ? trip.items.find((i) => i.kind === "activity" && i.status !== "done" && i.status !== "cancelled")?.vendorId : undefined;
      const place = s.kind === "closure" ? trip.items.find((i) => i.kind === "activity" && i.status !== "done")?.place : undefined;
      const inc = await createIncident(trip.id, s.kind, { delayMin: s.delayMin, vendorId, place, day: s.kind === "running_late" ? (trip.currentDay ?? 2) : undefined });
      router.push(`/ops/incidents/${inc.id}`);
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Link href="/ops/tours" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon size={14} /> Tours
      </Link>
      <PageHead
        kicker={`${trip.code} · ${dest.name}`}
        title={trip.groupName}
        sub={`${formatDate(trip.prefs.startDate)} to ${formatDate(addDays(trip.prefs.startDate, trip.prefs.nights))} · ${row.travelers} travelers · ${trip.status === "live" ? `Day ${trip.currentDay} of ${days.length}` : trip.status}`}
        actions={
          <>
            {(trip.status === "booked" || trip.status === "live") && (
              <Button
                size="sm"
                variant={confirmEnd ? "danger" : "outline"}
                loading={ending}
                icon={<FlagCheckeredIcon size={14} weight="bold" />}
                onClick={async () => {
                  if (!confirmEnd) return setConfirmEnd(true);
                  setEnding(true);
                  try {
                    await completeTour(trip.id);
                    toast({ tone: "success", title: "Trip completed", body: "The traveler has been asked for feedback." });
                  } catch (e) {
                    toast({ tone: "error", title: errorMessage(e) });
                  } finally {
                    setEnding(false);
                    setConfirmEnd(false);
                  }
                }}
                onBlur={() => setConfirmEnd(false)}
              >
                {confirmEnd ? "Confirm: end trip" : "Complete trip"}
              </Button>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button size="sm" variant="outline" className="bg-sun" loading={!!busy} icon={<CloudRainIcon size={14} weight="bold" />}>
                  Report a problem <CaretDownIcon size={12} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-[70] min-w-60 rounded-2xl border border-line bg-white p-1.5 shadow-float">
                  {SIMS.map((s) => (
                    <DropdownMenu.Item key={s.kind} onSelect={() => void simulate(s)} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-canvas">
                      <s.Icon size={16} weight="duotone" /> {s.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {open && (
              <Button size="sm" href={`/ops/incidents/${open.id}`} icon={<ArrowRightIcon size={14} weight="bold" />}>
                Open problem
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
          <p className="text-xs text-muted">Status</p>
          <div className="mt-2 flex items-center gap-2">
            <TourStatusBadge status={row.status} />
            <RiskBar risk={row.risk} />
          </div>
          {row.riskReasons.length > 0 && <p className="mt-2 text-[11px] text-ink-soft">{row.riskReasons.join(" · ")}</p>}
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
          <p className="text-xs text-muted">Trip value</p>
          <p className="mt-1 font-display text-xl font-extrabold">{rupees(price.total)}</p>
          <p className="text-[11px] text-muted">{rupees(price.perPerson)} per traveler</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
          <p className="text-xs text-muted">Vendors</p>
          <p className="mt-1 font-display text-xl font-extrabold">
            {vendorIds.length} <span className="text-sm font-semibold text-muted">· {row.pendingVendors} pending</span>
          </p>
          <p className="text-[11px] text-muted">{mine.filter((b) => b.status === "confirmed").length}/{mine.length} bookings confirmed</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
          <p className="text-xs text-muted">Lead traveler</p>
          <p className="mt-1 font-display text-xl font-extrabold">{trip.customerName}</p>
          <p className="text-[11px] text-muted">{trip.prefs.adults + trip.prefs.kids} traveler{trip.prefs.adults + trip.prefs.kids === 1 ? "" : "s"} · {trip.code}</p>
        </div>
      </div>

      <div className="space-y-4">
          <Tabs
            variant="bento"
            value={tab}
            onValueChange={setTab}
            layoutId="tour-tabs"
            items={[
              { value: "schedule", label: "Schedule" },
              { value: "vendors", label: "Bookings" },
              { value: "payments", label: "Payments" },
              { value: "changes", label: "Problems", badge: open ? <span className="rounded-full bg-danger px-1.5 text-[10px] text-white">!</span> : undefined },
              { value: "people", label: "Travelers" },
              { value: "docs", label: "Documents" },
            ]}
          />

          {tab === "schedule" && (
            <div className="space-y-4">
              {days.map((d) => (
                <Panel key={d} title={`Day ${d} · ${formatDate(addDays(trip.prefs.startDate, d - 1), { weekday: "short", day: "numeric", month: "short" })}`} pad={false} action={trip.currentDay === d ? <StatusBadge kind="purple" pulse>Today</StatusBadge> : undefined}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
                        <tr>
                          {["Time", "Item", "Vendor", "Booking", "Depends on", "Buffer", "Cost"].map((h) => (
                            <th key={h} scope="col" className="px-4 py-2 font-bold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dayItems(trip.items, d, true).map((i) => {
                          const b = mine.find((x) => x.itemId === i.id);
                          return (
                            <tr key={i.id} className={cn("border-t border-line", i.status === "cancelled" && "opacity-50")}>
                              <td className="px-4 py-2.5 text-xs font-bold tabular">{minToTime(i.startMin)}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <ArtTile icon={i.icon} tone={i.tone} size={28} />
                                  <span className={cn("font-semibold", i.status === "cancelled" && "line-through")}>{i.title}</span>
                                  {i.hearted && <span className="text-[10px] font-bold text-coral">Must-Do</span>}
                                  {i.status === "changed" && <StatusBadge kind="purple">Changed</StatusBadge>}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-xs">{i.vendorId ? <Link href={`/ops/vendors/${i.vendorId}`} className="hover:underline">{vendorMap[i.vendorId]?.name}</Link> : ""}</td>
                              <td className="px-4 py-2.5">
                                {b ? <StatusBadge kind={b.status === "confirmed" ? "success" : b.status === "requested" ? "warning" : "danger"}>{b.status}</StatusBadge> : <span className="text-xs text-muted"></span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted">{i.dependsOn.map((dep) => trip.items.find((x) => x.id === dep)?.title).filter(Boolean).join(", ") || ""}</td>
                              <td className="px-4 py-2.5 text-xs tabular">{i.bufferMin} min</td>
                              <td className="px-4 py-2.5 font-semibold tabular">{itemCost(i) ? rupees(itemCost(i)) : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ))}
            </div>
          )}

          {tab === "vendors" && (
            <Panel title={`${vendorIds.length} vendors`} pad={false}>
              <ul className="divide-y divide-line">
                {vendorIds.map((v) => {
                  const vendor = vendorMap[v];
                  const bs = mine.filter((b) => b.vendorId === v);
                  const status = bs.some((b) => b.status === "declined") ? "declined" : bs.length && bs.every((b) => b.status === "confirmed") ? "confirmed" : bs.length ? "requested" : "none";
                  return (
                    <li key={v} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/ops/vendors/${v}`} className="font-bold hover:underline">
                          {vendor?.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {vendor?.contactName} · {vendor?.phone} · trust {vendor?.trustScore}
                        </p>
                        <p className="text-[11px] text-ink-soft">{trip.items.filter((i) => i.vendorId === v).map((i) => `D${i.day} ${i.title}`).join(" · ")}</p>
                      </div>
                      {status === "confirmed" && <StatusBadge kind="success" icon={<CheckCircleIcon size={12} weight="fill" />}>Confirmed</StatusBadge>}
                      {status === "requested" && <StatusBadge kind="warning" icon={<HourglassMediumIcon size={12} weight="fill" />}>Waiting</StatusBadge>}
                      {status === "declined" && <StatusBadge kind="danger" icon={<XCircleIcon size={12} weight="fill" />}>Declined</StatusBadge>}
                      {status === "none" && <StatusBadge kind="neutral">Not booked</StatusBadge>}
                      <div className="flex gap-1.5">
                        {status === "requested" && (
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() =>
                              Promise.all(bs.map((b) => setBookingStatus(b.id, "confirmed")))
                                .then(() => toast({ tone: "success", title: `${vendor?.name} marked confirmed`, body: "Logged as a phone confirmation." }))
                                .catch((e) => toast({ tone: "error", title: errorMessage(e) }))
                            }
                          >
                            Mark confirmed
                          </Button>
                        )}
                        {status === "requested" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const pending = bs.find((b) => b.status === "requested");
                              if (!pending) return;
                              resendBookingRequest(pending.id)
                                .then(() => toast({ tone: "success", title: "Request sent again", body: `${vendor?.name} got a new reply link` }))
                                .catch((e) => toast({ tone: "error", title: errorMessage(e) }));
                            }}
                            icon={<PaperPlaneTiltIcon size={14} />}
                          >
                            Resend
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" href="/ops/inbox" icon={<ChatsCircleIcon size={14} weight="fill" className="text-purple" />}>
                          Message
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {tab === "payments" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Panel title="Payments for this trip" pad={false}>
                {money.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted">No payments yet, the tour is still being planned.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {money.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <StatusBadge kind={l.kind === "payment" ? "success" : l.kind === "refund" ? "info" : l.kind === "payout" ? "purple" : "warning"}>{l.kind}</StatusBadge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{l.party}</p>
                          <p className="truncate text-[11px] text-muted">
                            {l.note} · {l.method}
                          </p>
                        </div>
                        <span className={cn("font-bold tabular", l.amount < 0 ? "text-danger" : "text-success")}>{rupees(l.amount, { sign: true })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Price breakdown">
                <PriceBreakdown price={price} />
              </Panel>
            </div>
          )}

          {tab === "changes" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Incidents">
                {trIncidents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">No problems on this trip.</p>
                ) : (
                  <ul className="space-y-2">
                    {trIncidents.map((i) => {
                      const Icon = incidentIcon(i.kind);
                      return (
                        <li key={i.id}>
                          <Link href={`/ops/incidents/${i.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-canvas">
                            <Icon size={20} weight="duotone" />
                            <div className="flex-1">
                              <p className="text-sm font-bold">{i.title}</p>
                              <p className="text-[11px] text-muted">
                                Day {i.day} · {timeAgo(i.createdAt)}
                              </p>
                            </div>
                            <StatusBadge kind={i.status === "resolved" ? "success" : i.status === "escalated" ? "danger" : "warning"}>{i.status.replace("_", " ")}</StatusBadge>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
              <Panel title="Agent activity">
                {trRuns.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">The agent hasn&apos;t touched this tour yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {trRuns.map((r) => (
                      <li key={r.id}>
                        <Link href={`/ops/agent?run=${r.id}`} className="flex items-center gap-3 rounded-xl bg-lavender-soft/60 p-3">
                          <RobotIcon size={18} weight="fill" className="text-purple-deep" />
                          <span className="flex-1 text-sm font-semibold">
                            {r.steps.length} steps · attempt {r.attempt}
                          </span>
                          <StatusBadge kind={r.status === "succeeded" ? "success" : r.status === "needs_human" || r.status === "failed" ? "danger" : "purple"}>{r.status.replace("_", " ")}</StatusBadge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <div className="lg:col-span-2">
                <Panel title="Change receipts">{trip.receipts.length ? <div className="grid gap-3 md:grid-cols-2">{trip.receipts.map((r) => <ReceiptCard key={r.id} r={r} />)}</div> : <p className="text-sm text-muted">No changes yet.</p>}</Panel>
              </div>
            </div>
          )}

          {tab === "docs" && <TripDocuments tripId={trip.id} booked={trip.status !== "draft"} />}
          {tab === "people" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Lead traveler">
                <div className="flex items-center gap-3">
                  <Avatar name={trip.customerName} tone={customer?.tone ?? "sky"} size={48} />
                  <div className="flex-1">
                    <p className="font-bold">{trip.customerName}</p>
                    <p className="text-xs text-muted">
                      {customer?.email ?? ""} · {customer?.phone ?? ""}
                    </p>
                    {customer && <p className="text-xs text-muted">{customer.city} · {customer.dnaName} · {customer.trips} trips</p>}
                  </div>
                  {customer && (
                    <Button size="sm" variant="secondary" href={`/ops/customers?c=${customer.id}`} icon={<LinkIcon size={14} />}>
                      Profile
                    </Button>
                  )}
                </div>
              </Panel>
              <Panel title="Group">
                <p className="text-sm">
                  {trip.prefs.adults} adults · {trip.prefs.kids} kids · {trip.prefs.pace} pace
                </p>
                <p className="mt-1 text-xs text-muted">Interests: {trip.prefs.interests.join(", ")}</p>
                {trip.prefs.ownWords && <p className="mt-2 rounded-xl bg-canvas p-3 text-xs italic">“{trip.prefs.ownWords}”</p>}
                {trip.prefs.special.length > 0 && <p className="mt-2 text-xs">Needs: {trip.prefs.special.join(", ")}</p>}
              </Panel>
            </div>
          )}
      </div>
    </div>
  );
}
