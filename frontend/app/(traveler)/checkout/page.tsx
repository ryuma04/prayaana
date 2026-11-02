"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LockIcon,
  ShieldCheckIcon,
  TagIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  StorefrontIcon,
} from "@phosphor-icons/react";
import { useTripStore } from "@/stores/tripStore";
import { useAuthStore } from "@/stores/authStore";

import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { PriceBreakdown, BudgetMeter } from "@/components/traveler/PriceBreakdown";
import { ArtTile } from "@/components/art/ArtTile";
import { DestinationArt } from "@/components/art/DestinationArt";
import { destinationMap } from "@/data/destinations";
import { vendorMap } from "@/data/vendors";
import { stayMap } from "@/data/stays";
import { priceTrip, vendorBreakdown } from "@/lib/engine/pricing";
import { applyPromo, removePromo } from "@/lib/api/trips";
import { createOrder, payWithRazorpay } from "@/lib/api/bookings";
import { errorMessage } from "@/lib/api/client";
import { addDays, cn, formatDate, rupees } from "@/lib/format";
import { toast } from "@/stores/notificationStore";

const STEPS = ["Travelers", "Review", "Payment"];

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = useTripStore((s) => s.draftId);
  const id = params.get("trip") ?? draftId ?? "";
  const trip = useTripStore((s) => s.trips[id]);
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: "" });
  const [others, setOthers] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [promo, setPromo] = useState("");
  const [promoState, setPromoState] = useState<{ loading?: boolean; error?: string; ok?: string }>({});
  const [starting, setStarting] = useState(false);
  const price = useMemo(() => (trip ? priceTrip(trip) : null), [trip]);

  if (!trip || !price) return <EmptyState title="Nothing to check out" body="Build a trip first." action={<Button href="/onboarding">Plan a trip</Button>} />;
  if (trip.status !== "draft") return <EmptyState title="This trip is already booked" mood="celebrate" action={<Button href={`/my-trip/${trip.id}`}>Go to My Trip</Button>} />;

  const dest = destinationMap[trip.destinationId];
  const travelers = trip.prefs.adults + trip.prefs.kids;
  const vendors = vendorBreakdown(trip);
  const otherCount = travelers - 1;

  const validate = () => {
    const e: Record<string, string> = {};
    if (lead.name.trim().length < 2) e.name = "Enter the lead traveler's name";
    if (!/^\S+@\S+\.\S+$/.test(lead.email)) e.email = "Enter a valid email";
    if (lead.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitPromo = async () => {
    if (!promo.trim()) return;
    setPromoState({ loading: true });
    try {
      const label = await applyPromo(trip.id, promo);
      setPromoState({ ok: label });
    } catch (e) {
      setPromoState({ error: errorMessage(e, "Invalid code") });
    }
  };

  const booked = (paymentRef?: string) => router.push(`/booking-success?trip=${trip.id}${paymentRef ? `&payment=${encodeURIComponent(paymentRef)}` : ""}`);

  const startPayment = async () => {
    setStarting(true);
    try {
      const order = await createOrder(trip.id, { name: lead.name.trim(), email: lead.email.trim(), phone: lead.phone.trim() });
      const res = await payWithRazorpay(trip.id, order, { name: lead.name, email: lead.email, contact: lead.phone });
      booked(res.payment.paymentRef);
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e, "Payment failed") });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <button onClick={() => (step ? setStep(step - 1) : router.push(`/plan?trip=${trip.id}`))} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon size={16} /> {step ? "Back" : "Back to plan"}
      </button>
      <h1 className="text-3xl font-extrabold">Checkout</h1>
      <ol className="mt-4 flex items-center gap-2" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("grid h-8 w-8 place-items-center rounded-full border-2 border-ink text-xs font-extrabold", i < step ? "bg-mint" : i === step ? "bg-sun shadow-pop" : "bg-white")} aria-current={i === step ? "step" : undefined}>
              {i < step ? <CheckCircleIcon size={16} weight="fill" /> : i + 1}
            </span>
            <span className={cn("text-sm font-semibold", i === step ? "text-ink" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-0.5 w-6 bg-ink/15 sm:w-12" />}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {step === 0 && (
                <div className="space-y-5">
                  <Card pad="lg">
                    <SectionTitle title="Lead traveler" kicker="Your tickets and receipt are emailed here" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" htmlFor="lead-name" error={errors.name}>
                        <Input id="lead-name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} autoComplete="name" />
                      </Field>
                      <Field label="Mobile" htmlFor="lead-phone" error={errors.phone}>
                        <Input id="lead-phone" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} inputMode="tel" autoComplete="tel" />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Email" htmlFor="lead-email" error={errors.email}>
                          <Input id="lead-email" type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} autoComplete="email" />
                        </Field>
                      </div>
                    </div>
                  </Card>
                  {otherCount > 0 && (
                    <Card pad="lg">
                      <SectionTitle title="Other travelers" kicker="Optional now · needed before check-in" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: otherCount }).map((_, i) => (
                          <Field key={i} label={`Traveler ${i + 2}${i >= trip.prefs.adults - 1 ? " (child)" : ""}`} htmlFor={`t-${i}`}>
                            <Input id={`t-${i}`} value={others[i] ?? ""} onChange={(e) => setOthers(Object.assign([...others], { [i]: e.target.value }))} placeholder="Full name" />
                          </Field>
                        ))}
                      </div>
                    </Card>
                  )}
                  <Button size="lg" onClick={() => validate() && setStep(1)} icon={<ArrowRightIcon size={18} weight="bold" />}>
                    Continue to review
                  </Button>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <Card pad="none" className="overflow-hidden">
                    <div className="relative h-28">
                      <DestinationArt kind={dest.art} />
                    </div>
                    <div className="p-5">
                      <p className="font-display text-xl font-extrabold">{trip.title}</p>
                      <p className="text-sm text-muted">
                        {formatDate(trip.prefs.startDate, { day: "numeric", month: "long" })} to {formatDate(addDays(trip.prefs.startDate, trip.prefs.nights), { day: "numeric", month: "long", year: "numeric" })} · {travelers} travelers · {stayMap[trip.stayId]?.name}
                      </p>
                      <p className="mt-2 text-sm">
                        {trip.items.filter((i) => i.kind === "activity" && i.status !== "cancelled").length} experiences · {trip.items.filter((i) => i.hearted).length} Must-Dos
                      </p>
                    </div>
                  </Card>
                  <Card pad="lg">
                    <SectionTitle title="Vendor breakdown" kicker={`${vendors.length} partners confirm your bookings`} />
                    <ul className="divide-y divide-line">
                      {vendors.map((v) => {
                        const vendor = vendorMap[v.vendorId];
                        return (
                          <li key={v.vendorId} className="flex items-center gap-3 py-2.5">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas">
                              <StorefrontIcon size={16} weight="duotone" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{vendor?.name ?? v.vendorId}</p>
                              <p className="truncate text-xs text-muted">{v.items.map((i) => i.title.replace("Check-in · ", "")).slice(0, 2).join(", ") || "Stay"}</p>
                            </div>
                            <span className="text-sm font-bold tabular">{rupees(v.amount)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                  <Card pad="lg">
                    <SectionTitle title="Cancellation & changes" />
                    <ul className="space-y-2 text-sm text-ink-soft">
                      <li className="flex gap-2"><CheckCircleIcon size={18} weight="fill" className="shrink-0 text-success" /> Free cancellation until 7 days before departure (service fee kept).</li>
                      <li className="flex gap-2"><CheckCircleIcon size={18} weight="fill" className="shrink-0 text-success" /> Weather, vendor or closure changes: full refund for the affected items.</li>
                      <li className="flex gap-2"><CheckCircleIcon size={18} weight="fill" className="shrink-0 text-success" /> Every change needs every vendor&apos;s yes, you always get a Change Receipt.</li>
                      <li className="flex gap-2"><WarningCircleIcon size={18} weight="fill" className="shrink-0 text-warning" /> Within 48 hours of an activity: 20% cancellation charge by the partner.</li>
                    </ul>
                  </Card>
                  <Button size="lg" onClick={() => setStep(2)} icon={<ArrowRightIcon size={18} weight="bold" />}>
                    Continue to payment
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <Card pad="lg">
                    <SectionTitle title="Payment" />
                    <p className="text-sm text-ink-soft">You&apos;ll pay securely with Razorpay. Choose UPI, card, netbanking or a wallet in the next window.</p>
                  </Card>
                  <Button size="lg" full onClick={startPayment} loading={starting} icon={<LockIcon size={18} weight="bold" />}>
                    Pay {rupees(price.total)} securely
                  </Button>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
                    <ShieldCheckIcon size={14} /> Secured by Razorpay
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside>
          <div className="space-y-4 lg:sticky lg:top-24">
            <Card variant="sticker" pad="lg">
              <p className="mb-3 font-display text-sm font-bold">Trip summary</p>
              <PriceBreakdown price={price} />
              <BudgetMeter price={price} className="mt-4" />
            </Card>
            <Card pad="md">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <TagIcon size={16} weight="duotone" /> Promo code
              </p>
              {trip.promoCode ? (
                <div className="mt-2 flex items-center justify-between rounded-2xl bg-success-soft px-3 py-2">
                  <span className="text-sm font-bold text-success">{trip.promoCode} applied</span>
                  <button onClick={() => { setPromoState({}); removePromo(trip.id).catch((e) => setPromoState({ error: errorMessage(e) })); }} className="text-xs font-semibold text-muted hover:text-ink">
                    Remove
                  </button>
                </div>
              ) : (
                <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submitPromo(); }}>
                  <Input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="PRAYAANA10" aria-label="Promo code" className="h-11" />
                  <Button type="submit" variant="outline" size="sm" className="h-11" loading={promoState.loading}>
                    Apply
                  </Button>
                </form>
              )}
              {promoState.error && <p className="mt-2 text-xs font-medium text-danger">{promoState.error}</p>}
              {promoState.ok && <p className="mt-2 text-xs font-medium text-success">{promoState.ok}</p>}
              <p className="mt-2 text-[11px] text-muted">Try PRAYAANA10, KARNATAKA10, FIRSTTRIP or MONSOON500</p>
            </Card>
            <Card pad="md">
              <p className="text-sm font-bold">What you&apos;re booking</p>
              <ul className="mt-2 space-y-2">
                {trip.items
                  .filter((i) => i.kind === "activity" && i.status !== "cancelled")
                  .slice(0, 6)
                  .map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-xs">
                      <ArtTile icon={i.icon} tone={i.tone} size={26} />
                      <span className="flex-1 truncate">Day {i.day} · {i.title}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        </aside>
      </div>

      {/* Razorpay-style checkout (test mode) */}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
