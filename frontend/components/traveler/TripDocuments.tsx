"use client";
import { useEffect, useState } from "react";
import { ArrowClockwiseIcon, DownloadSimpleIcon, FilePdfIcon, ReceiptIcon, TicketIcon, MapTrifoldIcon, SealCheckIcon } from "@phosphor-icons/react";
import type { TripDocument } from "@/types";
import { useCommsStore } from "@/stores/commsStore";
import { toast } from "@/stores/notificationStore";
import { latestDocuments, loadDocuments, openDocument, reissueDocuments, sizeLabel } from "@/lib/api/documents";
import { errorMessage } from "@/lib/api/client";
import { cn, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/primitives";

const ICON = { confirmation: SealCheckIcon, invoice: ReceiptIcon, itinerary: MapTrifoldIcon, voucher: TicketIcon };
const TONE = { confirmation: "bg-mint-soft", invoice: "bg-cream", itinerary: "bg-sky-soft", voucher: "bg-lavender-soft" };

/** Booking confirmation, invoice, itinerary and vouchers as real PDFs (issued by the Go API). */
export function TripDocuments({ tripId, booked, className, compact }: { tripId: string; booked: boolean; className?: string; compact?: boolean }) {
  const list = useCommsStore((s) => s.docs[tripId]);
  const state = useCommsStore((s) => s.docsState[tripId] ?? "idle");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (booked) loadDocuments(tripId).catch(() => undefined);
  }, [tripId, booked]);

  const open = async (d: TripDocument, download = false) => {
    setBusy(d.id + (download ? ":dl" : ""));
    try {
      await openDocument(tripId, d.id, { download, fileName: d.fileName });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't open the document", body: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const reissue = async () => {
    setBusy("reissue");
    try {
      useCommsStore.getState().setDocs(tripId, await reissueDocuments(tripId));
      toast({ tone: "success", title: "Documents refreshed", body: "New versions reflect the latest plan." });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't refresh documents", body: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const latest = latestDocuments(list ?? []);
  const older = (list ?? []).filter((d) => !d.latest).length;

  return (
    <Card className={className}>
      <SectionTitle
        title="Trip documents"
        kicker="PDF · always the latest version"
        action={
          booked && latest.length > 0 ? (
            <Button size="sm" variant="ghost" loading={busy === "reissue"} onClick={reissue} icon={<ArrowClockwiseIcon size={14} weight="bold" />}>
              Refresh
            </Button>
          ) : undefined
        }
      />
      {!booked ? (
        <p className="rounded-2xl bg-canvas p-4 text-sm text-muted">Your confirmation, invoice, itinerary and vouchers appear here as soon as the trip is booked.</p>
      ) : state === "error" && !list ? (
        <ErrorState title="Couldn't load documents" error="Check your connection and try again." onRetry={() => loadDocuments(tripId).catch(() => undefined)} className="py-6" />
      ) : !list ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-busy="true" aria-label="Loading documents">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : latest.length === 0 ? (
        <p className="rounded-2xl bg-canvas p-4 text-sm text-muted">No documents yet. Tap refresh to issue them.</p>
      ) : (
        <ul className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
          {latest.map((d) => {
            const Icon = ICON[d.kind];
            return (
              <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", TONE[d.kind])}>
                  <Icon size={20} weight="duotone" />
                </span>
                <button onClick={() => open(d)} className="min-w-0 flex-1 text-left" aria-label={`Open ${d.title}`}>
                  <p className="truncate text-sm font-bold">{d.title}</p>
                  <p className="truncate text-[11px] text-muted">
                    v{d.version} · {sizeLabel(d.sizeBytes)} · {d.reason || "Issued"} · {timeAgo(d.createdAt)}
                  </p>
                </button>
                <Button size="icon-sm" variant="ghost" aria-label={`View ${d.title}`} loading={busy === d.id} onClick={() => open(d)} icon={<FilePdfIcon size={18} />} />
                <Button size="icon-sm" variant="ghost" aria-label={`Download ${d.title}`} loading={busy === d.id + ":dl"} onClick={() => open(d, true)} icon={<DownloadSimpleIcon size={18} />} />
              </li>
            );
          })}
        </ul>
      )}
      {older > 0 && <p className="mt-3 text-[11px] text-muted">{older} earlier version{older > 1 ? "s" : ""} kept for your records.</p>}
    </Card>
  );
}
