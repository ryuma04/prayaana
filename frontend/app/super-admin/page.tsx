"use client";
import { useQuery } from "@tanstack/react-query";
import { UsersThreeIcon, BuildingsIcon, IdentificationBadgeIcon, SealCheckIcon, HourglassIcon, MapTrifoldIcon, WarningOctagonIcon, ProhibitIcon } from "@phosphor-icons/react";
import { PageHead, StatCard, Panel } from "@/components/ops/opsKit";
import { ErrorState, PageLoader } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { getOverview } from "@/lib/api/admin";
import { timeAgo } from "@/lib/format";

export default function SuperAdminDashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin", "overview"], queryFn: getOverview, refetchInterval: 60_000 });

  if (isLoading) return <PageLoader label="Loading platform overview…" />;
  if (error || !data) return <ErrorState title="Couldn't load the overview" error={error} onRetry={() => refetch()} />;
  const s = data.stats;

  return (
    <div>
      <PageHead kicker="Super Admin" title="Platform overview" sub={`Live counts from the Prayaana database · updated ${timeAgo(data.generatedAt)}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total users" value={s.users} hint={`${s.travelers} travelers · ${s.operators} operators`} icon={<UsersThreeIcon size={20} weight="duotone" />} tone="bg-sky-soft" href="/super-admin/users" />
        <StatCard label="Operators" value={s.operators} hint={`${s.operatorCompanies} operator compan${s.operatorCompanies === 1 ? "y" : "ies"}`} icon={<BuildingsIcon size={20} weight="duotone" />} tone="bg-lavender-soft" href="/super-admin/operators" delay={0.03} />
        <StatCard label="Guides" value={s.guides} hint="Tour coordinators on the ground" icon={<IdentificationBadgeIcon size={20} weight="duotone" />} tone="bg-sun-soft" href="/super-admin/guides" delay={0.06} />
        <StatCard label="Verified guides" value={s.verifiedGuides} hint={`${s.rejectedGuides} rejected · ${s.suspendedGuides} suspended`} icon={<SealCheckIcon size={20} weight="duotone" />} tone="bg-mint-soft" href="/super-admin/guides" delay={0.09} />
        <StatCard label="Pending verifications" value={s.pendingGuides} hint={s.pendingGuides ? "Waiting for your review" : "Nothing to review"} icon={<HourglassIcon size={20} weight="duotone" />} tone="bg-pink-soft" href="/super-admin/guides" alert={s.pendingGuides > 0} delay={0.12} />
        <StatCard label="Active trips" value={s.liveTrips} hint={`${s.upcomingTrips} booked and upcoming`} icon={<MapTrifoldIcon size={20} weight="duotone" />} tone="bg-sky-soft" delay={0.15} />
        <StatCard
          label="Active incidents"
          value={s.activeIncidents}
          hint={s.demoActiveIncidents ? `${s.demoActiveIncidents} on demo trips` : "Open problems on trips"}
          icon={<WarningOctagonIcon size={20} weight="duotone" />}
          tone="bg-coral-soft"
          delay={0.18}
        />
        <StatCard label="Suspended accounts" value={s.suspendedAccounts} hint="Travelers and operators" icon={<ProhibitIcon size={20} weight="duotone" />} tone="bg-cream" href="/super-admin/users" delay={0.21} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Guide verification">
          <p className="text-sm text-muted">
            {s.pendingGuides
              ? `${s.pendingGuides} guide profile${s.pendingGuides === 1 ? " is" : "s are"} waiting for review. Only verified guides are listed publicly with the ✓ Prayaana Verified badge.`
              : "Every guide has been reviewed."}
          </p>
          <div className="mt-4">
            <Button size="sm" href="/super-admin/guides?status=pending">
              Review guides
            </Button>
          </div>
        </Panel>
        <Panel title="About this data">
          <ul className="space-y-1.5 text-sm text-muted">
            <li>All numbers are counted from the live database, nothing is estimated.</li>
            {s.demoAccounts > 0 && <li>{s.demoAccounts} account{s.demoAccounts === 1 ? " is a" : "s are"} seeded demo login{s.demoAccounts === 1 ? "" : "s"}, marked “Demo data” in the lists.</li>}
            <li>“Prayaana Verified” means Prayaana reviewed the guide. It is not a government verification.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
