"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRightIcon, FlaskIcon, PaperPlaneRightIcon, ShieldCheckIcon, SparkleIcon, WrenchIcon } from "@phosphor-icons/react";
import { askAssistant, type AssistantAnswer, type AssistantTurn } from "@/lib/api/assistant";
import { errorMessage } from "@/lib/api/client";
import { useIncident } from "@/stores/incidentStore";
import { PageHead, Panel } from "@/components/ops/opsKit";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/primitives";
import { cn, rupees } from "@/lib/format";

const SUGGESTIONS = [
  "What trips are affected today?",
  "Which trips are at risk?",
  "Which vendors need confirmation?",
  "What happens if heavy rain starts in Goa tomorrow?",
];
const FOCUS_SUGGESTIONS = ["Explain this Trip Fixer decision.", "Why is this activity marked cannot happen?", "Show me the cheapest fix."];

const SOURCE_LABEL: Record<AssistantAnswer["source"], string> = { "ai-service": "AI agent", gateway: "AI", rules: "rules" };

interface Message {
  id: number;
  from: "operator" | "assistant";
  text: string;
  answer?: AssistantAnswer;
  error?: boolean;
}

function AssistantInner() {
  const params = useSearchParams();
  const incidentId = params.get("incident") ?? undefined;
  const incident = useIncident(incidentId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const next = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, busy]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (question.length < 3 || busy) return;
    const history: AssistantTurn[] = messages.filter((m) => !m.error).slice(-6).map((m) => ({ from: m.from, text: m.text }));
    setMessages((m) => [...m, { id: next.current++, from: "operator", text: question }]);
    setText("");
    setBusy(true);
    try {
      const answer = await askAssistant(question, { incidentId, history });
      setMessages((m) => [...m, { id: next.current++, from: "assistant", text: answer.answer, answer }]);
    } catch (e) {
      setMessages((m) => [...m, { id: next.current++, from: "assistant", text: errorMessage(e, "The assistant couldn't answer. Try again."), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = incidentId ? FOCUS_SUGGESTIONS : SUGGESTIONS;

  return (
    <div>
      <PageHead
        title="Ask the ops assistant"
        sub="Answers from your live trips, problems, vendor confirmations and Trip Fixer runs. It explains and points you to the right page; it never changes a trip."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Panel pad={false}>
          <div className="flex min-h-[60vh] flex-col">
            {incidentId && (
              <div className="mx-4 mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-lavender-soft/60 px-3 py-2 text-xs">
                <span className="font-semibold">Focused on:</span>
                <Link href={`/ops/incidents/${incidentId}`} className="font-semibold text-purple-deep hover:underline">
                  {incident?.title ?? incidentId}
                </Link>
                <Link href="/ops/assistant" className="ml-auto text-muted hover:text-ink">
                  Clear focus
                </Link>
              </div>
            )}
            <div className="max-h-[65vh] flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="py-8 text-center">
                  <SparkleIcon size={36} weight="duotone" className="mx-auto text-purple" />
                  <p className="mt-2 font-display font-bold">Ask about today&apos;s operations</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => void ask(s)} className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.from === "operator" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-[22px] px-4 py-3 text-sm", m.from === "operator" ? "bg-pill text-white" : m.error ? "bg-danger-soft text-danger" : "bg-canvas")}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.answer && <AnswerExtras a={m.answer} />}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-[22px] bg-canvas px-4 py-3 text-sm text-muted">
                    <span className="inline-flex gap-1" aria-label="Thinking">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:240ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={end} />
            </div>
            <form
              className="flex items-end gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(text);
              }}
            >
              <Textarea
                aria-label="Your question"
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(text);
                  }
                }}
                placeholder={incidentId ? "Ask about this problem…" : "e.g. Which trips are at risk?"}
                className="min-h-12 flex-1"
                rows={1}
              />
              <Button type="submit" variant="purple" size="icon" loading={busy} disabled={text.trim().length < 3} aria-label="Send" icon={<PaperPlaneRightIcon size={18} weight="fill" />} />
            </form>
          </div>
        </Panel>

        <Panel title="What it can and can't do">
          <ul className="space-y-2 text-xs text-ink-soft">
            {[
              "Reads live trips, open problems, vendor requests and agent runs",
              "Runs a real What-If simulation when you ask “what if …” about a destination",
              "Explains Change Impact Maps, fix plans and Trip Fixer steps",
              "Never changes trips, bookings, prices or vendor answers",
              "Actions are links: you press the button on the page",
            ].map((g) => (
              <li key={g} className="flex items-start gap-1.5">
                <ShieldCheckIcon size={13} weight="fill" className="mt-0.5 shrink-0 text-success" /> {g}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function AnswerExtras({ a }: { a: AssistantAnswer }) {
  const sim = a.simulation;
  return (
    <div className="mt-2 space-y-2">
      {sim && (
        <div className="rounded-2xl bg-white p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold">
            <FlaskIcon size={13} weight="fill" className="text-purple" /> Simulated: {sim.scenario.title}
          </p>
          <p className="mt-0.5 text-muted">
            {sim.totals.tours} trip(s) · {sim.totals.travelers} travelers · {rupees(sim.totals.moneyAtRisk)} at risk · {sim.totals.autoFixable} fixable inside the rules
          </p>
        </div>
      )}
      {a.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {a.actions.map((x) => (
            <Link key={x.href} href={x.href} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-deep shadow-clay-sm hover:-translate-y-0.5">
              {x.kind === "simulate" ? <FlaskIcon size={12} /> : <ArrowRightIcon size={12} />} {x.label}
            </Link>
          ))}
        </div>
      )}
      <p className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-muted">
        <WrenchIcon size={10} /> {SOURCE_LABEL[a.source]}
        {a.engine && a.engine !== "rules" ? ` · ${a.engine}` : ""}
        {a.tools.length > 0 ? ` · ${a.tools.join(", ")}` : ""}
      </p>
      {a.note && <p className="text-[11px] text-muted">{a.note}</p>}
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={null}>
      <AssistantInner />
    </Suspense>
  );
}
