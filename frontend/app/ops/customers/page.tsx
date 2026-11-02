"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChatsCircleIcon, EnvelopeIcon, PhoneIcon } from "@phosphor-icons/react";
import { useTripStore } from "@/stores/tripStore";
import { PageHead, SearchInput, TourStatusBadge } from "@/components/ops/opsKit";
import { Sheet } from "@/components/ui/Sheet";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/States";
import { destinationMap } from "@/data/destinations";
import { tourStatusOf } from "@/lib/api/ops";
import { useCustomers } from "@/hooks/queries";
import { priceTrip } from "@/lib/engine/pricing";
import { formatDate, lakhs, rupees } from "@/lib/format";

function CustomersInner() {
  const params = useSearchParams();
  const trips = useTripStore((s) => s.trips);
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("c"));
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (customers ?? [])
      .map((c) => {
        const ts = Object.values(trips).filter((t) => t.customerId === c.id);
        const spent = ts.filter((t) => t.status !== "draft").reduce((s, t) => s + priceTrip(t).total, 0);
        return { c, ts, ltv: Math.max(c.ltv, spent) };
      })
      .filter(({ c }) => !n || [c.name, c.city, c.email, ...c.tags].some((s) => s.toLowerCase().includes(n)))
      .sort((a, b) => b.ltv - a.ltv);
  }, [customers, trips, q]);
  const current = list.find((x) => x.c.id === open);

  if (isLoading) return <PageLoader label="Loading customers…" />;
  if (error || !customers) return <ErrorState title="Couldn't load customers" error={error} onRetry={() => refetch()} />;

  return (
    <div>
      <PageHead title="Customers" sub={`${customers.length} travelers · profiles built from Travel DNA and past trips`} />
      <div className="mb-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, city, tag…" />
      </div>
      {list.length === 0 ? (
        <EmptyState title="No customers found" mood="thinking" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ c, ts, ltv }) => (
            <button key={c.id} onClick={() => setOpen(c.id)} className="rounded-2xl border border-line bg-white p-4 text-left shadow-clay-sm transition hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <Avatar name={c.name} tone={c.tone} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {c.city} · {c.dnaName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold">{lakhs(ltv)}</p>
                  <p className="text-[10px] text-muted">lifetime</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <Badge key={t} tone="lavender">
                    {t}
                  </Badge>
                ))}
                <Badge tone="sky">{ts.length} trip{ts.length === 1 ? "" : "s"} here</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!current} onOpenChange={(v) => !v && setOpen(null)} title={current?.c.name ?? ""} description={current ? `${current.c.city} · customer since ${formatDate(current.c.since, { month: "short", year: "numeric" })}` : undefined}>
        {current && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" href={`mailto:${current.c.email}`} icon={<EnvelopeIcon size={14} />}>
                {current.c.email}
              </Button>
              <Button size="sm" variant="secondary" href={`tel:${current.c.phone.replace(/\s/g, "")}`} icon={<PhoneIcon size={14} />}>
                {current.c.phone}
              </Button>
              <Button size="sm" variant="soft" href="/ops/inbox" icon={<ChatsCircleIcon size={14} weight="fill" />}>
                Message
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white p-3 shadow-clay-sm">
                <p className="font-display text-lg font-extrabold">{current.c.trips + current.ts.length}</p>
                <p className="text-[11px] text-muted">trips</p>
              </div>
              <div className="rounded-2xl bg-white p-3 shadow-clay-sm">
                <p className="font-display text-lg font-extrabold">{lakhs(current.ltv)}</p>
                <p className="text-[11px] text-muted">lifetime value</p>
              </div>
              <div className="rounded-2xl bg-white p-3 shadow-clay-sm">
                <p className="truncate font-display text-sm font-extrabold">{current.c.dnaName}</p>
                <p className="text-[11px] text-muted">Travel DNA</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Trips with us</p>
              {current.ts.length === 0 ? (
                <p className="text-sm text-muted">No trips in this workspace yet.</p>
              ) : (
                <ul className="space-y-2">
                  {current.ts.map((t) => (
                    <li key={t.id}>
                      <Link href={`/ops/tours/${t.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-clay-sm">
                        <div className="flex-1">
                          <p className="text-sm font-bold">
                            {t.code} · {destinationMap[t.destinationId].name}
                          </p>
                          <p className="text-xs text-muted">
                            {formatDate(t.prefs.startDate)} · {rupees(priceTrip(t).total)}
                          </p>
                        </div>
                        <TourStatusBadge status={tourStatusOf(t)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersInner />
    </Suspense>
  );
}
