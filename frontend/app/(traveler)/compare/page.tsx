"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeftIcon, CheckCircleIcon, CloudRainIcon, UmbrellaIcon, SunIcon, CrownIcon } from "@phosphor-icons/react";
import { getAlternatives } from "@/lib/api/trips";
import { useTripEditor } from "@/hooks/useTripEditor";
import { ArtTile } from "@/components/art/ArtTile";
import { Button } from "@/components/ui/Button";
import { Stars, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { toast } from "@/stores/notificationStore";
import { cn, duration, rupees } from "@/lib/format";
import type { Alternative } from "@/lib/engine/alternatives";

const ROWS: { key: string; label: string; render: (a: Alternative) => React.ReactNode; best?: (list: Alternative[]) => string | undefined }[] = [
  { key: "price", label: "Price", render: (a) => <span className="font-display font-bold">{a.totalCost ? rupees(a.totalCost) : "Free"}</span>, best: (l) => [...l].sort((x, y) => x.totalCost - y.totalCost)[0]?.activity.id },
  {
    key: "delta",
    label: "Change",
    render: (a) => (a.isCurrent ? <span className="text-muted">Current</span> : <span className={cn("font-bold", a.priceDelta < 0 ? "text-success" : a.priceDelta > 0 ? "text-danger" : "text-muted")}>{a.priceDelta === 0 ? "Same" : rupees(a.priceDelta, { sign: true })}</span>),
  },
  { key: "duration", label: "Duration", render: (a) => duration(a.activity.durationMin) },
  { key: "distance", label: "Distance", render: (a) => (a.isCurrent ? "" : `${a.distanceKm} km away`), best: (l) => [...l].filter((x) => !x.isCurrent).sort((x, y) => x.distanceKm - y.distanceKm)[0]?.activity.id },
  { key: "rating", label: "Rating", render: (a) => <Stars value={a.activity.rating} reviews={a.activity.reviews} />, best: (l) => [...l].sort((x, y) => y.activity.rating - x.activity.rating)[0]?.activity.id },
  {
    key: "weather",
    label: "Weather safety",
    render: (a) => (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", a.weatherSafe ? "text-success" : "text-danger")}>
        {!a.activity.outdoor ? <UmbrellaIcon size={14} /> : a.weatherSafe ? <SunIcon size={14} /> : <CloudRainIcon size={14} />}
        {a.weatherLabel}
      </span>
    ),
  },
  {
    key: "match",
    label: "Your match",
    render: (a) => (
      <span className="inline-flex items-center gap-2">
        <span className="h-2 w-14 overflow-hidden rounded-full bg-ink/10">
          <span className="block h-full rounded-full bg-purple" style={{ width: `${a.match}%` }} />
        </span>
        <b>{a.match}%</b>
      </span>
    ),
    best: (l) => [...l].sort((x, y) => y.match - x.match)[0]?.activity.id,
  },
  {
    key: "avail",
    label: "Availability",
    render: (a) => <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", a.availability === "Available" ? "bg-success-soft text-success" : a.availability === "Partner paused" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>{a.availability}</span>,
  },
];

function CompareInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get("trip") ?? "";
  const itemId = params.get("item") ?? "";
  const editor = useTripEditor(tripId);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["alternatives", tripId, itemId], queryFn: () => getAlternatives(tripId, itemId), enabled: !!tripId && !!itemId });

  const choose = (a: Alternative) => {
    if (a.isCurrent || !data) return;
    if (a.availability === "Partner paused") {
      toast({ tone: "warning", title: "That partner is paused", body: "The operator has paused this partner. We'll keep your current plan; pick another option." });
      return;
    }
    editor.swap(itemId, a.activity);
    toast({ tone: "success", title: `Swapped to ${a.activity.title}`, body: a.priceDelta ? `Trip total ${rupees(a.priceDelta, { sign: true })}` : "Same price" });
    router.push(`/plan?trip=${tripId}`);
  };

  return (
    <div className="pb-16">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon size={16} /> Back to plan
      </button>
      <h1 className="text-3xl font-extrabold">Compare options</h1>
      {data && (
        <p className="mt-1 text-sm text-muted">
          Replacing <b className="text-ink">{data.item.title}</b> on Day {data.item.day} · {data.item.qty} ticket{data.item.qty > 1 ? "s" : ""}
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
          <p className="col-span-full text-sm text-muted">Checking availability…</p>
        </div>
      ) : error || !data ? (
        <div className="mt-6">
          <ErrorState title="No alternatives found" error={error} onRetry={() => refetch()} action={<Button size="sm" variant="secondary" href={`/plan?trip=${tripId}`}>Back to plan</Button>} />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-[28px] bg-white shadow-clay lg:block">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">Comparison of alternatives for {data.item.title}</caption>
              <thead>
                <tr>
                  <th className="w-36 p-4 text-left text-xs font-bold uppercase tracking-wider text-muted" scope="col">
                    Option
                  </th>
                  {data.list.map((a) => (
                    <th key={a.activity.id} scope="col" className={cn("p-4 text-left align-top", a.isCurrent && "bg-canvas")}>
                      <ArtTile icon={a.activity.icon} tone={a.activity.tone} size={44} />
                      <p className="mt-2 line-clamp-2 font-bold leading-snug">{a.activity.title}</p>
                      {a.isCurrent && <span className="mt-1 inline-block rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">In your plan</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => {
                  const best = r.best?.(data.list);
                  return (
                    <tr key={r.key} className="border-t border-line">
                      <th scope="row" className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted">
                        {r.label}
                      </th>
                      {data.list.map((a) => (
                        <td key={a.activity.id} className={cn("p-4", a.isCurrent && "bg-canvas")}>
                          <span className="inline-flex items-center gap-1.5">
                            {r.render(a)}
                            {best === a.activity.id && <CrownIcon size={14} weight="fill" className="text-sun-deep" aria-label="Best" />}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t border-line">
                  <td className="p-4" />
                  {data.list.map((a) => (
                    <td key={a.activity.id} className={cn("p-4", a.isCurrent && "bg-canvas")}>
                      {a.isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
                          <CheckCircleIcon size={16} weight="fill" /> Current
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => choose(a)} disabled={a.availability === "Partner paused"}>
                          Choose this
                        </Button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="scrollbar-none -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:hidden">
            {data.list.map((a, i) => (
              <motion.article
                key={a.activity.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn("w-[82%] shrink-0 snap-center rounded-[28px] p-4", a.isCurrent ? "border-2 border-ink bg-canvas" : "bg-white shadow-clay")}
              >
                <div className="flex items-center gap-3">
                  <ArtTile icon={a.activity.icon} tone={a.activity.tone} size={48} />
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-bold leading-snug">{a.activity.title}</p>
                    {a.isCurrent && <span className="text-[11px] font-bold text-muted">In your plan</span>}
                  </div>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  {ROWS.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2">
                      <dt className="text-xs font-semibold text-muted">{r.label}</dt>
                      <dd className="text-right">{r.render(a)}</dd>
                    </div>
                  ))}
                </dl>
                {!a.isCurrent && (
                  <Button full className="mt-4" onClick={() => choose(a)} disabled={a.availability === "Partner paused"}>
                    Choose this
                  </Button>
                )}
              </motion.article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareInner />
    </Suspense>
  );
}
