"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircleIcon, SparkleIcon } from "@phosphor-icons/react";
import { useTravelerStore } from "@/stores/travelerStore";
import { generateTrip, type Planning } from "@/lib/api/trips";
import { generationSteps } from "@/lib/api/ai";
import { destinationMap } from "@/data/destinations";
import { DestinationArt } from "@/components/art/DestinationArt";
import { Zippy } from "@/components/art/Zippy";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/primitives";
import { sleep } from "@/lib/api/client";
import type { TripPreferences } from "@/types";

export default function GeneratePage() {
  const router = useRouter();
  const a = useTravelerStore((s) => s.answers);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const request = useRef<{ attempt: number; promise: ReturnType<typeof generateTrip> } | null>(null);

  const primaryDest = a.destinationId ?? a.destinationIds?.[0] ?? null;
  const destList = a.destinationIds?.length ? a.destinationIds : (primaryDest ? [primaryDest] : []);

  const prefs: TripPreferences | null = useMemo(
    () =>
      primaryDest
        ? {
            destinationId: primaryDest,
            destinations: destList,
            destinationDays: a.destinationAllocations && Object.keys(a.destinationAllocations).length > 0 ? a.destinationAllocations : undefined,
            destinationAllocations:
              destList.length > 1
                ? destList.map((id) => ({
                    destinationId: id,
                    days: a.destinationAllocations?.[id] || Math.max(1, Math.floor((a.nights + 1) / destList.length)),
                    startDay: 1,
                    endDay: a.nights + 1,
                  }))
                : undefined,
            destinationPlaces: a.destinationPlaces?.length ? a.destinationPlaces : undefined,
            originPlace: a.originPlace,
            startDate: a.startDate,
            nights: a.nights,
            adults: a.adults,
            kids: a.kids,
            budgetPerPerson: a.budgetPerPerson,
            stayType: a.stayType,
            transport: a.transport,
            interests: a.interests.length ? a.interests : ["nature", "food", "culture"],
            pace: a.pace,
            rhythm: a.rhythm,
            special: a.special,
            ownWords: a.ownWords,
            fromCity: a.fromCity,
            fromAddress: a.fromAddress,
            fromLat: a.fromLat,
            fromLng: a.fromLng,
          }
        : null,
    [a, primaryDest, destList],
  );
  const steps = useMemo(() => (prefs ? generationSteps(prefs) : []), [prefs]);

  useEffect(() => {
    if (!prefs) return;
    let cancelled = false;
    (async () => {
      try {
        // One request per attempt, even when React runs this effect twice in development.
        if (request.current?.attempt !== attempt) {
          const promise = generateTrip(prefs);
          promise.catch(() => {});
          request.current = { attempt, promise };
        }
        const created = request.current.promise;
        for (let i = 0; i < steps.length; i++) {
          await sleep(steps[i].ms);
          if (i === 0) setPlanning((await created).planning);
          if (cancelled) return;
          setDone(i + 1);
        }
        const { trip } = await created;
        if (cancelled) return;
        await sleep(500);
        router.replace(`/plan?trip=${trip.id}&fresh=1`);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefs, steps, attempt, router]);

  if (!prefs) {
    return (
      <div className="py-16">
        <EmptyState title="Pick a destination first" body="Tell us where you want to go and we'll build the whole trip." mood="thinking" action={<Button href="/onboarding">Start planning</Button>} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorState
          title="We couldn't build your trip"
          error={error}
          onRetry={() => {
            setError(null);
            setDone(0);
            setAttempt((n) => n + 1);
          }}
          action={<Button variant="secondary" size="sm" href="/onboarding">Edit answers</Button>}
        />
      </div>
    );
  }

  const dest = destinationMap[prefs.destinationId];
  const destName = dest?.name ?? a.destinationPlaces?.find((p) => p.placeId === prefs.destinationId)?.name ?? prefs.destinationId;
  const destArt = dest?.art ?? "beach";
  const pct = (done / steps.length) * 100;
  return (
    <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-8 py-10 lg:grid-cols-[1fr_1.1fr]">
      <div className="relative order-2 lg:order-1">
        <div className="relative overflow-hidden rounded-[36px] border-2 border-ink shadow-pop-lg">
          <div className="h-64 sm:h-80">
            <DestinationArt kind={destArt} />
          </div>
          <motion.div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" initial={{ opacity: 0.2 }} animate={{ opacity: 0.6 }} />
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Building your trip to</p>
            <p className="font-display text-3xl font-extrabold">{destName}</p>
            <p className="text-sm opacity-90">
              {prefs.nights + 1} days · {prefs.adults + prefs.kids} travelers · {prefs.pace}
            </p>
          </div>
        </div>
        <motion.div className="absolute -bottom-8 -right-4" animate={{ y: [0, -8, 0], rotate: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <Zippy mood={done === steps.length ? "celebrate" : "thinking"} size={110} />
        </motion.div>
      </div>
      <div className="order-1 lg:order-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-lavender px-3 py-1 text-xs font-bold shadow-pop">
          <SparkleIcon size={14} weight="fill" /> Prayaana planner
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{done === steps.length ? "Your trip is ready!" : "Crafting your trip…"}</h1>
        <Progress className="mt-5 h-3" value={pct} label="Generation progress" barClassName="bg-gradient-to-r from-coral via-purple to-sky-deep" />
        <ol className="mt-6 space-y-2.5" aria-live="polite">
          {steps.map((s, i) => {
            const isDone = i < done;
            const active = i === done;
            return (
              <AnimatePresence key={s.id}>
                {i <= done && (
                  <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-clay-sm">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center">
                      {isDone ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}>
                          <CheckCircleIcon size={26} weight="fill" className="text-success" />
                        </motion.span>
                      ) : (
                        <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-lavender border-t-purple" />
                      )}
                    </span>
                    <div>
                      <p className={isDone ? "text-sm text-muted" : "text-sm font-semibold"}>{s.running}</p>
                      {isDone && planning && <p className="text-sm font-semibold text-ink">✓ {s.done(planning)}</p>}
                      {active && !isDone && <p className="text-xs text-muted">working…</p>}
                    </div>
                  </motion.li>
                )}
              </AnimatePresence>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
