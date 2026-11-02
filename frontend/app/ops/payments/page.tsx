"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { WalletIcon, ArrowDownLeftIcon, ArrowUpRightIcon, ArrowCounterClockwiseIcon, HourglassMediumIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import type { LedgerEntry } from "@/types";
import { useBookingStore } from "@/stores/bookingStore";
import { useTripStore } from "@/stores/tripStore";
import { FilterPill, PageHead, Panel, StatCard } from "@/components/ops/opsKit";
import { RevenueChart, BarsChart } from "@/components/ops/Charts";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { revenueSeries } from "@/lib/api/ops";
import { cn, formatDate, lakhs, rupees } from "@/lib/format";
import { toast } from "@/stores/notificationStore";

export default function PaymentsPage() {
  const ledger = useBookingStore((s) => s.ledger);
  const trips = useTripStore((s) => s.trips);
  const [kind, setKind] = useState<LedgerEntry["kind"] | "all">("all");
  const series = useMemo(() => revenueSeries(ledger, 30), [ledger]);
  const sum = (k: LedgerEntry["kind"], status?: LedgerEntry["status"]) => ledger.filter((l) => l.kind === k && (!status || l.status === status)).reduce((s, l) => s + Math.abs(l.amount), 0);
  const pending = ledger.filter((l) => l.status === "pending").reduce((s, l) => s + Math.abs(l.amount), 0);
  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    ledger.filter((l) => l.kind === "payment").forEach((l) => m.set(l.method.split(" ·")[0], (m.get(l.method.split(" ·")[0]) ?? 0) + l.amount));
    return [...m.entries()].map(([method, amount]) => ({ method, amount }));
  }, [ledger]);
  const list = ledger.filter((l) => kind === "all" || l.kind === kind);

  const exportCsv = () => {
    const rows = [["id", "date", "kind", "party", "trip", "amount", "status", "method", "note"], ...list.map((l) => [l.id, l.date, l.kind, l.party, trips[l.tripId]?.code ?? l.tripId, String(l.amount), l.status, l.method, l.note])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "prayaana-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ tone: "success", title: "Ledger exported", body: `${list.length} rows` });
  };

  return (
    <div>
      <PageHead
        title="Payments"
        sub="Money ledger: customer payments (Razorpay test mode), vendor payouts, refunds and adjustments."
        actions={
          <Button size="sm" variant="secondary" onClick={exportCsv} icon={<DownloadSimpleIcon size={14} />}>
            Export CSV
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total revenue" value={lakhs(sum("payment") + sum("adjustment"))} icon={<WalletIcon size={16} weight="duotone" />} tone="bg-mint-soft" />
        <StatCard label="Vendor payouts" value={lakhs(sum("payout"))} hint={`${lakhs(sum("payout", "pending"))} scheduled`} icon={<ArrowUpRightIcon size={16} weight="duotone" />} tone="bg-coral-soft" delay={0.05} />
        <StatCard label="Refunds" value={lakhs(sum("refund"))} icon={<ArrowCounterClockwiseIcon size={16} weight="duotone" />} tone="bg-sky-soft" delay={0.1} />
        <StatCard label="Pending" value={lakhs(pending)} hint="payouts & refunds in flight" icon={<HourglassMediumIcon size={16} weight="duotone" />} tone="bg-sun-soft" delay={0.15} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Money in & out · 30 days">
          <RevenueChart data={series} height={260} />
        </Panel>
        <Panel title="Payments by method">
          <BarsChart data={byMethod} dataKey="amount" nameKey="method" money color="#23864b" height={260} />
        </Panel>
      </div>
      <div className="mt-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", "payment", "payout", "refund", "adjustment"] as const).map((k) => (
            <FilterPill key={k} active={kind === k} onClick={() => setKind(k)} count={k === "all" ? ledger.length : ledger.filter((l) => l.kind === k).length}>
              {k[0].toUpperCase() + k.slice(1)}s
            </FilterPill>
          ))}
        </div>
        {list.length === 0 ? (
          <EmptyState title="No transactions" mood="sleepy" />
        ) : (
          <Panel title="Transaction history" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-canvas text-left text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    {["Txn", "Date", "Type", "Party", "Trip", "Method", "Status", "Amount"].map((h) => (
                      <th key={h} scope="col" className={cn("px-4 py-3 font-bold", h === "Amount" && "text-right")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, 60).map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="px-4 py-3 font-mono text-xs">{l.id}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(l.date.slice(0, 10))}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold capitalize">
                          {l.amount >= 0 ? <ArrowDownLeftIcon size={14} className="text-success" /> : <ArrowUpRightIcon size={14} className="text-danger" />}
                          {l.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{l.party}</p>
                        <p className="max-w-64 truncate text-[11px] text-muted">{l.note}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {trips[l.tripId] ? (
                          <Link href={`/ops/tours/${l.tripId}`} className="font-semibold text-purple-deep hover:underline">
                            {trips[l.tripId].code}
                          </Link>
                        ) : (
                          ""
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{l.method}</td>
                      <td className="px-4 py-3">
                        <StatusBadge kind={l.status === "settled" ? "success" : l.status === "pending" ? "warning" : "danger"}>{l.status}</StatusBadge>
                      </td>
                      <td className={cn("px-4 py-3 text-right font-bold tabular", l.amount < 0 ? "text-danger" : "text-success")}>{rupees(l.amount, { sign: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
