"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircleIcon, ClockIcon, MicrophoneIcon, ChatCircleDotsIcon, LightningIcon, StopIcon, ProhibitIcon } from "@phosphor-icons/react";
import type { VoiceInterpretation } from "@/types";
import { getVendorRequest, replyToRequest, sendVoiceReply, type VendorPage } from "@/lib/api/vendors";
import { VOICE_SAMPLES } from "@/lib/api/ai";
import { errorMessage } from "@/lib/api/client";
import { useRecorder } from "@/hooks/useRecorder";
import { LogoMark } from "@/components/brand/Logo";
import { ErrorState, PageLoader } from "@/components/ui/States";
import { Zippy } from "@/components/art/Zippy";
import { minToTime, timeAgo } from "@/lib/format";

const TIMES = Array.from({ length: 14 }, (_, i) => 6 * 60 + 30 + i * 60);

type Answer = "yes" | "no" | "other_time";

const ANSWERED: Record<string, string> = { yes: "Yes, confirmed", no: "No, can't do it", other_time: "Another time", timeout: "No reply in time" };

export function VendorReply({ token }: { token: string }) {
  const qc = useQueryClient();
  const key = ["vendor-request", token];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => getVendorRequest(token),
    retry: 0,
    // The request can be cancelled by a rollback elsewhere: keep an open request fresh.
    refetchInterval: (q) => (q.state.data?.open ? 5000 : false),
  });
  const [mode, setMode] = useState<"choose" | "other" | "voice">("choose");
  const [sending, setSending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [heard, setHeard] = useState<VoiceInterpretation | null>(null);
  const recorder = useRecorder();

  if (isLoading) return <PageLoader label="Opening request…" />;
  if (error || !data) {
    return (
      <Frame>
        <ErrorState title="This link has expired" error={error} onRetry={() => refetch()} />
      </Frame>
    );
  }
  const { req, vendor } = data;
  const answered = req.status !== "pending" && req.status !== "cancelled" ? req.status : undefined;

  const done = (page: VendorPage) => qc.setQueryData(key, page);

  const send = async (answer: Answer, altTime?: string) => {
    setSending(answer);
    setFailure(null);
    try {
      done(await replyToRequest(token, answer, altTime));
    } catch (e) {
      setFailure(errorMessage(e));
      void refetch();
    } finally {
      setSending(null);
    }
  };

  const sendVoice = async (note: Blob | string) => {
    setSending("voice");
    setFailure(null);
    try {
      const res = await sendVoiceReply(token, note);
      setHeard(res.voice);
      done(res);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setSending(null);
    }
  };

  const stopAndSend = async () => {
    const blob = await recorder.stop();
    if (blob) void sendVoice(blob);
  };

  const voice = heard ?? req.voice;

  return (
    <Frame vendorName={vendor?.name}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl rounded-tl-sm bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 font-display text-sm font-extrabold">
          <LogoMark size={20} /> PRAYAANA
        </p>
        <p className="mt-2 text-base font-bold">{req.kind === "booking" ? "Booking request" : "Change request"}</p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted">Traveler</dt>
            <dd className="font-semibold">{req.travelerName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted">Date</dt>
            <dd className="font-semibold">{req.dateLabel || ""}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted">For</dt>
            <dd className="font-semibold">{vendor?.name}</dd>
          </div>
        </dl>
        {req.original && req.original !== "" && (
          <div className="mt-3 rounded-xl bg-canvas p-3">
            <p className="text-[11px] font-bold uppercase text-muted">Original</p>
            <p className="whitespace-pre-line text-sm text-muted line-through">{req.original}</p>
          </div>
        )}
        <div className="mt-2 rounded-xl bg-mint-soft p-3">
          <p className="text-[11px] font-bold uppercase text-mint-deep">New</p>
          <p className="whitespace-pre-line text-sm font-bold">{req.proposed}</p>
        </div>
        <p className="mt-3 text-sm">Can you confirm?</p>
        <p className="mt-1 text-[10px] text-muted">Sent {timeAgo(req.createdAt)} · replies are logged for the Change Receipt</p>
      </motion.div>

      {failure && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger">{failure}</p>}

      <AnimatePresence mode="wait">
        {req.status === "cancelled" ? (
          <motion.div key="cancelled" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <ProhibitIcon size={40} weight="duotone" className="mx-auto text-muted" />
            <p className="mt-2 font-bold">Request cancelled</p>
            <p className="mt-1 text-sm text-muted">Another vendor couldn&apos;t make it, so this change was rolled back. Your original booking stays as it was. No action needed.</p>
          </motion.div>
        ) : answered ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm">
            <p className="flex items-center gap-2 font-bold text-success">
              <CheckCircleIcon size={22} weight="fill" /> Response recorded
            </p>
            <p className="mt-1 text-sm">
              You answered: <b>{ANSWERED[answered] ?? answered}{answered === "other_time" && req.altTime ? ` (${req.altTime})` : ""}</b>
              {req.channel === "voice" ? " · via voice note" : ""}
            </p>
            {voice && <VoiceCard v={voice} />}
            <p className="mt-2 text-xs text-muted">Thank you! The operator and traveler see your answer instantly.</p>
          </motion.div>
        ) : !data.open ? (
          <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <p className="font-bold">This request is closed</p>
            <p className="mt-1 text-sm text-muted">The time to answer has passed. The operator will call you if anything is needed.</p>
          </motion.div>
        ) : mode === "choose" ? (
          <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button disabled={!!sending} onClick={() => send("yes")} className="rounded-2xl bg-white py-3.5 text-sm font-extrabold text-[#0b7a5f] shadow-sm active:scale-95 disabled:opacity-60">
                {sending === "yes" ? "…" : "YES"}
              </button>
              <button disabled={!!sending} onClick={() => send("no")} className="rounded-2xl bg-white py-3.5 text-sm font-extrabold text-danger shadow-sm active:scale-95 disabled:opacity-60">
                {sending === "no" ? "…" : "NO"}
              </button>
              <button disabled={!!sending} onClick={() => setMode("other")} className="rounded-2xl bg-white py-3.5 text-xs font-extrabold text-purple-deep shadow-sm active:scale-95 disabled:opacity-60">
                OTHER TIME
              </button>
            </div>
            <button onClick={() => setMode("voice")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold shadow-sm">
              <MicrophoneIcon size={18} weight="fill" className="text-success" /> Reply with a voice note
            </button>
          </motion.div>
        ) : mode === "other" ? (
          <motion.div key="other" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <ClockIcon size={16} /> Which time works for you?
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TIMES.map((t) => (
                <button key={t} disabled={!!sending} onClick={() => send("other_time", minToTime(t))} className="rounded-xl bg-canvas py-2 text-xs font-bold hover:bg-lavender-soft disabled:opacity-60">
                  {minToTime(t)}
                </button>
              ))}
            </div>
            <button onClick={() => setMode("choose")} className="mt-3 text-xs font-semibold text-muted">
              ← Back
            </button>
          </motion.div>
        ) : (
          <motion.div key="voice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm font-bold">Voice note</p>
            {sending === "voice" ? (
              <p className="mt-4 flex items-center gap-2 text-sm" role="status">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-mint border-t-success" /> Listening with Whisper, deciding with Jev…
              </p>
            ) : recorder.recording ? (
              <div className="mt-4 flex flex-col items-center" role="status">
                <button onClick={() => void stopAndSend()} className="relative grid h-16 w-16 place-items-center rounded-full bg-danger text-white" aria-label="Stop and send">
                  <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-40" />
                  <StopIcon size={24} weight="fill" />
                </button>
                <div className="mt-3 flex h-8 items-center gap-1">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <motion.span key={i} className="w-1 rounded-full bg-danger" animate={{ height: ["20%", "100%", "30%"] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.05 }} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Recording… tap to stop and send</p>
              </div>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted">Speak in any language, e.g. &ldquo;Haan, kal subah 9 baje aa jaunga&rdquo;.</p>
                <button onClick={() => void recorder.start()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-success py-3 text-sm font-bold text-white">
                  <MicrophoneIcon size={18} weight="fill" /> Record
                </button>
                {recorder.error && <p className="mt-2 text-xs font-semibold text-danger">{recorder.error}</p>}
                <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-muted">Or send a sample note</p>
                <div className="mt-2 space-y-1.5">
                  {VOICE_SAMPLES.map((s) => (
                    <button key={s.id} onClick={() => void sendVoice(s.transcript)} className="w-full rounded-xl bg-canvas px-3 py-2 text-left text-xs hover:bg-mint-soft">
                      {s.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setMode("choose")} className="mt-3 text-xs font-semibold text-muted">
                  ← Back to buttons
                </button>
              </>
            )}
            {heard && !answered && (
              <div className="mt-3">
                <VoiceCard v={heard} />
                {heard.decision === "needs_call" && <p className="mt-2 text-xs font-semibold text-purple-deep">We&apos;ve asked the operator to call you.</p>}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Frame>
  );
}

function VoiceCard({ v }: { v: VoiceInterpretation }) {
  return (
    <div className="mt-2 space-y-1.5">
      <p className="rounded-xl bg-white/70 p-2.5 text-sm italic">“{v.transcript}”</p>
      {v.translation && <p className="text-xs text-muted">{v.translation}</p>}
      <p className="flex items-center gap-1 rounded-xl bg-lavender-soft px-2.5 py-1.5 text-xs">
        <LightningIcon size={12} weight="fill" className="text-purple-deep" />
        <b className="capitalize">{v.decision.replace("_", " ")}</b>
        {v.time ? ` · ${v.time}` : ""} · {Math.round(v.confidence * 100)}% sure
      </p>
    </div>
  );
}

function Frame({ children, vendorName }: { children: React.ReactNode; vendorName?: string }) {
  return (
    <div className="min-h-dvh bg-ink">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-ink px-4 py-3 text-white">
        <ChatCircleDotsIcon size={26} weight="fill" className="text-purple" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Prayaana Trips</p>
          <p className="truncate text-[11px] text-white/70">{vendorName ? `to ${vendorName} · ` : ""}verified business · no login needed</p>
        </div>
        <Zippy mood="happy" size={36} />
      </header>
      <main id="main" className="mx-auto max-w-md space-y-3 px-3 pb-10 pt-4" style={{ backgroundImage: "radial-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
        {children}
      </main>
    </div>
  );
}
