"use client";
import { useMemo } from "react";
import { motion } from "motion/react";
import { CheckIcon, IdentificationCardIcon, BackpackIcon, FirstAidKitIcon, MoneyIcon, DeviceMobileIcon } from "@phosphor-icons/react";
import { useActiveTrip } from "@/stores/tripStore";
import { useTravelerStore } from "@/stores/travelerStore";
import { prepChecklist, type PrepItem } from "@/lib/engine/prep";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { TripPass } from "@/components/traveler/TripPass";
import { WeatherStrip } from "@/components/traveler/TripBits";
import { Zippy } from "@/components/art/Zippy";
import { cn } from "@/lib/format";

const GROUP_ICON: Record<PrepItem["group"], typeof BackpackIcon> = {
  Documents: IdentificationCardIcon,
  Packing: BackpackIcon,
  Health: FirstAidKitIcon,
  Money: MoneyIcon,
  "Apps & offline": DeviceMobileIcon,
};

const EMPTY: string[] = [];

export default function PreparePage() {
  const trip = useActiveTrip();
  const done = useTravelerStore((s) => (trip ? s.prepDone[trip.id] ?? EMPTY : EMPTY));
  const toggle = useTravelerStore((s) => s.togglePrep);
  const list = useMemo(() => (trip ? prepChecklist(trip) : []), [trip]);

  if (!trip) return <div className="py-10"><EmptyState title="Nothing to prepare yet" body="Your smart checklist appears once a trip is booked." action={<Button href="/onboarding">Plan a trip</Button>} /></div>;

  const checked = list.filter((i) => done.includes(i.id)).length;
  const pct = (checked / list.length) * 100;
  const groups = [...new Set(list.map((i) => i.group))];

  return (
    <div className="grid gap-6 pb-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-muted">{trip.title}</p>
          <h1 className="text-3xl font-extrabold">Get ready</h1>
          <p className="mt-1 text-sm text-muted">Built from your forecast and activities, not a generic list.</p>
        </div>
        <Card variant="sticker" pad="md" className="flex items-center gap-4">
          <Zippy mood={pct === 100 ? "celebrate" : "happy"} size={64} className="shrink-0" />
          <div className="flex-1">
            <p className="font-display text-lg font-extrabold">{pct === 100 ? "All packed" : `${checked} of ${list.length} ready`}</p>
            <Progress className="mt-2 h-3" value={pct} label="Checklist progress" barClassName="bg-gradient-to-r from-mint-deep to-success" />
          </div>
        </Card>
        <WeatherStrip trip={trip} />
        {groups.map((g) => {
          const Icon = GROUP_ICON[g];
          return (
            <Card key={g} pad="md">
              <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
                <Icon size={18} weight="duotone" className="text-purple" /> {g}
              </p>
              <ul className="space-y-2">
                {list
                  .filter((i) => i.group === g)
                  .map((i) => {
                    const on = done.includes(i.id);
                    return (
                      <li key={i.id}>
                        <button type="button" onClick={() => toggle(trip.id, i.id)} aria-pressed={on} className={cn("flex w-full items-start gap-3 rounded-2xl p-3 text-left transition", on ? "bg-mint-soft" : "bg-canvas hover:bg-lavender-soft/60")}>
                          <motion.span animate={{ scale: on ? [1, 1.25, 1] : 1 }} className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 border-ink", on ? "bg-success text-white" : "bg-white")}>
                            {on && <CheckIcon size={14} weight="bold" />}
                          </motion.span>
                          <span>
                            <span className={cn("block text-sm font-semibold", on && "text-muted line-through")}>{i.label}</span>
                            <span className="block text-xs text-muted">{i.why}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          );
        })}
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <TripPass trip={trip} />
        <Button full variant="outline" href={`/my-trip/${trip.id}`}>
          Back to My Trip
        </Button>
      </aside>
    </div>
  );
}
