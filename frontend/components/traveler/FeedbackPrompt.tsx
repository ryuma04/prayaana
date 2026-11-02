"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { FlagCheckeredIcon } from "@phosphor-icons/react";
import { useTripStore } from "@/stores/tripStore";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import type { Trip } from "@/types";

const KEY = "prayaana.feedback.later";

function later(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Asks for feedback as soon as the operator closes a trip that hasn't been reviewed yet. */
export function FeedbackPrompt() {
  const router = useRouter();
  const { trips, myTrips } = useTripStore(useShallow((s) => ({ trips: s.trips, myTrips: s.myTrips })));
  const [skipped, setSkipped] = useState<string[]>(later);
  const trip = myTrips.map((id) => trips[id]).find((t): t is Trip => !!t && t.status === "completed" && !t.review && !skipped.includes(t.id));
  if (!trip) return null;

  const dismiss = () => {
    const next = [...skipped, trip.id];
    setSkipped(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: ask again next time */
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(v) => !v && dismiss()}
      side="center"
      size="sm"
      title="Your trip is complete"
      description={`How was ${trip.title}? Two minutes of feedback tunes your next trip.`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={dismiss}>
            Later
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              dismiss();
              router.push("/review");
            }}
          >
            Give feedback
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3 rounded-2xl bg-lavender-soft p-4">
        <FlagCheckeredIcon size={28} weight="duotone" className="shrink-0 text-purple-deep" />
        <p className="text-sm text-ink-soft">Rate your experiences and tell us what to change. Your partners see the ratings, and your Travel DNA learns from it.</p>
      </div>
    </Sheet>
  );
}
