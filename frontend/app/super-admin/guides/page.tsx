"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHead, FilterPill, SearchInput } from "@/components/ops/opsKit";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar, Field, Textarea } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/States";
import { ConfirmSheet, VerificationBadge, DemoBadge, GUIDE_STATUS } from "@/components/admin/AdminKit";
import { toast } from "@/stores/notificationStore";
import { errorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { listGuides, setGuideVerification, type AdminGuide, type GuideVerification } from "@/lib/api/admin";

const FILTERS: ("all" | GuideVerification)[] = ["all", "pending", "verified", "rejected", "suspended"];

const DONE: Record<GuideVerification, string> = {
  verified: "is now ✓ Prayaana Verified",
  rejected: "was rejected",
  suspended: "was suspended",
  pending: "is back in review",
};

function GuidesInner() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const initial = params.get("status") as GuideVerification | null;
  const [filter, setFilter] = useState<"all" | GuideVerification>(initial && initial in GUIDE_STATUS ? initial : "all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"rejected" | "suspended" | null>(null);
  const [note, setNote] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin", "guides"], queryFn: () => listGuides() });

  const change = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: GuideVerification; note: string }) => setGuideVerification(id, status, note),
    onSuccess: (g) => {
      toast({ tone: g.verification === "verified" ? "success" : g.verification === "pending" ? "info" : "warning", title: `${g.name} ${DONE[g.verification]}` });
      setConfirm(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast({ tone: "error", title: "Couldn't update the guide", body: errorMessage(e) }),
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    for (const g of data ?? []) c[g.verification] = (c[g.verification] ?? 0) + 1;
    return c;
  }, [data]);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data ?? []).filter((g) => (filter === "all" || g.verification === filter) && (!n || [g.name, g.region, ...g.languages].some((s) => s.toLowerCase().includes(n))));
  }, [data, filter, q]);
  const open = data?.find((g) => g.id === openId) ?? null;

  if (isLoading) return <PageLoader label="Loading guides…" />;
  if (error || !data) return <ErrorState title="Couldn't load guides" error={error} onRetry={() => refetch()} />;

  const act = (g: AdminGuide, status: GuideVerification) => change.mutate({ id: g.id, status, note });

  return (
    <div>
      <PageHead kicker="Super Admin" title="Guide verification" sub="Guides are the tour coordinators operators put on trips. Only verified guides are shown publicly." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, region, language…" />
        <div className="scrollbar-none flex max-w-full gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)} count={counts[f] ?? 0}>
              {f === "all" ? "All" : GUIDE_STATUS[f].label}
            </FilterPill>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title={filter === "pending" ? "No guides waiting for review" : "No guides here"} body={q ? "Try another search." : undefined} mood="thinking" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => (
            <button key={g.id} onClick={() => setOpenId(g.id)} className="rounded-2xl border border-line bg-white p-4 text-left shadow-clay-sm transition hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <Avatar name={g.name} tone={g.tone} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{g.name}</p>
                  <p className="truncate text-xs text-muted">
                    {g.region} · {g.operatorName || "No operator"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <VerificationBadge status={g.verification} />
                {!g.phone && <DemoBadge />}
              </div>
              <p className="mt-2 truncate text-xs text-muted">{g.languages.join(" · ") || "Languages not added"}</p>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)} title={open?.name ?? "Guide"} description={open ? `${open.region} · ${open.operatorName}` : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={open.name} tone={open.tone} size={56} />
              <div className="flex flex-wrap gap-1.5">
                <VerificationBadge status={open.verification} />
                {!open.phone && <DemoBadge />}
              </div>
            </div>
            {!open.phone && <p className="rounded-2xl bg-cream px-3.5 py-2.5 text-xs text-ink-soft">Seeded demo profile: no phone number or documents on file yet. Verify only after checking the person yourself.</p>}
            <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 text-sm shadow-clay-sm">
              <Detail label="Phone" value={open.phone || "Not added"} />
              <Detail label="On duty" value={open.dutyStatus} />
              <Detail label="Languages" value={open.languages.join(", ") || "—"} />
              <Detail label="Destinations" value={open.destinations.join(", ") || "—"} />
              <Detail label="Tours led" value={String(open.toursLed)} />
              <Detail label="Active tours" value={String(open.activeTours)} />
              <Detail label="Verified on" value={open.verifiedAt ? formatDate(open.verifiedAt, { day: "numeric", month: "short", year: "numeric" }) : "—"} />
              <Detail label="Last change" value={open.verificationChangedAt ? formatDate(open.verificationChangedAt, { day: "numeric", month: "short", year: "numeric" }) : "Never reviewed"} />
            </dl>
            {open.verificationNote && (
              <div className="rounded-2xl bg-lavender-soft/60 p-3.5 text-sm">
                <p className="text-xs font-bold text-muted">Review note</p>
                <p className="mt-1">{open.verificationNote}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {open.verification !== "verified" && (
                <Button variant="success" onClick={() => act(open, "verified")} loading={change.isPending && change.variables?.status === "verified"}>
                  {open.verification === "suspended" ? "Reinstate as verified" : "Verify guide"}
                </Button>
              )}
              {open.verification !== "rejected" && open.verification !== "verified" && (
                <Button variant="secondary" className="text-danger" onClick={() => setConfirm("rejected")}>
                  Reject
                </Button>
              )}
              {open.verification !== "suspended" && open.verification !== "pending" && (
                <Button variant="secondary" className="text-danger" onClick={() => setConfirm("suspended")}>
                  Suspend
                </Button>
              )}
              {open.verification !== "pending" && (
                <Button variant="ghost" onClick={() => act(open, "pending")} loading={change.isPending && change.variables?.status === "pending"}>
                  Move back to review
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">Rejected and suspended guides can&apos;t be assigned to new tours and never appear in the public verified list.</p>
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!confirm && !!open}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm === "rejected" ? `Reject ${open?.name ?? ""}?` : `Suspend ${open?.name ?? ""}?`}
        description={
          confirm === "rejected"
            ? "They won't be shown as verified and operators can't assign them to tours."
            : `They lose the ✓ Prayaana Verified badge and disappear from public listings.${open?.activeTours ? ` They stay on their ${open.activeTours} current tour${open.activeTours === 1 ? "" : "s"} until an operator reassigns them.` : ""}`
        }
        confirmLabel={confirm === "rejected" ? "Reject guide" : "Suspend guide"}
        busy={change.isPending}
        onConfirm={() => open && confirm && act(open, confirm)}
      >
        <div className="mb-4">
          <Field label="Note (optional)" htmlFor="review-note" hint="Kept with the guide's record for the next reviewer.">
            <Textarea id="review-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this decision?" />
          </Field>
        </div>
      </ConfirmSheet>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  );
}

export default function SuperAdminGuidesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading guides…" />}>
      <GuidesInner />
    </Suspense>
  );
}
