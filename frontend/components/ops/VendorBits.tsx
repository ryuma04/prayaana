"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Vendor } from "@/types";
import { useOperatorStore } from "@/stores/operatorStore";
import { setAvailability } from "@/lib/api/vendors";
import { Switch } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { toast } from "@/stores/notificationStore";
import { cn } from "@/lib/format";

export function TrustRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? "#23864b" : score >= 65 ? "#d99a0b" : "#c93535";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Trust score ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef1f6" strokeWidth={6} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.3} fontWeight={800} fill="#1c1b2b">
        {score}
      </text>
    </svg>
  );
}

export function useVendorAvailable(v: Vendor) {
  const override = useOperatorStore((s) => s.vendorAvailability[v.id]);
  return override ?? v.available;
}

/** Availability switch — pausing asks for confirmation because it creates incidents. */
export function AvailabilityToggle({ v }: { v: Vendor }) {
  const router = useRouter();
  const available = useVendorAvailable(v);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const pause = async () => {
    setBusy(true);
    const created = await setAvailability(v.id, false);
    setBusy(false);
    setConfirm(false);
    toast({ tone: created.length ? "warning" : "info", title: `${v.name} paused`, body: created.length ? `${created.length} tour${created.length > 1 ? "s" : ""} affected, incidents created.` : "No upcoming bookings affected.", action: created[0] ? { label: "Open incident", href: `/ops/incidents/${created[0].id}` } : undefined });
    if (created.length === 1) router.push(`/ops/incidents/${created[0].id}`);
  };
  return (
    <>
      <label className="inline-flex items-center gap-2 text-xs font-semibold">
        <Switch
          checked={available}
          onChange={(on) => {
            if (on) {
              void setAvailability(v.id, true);
              toast({ tone: "success", title: `${v.name} available again` });
            } else setConfirm(true);
          }}
          label={`${v.name} available`}
        />
        <span className={cn(available ? "text-success" : "text-danger")}>{available ? "Available" : "Paused"}</span>
      </label>
      <Sheet open={confirm} onOpenChange={setConfirm} title={`Pause ${v.name}?`} description="Every upcoming booking with this vendor becomes an incident so the agent can find a replacement." side="center" size="sm">
        <div className="flex gap-2">
          <Button variant="danger" onClick={pause} loading={busy}>
            Pause vendor
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Keep available
          </Button>
        </div>
      </Sheet>
    </>
  );
}
