"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, ArrowsClockwiseIcon, CompassIcon, CheckCircleIcon, type Icon } from "@phosphor-icons/react";
import { DnaIcon, QUIZ_ICONS, SLIDER_ICONS } from "@/lib/icons";
import { QUIZ, computeDNA, dnaToInterests } from "@/lib/engine/dna";
import { useQuizStore } from "@/stores/quizStore";
import { useTravelerStore } from "@/stores/travelerStore";
import { StepShell } from "@/components/traveler/StepShell";
import { TravelDNABars } from "@/components/traveler/TravelDNA";
import { Slider } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Burst } from "@/components/landing/Burst";
import { Zippy } from "@/components/art/Zippy";
import { toneSoft } from "@/components/ui/tone";
import { cn } from "@/lib/format";
import { submitQuiz } from "@/lib/api/profile";
import { sleep } from "@/lib/api/client";
import { toast } from "@/stores/notificationStore";

export default function QuizPage() {
  const router = useRouter();
  const { answers, index, completed, answer, go, complete, reset } = useQuizStore();
  const travelerDNA = useTravelerStore((s) => s.dna);
  const setDNA = useTravelerStore((s) => s.setDNA);
  const applyProfile = useTravelerStore((s) => s.applyProfile);
  const setAnswers = useTravelerStore((s) => s.setAnswers);
  const [analyzing, setAnalyzing] = useState(false);
  const dna = useMemo(() => travelerDNA || computeDNA(answers), [travelerDNA, answers]);
  const hasAnswers = Object.keys(answers).length > 0;
  const showCompleted = completed && (hasAnswers || !!travelerDNA);
  const q = QUIZ[index];

  // If marked completed in local storage but user has no answers and no saved DNA, reset to questions
  useEffect(() => {
    if (completed && !hasAnswers && !travelerDNA) {
      reset();
    }
  }, [completed, hasAnswers, travelerDNA, reset]);

  const submitQuizNow = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    const computed = computeDNA(answers);
    try {
      const [res] = await Promise.all([submitQuiz(answers), sleep(1800)]);
      applyProfile(res.profile);
      setAnswers({ interests: dnaToInterests(res.dna), pace: res.dna.pace, rhythm: res.dna.rhythm });
    } catch {
      setDNA(computed);
      setAnswers({ interests: dnaToInterests(computed), pace: computed.pace, rhythm: computed.rhythm });
      toast({ tone: "warning", title: "Saved on this device only", body: "We couldn't reach the server. Your Travel DNA will sync next time." });
    } finally {
      complete();
      setAnalyzing(false);
    }
  };

  if (analyzing) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite">
        <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
          <Zippy mood="thinking" size={130} />
        </motion.div>
        <h1 className="mt-6 text-2xl font-extrabold">Decoding your Travel DNA…</h1>
        <div className="mt-6 w-full max-w-xs space-y-2 text-left text-sm">
          {["Weighing adventure vs. comfort", "Matching your rhythm", "Naming your travel personality"].map((t, i) => (
            <motion.p key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 * i }} className="flex items-center gap-2 font-medium">
              <CheckCircleIcon size={18} weight="fill" className="text-success" /> {t}
            </motion.p>
          ))}
        </div>
      </div>
    );
  }

  if (showCompleted) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-[36px] border-2 border-ink bg-white p-6 shadow-pop-lg sm:p-8">
          <div className="absolute -right-4 -top-10">
            <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }}>
              <Burst text="YOU!" color="#fad47f" size={100} rotate={12} />
            </motion.div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Your Travel DNA</p>
          <motion.h1 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", delay: 0.1 }} className="mt-2 text-3xl font-extrabold sm:text-4xl">
            <span className="inline-flex items-center gap-3">
              <DnaIcon name={dna.name} size={40} className="text-purple-deep" /> {dna.name}
            </span>
          </motion.h1>
          <div className="mt-6">
            <TravelDNABars dna={dna} />
          </div>
          <p className="mt-6 rounded-2xl bg-canvas p-4 text-sm leading-relaxed text-ink-soft">{dna.summary}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button size="lg" onClick={() => router.push("/onboarding")} icon={<ArrowRightIcon size={18} weight="bold" />}>
              Plan with my DNA
            </Button>
            <Button size="lg" variant="outline" href="/discover" icon={<CompassIcon size={18} weight="bold" />}>
              Explore trips
            </Button>
          </div>
          <button onClick={reset} className="mx-auto mt-5 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <ArrowsClockwiseIcon size={14} /> Retake the quiz
          </button>
        </motion.div>
      </div>
    );
  }

  const value = answers[q.id];
  const answered = q.kind === "slider" ? true : q.kind === "multi" ? Array.isArray(value) && value.length > 0 : typeof value === "string";
  const onNext = () => (index === QUIZ.length - 1 ? void submitQuizNow() : go(index + 1));

  return (
    <StepShell
      step={index}
      total={QUIZ.length}
      label="Travel DNA"
      title={q.title}
      subtitle={q.subtitle}
      stepKey={q.id}
      exitHref="/discover"
      onBack={index > 0 ? () => go(index - 1) : undefined}
      onNext={onNext}
      onSkip={() => (index === QUIZ.length - 1 ? void submitQuizNow() : go(index + 1))}
      nextDisabled={!answered}
      nextLabel={index === QUIZ.length - 1 ? "Reveal my DNA" : "Next"}
    >
      {q.kind === "single" && (
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={q.title}>
          {q.options.map((o, i) => {
            const on = value === o.id;
            return (
              <motion.button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => answer(q.id, o.id)}
                className={cn("flex min-h-36 flex-col items-center justify-center gap-3 rounded-[28px] p-4 text-center transition", on ? cn(toneSoft[o.tone], "ring-[3px] ring-ink shadow-pop") : "bg-white shadow-clay-sm hover:-translate-y-1")}
              >
                <QuizIcon id={o.id} size={48} tone={o.tone} />
                <span className="text-sm font-bold">{o.label}</span>
                {o.hint && <span className="-mt-2 text-xs text-muted">{o.hint}</span>}
              </motion.button>
            );
          })}
        </div>
      )}
      {q.kind === "multi" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {q.options.map((o) => {
            const list = Array.isArray(value) ? value : [];
            const on = list.includes(o.id);
            const full = !on && list.length >= q.max;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => answer(q.id, on ? list.filter((x) => x !== o.id) : [...list, o.id])}
                className={cn("flex flex-col items-center gap-2 rounded-[24px] p-4 transition disabled:opacity-40", on ? cn(toneSoft[o.tone], "ring-[3px] ring-ink shadow-pop") : "bg-white shadow-clay-sm hover:-translate-y-0.5")}
              >
                <QuizIcon id={o.id} size={40} tone={o.tone} />
                <span className="text-sm font-bold">{o.label}</span>
              </button>
            );
          })}
          <p className="col-span-full text-xs text-muted">
            {(Array.isArray(value) ? value.length : 0)} / {q.max} picked
          </p>
        </div>
      )}
      {q.kind === "slider" && (
        <SliderQuestion
          value={typeof value === "number" ? value : 50}
          onChange={(v) => answer(q.id, v)}
          left={q.left}
          right={q.right}
          icons={SLIDER_ICONS[q.id]}
          label={q.title}
        />
      )}
    </StepShell>
  );
}

// Each option's icon takes the deep shade of its card colour.
const ICON_COLOR: Record<string, string> = {
  coral: "text-coral-deep", cream: "text-sun-deep", lavender: "text-purple-deep", mint: "text-mint-deep",
  pink: "text-pink-deep", sky: "text-sky-deep", sun: "text-sun-deep",
};

function QuizIcon({ id, size, tone }: { id: string; size: number; tone?: string }) {
  const I = QUIZ_ICONS[id] ?? CompassIcon;
  return <I size={size} weight="duotone" className={ICON_COLOR[tone ?? ""] ?? "text-purple-deep"} aria-hidden />;
}

function SliderQuestion({ value, onChange, left, right, icons, label }: { value: number; onChange: (v: number) => void; left: string; right: string; icons?: [Icon, Icon]; label: string }) {
  const scale = 0.8 + (value / 100) * 0.7;
  const [Left, Right] = icons ?? [CompassIcon, CompassIcon];
  return (
    <div className="rounded-[32px] bg-white p-6 shadow-clay sm:p-8">
      <div className="flex items-center justify-between">
        <motion.span animate={{ scale: 1.6 - (value / 100) * 0.7 }} aria-hidden>
          <Left size={44} weight="duotone" className="text-mint-deep" />
        </motion.span>
        <AnimatePresence mode="popLayout">
          <motion.span key={Math.round(value / 10)} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-4xl font-extrabold tabular">
            {value}
          </motion.span>
        </AnimatePresence>
        <motion.span animate={{ scale }} aria-hidden>
          <Right size={44} weight="duotone" className="text-coral-deep" />
        </motion.span>
      </div>
      <Slider className="mt-8" value={value} onChange={onChange} min={0} max={100} label={label} />
      <div className="mt-3 flex justify-between gap-4 text-xs font-semibold text-muted">
        <span>{left}</span>
        <span className="text-right">{right}</span>
      </div>
    </div>
  );
}
