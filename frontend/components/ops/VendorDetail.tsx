"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeftIcon, PhoneIcon, ChatsIcon, ClockIcon, StarIcon, ProhibitIcon, ChatTextIcon } from "@phosphor-icons/react";
import { useVendor } from "@/hooks/queries";
import { useBookingStore } from "@/stores/bookingStore";
import { useTripStore } from "@/stores/tripStore";
import { useAgentStore } from "@/stores/agentStore";
import { PageHead, Panel, StatCard } from "./opsKit";
import { AvailabilityToggle, TrustRing } from "./VendorBits";
import { VendorHistoryChart } from "./Charts";
import { Button } from "@/components/ui/Button";
import { Skeleton, StatusBadge } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { destinationMap } from "@/data/destinations";
import { activities } from "@/data/activities";
import { stays } from "@/data/stays";
import { formatDate, rupees, timeAgo } from "@/lib/format";

export function VendorDetail({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useVendor(id);
  const v = data?.vendor;
  const bookings = useBookingStore((s) => s.bookings);
  const trips = useTripStore((s) => s.trips);
  const requests = useAgentStore((s) => s.requests);
  const mine = useMemo(() => bookings.filter((b) => b.vendorId === id).sort((a, b) => b.date.localeCompare(a.date)), [bookings, id]);
  const reqs = data?.requests ?? Object.values(requests).filter((r) => r.vendorId === id);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (error || !v) return <ErrorState title="Vendor not found" error={error} onRetry={() => refetch()} action={<Button size="sm" variant="secondary" href="/ops/vendors">All vendors</Button>} />;
  const offers = [...activities.filter((a) => a.vendorId === id || a.altVendorId === id).map((a) => a.title), ...stays.filter((s) => s.vendorId === id).map((s) => s.name)];
  const revenue = mine.filter((b) => b.status === "confirmed").reduce((s, b) => s + b.amount, 0);

  return (
    <div>
      <Link href="/ops/vendors" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon size={14} /> Vendors
      </Link>
      <PageHead
        kicker={`${v.kind} · ${destinationMap[v.destinationId].name}`}
        title={v.name}
        sub={`${v.contactName || "No contact yet"} · ${v.phone || "no phone on file"}${v.email ? ` · ${v.email}` : ""} · ${v.language}`}
        actions={
          <>
            <AvailabilityToggle v={v} />
            {v.phone && (
              <Button size="sm" variant="secondary" href={`tel:${v.phone.replace(/\s/g, "")}`} icon={<PhoneIcon size={14} weight="fill" />}>
                Call
              </Button>
            )}
            <Button size="sm" href="/ops/inbox" icon={<ChatsIcon size={14} weight="fill" />}>
              Inbox
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
          <TrustRing score={v.trustScore} size={64} />
          <div>
            <p className="text-xs text-muted">Trust score</p>
            <p className="text-sm font-bold">{v.trustScore >= 85 ? "Highly reliable" : v.trustScore >= 65 ? "Watch" : "Auto-backup on"}</p>
          </div>
        </div>
        <StatCard label="Reply rate" value={`${v.responseRate}%`} icon={<ChatTextIcon size={16} weight="duotone" />} />
        <StatCard label="Avg reply time" value={`${v.avgReplyMin} min`} icon={<ClockIcon size={16} weight="duotone" />} tone="bg-sky-soft" />
        <StatCard label="Cancellation rate" value={`${v.cancellationRate}%`} icon={<ProhibitIcon size={16} weight="duotone" />} tone="bg-danger-soft" alert={(v.cancellationRate ?? 0) > 5} />
        <StatCard label="Rating" value={v.rating} hint={`${rupees(revenue)} confirmed business`} icon={<StarIcon size={16} weight="duotone" />} tone="bg-sun-soft" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Last 6 months">
          <VendorHistoryChart data={v.history} />
        </Panel>
        <Panel title="How the trust score works">
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>45% · reply rate on requests ({v.requests ? `${v.responseRate}%` : "no requests yet"})</li>
            <li>35% · reliability (declined or unanswered {v.requests ? `${v.cancellationRate}%` : ""})</li>
            <li>20% · reply speed ({v.requests ? `${v.avgReplyMin} min` : ""}), plus traveler stars when reviewed ({v.rating ? `${v.rating}★` : "none yet"}). New partners start at 80.</li>
          </ul>
          <p className="mt-3 rounded-xl bg-canvas p-3 text-xs">
            Vendors below 65 get a backup partner pre-picked automatically, and the Trip Fixer Agent asks them first to confirm last.
          </p>
          {offers.length > 0 && (
            <>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Offers on Prayaana</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {offers.map((o) => (
                  <span key={o} className="rounded-lg bg-canvas px-2 py-1 text-xs">
                    {o}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title={`Bookings (${mine.length})`} pad={false}>
          {mine.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">No bookings with this vendor yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {mine.slice(0, 30).map((b) => (
                <li key={b.id + b.itemId} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/ops/tours/${b.tripId}`} className="truncate font-semibold hover:underline">
                      {b.itemTitle}
                    </Link>
                    <p className="text-[11px] text-muted">
                      {trips[b.tripId]?.code} · {b.customerName} · {formatDate(b.date)}
                    </p>
                  </div>
                  <StatusBadge kind={b.status === "confirmed" ? "success" : b.status === "requested" ? "warning" : "danger"}>{b.status}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Change requests" pad={false}>
          {reqs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">No change requests sent.</p>
          ) : (
            <ul className="divide-y divide-line">
              {reqs.map((r) => (
                <li key={r.token} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.proposed.split("\n")[0]}</p>
                    <p className="text-[11px] text-muted">{timeAgo(r.createdAt)} · {r.channel ?? "pending"}</p>
                  </div>
                  <Link href={`/v/${r.token}`} target="_blank" className="text-xs font-bold text-purple-deep">
                    Link
                  </Link>
                  <StatusBadge kind={r.status === "yes" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
