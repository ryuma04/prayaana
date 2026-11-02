"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, TrendDownIcon, TrendUpIcon, ScalesIcon } from "@phosphor-icons/react";
import type { PriceBreakdown as PB } from "@/types";
import { AnimatedNumber } from "@/components/ui/primitives";
import { usePricingStore } from "@/stores/pricingStore";
import { cn, rupees } from "@/lib/format";
import type { PriceRange } from "@/lib/engine/pricing";

const fmt = (n: number) => rupees(n);

interface BudgetMeterProps {
  price: PB;
  className?: string;
  tripId?: string;
  onOptimize?: () => Promise<void>;
}

export function BudgetMeter({ price, className, tripId, onOptimize }: BudgetMeterProps) {
  const pct = Math.min(100, (price.total / Math.max(1, price.budget)) * 100);
  const status = price.budgetStatus;
  const label = status === "roomy" ? "Room to spare" : status === "on-budget" ? "On budget" : "Over budget";
  const [optimizing, setOptimizing] = useState(false);

  const handleOptimize = async () => {
    if (!onOptimize || optimizing) return;
    setOptimizing(true);
    try { await onOptimize(); } finally { setOptimizing(false); }
  };

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">
          <AnimatedNumber value={price.total} format={fmt} /> <span className="text-muted">/ {rupees(price.budget)}</span>
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", status === "over" ? "bg-danger-soft text-danger" : status === "on-budget" ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>{label}</span>
      </div>
      <div className="mt-2 h-3.5 overflow-hidden rounded-full bg-ink/8" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Budget used ${Math.round(pct)}%`}>
        <motion.div
          className={cn("h-full rounded-full", status === "over" ? "bg-danger" : status === "on-budget" ? "bg-gradient-to-r from-sun to-coral" : "bg-gradient-to-r from-mint-deep to-success")}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        {status === "over" ? `${rupees(price.total - price.budget)} over, try a cheaper stay or swap an activity` : `${rupees(price.budget - price.total)} left in your budget`}
      </p>
      {status === "over" && onOptimize && (
        <button
          type="button"
          onClick={handleOptimize}
          disabled={optimizing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-pop transition hover:bg-lavender-soft active:scale-[0.98] disabled:opacity-60"
        >
          {optimizing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" /> : <ScalesIcon size={16} weight="bold" />}
          {optimizing ? "Finding savings" : "Fit to my budget"}
        </button>
      )}
    </div>
  );
}

/**
 * Compact price-range sparkline. Points are real: every stay × transport combination for this
 * trip priced by the same engine, cheapest (green) to priciest (red). There is no price history
 * feed, and the chart says so rather than drawing an invented timeline.
 */
export function PriceRangeChart({ range }: { range: PriceRange | null }) {
  if (!range) {
    return (
      <div className="rounded-2xl border border-line bg-canvas/70 p-3 text-xs text-muted">
        <p className="font-bold text-ink">Price range</p>
        <p className="mt-1">Price history unavailable · no alternative stays or transport to compare yet.</p>
      </div>
    );
  }
  const { low, high, current, totals } = range;
  const W = 240;
  const H = 56;
  const pad = 6;
  const span = Math.max(1, high - low);
  const x = (i: number) => pad + (i / Math.max(1, totals.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - low) / span) * (H - pad * 2);
  const pts = totals.map((v, i) => [x(i), y(v)] as const);
  // Smooth path through the sorted totals (monotone, so a simple midpoint curve never overshoots).
  const line = pts.reduce((d, [px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [qx, qy] = pts[i - 1];
    const mx = (qx + px) / 2;
    return `${d} C${mx},${qy} ${mx},${py} ${px},${py}`;
  }, "");
  const area = `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
  // Where the current plan sits among the options.
  const rank = totals.findIndex((v) => v >= current);
  const ci = rank < 0 ? totals.length - 1 : rank;
  const cx = x(ci);
  const cy = y(current);
  const pct = (current - low) / span;
  const tone = pct < 0.34 ? "text-success" : pct > 0.66 ? "text-danger" : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-canvas/70 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-ink">Price range</span>
        <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-semibold text-muted">{totals.length} real options</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" role="img" aria-label={`Cheapest ${rupees(low)}, your plan ${rupees(current)}, priciest ${rupees(high)}`}>
        <defs>
          <linearGradient id="trz-price-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-success, #23864b)" />
            <stop offset="50%" stopColor="#c9c4b6" />
            <stop offset="100%" stopColor="var(--color-danger, #d64545)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trz-price-grad)" opacity={0.18} />
        <path d={line} fill="none" stroke="url(#trz-price-grad)" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={cx} x2={cx} y1={4} y2={H} stroke="#1c1b2b" strokeDasharray="2 3" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={4.5} fill="#fff" stroke="#1c1b2b" strokeWidth={2} />
      </svg>
      <div className="mt-1 grid grid-cols-3 text-[11px]">
        <div>
          <span className="block text-[10px] text-muted">Low</span>
          <span className="font-bold text-success">{rupees(low)}</span>
        </div>
        <div className="text-center">
          <span className="block text-[10px] text-muted">Your plan</span>
          <span className={cn("font-bold", tone)}>{rupees(current)}</span>
        </div>
        <div className="text-right">
          <span className="block text-[10px] text-muted">High</span>
          <span className="font-bold text-danger">{rupees(high)}</span>
        </div>
      </div>
      <p className="mt-1.5 border-t border-line/60 pt-1.5 text-[10px] leading-tight text-muted">
        Green is cheaper, red is pricier · range across this destination&apos;s stays and transport · price history unavailable
      </p>
    </div>
  );
}

/** Plan-page price panel: headline total, the range chart, budget — details folded away. */
export function PriceSummary({ price, range }: { price: PB; range: PriceRange | null }) {
  return (
    <div>
      <p className="font-display text-3xl font-extrabold leading-none">
        <AnimatedNumber value={price.total} format={fmt} />
      </p>
      <p className="mt-1 text-xs text-muted">
        <AnimatedNumber value={price.perPerson} format={fmt} /> / person · {price.travelers} {price.travelers === 1 ? "traveler" : "travelers"}
      </p>
      <div className="mt-3">
        <PriceRangeChart range={range} />
      </div>
      <details className="group mt-3 text-sm">
        <summary className="cursor-pointer list-none text-xs font-semibold text-purple-deep hover:underline">
          <span className="group-open:hidden">Show cost breakdown</span>
          <span className="hidden group-open:inline">Hide cost breakdown</span>
        </summary>
        <div className="mt-2">
          <PriceBreakdown price={price} />
        </div>
      </details>
    </div>
  );
}


export function PriceBreakdown({ price, compact }: { price: PB; compact?: boolean }) {
  const recalculating = usePricingStore((s) => s.recalculating);
  const rows: [string, number, string?][] = [
    [`Stay · ${price.rooms} room${price.rooms > 1 ? "s" : ""}`, price.stay, price.stay === 0 ? "Included / Homestay" : undefined],
    ["Transport (inter-city)", price.travel, price.travel === 0 ? "Not selected" : undefined],
    ["Local cab & transfers", price.local, price.local === 0 ? "Included" : undefined],
    ["Activities & spots", price.activities, price.activities === 0 ? "Free / self-guided" : undefined],
    ["Meals & dining", price.meals, price.meals === 0 ? "Pay as you go" : undefined],
  ];
  return (
    <div>
      <dl className={cn("space-y-2 text-sm transition-opacity", recalculating && "opacity-60")}>
        {rows.map(([k, v, emptyLabel]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="font-semibold">
              {v > 0 ? <AnimatedNumber value={v} format={fmt} /> : <span className="text-xs text-muted font-normal">{emptyLabel}</span>}
            </dd>
          </div>
        ))}
        {price.teamUp > 0 && (
          <div className="flex justify-between gap-3 text-success">
            <dt>Team-up deal</dt>
            <dd className="font-semibold">−{rupees(price.teamUp)}</dd>
          </div>
        )}
        {price.promo > 0 && (
          <div className="flex justify-between gap-3 text-success">
            <dt>Promo code</dt>
            <dd className="font-semibold">−{rupees(price.promo)}</dd>
          </div>
        )}
        {!compact && (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Service fee (3%)</dt>
              <dd className="font-semibold">
                <AnimatedNumber value={price.serviceFee} format={fmt} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">GST (5%)</dt>
              <dd className="font-semibold">
                <AnimatedNumber value={price.tax} format={fmt} />
              </dd>
            </div>
          </>
        )}
      </dl>
      <div className="mt-3 flex items-end justify-between border-t-2 border-dashed border-line pt-3">
        <div>
          <p className="text-xs font-semibold text-muted">Trip total ({price.travelers} {price.travelers === 1 ? "traveler" : "travelers"})</p>
          <p className="font-display text-2xl font-extrabold">
            <AnimatedNumber value={price.total} format={fmt} />
          </p>
        </div>
        <p className="text-right text-xs text-muted">
          <span className="font-display text-base font-bold text-ink">
            <AnimatedNumber value={price.perPerson} format={fmt} />
          </span>
          <br />
          per person
        </p>
      </div>
    </div>
  );
}

/** “Updating price… ₹31,840 → ₹33,120” — appears after every edit. */
export function PriceTicker({ tripId }: { tripId: string }) {
  const change = usePricingStore((s) => s.lastChange);
  const [visible, setVisible] = useState<typeof change>(null);
  useEffect(() => {
    if (!change || change.tripId !== tripId || Date.now() - change.at > 1500) return;
    setVisible(change);
    const t = setTimeout(() => setVisible(null), 3200);
    return () => clearTimeout(t);
  }, [change, tripId]);
  const up = visible ? visible.to > visible.from : false;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={visible.at}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed inset-x-0 bottom-44 z-40 mx-auto flex w-fit max-w-[92vw] items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-semibold shadow-pop md:bottom-8"
          role="status"
          aria-live="polite"
        >
          {up ? <TrendUpIcon size={18} weight="bold" className="text-danger" /> : <TrendDownIcon size={18} weight="bold" className="text-success" />}
          <span className="hidden text-muted sm:inline">{visible.reason} · </span>
          <span className="tabular text-muted line-through">{rupees(visible.from)}</span>
          <ArrowRightIcon size={14} />
          <span className={cn("tabular", up ? "text-danger" : "text-success")}>{rupees(visible.to)}</span>
          <span className="tabular text-xs text-muted">({rupees(visible.to - visible.from, { sign: true })})</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
