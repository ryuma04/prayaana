"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapTrifoldIcon,
  WarningOctagonIcon,
  HourglassMediumIcon,
  CurrencyInrIcon,
  ArrowRightIcon,
  RobotIcon,
  SirenIcon,
  CheckCircleIcon,
  ChatsCircleIcon,
  PaperPlaneTiltIcon,
  FlaskIcon,
} from "@phosphor-icons/react";
import { useAuthStore } from "@/stores/authStore";
import { useOperatorStore } from "@/stores/operatorStore";
import { useAgentStore } from "@/stores/agentStore";
import { useWeatherStore } from "@/stores/weatherStore";
import { toast } from "@/stores/notificationStore";
import { PageHead, Panel, StatCard, TourStatusBadge, useOpsData, useTourRows } from "@/components/ops/opsKit";
import { RevenueChart } from "@/components/ops/Charts";
import { incidentIcon } from "@/components/adapt/ImpactMap";
import { ArtTile } from "@/components/art/ArtTile";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { Zippy } from "@/components/art/Zippy";
import { handOffWarning, overview, resendBookingRequest, revenueSeries } from "@/lib/api/ops";
import { startAgentRun } from "@/lib/api/agent";
import { errorMessage } from "@/lib/api/client";
import { destinationMap } from "@/data/destinations";
import { vendorMap } from "@/data/vendors";
import { dayItems } from "@/lib/engine/schedule";
import { cn, lakhs, minToTime, timeAgo, formatDate, todayISO } from "@/lib/format";
import { AIModelCard } from "@/components/ops/AIModelCard";

type Task = {
  id: string;
  kind: "problem" | "vendor" | "warning" | "message";
  title: string;
  sub: string;
  href: string;
  action?: { label: string; run: () => Promise<unknown> };
  urgency: number;
};

const TASK_STYLE = {
  problem: { Icon: WarningOctagonIcon, tone: "bg-danger-soft text-danger" },
  vendor: { Icon: HourglassMediumIcon, tone: "bg-sun-soft text-sun-deep" },
  warning: { Icon: SirenIcon, tone: "bg-warning-soft text-warning" },
  message: { Icon: ChatsCircleIcon, tone: "bg-sky-soft text-sky-deep" },
};

/** Operator home: what needs a person right now, then what is happening today. */
export default function OpsToday() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const rows = useTourRows();
  const { bookings, ledger, incidents } = useOpsData();
  const warnings = useOperatorStore((s) => s.warnings);
  const inbox = useOperatorStore((s) => s.inbox);
  const runs = useAgentStore((s) => s.runs);
  const [busy, setBusy] = useState<string | null>(null);

  const o = useMemo(() => overview(rows, incidents, bookings, ledger), [rows, incidents, bookings, ledger]);
  const series = useMemo(() => revenueSeries(ledger, 14), [ledger]);
  const live = rows.filter((r) => r.status === "live" || r.status === "at_risk");
  const activeRuns = Object.values(runs).filter((r) => r.status === "running" || r.status === "waiting").length;
  const tripOf = (id: string) => rows.find((r) => r.trip.id === id)?.trip;

  const tasks = useMemo<Task[]>(() => {
    const list: Task[] = [];
    for (const i of incidents) {
      if (i.status === "resolved") continue;
      const t = tripOf(i.tripId);
      const agentBusy = i.status === "analyzing" || i.status === "awaiting_vendors";
      list.push({
        id: i.id,
        kind: "problem",
        title: i.title,
        sub: `${t?.code ?? ""} · ${t?.groupName ?? ""} · Day ${i.day} · ${agentBusy ? "agent working" : timeAgo(i.createdAt)}`,
        href: `/ops/incidents/${i.id}`,
        urgency: 100 + i.severity * 10 - (agentBusy ? 60 : 0),
        action: agentBusy || i.status === "escalated" ? undefined : { label: "Let the agent fix it", run: () => startAgentRun(i.id, {}).then(() => router.push(`/ops/incidents/${i.id}`)) },
      });
    }
    for (const w of warnings) {
      if (w.status !== "watching") continue;
      const t = tripOf(w.tripId);
      list.push({ id: w.id, kind: "warning", title: w.title, sub: `${t?.code ?? ""} · ${w.detail}`, href: "/ops/alerts", urgency: 90, action: { label: "Hand to agent", run: () => handOffWarning(w.id) } });
    }
    const pending = new Map<string, (typeof bookings)[number]>();
    for (const b of bookings) if (b.status === "requested" && !pending.has(`${b.tripId}:${b.vendorId}`)) pending.set(`${b.tripId}:${b.vendorId}`, b);
    for (const b of pending.values()) {
      const t = tripOf(b.tripId);
      list.push({
        id: b.id,
        kind: "vendor",
        title: `${vendorMap[b.vendorId]?.name ?? "Partner"} hasn't confirmed`,
        sub: `${t?.code ?? ""} · ${b.itemTitle} · Day ${b.day}`,
        href: `/ops/tours/${b.tripId}`,
        urgency: 60,
        action: { label: "Send reminder", run: () => resendBookingRequest(b.id) },
      });
    }
    for (const th of inbox) {
      if (!th.unread) continue;
      const last = th.messages[th.messages.length - 1];
      list.push({ id: th.id, kind: "message", title: `${th.name} wrote`, sub: last ? (last.transcript || last.body).slice(0, 90) : th.subtitle, href: `/ops/inbox?thread=${th.id}`, urgency: th.party === "traveler" ? 80 : 50 });
    }
    return list.sort((a, b) => b.urgency - a.urgency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, warnings, bookings, inbox, rows]);

  const act = async (t: Task) => {
    if (!t.action) return;
    setBusy(t.id);
    try {
      await t.action.run();
      toast({ tone: "success", title: t.kind === "vendor" ? "Reminder sent" : t.kind === "warning" ? "Agent is on it" : "Agent started" });
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <PageHead
        kicker={formatDate(todayISO(), { weekday: "long", day: "numeric", month: "long" })}
        title={`${greet}, ${user?.name.split(" ")[0] ?? "there"}`}
        sub={tasks.length ? `${tasks.length} thing${tasks.length > 1 ? "s" : ""} need you` : "Every trip is on track."}
        actions={
          <Button size="sm" variant="secondary" href="/ops/what-if" icon={<FlaskIcon size={14} weight="fill" />}>
            What-If simulator
          </Button>
        }
      />

      <LiveWeatherMonitor />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="On the road" value={o.active} hint={`${o.departuresThisWeek} leaving this week`} icon={<MapTrifoldIcon size={18} weight="duotone" />} tone="bg-lavender" href="/ops/tours" />
        <StatCard label="Open problems" value={o.openIncidents} hint={activeRuns ? `agent working on ${activeRuns}` : "tap to review"} icon={<WarningOctagonIcon size={18} weight="duotone" />} tone="bg-coral-soft" href="/ops/incidents" alert={o.openIncidents > 0} delay={0.04} />
        <StatCard label="Waiting on partners" value={o.pendingVendors} hint={`${o.replyRate}% answered so far`} icon={<HourglassMediumIcon size={18} weight="duotone" />} tone="bg-sun" href="/ops/bookings?status=requested" delay={0.08} />
        <StatCard label="Money in" value={lakhs(o.revenue)} hint={`${lakhs(o.refunds)} refunds · ${lakhs(o.payouts)} paid out`} icon={<CurrencyInrIcon size={18} weight="duotone" />} tone="bg-mint" href="/ops/payments" delay={0.12} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Needs you now" action={activeRuns > 0 ? <Link href="/ops/agent" className="inline-flex items-center gap-1 text-xs font-semibold text-purple-deep"><RobotIcon size={14} weight="fill" /> Agent working</Link> : undefined}>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Zippy mood="celebrate" size={96} />
              <p className="mt-3 font-display font-bold">Nothing needs you</p>
              <p className="text-sm text-muted">Problems, unanswered partners and traveler messages show up here.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {tasks.slice(0, 8).map((t) => {
                const s = TASK_STYLE[t.kind];
                const Icon = t.kind === "problem" ? incidentIcon(incidents.find((i) => i.id === t.id)?.kind ?? "weather") : s.Icon;
                return (
                  <li key={t.kind + t.id} className="flex items-center gap-3 rounded-[22px] bg-canvas p-3">
                    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", s.tone)}>
                      <Icon size={20} weight="duotone" />
                    </span>
                    <Link href={t.href} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{t.title}</p>
                      <p className="truncate text-xs text-muted">{t.sub}</p>
                    </Link>
                    {t.action ? (
                      <Button size="sm" aria-label={t.action.label} variant={t.kind === "problem" ? "purple" : "secondary"} loading={busy === t.id} onClick={() => void act(t)} icon={t.kind === "vendor" ? <PaperPlaneTiltIcon size={14} /> : <RobotIcon size={14} weight="fill" />}>
                        <span className="hidden sm:inline">{t.action.label}</span>
                      </Button>
                    ) : (
                      <Button size="icon-sm" variant="ghost" href={t.href} aria-label="Open" icon={<ArrowRightIcon size={16} />} />
                    )}
                  </li>
                );
              })}
              {tasks.length > 8 && <p className="px-1 text-xs text-muted">+{tasks.length - 8} more in Problems, Bookings and Inbox.</p>}
            </ul>
          )}
        </Panel>

        <Panel title="On the road" action={<Link href="/ops/tours?tab=live" className="text-xs font-semibold text-purple-deep">All trips</Link>}>
          {live.length === 0 ? (
            <EmptyState compact title="No trips on the road" body="Trips show up here from their first day." />
          ) : (
            <ul className="space-y-2.5">
              {live.map((r) => {
                const days = r.trip.prefs.nights + 1;
                const cur = r.trip.currentDay ?? 1;
                const d = destinationMap[r.trip.destinationId];
                return (
                  <li key={r.trip.id}>
                    <Link href={`/ops/tours/${r.trip.id}`} className="block rounded-[22px] bg-canvas p-3 transition hover:-translate-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-bold">{r.trip.groupName}</p>
                        <TourStatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-muted">
                        {r.trip.code} · {d.name} · {r.travelers} travelers · Day {cur} of {days}
                      </p>
                      <div className="mt-2 flex gap-1" aria-hidden>
                        {Array.from({ length: days }).map((_, i) => (
                          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i + 1 < cur ? "bg-mint-deep" : i + 1 === cur ? (r.status === "at_risk" ? "bg-danger" : "bg-purple") : "bg-ink/10")} />
                        ))}
                      </div>
                      {r.riskReasons.length > 0 && r.status === "at_risk" && <p className="mt-1.5 truncate text-[11px] font-semibold text-danger">{r.riskReasons[0]}</p>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <StartingSoon rows={rows} />

      <AIModelCard />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <TodaySchedule rows={live} />
        <Panel title="Money in & out · last 14 days" action={<Link href="/ops/payments" className="text-xs font-semibold text-purple-deep">Ledger</Link>}>
          <RevenueChart data={series} />
        </Panel>
      </div>
    </div>
  );
}

function LiveWeatherMonitor() {
  const wx = useWeatherStore((s) => s.byDest);
  const hubs = [
    { id: "manali", name: "Manali", state: "Himachal Pradesh" },
    { id: "goa", name: "Goa", state: "Western Coast" },
    { id: "rishikesh", name: "Rishikesh", state: "Uttarakhand" },
    { id: "leh", name: "Leh Ladakh", state: "Ladakh" },
  ];

  return (
    <div className="rounded-[28px] border-2 border-ink bg-white p-4 shadow-pop">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold">Real-Time Open-Meteo Meteorological Radar</span>
              <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-bold text-mint-deep">
                LIVE API SYNC
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Live atmospheric feed synced with the Go engine · feeds automated alerts to What-If & Trip Fixer
            </p>
          </div>
        </div>
        <Link
          href="/ops/what-if"
          className="inline-flex items-center gap-1.5 rounded-full bg-purple-soft px-3 py-1 text-xs font-bold text-purple hover:bg-purple hover:text-white transition"
        >
          <FlaskIcon size={14} weight="fill" /> Open What-If Simulator →
        </Link>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {hubs.map((h) => {
          const days = Object.values(wx[h.id] ?? {});
          const todayWx = days[0];
          const tomorrowWx = days[1];
          const hasRain = (todayWx?.rainChance ?? 0) > 50 || (tomorrowWx?.rainChance ?? 0) > 50;
          const isExtreme = (todayWx?.rainChance ?? 0) > 80 || (tomorrowWx?.rainChance ?? 0) > 80;

          return (
            <div
              key={h.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl border-2 p-3 transition",
                isExtreme
                  ? "border-danger bg-danger-soft/40"
                  : hasRain
                  ? "border-warning bg-warning-soft/30"
                  : "border-line bg-canvas hover:border-ink/20"
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-ink">{h.name}</span>
                  {isExtreme ? (
                    <span className="rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                      Alert
                    </span>
                  ) : hasRain ? (
                    <span className="rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                      Watch
                    </span>
                  ) : (
                    <span className="rounded-full bg-mint px-1.5 py-0.5 text-[9px] font-bold text-ink uppercase tracking-wider">
                      Clear
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted">{h.state}</p>

                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black">
                    {todayWx ? `${todayWx.tempC}°C` : "--"}
                  </span>
                  <span className="text-xs font-semibold capitalize text-ink-soft">
                    {todayWx?.condition || "Moderate"}
                  </span>
                </div>

                <p className="mt-1 text-[11px] font-medium text-muted">
                  Rain: <b className={isExtreme ? "text-danger" : hasRain ? "text-warning-deep" : "text-ink"}>{todayWx?.rainChance ?? 0}%</b>
                  {tomorrowWx ? ` · Tmrw: ${tomorrowWx.rainChance}%` : ""}
                </p>
              </div>

              <Link
                href={`/ops/what-if?destination=${h.id}&kind=weather`}
                className="mt-3 inline-flex items-center justify-center gap-1 rounded-xl bg-white border border-line py-1 text-[11px] font-bold text-ink hover:border-ink hover:shadow-sm transition"
              >
                <FlaskIcon size={12} weight="fill" className="text-purple" />
                Simulate Impact
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StartingSoon({ rows }: { rows: ReturnType<typeof useTourRows> }) {
  const today = todayISO();
  const soon = rows.filter((r) => r.status === "confirmed" && r.trip.prefs.startDate >= today).slice(0, 6);
  if (soon.length === 0) return null;
  return (
    <Panel title="Starting soon" action={<Link href="/ops/tours?tab=upcoming" className="text-xs font-semibold text-purple-deep">All upcoming</Link>}>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {soon.map((r) => (
          <li key={r.trip.id}>
            <Link href={`/ops/tours/${r.trip.id}`} className="block rounded-[22px] bg-canvas p-3 transition hover:-translate-y-0.5">
              <p className="truncate text-sm font-bold">{r.trip.groupName}</p>
              <p className="text-xs text-muted">
                {destinationMap[r.trip.destinationId].name} · {formatDate(r.trip.prefs.startDate)} · {r.travelers} travelers
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TodaySchedule({ rows }: { rows: ReturnType<typeof useTourRows> }) {
  const schedule = rows
    .flatMap((r) => dayItems(r.trip.items, r.trip.currentDay ?? 1).filter((i) => (i.kind === "activity" || i.kind === "transfer") && i.status !== "cancelled").map((i) => ({ r, i })))
    .sort((a, b) => a.i.startMin - b.i.startMin)
    .slice(0, 8);
  return (
    <Card>
      <h2 className="mb-3 font-display text-base font-bold">Today&apos;s schedule</h2>
      {schedule.length === 0 ? (
        <p className="rounded-2xl bg-canvas p-4 text-sm text-muted">Nothing scheduled on the road today.</p>
      ) : (
        <ul className="space-y-2.5">
          {schedule.map(({ r, i }) => (
            <li key={i.id} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-bold tabular">{minToTime(i.startMin)}</span>
              <ArtTile icon={i.icon} tone={i.tone} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{i.title}</p>
                <p className="truncate text-[11px] text-muted">{r.trip.groupName}</p>
              </div>
              {i.status === "confirmed" && <CheckCircleIcon size={16} weight="fill" className="text-success" aria-label="Confirmed" />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
