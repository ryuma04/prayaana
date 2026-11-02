"use client";
import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { SparkleIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { useTravelerStore } from "@/stores/travelerStore";
import { useAuthStore } from "@/stores/authStore";
import { StepShell } from "@/components/traveler/StepShell";
import {
  AllocationStep,
  BudgetStep,
  DaysStep,
  InterestsStep,
  ReviewStep,
  SpecialStep,
  StayStep,
  StyleStep,
  TransportStep,
  WhenStep,
  WhereStep,
  WhoStep,
  WordsStep,
} from "@/components/traveler/OnboardingSteps";
import { Zippy } from "@/components/art/Zippy";
import { Button } from "@/components/ui/Button";
import { dnaToInterests } from "@/lib/engine/dna";
import { destinations } from "@/data/destinations";
import type { DestinationId } from "@/types";

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const answers = useTravelerStore((s) => s.answers);
  const step = useTravelerStore((s) => s.onboardingStep);
  const setAnswers = useTravelerStore((s) => s.setAnswers);
  const setStep = useTravelerStore((s) => s.setStep);
  const dna = useTravelerStore((s) => s.dna);

  // Deep link from a destination page: /onboarding?destination=manali
  // Lands on the "when" step so the user can set their dates before continuing.
  useEffect(() => {
    const d = params.get("destination") as DestinationId | null;
    if (d && destinations.some((x) => x.id === d)) {
      const dest = destinations.find((x) => x.id === d)!;
      setAnswers({ destinationId: d, fromCity: dest.fromCity });
      setStep(2); // "when" step (dates)
    }
  }, [params, setAnswers, setStep]);

  // Prefill interests from Travel DNA.
  useEffect(() => {
    if (dna && answers.interests.length === 0) setAnswers({ interests: dnaToInterests(dna), pace: dna.pace, rhythm: dna.rhythm });
  }, [dna, answers.interests.length, setAnswers]);

  const recommended = useMemo(() => {
    if (!dna) return undefined;
    const ints = dnaToInterests(dna);
    return [...destinations].sort((a, b) => b.interests.filter((i) => ints.includes(i)).length - a.interests.filter((i) => ints.includes(i)).length)[0]?.id;
  }, [dna]);

  const isMulti = (answers.destinationIds?.length ?? 0) > 1;
  const STEPS = useMemo(
    () => [
      { key: "welcome", label: "Welcome", title: "", skip: false },
      { key: "where", label: "Destination", title: "Where do you want to go?", sub: "Pick one or more, you can explore later too.", skip: false },
      { key: "when", label: "Dates", title: "When are you leaving?", sub: "Move a day or two to save money or dodge the rain.", skip: true },
      { key: "days", label: "Duration", title: "How many days?", skip: true },
      ...(isMulti
        ? [
            {
              key: "allocations",
              label: "Split",
              title: "How do you want to split your trip?",
              sub: "Allocate days across your selected destinations.",
              skip: false,
            },
          ]
        : []),
      { key: "who", label: "Travelers", title: "Who is travelling?", skip: true },
      { key: "budget", label: "Budget", title: "What's your budget?", sub: "We'll keep the whole trip inside it.", skip: true },
      { key: "stay", label: "Stay", title: "Where do you like to sleep?", skip: true },
      { key: "transport", label: "Transport", title: "How do you want to get there?", skip: true },
      { key: "interests", label: "Interests", title: "What do you love doing?", sub: "Pick as many as you like.", skip: true },
      { key: "style", label: "Travel style", title: "What's your travel style?", skip: true },
      { key: "special", label: "Special needs", title: "Anything we should know?", sub: "Optional, helps our safety checks.", skip: true },
      { key: "words", label: "Your words", title: "Describe your dream trip", sub: "In your own words. Hindi, English or Hinglish.", skip: true },
      { key: "review", label: "Review", title: "Ready to build your trip?", sub: "Check everything, then let Prayaana do the rest.", skip: false },
    ],
    [isMulti],
  );

  const s = STEPS[step] ?? STEPS[0];
  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  const goKey = (key: string) => {
    const idx = STEPS.findIndex((item) => item.key === key);
    if (idx !== -1) setStep(idx);
  };
  const next = () => {
    if (step === STEPS.length - 1) {
      router.push("/plan/generate");
      return;
    }
    go(step + 1);
  };

  if (s.key === "welcome") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-2 text-center">
        <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 12 }}>
          <Zippy mood="happy" size={150} />
        </motion.div>
        <h1 className="mt-6 text-3xl font-extrabold leading-tight sm:text-4xl">Hi {user?.name.split(" ")[0] ?? "there"}! I&apos;m Zippy.</h1>
        <p className="mt-3 text-ink-soft">Answer a few quick questions and I&apos;ll build a complete trip around you, stays, transport, activities, times and a live price.</p>
        <div className="mt-8 flex w-full flex-col gap-3">
          <Button size="lg" full onClick={() => go(1)} icon={<ArrowRightIcon size={18} weight="bold" />}>
            Let&apos;s plan a trip
          </Button>
          {!dna && (
            <Button size="lg" full variant="outline" href="/quiz" icon={<SparkleIcon size={18} weight="fill" />}>
              Take the 60-second Travel DNA quiz first
            </Button>
          )}
          <Link href="/discover" className="mt-1 text-sm font-semibold text-muted hover:text-ink">
            Just browsing? Explore destinations
          </Link>
        </div>
      </div>
    );
  }

  const totalDays = answers.nights + 1;
  const allocatedSum = (answers.destinationIds || []).reduce(
    (sum, id) => sum + (answers.destinationAllocations?.[id] || 0),
    0,
  );
  const allocationInvalid = s.key === "allocations" && allocatedSum !== totalDays;
  const whereInvalid = s.key === "where" && !(answers.destinationIds?.length || answers.destinationId);
  const nextDisabled = whereInvalid || allocationInvalid;

  return (
    <StepShell
      step={step - 1}
      total={STEPS.length - 1}
      label={s.label}
      title={s.title}
      subtitle={s.sub}
      stepKey={s.key}
      exitHref="/discover"
      onBack={() => go(step - 1)}
      onNext={next}
      onSkip={s.skip ? () => go(step + 1) : undefined}
      nextDisabled={nextDisabled}
      nextLabel={
        s.key === "review"
          ? "Generate my trip"
          : s.key === "where" && whereInvalid
            ? "Pick a place"
            : s.key === "allocations" && allocationInvalid
              ? "Allocate all days"
              : "Next"
      }
    >
      {s.key === "where" && <WhereStep a={answers} set={setAnswers} recommended={recommended} />}
      {s.key === "when" && <WhenStep a={answers} set={setAnswers} />}
      {s.key === "days" && <DaysStep a={answers} set={setAnswers} />}
      {s.key === "allocations" && <AllocationStep a={answers} set={setAnswers} />}
      {s.key === "who" && <WhoStep a={answers} set={setAnswers} />}
      {s.key === "budget" && <BudgetStep a={answers} set={setAnswers} />}
      {s.key === "stay" && <StayStep a={answers} set={setAnswers} />}
      {s.key === "transport" && <TransportStep a={answers} set={setAnswers} />}
      {s.key === "interests" && <InterestsStep a={answers} set={setAnswers} />}
      {s.key === "style" && <StyleStep a={answers} set={setAnswers} />}
      {s.key === "special" && <SpecialStep a={answers} set={setAnswers} />}
      {s.key === "words" && <WordsStep a={answers} set={setAnswers} />}
      {s.key === "review" && <ReviewStep a={answers} goTo={go} goKey={goKey} />}
    </StepShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
