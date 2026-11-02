"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SealCheckIcon } from "@phosphor-icons/react";
import { PageHead, SearchInput, FilterPill } from "@/components/ops/opsKit";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar, Badge, StatusBadge, type StatusKind } from "@/components/ui/primitives";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/States";
import { toast } from "@/stores/notificationStore";
import { errorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { listAccounts, setAccountStatus, type AdminAccount, type AccountStatus, type GuideVerification } from "@/lib/api/admin";

export const GUIDE_STATUS: Record<GuideVerification, { label: string; kind: StatusKind }> = {
  pending: { label: "Pending review", kind: "warning" },
  verified: { label: "Prayaana Verified", kind: "success" },
  rejected: { label: "Rejected", kind: "danger" },
  suspended: { label: "Suspended", kind: "neutral" },
};

export function VerificationBadge({ status }: { status: GuideVerification }) {
  const s = GUIDE_STATUS[status];
  if (status === "verified") return <StatusBadge kind="success" icon={<SealCheckIcon size={13} weight="fill" />}>✓ Prayaana Verified</StatusBadge>;
  return <StatusBadge kind={s.kind}>{s.label}</StatusBadge>;
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return status === "active" ? <StatusBadge kind="success">Active</StatusBadge> : <StatusBadge kind="danger">Suspended</StatusBadge>;
}

/** Marks seeded demo records so they are never mistaken for real, reviewed ones. */
export function DemoBadge() {
  return (
    <Badge tone="cream" className="border border-ink/10">
      Demo data
    </Badge>
  );
}

/** Confirmation dialog for destructive actions (same Sheet the operator console uses). */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy,
  children,
  tone = "danger",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  children?: ReactNode;
  tone?: "danger" | "primary";
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={description} side="center" size="sm">
      {children}
      <div className="flex flex-wrap gap-2">
        <Button variant={tone} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

/** Operators and Users pages: list accounts, suspend or reactivate them. */
export function AccountsView({ role, title, sub }: { role?: AdminAccount["role"]; title: string; sub: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | AccountStatus>("all");
  const [target, setTarget] = useState<AdminAccount | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin", "accounts", role ?? "all"], queryFn: () => listAccounts(role) });

  const change = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) => setAccountStatus(id, status),
    onSuccess: (a) => {
      toast({ tone: a.status === "suspended" ? "warning" : "success", title: a.status === "suspended" ? `${a.name} suspended` : `${a.name} reactivated`, body: a.status === "suspended" ? "They are signed out and can't log in." : "They can log in again." });
      setTarget(null);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast({ tone: "error", title: "Couldn't update the account", body: errorMessage(e) }),
  });

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data?.accounts ?? []).filter((a) => (filter === "all" || a.status === filter) && (!n || a.name.toLowerCase().includes(n) || a.email.toLowerCase().includes(n)));
  }, [data, q, filter]);

  if (isLoading) return <PageLoader label={`Loading ${title.toLowerCase()}…`} />;
  if (error || !data) return <ErrorState title={`Couldn't load ${title.toLowerCase()}`} error={error} onRetry={() => refetch()} />;

  const suspended = data.accounts.filter((a) => a.status === "suspended").length;
  const reactivating = (a: AdminAccount) => a.status === "suspended";

  return (
    <div>
      <PageHead kicker="Super Admin" title={title} sub={`${data.total} ${sub}${data.total > data.accounts.length ? ` · showing newest ${data.accounts.length}` : ""}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name or email…" />
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")} count={data.accounts.length}>
          All
        </FilterPill>
        <FilterPill active={filter === "active"} onClick={() => setFilter("active")} count={data.accounts.length - suspended}>
          Active
        </FilterPill>
        <FilterPill active={filter === "suspended"} onClick={() => setFilter("suspended")} count={suspended}>
          Suspended
        </FilterPill>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No accounts here" body={q || filter !== "all" ? "Try another search or filter." : "Accounts appear as people sign up."} mood="thinking" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <article key={a.id} className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-clay-sm">
              <div className="flex items-start gap-3">
                <Avatar name={a.name} tone={a.avatarTone} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{a.name}</p>
                  <p className="truncate text-xs text-muted">{a.email}</p>
                </div>
                <AccountStatusBadge status={a.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={a.role === "operator" ? "sky" : "sun"}>{a.role === "operator" ? "Operator" : "Traveler"}</Badge>
                {a.operatorName && <Badge tone="lavender">{a.operatorName}</Badge>}
                {a.demo && <DemoBadge />}
                {!a.emailVerified && <Badge tone="pink">Email unconfirmed</Badge>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Joined</dt>
                  <dd className="font-semibold">{formatDate(a.createdAt, { day: "numeric", month: "short", year: "numeric" })}</dd>
                </div>
                <div>
                  <dt className="text-muted">{a.role === "operator" ? "Phone" : "Trips booked"}</dt>
                  <dd className="font-semibold">{a.role === "operator" ? a.phone || "—" : a.trips}</dd>
                </div>
              </dl>
              <div className="mt-4 flex justify-end">
                {reactivating(a) ? (
                  <Button size="sm" variant="success" onClick={() => change.mutate({ id: a.id, status: "active" })} loading={change.isPending && change.variables?.id === a.id}>
                    Reactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" className="text-danger" onClick={() => setTarget(a)}>
                    Suspend
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmSheet
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        title={`Suspend ${target?.name ?? ""}?`}
        description={
          target?.role === "operator"
            ? "They are signed out of the operator console at once and can't log in until you reactivate them. Tours and bookings are kept."
            : "They are signed out at once and can't log in until you reactivate them. Their trips and bookings are kept."
        }
        confirmLabel="Suspend account"
        busy={change.isPending}
        onConfirm={() => target && change.mutate({ id: target.id, status: "suspended" })}
      />
    </div>
  );
}
