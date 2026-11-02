"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ArrowsClockwiseIcon, CheckIcon } from "@phosphor-icons/react";
import type { Interest, Pace } from "@/types";
import { useTripStore } from "@/stores/tripStore";
import { useTripEditor } from "@/hooks/useTripEditor";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Chip, Slider, Stepper } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { HotelCard, TransportRow } from "@/components/traveler/Cards";
import { BudgetMeter, PriceTicker } from "@/components/traveler/PriceBreakdown";
import { INTEREST_META } from "@/components/traveler/OnboardingSteps";
import { staysFor, transportFor } from "@/data/stays";
import { priceTrip } from "@/lib/engine/pricing";
import { buildTrip, roomsFor } from "@/lib/engine/planner";
import { destinationMap } from "@/data/destinations";
import { toast } from "@/stores/notificationStore";
import { rupees, todayISO } from "@/lib/format";
import { Glyph } from "@/lib/icons";

function EditInner() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = useTripStore((s) => s.draftId);
  const id = params.get("trip") ?? draftId ?? undefined;
  const trip = useTripStore((s) => (id ? s.trips[id] : undefined));
  const upsert = useTripStore((s) => s.upsert);
  const editor = useTripEditor(id);
  const [nights, setNights] = useState(trip?.prefs.nights ?? 4);
  const [pace, setPace] = useState<Pace>(trip?.prefs.pace ?? "balanced");
  const [interests, setInterests] = useState<Interest[]>(trip?.prefs.interests ?? []);
  const price = useMemo(() => (trip ? priceTrip(trip) : null), [trip]);

  if (!trip || !price) return <EmptyState title="No trip to edit" action={<Button href="/onboarding">Plan a trip</Button>} />;
  if (trip.status !== "draft") return <EmptyState title="This trip is already booked" body="Changes to a booked trip go through vendor confirmation." action={<Button href={`/my-trip/${trip.id}`}>Open My Trip</Button>} />;

  const rooms = roomsFor(trip.prefs);
  const currentStay = staysFor(trip.destinationId).find((s) => s.id === trip.stayId);
  const needsRebuild = nights !== trip.prefs.nights || pace !== trip.prefs.pace || interests.join() !== trip.prefs.interests.join();

  const rebuild = () => {
    const hearted = new Set(trip.items.filter((i) => i.hearted && i.refId).map((i) => i.refId));
    const next = buildTrip(
      { ...trip.prefs, nights, pace, interests },
      { id: trip.id, code: trip.code, customerId: trip.customerId, customerName: trip.customerName, coordinatorId: trip.coordinatorId, groupName: trip.groupName, stayId: trip.stayId, transportId: trip.transportId },
    );
    next.items = next.items.map((i) => ({ ...i, hearted: !!i.refId && hearted.has(i.refId) }));
    next.promoCode = trip.promoCode;
    const kept = next.items.filter((i) => i.hearted).length;
    upsert(next);
    toast({ tone: "success", title: "Itinerary rebuilt", body: `${nights + 1} days · ${pace} pace · ${kept}/${hearted.size} Must-Dos kept` });
    router.push(`/plan?trip=${trip.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <button onClick={() => router.push(`/plan?trip=${trip.id}`)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon size={16} /> Back to plan
      </button>
      <h1 className="text-3xl font-extrabold">Edit your {destinationMap[trip.destinationId].name} trip</h1>
      <p className="mt-1 text-sm text-muted">Instant changes update the price right away. Bigger changes rebuild the itinerary and keep your Must-Dos.</p>

      <Card variant="sticker" className="mt-6" pad="md">
        <BudgetMeter price={price} />
      </Card>

      <section className="mt-8">
        <SectionTitle title="Dates & budget" kicker="Instant" />
        <Card pad="md" className="space-y-5">
          <label className="block">
            <span className="text-sm font-semibold">Start date</span>
            <input
              type="date"
              min={todayISO()}
              value={trip.prefs.startDate}
              onChange={(e) => e.target.value && editor.startDate(e.target.value)}
              className="mt-1 h-12 w-full rounded-2xl bg-canvas px-4 font-semibold outline-none focus:ring-2 focus:ring-purple"
            />
          </label>
          <div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Budget per person</span>
              <span className="font-display font-bold">{rupees(trip.prefs.budgetPerPerson)}</span>
            </div>
            <Slider className="mt-2" value={trip.prefs.budgetPerPerson} min={8000} max={150000} step={1000} label="Budget per person" onChange={(v) => editor.budget(v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Adults</p>
              <p className="text-xs text-muted">Rooms and tickets update automatically</p>
            </div>
            <Stepper value={trip.prefs.adults} onChange={(v) => editor.travelers(v, trip.prefs.kids)} min={1} max={12} label="adults" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Kids</p>
            <Stepper value={trip.prefs.kids} onChange={(v) => editor.travelers(trip.prefs.adults, v)} min={0} max={8} label="kids" />
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <SectionTitle title="Where you stay" kicker={`${rooms} room${rooms > 1 ? "s" : ""} · ${trip.prefs.nights} nights`} />
        <div className="grid gap-3">
          {staysFor(trip.destinationId).map((s) => (
            <HotelCard
              key={s.id}
              s={s}
              selected={s.id === trip.stayId}
              onSelect={() => editor.stay(s.id)}
              nights={trip.prefs.nights}
              rooms={rooms}
              delta={currentStay ? (s.nightlyPrice - currentStay.nightlyPrice) * rooms * trip.prefs.nights : undefined}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle title="Getting there" kicker="Return journey" />
        <div className="grid gap-3">
          {transportFor(trip.destinationId).map((t) => (
            <TransportRow key={t.id} t={t} selected={t.id === trip.transportId} onSelect={() => editor.transport(t.id)} travelers={trip.prefs.adults + trip.prefs.kids} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle title="Length, pace & interests" kicker="Rebuilds the itinerary" />
        <Card pad="md" className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{nights + 1} days · {nights} nights</p>
              <p className="text-xs text-muted">Currently {trip.prefs.nights + 1} days</p>
            </div>
            <Stepper value={nights} onChange={setNights} min={1} max={10} label="nights" />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Pace</p>
            <div className="flex flex-wrap gap-2">
              {(["relaxed", "balanced", "packed"] as Pace[]).map((p) => (
                <Chip key={p} selected={pace === p} onClick={() => setPace(p)} className="capitalize">
                  {p}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Interests</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(INTEREST_META) as Interest[]).map((i) => (
                <Chip key={i} size="sm" selected={interests.includes(i)} onClick={() => setInterests(interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i])}>
                  <Glyph emoji={INTEREST_META[i].emoji} size={16} /> {INTEREST_META[i].label}
                </Chip>
              ))}
            </div>
          </div>
          <Button variant={needsRebuild ? "primary" : "secondary"} disabled={!needsRebuild} onClick={rebuild} icon={<ArrowsClockwiseIcon size={16} weight="bold" />}>
            Rebuild itinerary
          </Button>
        </Card>
      </section>

      <div className="mt-10 flex justify-end">
        <Button size="lg" onClick={() => router.push(`/plan?trip=${trip.id}`)} icon={<CheckIcon size={18} weight="bold" />}>
          Done
        </Button>
      </div>
      <PriceTicker tripId={trip.id} />
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={null}>
      <EditInner />
    </Suspense>
  );
}
