"use client";
import { resendBookingRequest, setBookingStatus } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircleIcon, PaperPlaneTiltIcon, XCircleIcon, ChatsCircleIcon, GlobeIcon, PhoneIcon } from "@phosphor-icons/react";
import type { Booking, BookingStatus } from "@/types";
import { useBookingStore } from "@/stores/bookingStore";
import { useTripStore } from "@/stores/tripStore";
import { FilterPill, PageHead, Panel, SearchInput } from "@/components/ops/opsKit";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { vendorMap } from "@/data/vendors";
import { formatDate, rupees, timeAgo } from "@/lib/format";
import { toast } from "@/stores/notificationStore";

const KIND: Record<BookingStatus, "success" | "warning" | "danger" | "neutral"> = { confirmed: "success", requested: "warning", declined: "danger", cancelled: "neutral" };
const CHANNEL: Record<string, typeof ChatsCircleIcon> = { telegram: ChatsCircleIcon, whatsapp: ChatsCircleIcon, web: GlobeIcon, phone: PhoneIcon };

function BookingsInner() {
  const params = useSearchParams();
  const bookings = useBookingStore((s) => s.bookings);
  const trips = useTripStore((s) => s.trips);
  const [q, setQ] = useState("");
  const [status, setStatusFilter] = useState<BookingStatus | "all">((params.get("status") as BookingStatus) ?? "all");
  const [open, setOpen] = useState<Booking | null>(null);
  const [limit, setLimit] = useState(40);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return [...bookings]
      .filter((b) => status === "all" || b.status === status)
      .filter((b) => !n || [b.id, b.itemTitle, b.customerName, vendorMap[b.vendorId]?.name ?? "", trips[b.tripId]?.code ?? ""].some((s) => s.toLowerCase().includes(n)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [bookings, q, status, trips]);
  const count = (s: BookingStatus | "all") => (s === "all" ? bookings.length : bookings.filter((b) => b.status === s).length);

  return (
    <div>
      <PageHead title="Bookings" sub="One booking per partner per item. Every reply is logged." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search booking, vendor, traveler, trip…" />
        {(["all", "requested", "confirmed", "declined", "cancelled"] as const).map((s) => (
          <FilterPill key={s} active={status === s} onClick={() => setStatusFilter(s)} count={count(s)}>
            {s === "requested" ? "Pending" : s[0].toUpperCase() + s.slice(1)}
          </FilterPill>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No bookings" body="Nothing matches these filters." mood="thinking" />
      ) : (
        <Panel pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-canvas text-left text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  {["Booking", "Item", "Vendor", "Traveler", "Date", "Amount", "Status", "Channel"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((b) => {
                  const Ch = CHANNEL[b.channel];
                  return (
                    <tr key={b.id + b.itemId} onClick={() => setOpen(b)} className="cursor-pointer border-t border-line hover:bg-canvas/60">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold">{b.id}</p>
                        <p className="text-[11px] text-muted">{trips[b.tripId]?.code}</p>
                      </td>
                      <td className="max-w-56 truncate px-4 py-3 font-semibold">{b.itemTitle}</td>
                      <td className="px-4 py-3 text-xs">{vendorMap[b.vendorId]?.name}</td>
                      <td className="px-4 py-3 text-xs">{b.customerName}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(b.date)}</td>
                      <td className="px-4 py-3 font-semibold tabular">{b.amount ? rupees(b.amount) : ""}</td>
                      <td className="px-4 py-3">
                        <StatusBadge kind={KIND[b.status]}>{b.status === "requested" ? "pending" : b.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <Ch size={16} weight="duotone" aria-label={b.channel} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <Button size="sm" variant="secondary" onClick={() => setLimit(limit + 40)}>
                Show more ({filtered.length - limit} left)
              </Button>
            </div>
          )}
        </Panel>
      )}

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)} title={open?.id ?? ""} description={open?.itemTitle}>
        {open && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Status", <StatusBadge key="s" kind={KIND[open.status]}>{open.status}</StatusBadge>],
                ["Amount", rupees(open.amount)],
                ["Vendor", vendorMap[open.vendorId]?.name],
                ["Contact", `${vendorMap[open.vendorId]?.contactName} · ${vendorMap[open.vendorId]?.phone}`],
                ["Traveler", open.customerName],
                ["Trip", trips[open.tripId]?.code],
                ["Date", `${formatDate(open.date, { weekday: "short", day: "numeric", month: "short" })} · Day ${open.day}`],
                ["Last update", timeAgo(open.updatedAt)],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-2xl bg-white p-3 shadow-clay-sm">
                  <dt className="text-[11px] font-semibold uppercase text-muted">{k as string}</dt>
                  <dd className="mt-0.5 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              {open.status !== "confirmed" && (
                <Button onClick={() => setBookingStatus(open.id, "confirmed").then((b) => { setOpen(b); toast({ tone: "success", title: "Marked confirmed" }); }).catch((e) => toast({ tone: "error", title: errorMessage(e) }))} icon={<CheckCircleIcon size={16} weight="fill" />}>
                  Mark confirmed
                </Button>
              )}
              {open.status === "requested" && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    resendBookingRequest(open.id)
                      .then(() => toast({ tone: "success", title: "Request re-sent", body: `Reply link sent to ${vendorMap[open.vendorId]?.name ?? "the partner"}` }))
                      .catch((e) => toast({ tone: "error", title: errorMessage(e) }))
                  }
                  icon={<PaperPlaneTiltIcon size={16} />}
                >
                  Resend request
                </Button>
              )}
              {open.status !== "cancelled" && (
                <Button variant="ghost" onClick={() => setBookingStatus(open.id, "cancelled").then((b) => { setOpen(b); toast({ tone: "warning", title: "Booking cancelled" }); }).catch((e) => toast({ tone: "error", title: errorMessage(e) }))} icon={<XCircleIcon size={16} />}>
                  Cancel
                </Button>
              )}
              <Button variant="soft" href={`/ops/tours/${open.tripId}`}>
                Open tour
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsInner />
    </Suspense>
  );
}

