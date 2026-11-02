"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "motion/react";
import { ArrowRightIcon, SuitcaseRollingIcon, PencilSimpleLineIcon, NavigationArrowIcon, StarIcon } from "@phosphor-icons/react";
import { useTripStore } from "@/stores/tripStore";
import { DestinationArt } from "@/components/art/DestinationArt";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/primitives";
import { destinationMap } from "@/data/destinations";
import { priceTrip } from "@/lib/engine/pricing";
import { addDays, daysBetween, formatDate, rupees, todayISO } from "@/lib/format";
import type { Trip } from "@/types";

function TripRow({ t, i }: { t: Trip; i: number }) {
  const d = destinationMap[t.destinationId];
  const toGo = daysBetween(todayISO(), t.prefs.startDate);
  const href = t.status === "draft" ? `/plan?trip=${t.id}` : t.status === "live" ? "/my-trip/live" : `/my-trip/${t.id}`;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Link href={href} className="group flex overflow-hidden rounded-[28px] bg-white shadow-clay transition hover:-translate-y-1">
        <div className="relative w-32 shrink-0 sm:w-48">
          <DestinationArt kind={d.art} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            {t.status === "live" && <StatusBadge kind="success" pulse>Live · Day {t.currentDay}</StatusBadge>}
            {t.status === "booked" && <StatusBadge kind="info">{toGo > 0 ? `In ${toGo} day${toGo > 1 ? "s" : ""}` : "Starts today"}</StatusBadge>}
            {t.status === "draft" && <StatusBadge kind="neutral">Draft</StatusBadge>}
            {t.status === "completed" && <StatusBadge kind="purple">Completed</StatusBadge>}
            <span className="text-xs font-semibold text-muted">{t.code}</span>
          </div>
          <p className="mt-2 font-display text-lg font-bold">{t.title}</p>
          <p className="text-sm text-muted">
            {formatDate(t.prefs.startDate)} to {formatDate(addDays(t.prefs.startDate, t.prefs.nights))} · {t.prefs.adults + t.prefs.kids} travelers
          </p>
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="font-display font-bold">{rupees(priceTrip(t).total)}</span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-purple-deep">
              {t.status === "draft" ? <><PencilSimpleLineIcon size={16} /> Continue planning</> : t.status === "live" ? <><NavigationArrowIcon size={16} /> Open live mode</> : t.status === "completed" ? <><StarIcon size={16} /> {t.review ? "View trip" : "Review trip"}</> : <>Open <ArrowRightIcon size={16} /></>}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function MyTripsPage() {
  const { trips, myTrips, draftId } = useTripStore(useShallow((s) => ({ trips: s.trips, myTrips: s.myTrips, draftId: s.draftId })));
  const mine = useMemo(() => myTrips.map((id) => trips[id]).filter((t): t is Trip => !!t), [myTrips, trips]);
  const draft = draftId ? trips[draftId] : undefined;
  const upcoming = mine.filter((t) => t.status === "live" || t.status === "booked");
  const past = mine.filter((t) => t.status === "completed");

  if (!mine.length && !draft) {
    return (
      <div className="py-10">
        <EmptyState title="No trips yet" body="Your booked trips, live trip mode and Trip Pass will live here." mood="sleepy" action={<Button href="/onboarding" icon={<SuitcaseRollingIcon size={16} weight="bold" />}>Plan my first trip</Button>} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold">My trips</h1>
      {upcoming.length > 0 && (
        <section>
          <SectionTitle title="Upcoming & live" />
          <div className="grid gap-4">
            {upcoming.map((t, i) => (
              <TripRow key={t.id} t={t} i={i} />
            ))}
          </div>
        </section>
      )}
      {draft && draft.status === "draft" && (
        <section>
          <SectionTitle title="In progress" />
          <TripRow t={draft} i={0} />
        </section>
      )}
      {past.length > 0 && (
        <section>
          <SectionTitle title="Past trips" />
          <div className="grid gap-4">
            {past.map((t, i) => (
              <TripRow key={t.id} t={t} i={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
