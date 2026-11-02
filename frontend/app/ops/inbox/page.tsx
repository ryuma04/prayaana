"use client";
import { markThreadRead, sendInboxMessage } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/client";
import { toast } from "@/stores/notificationStore";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { openDocument } from "@/lib/api/documents";
import Link from "next/link";
import { ArrowLeftIcon, PaperPlaneRightIcon, PlayIcon, RobotIcon, FileIcon, CheckIcon, ChecksIcon, ClockIcon, LightningIcon } from "@phosphor-icons/react";
import type { InboxMessage, InboxThread } from "@/types";
import { useOperatorStore } from "@/stores/operatorStore";
import { FilterPill, PageHead, SearchInput } from "@/components/ops/opsKit";
import { Avatar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { cn, timeAgo } from "@/lib/format";

const PARTY_LABEL: Record<InboxThread["party"], string> = { vendor: "Vendors", traveler: "Travelers", agent: "Agent", system: "System" };

function Bubble({ m, tripId }: { m: InboxMessage; tripId?: string }) {
  const mine = m.from !== "them";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm", m.from === "agent" ? "rounded-br-sm bg-lavender-soft" : mine ? "rounded-br-sm bg-[#d9fdd3]" : "rounded-bl-sm bg-white")}>
        {m.from === "agent" && (
          <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-purple-deep">
            <RobotIcon size={11} weight="fill" /> Trip Fixer Agent
          </p>
        )}
        {m.type === "voice" ? (
          <div className="min-w-56">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-success text-white">
                <PlayIcon size={14} weight="fill" />
              </span>
              <div className="flex h-6 flex-1 items-center gap-0.5">
                {Array.from({ length: 28 }).map((_, i) => (
                  <span key={i} className="w-0.5 rounded-full bg-success/70" style={{ height: `${25 + ((i * 41) % 75)}%` }} />
                ))}
              </div>
              <span className="text-[10px] text-muted">{m.body.split("·")[1]?.trim()}</span>
            </div>
            {m.transcript && <p className="mt-2 text-xs italic">“{m.transcript}”</p>}
            {m.decision && (
              <p className="mt-1.5 flex items-center gap-1 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-bold text-purple-deep">
                <LightningIcon size={11} weight="fill" /> Read as: {m.decision} · {Math.round((m.confidence ?? 0) * 100)}%
              </p>
            )}
          </div>
        ) : m.type === "template" ? (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase text-muted">Utility template</p>
            <p>{m.body.replace(/\[[^\]]+\]/g, "").trim()}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(m.body.match(/\[([^\]]+)\]/g) ?? []).map((b) => (
                <span key={b} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#0b7a5f]">
                  {b.slice(1, -1)}
                </span>
              ))}
            </div>
          </div>
        ) : m.type === "button" ? (
          <p className="font-bold text-[#0b7a5f]">↩ {m.body}</p>
        ) : m.type === "attachment" ? (
          <button
            type="button"
            disabled={!m.attachment?.docId || !tripId}
            onClick={() => tripId && m.attachment?.docId && openDocument(tripId, m.attachment.docId, { fileName: m.attachment.name }).catch((e) => toast({ tone: "error", title: errorMessage(e) }))}
            className="flex items-center gap-2 text-left disabled:cursor-default"
          >
            <FileIcon size={18} weight="duotone" className="text-danger" /> <span className="font-semibold">{m.body}</span> <span className="text-[11px] text-muted">{m.attachment?.size}</span>
          </button>
        ) : (
          <p className="whitespace-pre-line">{m.body}</p>
        )}
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
          {timeAgo(m.at)}
          {mine && (m.status === "read" ? <ChecksIcon size={12} className="text-sky-deep" /> : m.status === "delivered" ? <ChecksIcon size={12} /> : <CheckIcon size={12} />)}
        </p>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <Inbox />
    </Suspense>
  );
}

function Inbox() {
  const params = useSearchParams();
  const inbox = useOperatorStore((s) => s.inbox);
  const [party, setParty] = useState<InboxThread["party"] | "all">("all");
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(params.get("thread"));
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return inbox
      .filter((t) => party === "all" || t.party === party)
      .filter((t) => !n || t.name.toLowerCase().includes(n) || t.messages.some((m) => m.body.toLowerCase().includes(n) || m.transcript?.toLowerCase().includes(n)))
      .sort((a, b) => (b.messages.at(-1)?.at ?? "").localeCompare(a.messages.at(-1)?.at ?? ""));
  }, [inbox, party, q]);
  const active = inbox.find((t) => t.id === activeId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, activeId]);

  const open = (id: string) => {
    setActiveId(id);
    void markThreadRead(id);
  };
  const submit = (body: string) => {
    if (!active || !body.trim()) return;
    setText("");
    sendInboxMessage(active.id, body).catch((e) => {
      setText(body);
      toast({ tone: "error", title: errorMessage(e) });
    });
  };
  const windowOpen = active?.windowOpenUntil && new Date(active.windowOpenUntil).getTime() > Date.now();

  return (
    <div>
      <PageHead title="Messages" sub="Every partner and traveler conversation in one place. Voice notes are shown as text with what the AI understood." />
      <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] overflow-hidden rounded-[28px] bg-white shadow-clay md:grid-cols-[340px_1fr]">
        <aside className={cn("flex min-h-0 flex-col border-r border-line", active && "hidden md:flex")}>
          <div className="space-y-2 border-b border-line p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search conversations…" />
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
              {(["all", "vendor", "traveler", "agent", "system"] as const).map((p) => (
                <FilterPill key={p} active={party === p} onClick={() => setParty(p)}>
                  {p === "all" ? "All" : PARTY_LABEL[p]}
                </FilterPill>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && <li className="p-6 text-center text-sm text-muted">No conversations.</li>}
            {list.map((t) => {
              const last = t.messages.at(-1);
              return (
                <li key={t.id}>
                  <button onClick={() => open(t.id)} className={cn("flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left hover:bg-canvas", activeId === t.id && "bg-lavender-soft/60")}>
                    <Avatar name={t.name} tone={t.tone} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-bold">
                        {t.name}
                        {t.unread > 0 && <span className="rounded-full bg-success px-1.5 text-[10px] font-bold text-white">{t.unread}</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{last ? (last.type === "voice" ? `Voice note: ${last.transcript ?? ""}` : last.body) : t.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted">{last ? timeAgo(last.at) : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <section className={cn("flex min-h-0 flex-col", !active && "hidden md:flex")}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState compact title="Pick a conversation" body="Vendor replies, traveler voice notes and agent summaries all land here." mood="happy" />
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button onClick={() => setActiveId(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-canvas md:hidden" aria-label="Back">
                  <ArrowLeftIcon size={16} />
                </button>
                <Avatar name={active.name} tone={active.tone} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{active.name}</p>
                  <p className="truncate text-[11px] text-muted">{active.subtitle}</p>
                </div>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold", windowOpen ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                  <ClockIcon size={11} /> {windowOpen ? "24h window open · free replies" : "Template only (₹0.115)"}
                </span>
                {active.vendorId && (
                  <Link href={`/ops/vendors/${active.vendorId}`} className="hidden text-xs font-bold text-purple-deep sm:inline">
                    Vendor
                  </Link>
                )}
                {active.tripId && (
                  <Link href={`/ops/tours/${active.tripId}`} className="hidden text-xs font-bold text-purple-deep sm:inline">
                    Tour
                  </Link>
                )}
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#efe7dc] p-4" style={{ backgroundImage: "radial-gradient(rgb(0 0 0 / 0.035) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
                {active.messages.map((m) => (
                  <Bubble key={m.id} m={m} tripId={active.tripId} />
                ))}
                <div ref={endRef} />
              </div>
              <div className="border-t border-line p-3">
                <div className="scrollbar-none mb-2 flex gap-1.5 overflow-x-auto">
                  {(active.party === "vendor" ? ["Thank you, confirmed", "Can you share the driver's number?", "Please confirm by 6 PM"] : ["We're on it!", "Your pickup is confirmed.", "Calling you in 2 minutes"]).map((s) => (
                    <button key={s} onClick={() => submit(s)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:bg-canvas">
                      {s}
                    </button>
                  ))}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(text);
                  }}
                >
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder={windowOpen ? "Type a reply…" : "Outside 24h, a utility template will be used"} aria-label="Reply" className="h-11 flex-1 rounded-full border border-line px-4 text-sm outline-none focus:border-purple" />
                  <button type="submit" className="grid h-11 w-11 place-items-center rounded-full bg-success text-white" aria-label="Send">
                    <PaperPlaneRightIcon size={18} weight="fill" />
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
