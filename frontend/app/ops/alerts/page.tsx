"use client";
import { useMemo, useState } from "react";
import { SirenIcon, CheckCircleIcon, RobotIcon, MegaphoneIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import type { CrowdReport } from "@/types";
import { useOperatorStore } from "@/stores/operatorStore";
import { useNotificationStore, toast } from "@/stores/notificationStore";
import { PageHead, Panel } from "@/components/ops/opsKit";
import { NotificationItem } from "@/components/shell/NotificationBell";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/Button";
import { Select, StatusBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { fileGuideReport, handOffWarning, verifyCrowdReport } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/client";
import { destinations, destinationMap } from "@/data/destinations";
import { activities } from "@/data/activities";
import { timeAgo } from "@/lib/format";
import type { DestinationId } from "@/types";

const TYPE_LABEL: Record<CrowdReport["type"], string> = { closed: "Closed", road_blocked: "Road blocked", crowded: "Too crowded", unsafe: "Unsafe", other: "Other" };

/** Where a reported place is: the matching experience in the catalog, else the destination center. */
function placePoint(destinationId: DestinationId, place: string) {
  const words = place.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const hit = activities.filter((a) => a.destinationId === destinationId).find((a) => words.some((w) => a.title.toLowerCase().includes(w)));
  const d = destinationMap[destinationId];
  return hit ? { lat: hit.lat, lng: hit.lng } : { lat: d.lat, lng: d.lng };
}

export default function AlertsPage() {
  const warnings = useOperatorStore((s) => s.warnings);
  const reports = useOperatorStore((s) => s.crowdReports);
  const notifications = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAll = useNotificationStore((s) => s.markAllRead);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ dest: DestinationId; place: string; type: CrowdReport["type"] }>({ dest: "manali", place: "Solang ropeway", type: "closed" });
  const ops = useMemo(() => notifications.filter((n) => n.audience === "operator"), [notifications]);

  const points = reports.map((r) => {
    const at = placePoint(r.destinationId, r.place);
    return { id: r.id, lat: at.lat, lng: at.lng, label: `${TYPE_LABEL[r.type]} · ${r.place}`, n: r.verified ? "✓" : "?", tone: (r.verified ? "coral" : "sun") as "coral" | "sun" };
  });

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const handToAgent = (id: string) =>
    act(id, async () => {
      const run = await handOffWarning(id);
      toast({ tone: "agent", title: "Agent is on it", body: `${run.tripCode}: shifting the next items and asking vendors.`, action: { label: "Watch", href: `/ops/incidents/${run.incidentId}` } });
    });

  const announce = (r: CrowdReport) =>
    toast({
      tone: r.verified ? "warning" : "info",
      title: r.verified ? "Report verified" : "Report logged",
      body: r.verified ? `${r.affectedTrips.length} tour${r.affectedTrips.length === 1 ? "" : "s"} plan to go to ${r.place}.` : "It needs one more report to count.",
    });

  const doVerify = (r: CrowdReport) => act(r.id, async () => announce(await verifyCrowdReport(r.id)));

  const fileReport = () =>
    act("report", async () => announce(await fileGuideReport({ destinationId: form.dest, place: form.place, type: form.type, text: `${TYPE_LABEL[form.type]}, guide report` })));

  return (
    <div>
      <PageHead title="Live alerts" sub="Early warnings compare each live tour's plan with reality. Crowd reports turn travelers, guides and vendors into a live alert network." />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Panel title="Early warnings">
            {warnings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No early warnings right now.</p>
            ) : (
              <ul className="space-y-2">
                {warnings.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                    <SirenIcon size={22} weight="duotone" className="text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{w.title}</p>
                      <p className="text-xs text-muted">
                        {w.detail} · {timeAgo(w.createdAt)}
                      </p>
                    </div>
                    {w.status === "watching" ? (
                      <Button size="sm" variant="purple" onClick={() => void handToAgent(w.id)} loading={busy === w.id} icon={<RobotIcon size={14} weight="fill" />}>
                        Hand to agent
                      </Button>
                    ) : (
                      <StatusBadge kind={w.status === "resolved" ? "success" : "purple"}>{w.status.replace(/-/g, " ")}</StatusBadge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Crowd reports">
            <MapView points={points} route={false} height={260} />
            <ul className="mt-4 space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {TYPE_LABEL[r.type]} · {r.place}
                    </p>
                    <p className="text-xs text-muted">
                      “{r.text}”, {r.reporter} ({r.reporterRole}) · {r.confirmations} report{r.confirmations > 1 ? "s" : ""} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  {r.verified ? (
                    <StatusBadge kind="success" icon={<CheckCircleIcon size={12} weight="fill" />}>
                      Verified
                    </StatusBadge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => void doVerify(r)} loading={busy === r.id} icon={<ShieldCheckIcon size={14} />}>
                      Verify
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Report a problem at a place">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Select value={form.dest} onChange={(e) => setForm({ ...form, dest: e.target.value as DestinationId })} aria-label="Destination" className="rounded-xl">
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} aria-label="Place" className="h-11 rounded-xl border border-line px-3 text-sm outline-none focus:border-purple" />
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CrowdReport["type"] })} aria-label="Type" className="rounded-xl">
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Button
                onClick={() => void fileReport()}
                loading={busy === "report"}
                disabled={!form.place.trim()}
                icon={<MegaphoneIcon size={16} weight="bold" />}
              >
                Report
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted">Your report counts right away. Traveler reports need 2 within 2 hours.</p>
          </Panel>
        </div>
        <Panel title="All notifications" action={<button onClick={() => markAll("operator")} className="text-xs font-semibold text-purple-deep">Mark all read</button>}>
          {ops.length === 0 ? (
            <EmptyState compact title="No notifications" mood="sleepy" />
          ) : (
            <div className="max-h-[80vh] space-y-1 overflow-y-auto">
              {ops.map((n) => (
                <NotificationItem key={n.id} n={n} onClick={() => markRead(n.id)} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
