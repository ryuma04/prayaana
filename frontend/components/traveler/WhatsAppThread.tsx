"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChatsCircleIcon, PaperPlaneRightIcon, FilePdfIcon, ChecksIcon, CircleNotchIcon } from "@phosphor-icons/react";
import type { InboxMessage } from "@/types";
import { useCommsStore } from "@/stores/commsStore";

import { toast } from "@/stores/notificationStore";
import { loadWhatsApp, openDocument, sendTripWhatsApp } from "@/lib/api/documents";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/primitives";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/**
 * The trip's message thread: booking confirmations, documents, change updates and
 * replies from the trip assistant. Without Meta keys on the server this is the mock
 * channel (same messages, shown here and in the operator inbox).
 */
export function WhatsAppThread({ tripId, className, height = 380 }: { tripId: string; className?: string; height?: number }) {
  const messages = useCommsStore((s) => s.whatsapp[tripId]);
  const state = useCommsStore((s) => s.whatsappState[tripId] ?? "idle");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWhatsApp(tripId).catch(() => undefined);
  }, [tripId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await sendTripWhatsApp(tripId, body);
      useCommsStore.getState().receive(tripId, res.sent);
      useCommsStore.getState().receive(tripId, res.reply);
      setText("");
    } catch (err) {
      toast({ tone: "error", title: "Message not sent", body: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={className} pad="none">
      <div className="flex items-center gap-3 rounded-t-[28px] bg-ink px-5 py-3 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
          <ChatsCircleIcon size={22} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">Messages</p>
          <p className="truncate text-[11px] text-white/75">Trip updates and help</p>
        </div>
      </div>
      <div ref={scroller} className="space-y-2 overflow-y-auto bg-canvas px-3 py-4" style={{ height }} aria-live="polite" aria-label="Trip messages">
        {state === "error" && !messages ? (
          <ErrorState title="Couldn't load messages" error="Check your connection." onRetry={() => loadWhatsApp(tripId).catch(() => undefined)} className="py-6" />
        ) : !messages ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-14 w-3/4" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-16 w-2/3" />
          </div>
        ) : messages.length === 0 ? (
          <p className="mx-auto mt-10 max-w-xs rounded-xl bg-sun-soft p-3 text-center text-xs text-ink-soft">
            Booking confirmations, documents and every change to your trip arrive here. Say hi or ask anything about the trip.
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} tripId={tripId} />)
        )}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 rounded-b-[28px] border-t border-line bg-white px-3 py-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Message the trip assistant… e.g. “We're stuck in traffic”"
          aria-label="Message"
          className="h-11 min-w-0 flex-1 rounded-full bg-canvas px-4 text-sm outline-none focus:ring-2 focus:ring-purple/40"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send"
          className="grid h-11 w-11 place-items-center rounded-full bg-purple text-white transition active:scale-95 disabled:opacity-40"
        >
          {sending ? <CircleNotchIcon size={18} className="animate-spin" /> : <PaperPlaneRightIcon size={18} weight="fill" />}
        </button>
      </form>
    </Card>
  );
}

function Bubble({ m, tripId }: { m: InboxMessage; tripId: string }) {
  const mine = m.from === "them"; // the traveler's own messages
  const [opening, setOpening] = useState(false);
  const doc = m.attachment?.docId;
  const open = async () => {
    if (!doc) return;
    setOpening(true);
    try {
      await openDocument(tripId, doc, { fileName: m.attachment?.name });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't open the document", body: errorMessage(e) });
    } finally {
      setOpening(false);
    }
  };
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm", mine ? "rounded-tr-sm bg-lavender-soft" : "rounded-tl-sm bg-white")}>
        {m.type === "attachment" && m.attachment ? (
          <button onClick={open} disabled={opening || !doc} className="flex w-full items-center gap-2.5 rounded-lg bg-canvas p-2 text-left disabled:opacity-60">
            <FilePdfIcon size={28} weight="duotone" className="shrink-0 text-danger" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{m.body}</span>
              <span className="block truncate text-[11px] text-muted">
                {m.attachment.name} · {m.attachment.size}
                {opening ? " · opening…" : ""}
              </span>
            </span>
          </button>
        ) : m.type === "voice" ? (
          <p>
            <span className="text-[11px] font-semibold text-muted">Voice note</span>
            <br />“{m.transcript}”
          </p>
        ) : (
          <p className="whitespace-pre-line break-words">{m.body}</p>
        )}
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
          {m.from === "agent" && <span className="mr-auto font-semibold text-purple">Trip assistant</span>}
          {time(m.at)}
          {!mine && m.status && <ChecksIcon size={12} className={m.status === "read" ? "text-sky-deep" : ""} aria-label={m.status} />}
        </p>
      </div>
    </div>
  );
}
