"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react";
import type { TourStatus } from "@/types";
import { FilterPill, PageHead, Panel, RiskBar, SearchInput, TourStatusBadge, useTourRows } from "@/components/ops/opsKit";
import { Select } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { destinations, destinationMap } from "@/data/destinations";

import { addDays, formatDate, lakhs } from "@/lib/format";

type Tab = "live" | "upcoming" | "completed" | "drafts" | "all";
const TABS: { id: Tab; label: string; match: TourStatus[] }[] = [
  { id: "live", label: "Live", match: ["live", "at_risk"] },
  { id: "upcoming", label: "Upcoming", match: ["confirmed"] },
  { id: "completed", label: "Completed", match: ["completed"] },
  { id: "drafts", label: "Drafts", match: ["planning"] },
  { id: "all", label: "All", match: [] },
];
const inTab = (tab: Tab, s: TourStatus) => tab === "all" || TABS.find((t) => t.id === tab)!.match.includes(s);

function ToursInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rows = useTourRows();
  const [q, setQ] = useState(params.get("q") ?? "");
  const initial = (params.get("tab") as Tab) ?? (rows.some((r) => inTab("live", r.status)) ? "live" : "upcoming");
  const [tab, setTab] = useState<Tab>(initial);
  const [dest, setDest] = useState("all");
  const [sort, setSort] = useState<"date" | "risk" | "revenue">("date");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => inTab(tab, r.status))
      .filter((r) => dest === "all" || r.trip.destinationId === dest)
      .filter((r) => !needle || [r.trip.code, r.trip.groupName, r.trip.customerName, destinationMap[r.trip.destinationId].name].some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => (sort === "risk" ? b.risk - a.risk : sort === "revenue" ? b.revenue - a.revenue : a.trip.prefs.startDate.localeCompare(b.trip.prefs.startDate)));
  }, [rows, q, tab, dest, sort]);

  const count = (t: Tab) => rows.filter((r) => inTab(t, r.status)).length;

  return (
    <div>
      <PageHead title="Trips" sub={`${count("live")} on the road · ${count("upcoming")} upcoming`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search trips" />
        <Select value={dest} onChange={(e) => setDest(e.target.value)} className="h-10 w-44 rounded-xl" aria-label="Destination">
          <option value="all">All destinations</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 w-40 rounded-xl" aria-label="Sort by">
          <option value="date">Sort: start date</option>
          <option value="risk">Sort: risk</option>
          <option value="revenue">Sort: revenue</option>
        </Select>
      </div>
      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <FilterPill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} count={count(t.id)}>
            {t.label}
          </FilterPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No trips here" body="Try another tab or search." mood="thinking" />
      ) : (
        <>
          <Panel pad={false} className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-canvas text-left text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    {["Trip", "Destination", "Dates", "Travelers", "Status", "Risk", "Revenue", ""].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.trip.id} onClick={() => router.push(`/ops/tours/${r.trip.id}`)} className="cursor-pointer border-t border-line transition hover:bg-canvas/60">
                      <td className="px-4 py-3">
                        <Link href={`/ops/tours/${r.trip.id}`} className="font-bold hover:underline" onClick={(e) => e.stopPropagation()}>
                          {r.trip.groupName}
                        </Link>
                        <p className="text-[11px] text-muted">
                          {r.trip.code} · {r.trip.customerName}
                        </p>
                      </td>
                      <td className="px-4 py-3">{destinationMap[r.trip.destinationId].name}</td>
                      <td className="px-4 py-3 text-xs">
                        {formatDate(r.trip.prefs.startDate)} to {formatDate(addDays(r.trip.prefs.startDate, r.trip.prefs.nights))}
                      </td>
                      <td className="px-4 py-3 tabular">{r.travelers}</td>
                      <td className="px-4 py-3">
                        <TourStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3" title={r.riskReasons.join(" · ")}>
                        <RiskBar risk={r.risk} />
                      </td>
                      <td className="px-4 py-3 font-semibold tabular">{r.revenue ? lakhs(r.revenue) : ""}</td>
                      <td className="px-4 py-3">
                        <CaretRightIcon size={16} className="text-muted" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <div className="grid gap-3 md:hidden">
            {filtered.map((r) => (
              <Link key={r.trip.id} href={`/ops/tours/${r.trip.id}`} className="rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{r.trip.groupName}</p>
                    <p className="text-xs text-muted">
                      {r.trip.code} · {destinationMap[r.trip.destinationId].name} · {r.travelers} travelers
                    </p>
                  </div>
                  <TourStatusBadge status={r.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span>
                    {formatDate(r.trip.prefs.startDate)} to {formatDate(addDays(r.trip.prefs.startDate, r.trip.prefs.nights))}
                  </span>
                  <RiskBar risk={r.risk} />
                  <span className="font-bold">{r.revenue ? lakhs(r.revenue) : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ToursPage() {
  return (
    <Suspense fallback={null}>
      <ToursInner />
    </Suspense>
  );
}
