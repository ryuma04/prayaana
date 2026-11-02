"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CheckCircleIcon, BackpackIcon, ArrowRightIcon, StorefrontIcon } from "@phosphor-icons/react";
import { useTripStore } from "@/stores/tripStore";
import { useBookingStore } from "@/stores/bookingStore";

import { waitForVendorConfirmations } from "@/lib/api/bookings";

import { vendorMap } from "@/data/vendors";
import { destinationMap } from "@/data/destinations";
import { priceTrip } from "@/lib/engine/pricing";
import { Button } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
import { EmptyState } from "@/components/ui/States";
import { Zippy } from "@/components/art/Zippy";
import { addDays, cn, formatDate, rupees } from "@/lib/format";

import { TripDocuments } from "@/components/traveler/TripDocuments";

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("trip") ?? "";
  const paymentId = params.get("payment") ?? "pay_TEST";
  const trip = useTripStore((s) => s.trips[id]);
  const bookings = useBookingStore((s) => s.bookings);
  const [phase, setPhase] = useState(0);
  const started = useRef(false);

  const tripKey = trip?.id;
  useEffect(() => {
    if (!tripKey) return;
    const t1 = setTimeout(() => setPhase((p) => Math.max(p, 1)), 700);
    const t2 = setTimeout(() => {
      setPhase((p) => Math.max(p, 2));
      if (started.current) return;
      started.current = true;
      void waitForVendorConfirmations(tripKey).then(() => setPhase(3));
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [tripKey]);

  if (!trip) return <EmptyState title="Booking not found" action={<Button href="/my-trip">My trips</Button>} />;
  const price = priceTrip(trip);
  const dest = destinationMap[trip.destinationId];
  const mine = bookings.filter((b) => b.tripId === trip.id);
  const vendorIds = [...new Set(mine.map((b) => b.vendorId))];
  const confirmed = vendorIds.filter((v) => mine.filter((b) => b.vendorId === v).every((b) => b.status === "confirmed")).length;

  const steps = [
    { label: "Payment successful", sub: `${rupees(price.total)} · ${paymentId}` },
    { label: "Booking confirmed", sub: `${trip.code} · ${trip.title}` },
    { label: "Partners confirming", sub: `${confirmed} of ${vendorIds.length} confirmed` },
    { label: "Trip ready", sub: "Your ticket and receipt are in your email" },
  ];

  return (
    <div className="mx-auto max-w-2xl py-8">
      {phase >= 3 && <Confetti />}
      <div className="flex flex-col items-center text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 12 }} className="grid h-24 w-24 place-items-center rounded-full border-4 border-ink bg-mint shadow-pop-lg">
          <CheckCircleIcon size={56} weight="fill" className="text-success" />
        </motion.div>
        <h1 className="mt-5 text-3xl font-extrabold">{phase >= 3 ? "You're going to " + dest.name + "!" : "Booking your trip…"}</h1>
        <p className="mt-1 text-muted">Your ticket and receipt are on their way to your email.</p>
      </div>

      <ol className="mt-8 space-y-2.5" aria-live="polite">
        {steps.map((s, i) => {
          const done = phase > i || (i === 3 && phase >= 3);
          const active = phase === i;
          return (
            <motion.li key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: i <= phase ? 1 : 0.4, y: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-clay-sm">
              {done ? <CheckCircleIcon size={28} weight="fill" className="text-success" /> : active ? <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-lavender border-t-purple" /> : <span className="h-6 w-6 rounded-full border-2 border-ink/15" />}
              <div className="flex-1">
                <p className="font-bold">{s.label}</p>
                <p className="text-xs text-muted">{s.sub}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {phase >= 2 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {vendorIds.map((v) => {
            const ok = mine.filter((b) => b.vendorId === v).every((b) => b.status === "confirmed");
            return (
              <div key={v} className={cn("flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition-colors", ok ? "bg-success-soft" : "bg-white shadow-clay-sm")}>
                <StorefrontIcon size={16} weight="duotone" />
                <span className="flex-1 truncate">{vendorMap[v]?.name ?? v}</span>
                {ok ? <CheckCircleIcon size={18} weight="fill" className="text-success" /> : <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/15 border-t-purple" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket-style receipt */}
      <div className="relative mt-8 rounded-[28px] border-2 border-ink bg-white shadow-pop-lg">
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Trip receipt</p>
              <p className="font-display text-xl font-extrabold">{trip.code}</p>
            </div>
            <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold">PAID</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted">Destination</p>
              <p className="font-semibold">{dest.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Dates</p>
              <p className="font-semibold">
                {formatDate(trip.prefs.startDate)} to {formatDate(addDays(trip.prefs.startDate, trip.prefs.nights))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Travelers</p>
              <p className="font-semibold">{trip.prefs.adults + trip.prefs.kids}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Payment</p>
              <p className="truncate font-semibold">{paymentId}</p>
            </div>
          </div>
        </div>
        <div className="relative border-t-2 border-dashed border-ink/30">
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-ink bg-canvas" />
          <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full border-2 border-ink bg-canvas" />
        </div>
        <div className="flex items-center justify-between p-5">
          <span className="text-sm text-muted">Total paid</span>
          <span className="font-display text-2xl font-extrabold">{rupees(price.total)}</span>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={() => router.push(`/my-trip/${trip.id}`)} icon={<ArrowRightIcon size={18} weight="bold" />}>
          Go to My Trip
        </Button>
        <Button size="lg" variant="outline" href="/prepare" icon={<BackpackIcon size={18} weight="bold" />}>
          Prep checklist
        </Button>
      </div>
      <div className="mt-8 space-y-4 text-left">
        <TripDocuments tripId={trip.id} booked compact />
      </div>
      <div className="mt-10 flex justify-center">
        <Zippy mood={phase >= 3 ? "celebrate" : "happy"} size={90} />
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
