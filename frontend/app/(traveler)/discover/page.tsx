"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { MagnifyingGlassIcon, SparkleIcon, FunnelIcon, XIcon, ArrowRightIcon, TagIcon } from "@phosphor-icons/react";
import { useDestinations } from "@/hooks/queries";
import { useTravelerStore } from "@/stores/travelerStore";
import { useAuthStore } from "@/stores/authStore";
import { useActiveTrip } from "@/stores/tripStore";
import { DestinationCard } from "@/components/traveler/DestinationCard";
import { ArtTile } from "@/components/art/ArtTile";
import { Chip, Stars, Skeleton } from "@/components/ui/primitives";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { SectionTitle } from "@/components/ui/Card";
import { destinationMatch, estimatedPerPerson, todaysWeather } from "@/lib/engine/match";
import { scoreByFeeling } from "@/lib/api/catalog";
import { activities } from "@/data/activities";
import { destinationMap } from "@/data/destinations";
import { cn, duration, rupees } from "@/lib/format";
import { toneSoft } from "@/components/ui/tone";
import type { Destination } from "@/types";

const MOODS = ["Western Ghats", "Beaches", "UNESCO Heritage", "Wildlife Safari", "Coffee Country", "Adventure", "Food & Culture"];

const MOOD_MATCHERS: Record<string, (d: Destination) => boolean> = {
  "Western Ghats": (d) =>
    d.moods.some((m) => /mountain|hill|himalaya|peak|snow/i.test(m)) ||
    (d.interests.includes("nature") && (d.art === "mountain" || /mountain|himalaya|hill|peak/i.test(`${d.tagline} ${d.description}`))),
  Beaches: (d) =>
    d.moods.some((m) => /beach|coast|sea|island/i.test(m)) ||
    d.art === "beach" || /beach|coast|sea|marine/i.test(`${d.tagline} ${d.description}`),
  "UNESCO Heritage": (d) =>
    d.moods.some((m) => /heritage|fort|palace|history|temple|ruins/i.test(m)) ||
    d.interests.includes("culture") ||
    d.art === "fort" || /unesco|palace|fort|heritage|temple|ruins|mughal|ancient/i.test(`${d.tagline} ${d.description}`),
  Adventure: (d) =>
    d.moods.some((m) => /adventure|raft|trek|scuba|boulder|safari/i.test(m)) ||
    d.interests.includes("adventure"),
  "Food & Culture": (d) =>
    d.moods.some((m) => /food|café|cafe|seafood|culinary/i.test(m)) ||
    d.interests.includes("food") || /street food|chaat|cuisine|café|dining/i.test(`${d.tagline} ${d.description}`),
  "Wildlife Safari": (d) =>
    d.moods.some((m) => /safari|tiger|elephant|wildlife|reserve|jungle/i.test(m)) ||
    /safari|tiger|elephant|wildlife|nagarhole|bandipur|kabini/i.test(`${d.tagline} ${d.description}`),
  "Coffee Country": (d) =>
    d.moods.some((m) => /coffee|estate|kodagu|plantation/i.test(m)) ||
    /coffee|plantation|kodagu|coorg|chikmagalur|sakleshpur/i.test(`${d.tagline} ${d.description}`),
  "Coastal Islands": (d) =>
    d.moods.some((m) => /island|reef|scuba/i.test(m)) ||
    d.art === "island" || /island|netrani|st\. mary|basalt/i.test(`${d.tagline} ${d.description}`),
};

const FEELINGS = ["misty coffee hills & waterfalls", "cliffs & beach shacks", "ancient boulder ruins & temples", "tiger & elephant safaris", "white water rapids & camping", "palaces & silk heritage"];
const BUDGETS: { id: string; label: string; max: number }[] = [
  { id: "any", label: "Any budget", max: Infinity },
  { id: "25", label: "Under ₹25k", max: 25000 },
  { id: "40", label: "Under ₹40k", max: 40000 },
];

export default function DiscoverPage() {
  const { data, isLoading, error, refetch } = useDestinations();
  const dna = useTravelerStore((s) => s.dna);
  const user = useAuthStore((s) => s.user);
  const active = useActiveTrip();
  const [q, setQ] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [budget, setBudget] = useState("any");

  const enriched = useMemo(
    () =>
      (data ?? []).map((d) => {
        const m = destinationMatch(d, dna);
        return { d, ...m, price: estimatedPerPerson(d), weather: todaysWeather(d), feeling: scoreByFeeling(d, q) };
      }),
    [data, dna, q],
  );

  const max = BUDGETS.find((b) => b.id === budget)!.max;
  const filtered = enriched
    .filter((x) => (mood && MOOD_MATCHERS[mood] ? MOOD_MATCHERS[mood](x.d) : true))
    .filter((x) => x.price <= max)
    .filter((x) => (q.trim() ? x.feeling > 0 : true))
    .sort((a, b) => (q.trim() ? b.feeling - a.feeling : b.score - a.score));

  const recommended = [...enriched].sort((a, b) => b.score - a.score).slice(0, 3);
  const popular = [...enriched].sort((a, b) => b.d.reviews - a.d.reviews);
  const experiences = useMemo(() => [...activities].sort((a, b) => b.reviews * b.rating - a.reviews * a.rating).slice(0, 10), []);
  const filtering = !!(q.trim() || mood || budget !== "any");

  return (
    <div className="space-y-10">
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-muted">
            {user ? `Namaste, ${user.name.split(" ")[0]}` : "Namaste"}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">Where does your heart want to go?</h1>
          <form className="relative mt-5" role="search" onSubmit={(e) => e.preventDefault()}>
            <MagnifyingGlassIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by feeling: “quiet mountains, good food”"
              aria-label="Search destinations by feeling"
              className="h-14 w-full rounded-full border-2 border-ink bg-white pl-12 pr-12 text-[15px] shadow-pop outline-none focus:shadow-pop-lg"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-ink/5" aria-label="Clear search">
                <XIcon size={16} />
              </button>
            )}
          </form>
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
            {FEELINGS.map((f) => (
              <button key={f} onClick={() => setQ(f)} className="shrink-0 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-ink-soft shadow-clay-sm hover:bg-white">
                <SparkleIcon size={12} className="mr-1 inline text-purple" weight="fill" />
                {f}
              </button>
            ))}
          </div>
        </div>
        <Link href={active ? `/my-trip/${active.id}` : dna ? "/onboarding" : "/quiz"} className="bg-speed group relative overflow-hidden rounded-[30px] border-2 border-ink bg-lavender p-5 shadow-pop transition hover:-translate-y-0.5">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold">{active ? "Your trip" : dna ? "Ready when you are" : "60 seconds"}</span>
          <p className="mt-3 font-display text-xl font-extrabold leading-tight">
            {active ? `${active.title} is ${active.status === "live" ? "live now" : "booked"}` : dna ? `${dna.name}, let's build a trip` : "Discover your Travel DNA"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{active ? "See your plan, bookings and Trip Pass." : dna ? "A few quick answers and your trip is ready." : "Get trips that feel like you."}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold">
            {active ? "Open My Trip" : dna ? "Start planning" : "Take the quiz"} <ArrowRightIcon size={16} weight="bold" className="transition group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      <div className="rounded-[28px] bg-sun-soft p-4 sm:flex sm:items-center sm:justify-between sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <TagIcon size={18} weight="fill" className="text-sun-deep" /> Prayaana special: use <code className="rounded-lg bg-white px-2 py-0.5 font-bold">PRAYAANA10</code> for 10% off (up to ₹2,500)
        </p>
        <p className="mt-1 text-xs text-muted sm:mt-0">Team-up deals unlock on popular activities automatically.</p>
      </div>

      <section aria-label="Filters" className="space-y-3">
        <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1">
          <FunnelIcon size={18} className="shrink-0 text-muted" aria-hidden />
          {MOODS.map((m) => (
            <Chip key={m} size="sm" selected={mood === m} onClick={() => setMood(mood === m ? null : m)} className="shrink-0">
              {m}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <Chip key={b.id} size="sm" tone="mint" selected={budget === b.id} onClick={() => setBudget(b.id)}>
              {b.label}
            </Chip>
          ))}
          {filtering && (
            <button onClick={() => { setQ(""); setMood(null); setBudget("any"); }} className="text-xs font-bold text-purple-deep underline">
              Clear all
            </button>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[30px] bg-white shadow-clay">
              <Skeleton className="h-40 rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load destinations" error={error} onRetry={() => refetch()} />
      ) : filtering ? (
        <section>
          <SectionTitle title={`${filtered.length} ${filtered.length === 1 ? "place" : "places"} for you`} kicker={q ? `Search: “${q}”` : "Filtered"} />
          {filtered.length === 0 ? (
            <EmptyState title="No destinations found" body="Try a different feeling like “beach” or “forts”, or clear the filters." mood="thinking" action={<Button size="sm" variant="secondary" onClick={() => { setQ(""); setMood(null); setBudget("any"); }}>Clear filters</Button>} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((x, i) => (
                <DestinationCard key={x.d.id} d={x.d} match={x.score} because={x.because} price={x.price} weather={x.weather} index={i} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section>
            <SectionTitle kicker={dna ? `For ${dna.name}s` : "Recommended"} title="Picked for you" action={<Link href="/quiz" className="text-sm font-semibold text-purple-deep hover:underline">{dna ? "Retake quiz" : "Personalize"}</Link>} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((x, i) => (
                <DestinationCard key={x.d.id} d={x.d} match={x.score} because={x.because} price={x.price} weather={x.weather} tall index={i} />
              ))}
            </div>
          </section>

          <section>
            <SectionTitle kicker="Loved by travelers" title="Top experiences" />
            <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {experiences.map((a, i) => {
                const d = destinationMap[a.destinationId];
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }}>
                    <Link href={`/discover/${d.id}#experiences`} className={cn("flex h-full w-64 shrink-0 flex-col rounded-[26px] p-4 shadow-clay-sm transition hover:-translate-y-1", toneSoft[a.tone])}>
                      <ArtTile icon={a.icon} tone={a.tone} size={52} />
                      <p className="mt-3 line-clamp-2 font-bold leading-snug">{a.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {d.name} · {duration(a.durationMin)}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <Stars value={a.rating} reviews={a.reviews} />
                        <span className="font-display text-sm font-bold">{a.price ? rupees(a.price) : "Free"}</span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle kicker="Trending now" title="Popular destinations" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((x, i) => (
                <DestinationCard key={x.d.id} d={x.d} price={x.price} weather={x.weather} match={dna ? x.score : undefined} index={i} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
