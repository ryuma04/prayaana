"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { StarIcon, ArrowRightIcon } from "@phosphor-icons/react";
import type { Vendor, VendorKind } from "@/types";
import { useVendors } from "@/hooks/queries";
import { FilterPill, PageHead, SearchInput } from "@/components/ops/opsKit";
import { AvailabilityToggle, TrustRing } from "@/components/ops/VendorBits";
import { Select, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { destinations, destinationMap } from "@/data/destinations";
import { cn } from "@/lib/format";

const KINDS: (VendorKind | "all")[] = ["all", "stay", "activity", "local", "transport"];
const KIND_LABEL: Record<VendorKind | "all", string> = { all: "All", stay: "Hotels & stays", activity: "Activity partners", local: "Cabs & drivers", transport: "Long-distance" };

function VendorCard({ v }: { v: Vendor }) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
      <div className="flex items-start gap-3">
        <TrustRing score={v.trustScore} />
        <div className="min-w-0 flex-1">
          <Link href={`/ops/vendors/${v.id}`} className="font-bold hover:underline">
            {v.name}
          </Link>
          <p className="truncate text-xs text-muted">
            {KIND_LABEL[v.kind]} · {destinationMap[v.destinationId]?.name}
          </p>
          <p className="truncate text-xs text-muted">
            {v.contactName || "No contact yet"} · {v.phone || "add a phone number"}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-canvas p-2">
          <dd className="font-display text-sm font-extrabold">{v.requests ? `${v.responseRate}%` : ""}</dd>
          <dt className="text-[10px] text-muted">reply rate</dt>
        </div>
        <div className="rounded-xl bg-canvas p-2">
          <dd className={cn("font-display text-sm font-extrabold", (v.cancellationRate ?? 0) > 5 && "text-danger")}>{v.requests ? `${v.cancellationRate}%` : ""}</dd>
          <dt className="text-[10px] text-muted">cancels</dt>
        </div>
        <div className="rounded-xl bg-canvas p-2">
          <dd className="inline-flex items-center gap-0.5 font-display text-sm font-extrabold">
            <StarIcon size={11} weight="fill" className="text-star" />
            {v.rating ? v.rating : ""}
          </dd>
          <dt className="text-[10px] text-muted">rating</dt>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span>
          <b>{v.activeBookings}</b> active · <b className={v.pendingConfirmations ? "text-warning" : ""}>{v.pendingConfirmations}</b> pending
        </span>
        <span className="text-muted">{v.requests ? `${v.requests} requests (180 days)` : "No requests yet"}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <AvailabilityToggle v={v} />
        <Link href={`/ops/vendors/${v.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-purple-deep">
          Details <ArrowRightIcon size={12} />
        </Link>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const { data, isLoading, error, refetch } = useVendors();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<VendorKind | "all">("all");
  const [dest, setDest] = useState("all");
  const [sort, setSort] = useState<"trust" | "reply" | "cancel">("trust");

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data ?? [])
      .filter((v) => kind === "all" || v.kind === kind)
      .filter((v) => dest === "all" || v.destinationId === dest)
      .filter((v) => !n || [v.name, v.contactName ?? ""].some((s) => s.toLowerCase().includes(n)))
      .sort((a, b) => (sort === "trust" ? b.trustScore - a.trustScore : sort === "reply" ? (a.avgReplyMin ?? 0) - (b.avgReplyMin ?? 0) : (b.cancellationRate ?? 0) - (a.cancellationRate ?? 0)));
  }, [data, q, kind, dest, sort]);

  return (
    <div>
      <PageHead title="Vendors" sub="Partners scored from their real request history: reply rate, reply speed, declines and traveler ratings. New partners start at a neutral 80." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search vendor or contact…" />
        <Select value={dest} onChange={(e) => setDest(e.target.value)} className="h-10 w-44 rounded-xl" aria-label="Destination">
          <option value="all">All destinations</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 w-48 rounded-xl" aria-label="Sort">
          <option value="trust">Sort: trust score</option>
          <option value="reply">Sort: fastest reply</option>
          <option value="cancel">Sort: most cancellations</option>
        </Select>
      </div>
      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
        {KINDS.map((k) => (
          <FilterPill key={k} active={kind === k} onClick={() => setKind(k)} count={k === "all" ? data?.length : data?.filter((v) => v.kind === k).length}>
            {KIND_LABEL[k]}
          </FilterPill>
        ))}
      </div>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load vendors" error={error} onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="No vendors found" body="Try another filter." mood="thinking" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => (
            <VendorCard key={v.id} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}
