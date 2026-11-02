"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { FlagCheckeredIcon, HeartIcon, MapPinIcon, ArrowsClockwiseIcon, StampIcon, SparkleIcon, ThumbsUpIcon, ThumbsDownIcon } from "@phosphor-icons/react";
import { useShallow } from "zustand/react/shallow";
import { useTripStore } from "@/stores/tripStore";
import { useTravelerStore, BADGES } from "@/stores/travelerStore";
import { submitReview } from "@/lib/api/trips";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { StarInput, Textarea } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { Confetti } from "@/components/ui/Confetti";
import { DestinationArt } from "@/components/art/DestinationArt";
import { Zippy } from "@/components/art/Zippy";
import { destinationMap } from "@/data/destinations";
import { vendorMap } from "@/data/vendors";
import { cn, haversineKm } from "@/lib/format";
import { toast } from "@/stores/notificationStore";
import type { DNADimension, Trip, TripFeedback } from "@/types";
import { Glyph } from "@/lib/icons";

const DIMS: { id: DNADimension; label: string }[] = [
  { id: "food", label: "Food" }, { id: "culture", label: "Culture" }, { id: "adventure", label: "Adventure" },
  { id: "nature", label: "Nature" }, { id: "luxury", label: "Comfort & rest" }, { id: "social", label: "Social" },
];

function Chip({ on, onClick, children, tone = "bg-purple text-white" }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition", on ? tone : "bg-white shadow-clay-sm")}>
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function story(trip: Trip) {
  const acts = trip.items.filter((i) => i.kind === "activity" && i.status !== "cancelled");
  let km = 0;
  const pts = trip.items.filter((i) => i.lat != null && i.lng != null && i.status !== "cancelled").sort((a, b) => a.day - b.day || a.startMin - b.startMin);
  for (let k = 1; k < pts.length; k++) km += haversineKm({ lat: pts[k - 1].lat!, lng: pts[k - 1].lng! }, { lat: pts[k].lat!, lng: pts[k].lng! });
  return { acts: acts.length, km: Math.round(km), hearts: acts.filter((a) => a.hearted).length, changes: trip.receipts.length, highlights: acts.filter((a) => a.hearted).map((a) => a.title).concat(acts.map((a) => a.title)).slice(0, 3) };
}

export default function ReviewPage() {
  const { trips, myTrips } = useTripStore(useShallow((s) => ({ trips: s.trips, myTrips: s.myTrips })));
  const xp = useTravelerStore((s) => s.xp);
  const badges = useTravelerStore((s) => s.badges);
  const trip = useMemo(() => {
    const mine = myTrips.map((id) => trips[id]).filter((t): t is Trip => !!t && t.status !== "draft");
    return mine.find((t) => t.status === "completed" && !t.review) ?? mine.find((t) => t.status === "live") ?? mine[0];
  }, [trips, myTrips]);
  const [stars, setStars] = useState(5);
  const [aspects, setAspects] = useState<Record<string, number>>({ Stay: 5, Guide: 5, Experiences: 5, Transport: 4, Value: 4 });
  const [vendorVotes, setVendorVotes] = useState<Record<string, "up" | "down">>({});
  const [text, setText] = useState("");
  const [fb, setFb] = useState<TripFeedback>({ loved: [], disliked: [], pace: "", more: [], less: [], note: "" });
  const [loading, setLoading] = useState(false);

  if (!trip) return <div className="py-10"><EmptyState title="No trip to review yet" body="After your trip ends, rate your stay, guide and experiences here." action={<Button href="/onboarding">Plan a trip</Button>} /></div>;
  const d = destinationMap[trip.destinationId];
  const s = story(trip);
  const vendors = [...new Set(trip.items.filter((i) => i.vendorId && i.kind !== "flight" && i.kind !== "bus" && i.kind !== "train").map((i) => i.vendorId as string))].slice(0, 6);

  if (trip.review) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <Confetti count={40} />
        <Zippy mood="celebrate" size={120} className="mx-auto" />
        <h1 className="mt-4 text-3xl font-extrabold">Thank you!</h1>
        <p className="mt-2 text-muted">Your {trip.review.stars}★ review helps {vendors.length} local partners, their trust scores just updated.</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Card pad="md"><p className="font-display text-2xl font-extrabold text-purple">{xp}</p><p className="text-xs text-muted">XP</p></Card>
          <Card pad="md"><p className="font-display text-2xl font-extrabold text-coral">{badges.length}</p><p className="text-xs text-muted">Badges</p></Card>
          <Card pad="md"><p className="font-display text-2xl font-extrabold text-mint-deep">+1</p><p className="text-xs text-muted">Passport stamp</p></Card>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {BADGES.filter((b) => badges.includes(b.id)).map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sun px-3 py-1 text-xs font-bold shadow-pop">
              <Glyph emoji={b.emoji} size={14} /> {b.label}
            </span>
          ))}
        </div>
        <div className="mt-8 flex justify-center gap-2">
          <Button href="/discover">Plan the next one</Button>
          <Button variant="outline" href="/profile">See my profile</Button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setLoading(true);
    try {
      await submitReview(trip.id, { stars, aspects, text, feedback: fb });
      toast({ tone: "success", title: "Review posted", body: "Vendor trust scores updated." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-[36px] border-2 border-ink shadow-pop-lg">
        <div className="h-52">
          <DestinationArt kind={d.art} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Your trip story</p>
          <h1 className="text-3xl font-extrabold">{trip.title}</h1>
        </div>
      </div>
      {trip.status !== "completed" && (
        <div className="flex flex-wrap items-center gap-3 rounded-[24px] bg-lavender-soft p-4">
          <FlagCheckeredIcon size={22} weight="duotone" className="text-purple-deep" />
          <p className="flex-1 text-sm">
            Your trip is still <b>{trip.status}</b>. Once your coordinator marks it complete, you&apos;ll get a notification and can share how it went here.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [SparkleIcon, `${s.acts}`, "experiences"],
          [MapPinIcon, `${s.km} km`, "explored"],
          [HeartIcon, `${s.hearts}`, "must-dos done"],
          [ArrowsClockwiseIcon, `${s.changes}`, "changes handled"],
        ].map(([I, v, k]) => {
          const C = I as typeof SparkleIcon;
          return (
            <motion.div key={k as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card pad="md">
                <C size={20} weight="duotone" className="text-purple" />
                <p className="mt-1 font-display text-2xl font-extrabold">{v as string}</p>
                <p className="text-xs text-muted">{k as string}</p>
              </Card>
            </motion.div>
          );
        })}
      </div>
      <Card pad="md" className="flex flex-wrap items-center gap-3">
        <StampIcon size={28} weight="duotone" className="text-coral" />
        <p className="flex-1 text-sm">
          Highlights: <b>{s.highlights.join(" · ")}</b>
        </p>
      </Card>

      <Card pad="lg">
        <SectionTitle title="How was it overall?" />
        <StarInput value={stars} onChange={setStars} label="Overall rating" size={40} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Object.keys(aspects).map((k) => (
            <div key={k} className="flex items-center justify-between rounded-2xl bg-canvas p-3">
              <span className="text-sm font-semibold">{k}</span>
              <StarInput value={aspects[k]} onChange={(v) => setAspects({ ...aspects, [k]: v })} label={`${k} rating`} size={22} />
            </div>
          ))}
        </div>
      </Card>

      <Card pad="lg">
        <SectionTitle title="Rate your partners" kicker="Feeds the vendor trust score" />
        <ul className="space-y-2">
          {vendors.map((v) => (
            <li key={v} className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
              <span className="flex-1 text-sm font-semibold">{vendorMap[v]?.name ?? v}</span>
              {(["up", "down"] as const).map((dir) => (
                <button key={dir} onClick={() => setVendorVotes({ ...vendorVotes, [v]: dir })} aria-pressed={vendorVotes[v] === dir} aria-label={`${dir === "up" ? "Good" : "Bad"} experience with ${vendorMap[v]?.name}`} className={cn("grid h-9 w-9 place-items-center rounded-full transition", vendorVotes[v] === dir ? (dir === "up" ? "bg-success text-white" : "bg-danger text-white") : "bg-white shadow-clay-sm")}>
                  {dir === "up" ? <ThumbsUpIcon size={16} weight="fill" /> : <ThumbsDownIcon size={16} weight="fill" />}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </Card>

      <Card pad="lg" className="space-y-4">
        <SectionTitle title="Teach your Travel DNA" kicker="Your answers tune your next trip's picks" />
        <div>
          <p className="mb-2 text-sm font-bold">Which experiences did you enjoy most?</p>
          <div className="flex flex-wrap gap-2">
            {trip.items.filter((i) => i.kind === "activity" && i.status !== "cancelled").map((i) => (
              <Chip key={i.id} on={fb.loved.includes(i.id)} onClick={() => setFb({ ...fb, loved: toggle(fb.loved, i.id), disliked: fb.disliked.filter((x) => x !== i.id) })} tone="bg-success text-white">
                {i.title}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">…and least?</p>
          <div className="flex flex-wrap gap-2">
            {trip.items.filter((i) => i.kind === "activity" && i.status !== "cancelled").map((i) => (
              <Chip key={i.id} on={fb.disliked.includes(i.id)} onClick={() => setFb({ ...fb, disliked: toggle(fb.disliked, i.id), loved: fb.loved.filter((x) => x !== i.id) })} tone="bg-danger text-white">
                {i.title}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">Was the pace right?</p>
          <div className="flex flex-wrap gap-2">
            {([["too_slow", "Too slow"], ["right", "Just right"], ["too_fast", "Too tiring"]] as const).map(([id, label]) => (
              <Chip key={id} on={fb.pace === id} onClick={() => setFb({ ...fb, pace: fb.pace === id ? "" : id })}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["more", "less"] as const).map((k) => (
            <div key={k}>
              <p className="mb-2 text-sm font-bold">Next time, {k} of…</p>
              <div className="flex flex-wrap gap-2">
                {DIMS.map((d) => (
                  <Chip key={d.id} on={fb[k].includes(d.id)} onClick={() => setFb({ ...fb, [k]: toggle(fb[k], d.id), [k === "more" ? "less" : "more"]: fb[k === "more" ? "less" : "more"].filter((x) => x !== d.id) })}>
                    {d.label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Textarea value={fb.note} onChange={(e) => setFb({ ...fb, note: e.target.value })} placeholder="What would you change next time?" aria-label="What would you change next time" />
      </Card>

      <Card pad="lg">
        <SectionTitle title="Tell future travelers" />
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What should the next traveler not miss?" aria-label="Review text" />
        <Button className="mt-4" size="lg" onClick={submit} loading={loading} disabled={trip.status !== "completed"}>
          Post review
        </Button>
        {trip.status !== "completed" && <p className="mt-2 text-xs text-muted">You can send this once your trip is complete.</p>}
      </Card>
    </div>
  );
}
