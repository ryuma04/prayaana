"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainIcon, CheckCircleIcon, CircleIcon, CircleNotchIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import { askAIModel, getAIModel } from "@/lib/api/ops";
import { errorMessage } from "@/lib/api/client";
import { Panel } from "@/components/ops/opsKit";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

type Step = { label: string; detail: string; state: "done" | "working" | "waiting" };

const DONE = ["READY", "EVALUATED", "DEPLOYING", "UNDEPLOYED", "DEPLOYED"];

function FormattedAnswer({ text }: { text: string }) {
  const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);

  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-bold text-ink">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="rounded-2xl bg-white border border-ink/15 p-4 text-xs sm:text-sm space-y-2 text-ink shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b border-ink/10 pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-deep">
          <BrainIcon size={16} weight="fill" />
          <span>Nugen Aligned AI Concierge</span>
        </div>
        <span className="text-[10px] font-bold bg-lavender-soft text-purple-deep px-2 py-0.5 rounded-full border border-purple/20">
          Model Output
        </span>
      </div>
      <div className="space-y-2">
        {paragraphs.map((p, idx) => (
          <p key={idx} className="leading-relaxed font-medium text-ink">
            {parseBold(p)}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Base model → Nugen alignment on Prayaana's Karnataka travel data → domain model → used by the app. */
export function AIModelCard() {
  const { data } = useQuery({ queryKey: ["ai-model"], queryFn: getAIModel, refetchInterval: 60_000 });
  const [q, setQ] = useState("What are top 3 budget spots in Gokarna?");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  if (!data?.configured) return null;

  const aligned = DONE.includes(data.alignmentStatus);
  const deployed = data.deploymentStatus === "DEPLOYED";
  const steps: Step[] = [
    { label: "Base model", detail: data.baseModel || "Nugen base model", state: "done" },
    {
      label: "Aligned on Prayaana data",
      detail: aligned
        ? `${data.documents} documents: destinations, experiences, trip rules`
        : data.alignmentStatus === "QUEUED" && data.queuePosition != null
          ? `Waiting in Nugen's queue (position ${data.queuePosition})`
          : `Training on ${data.documents} documents`,
      state: aligned ? "done" : "working",
    },
    { label: "Travel model deployed", detail: deployed ? data.modelId : aligned ? "Deploying" : "After training", state: deployed ? "done" : aligned ? "working" : "waiting" },
    { label: "Answering travelers", detail: data.inUse && deployed ? "Trip chat and change explanations" : "Starts once deployed", state: data.inUse && deployed ? "done" : "waiting" },
  ];

  const ask = async () => {
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer((await askAIModel(q)).answer);
    } catch (e) {
      setAnswer(errorMessage(e));
    } finally {
      setAsking(false);
    }
  };

  return (
    <Panel title="Prayaana travel model" action={<span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-deep"><BrainIcon size={14} weight="duotone" /> Nugen</span>}>
      <ol className="grid gap-3 sm:grid-cols-4">
        {steps.map((s) => (
          <li key={s.label} className={cn("rounded-[20px] p-3", s.state === "done" ? "bg-mint-soft" : s.state === "working" ? "bg-sun-soft" : "bg-canvas")}>
            <p className="flex items-center gap-1.5 text-sm font-bold">
              {s.state === "done" ? <CheckCircleIcon size={16} weight="fill" className="text-success" /> : s.state === "working" ? <CircleNotchIcon size={16} className="animate-spin text-sun-deep" /> : <CircleIcon size={16} className="text-faint" />}
              {s.label}
            </p>
            <p className="mt-1 break-all text-xs text-ink-soft">{s.detail}</p>
          </li>
        ))}
      </ol>
      {data.error && <p className="mt-3 text-xs text-danger">{data.error}</p>}
      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask the travel model" placeholder="Ask about places, food, or trip rules..." />
          <Button onClick={ask} loading={asking} icon={<PaperPlaneRightIcon size={16} weight="bold" />}>
            Ask
          </Button>
        </div>
        {answer && <FormattedAnswer text={answer} />}
      </div>
    </Panel>
  );
}
