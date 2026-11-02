"use client";
import { useWeatherVersion } from "@/stores/weatherStore";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeftIcon,
  HeartIcon,
  CalendarCheckIcon,
  MapPinIcon,
  TranslateIcon,
  ClockIcon,
  ArrowRightIcon,
  SirenIcon,
  CloudRainIcon,
  SunIcon,
  CloudIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useDestinationDetail } from "@/hooks/queries";
import { useTravelerStore } from "@/stores/travelerStore";
import { DestinationArt } from "@/components/art/DestinationArt";
import { ArtTile } from "@/components/art/ArtTile";
import { ActivityCard, HotelCard, TransportRow } from "@/components/traveler/Cards";
import { MapView } from "@/components/map/MapView";
import { NearbyPlaces } from "@/components/traveler/LiveInfo";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Chip, Skeleton, Stars } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/States";
import { monthNames } from "@/data/destinations";
import { destinationMatch, estimatedPerPerson } from "@/lib/engine/match";
import { buildTrip, matchPercent } from "@/lib/engine/planner";
import { priceTrip } from "@/lib/engine/pricing";
import { dayItems } from "@/lib/engine/schedule";
import { forecastFor } from "@/lib/engine/weather";
import { addDays, cn, dayDate, minToTime, rupees, todayISO } from "@/lib/format";
import { dnaToInterests } from "@/lib/engine/dna";
import type { Interest, TripPreferences } from "@/types";

export function DestinationDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useDestinationDetail(id);
  const dna = useTravelerStore((s) => s.dna);
  const saved = useTravelerStore((s) => s.savedPlaces.includes(id));
  const toggleSaved = useTravelerStore((s) => s.toggleSaved);
  const setAnswers = useTravelerStore((s) => s.setAnswers);
  const setStep = useTravelerStore((s) => s.setStep);
  const [interest, setInterest] = useState<Interest | "all">("all");

  const sample = useMemo(() => {
    if (!data) return null;
    const d = data.destination;
    const prefs: TripPreferences = {
      destinationId: d.id,
      startDate: addDays(todayISO(), 21),
      nights: 3,
      adults: 2,
      kids: 0,
      budgetPerPerson: 30000,
      stayType: "boutique",
      transport: data.transport[0].mode,
      interests: dna ? dnaToInterests(dna) : d.interests.slice(0, 3),
      pace: "balanced",
      rhythm: "early-bird",
      special: [],
      ownWords: "",
      fromCity: d.fromCity,
      fromAddress: "",
      fromLat: null,
      fromLng: null,
    };
    const trip = buildTrip(prefs, { id: `sample-${d.id}`, code: "SAMPLE", customerId: "", customerName: "Sample", coordinatorId: "" });
    return { prefs, trip, price: priceTrip(trip) };
  }, [data, dna]);

  useWeatherVersion();
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-[36px]" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error || !data) return <ErrorState title="Unable to load destination" error={error} onRetry={() => refetch()} action={<Button size="sm" variant="secondary" href="/discover">Back to Discover</Button>} />;

  const d = data.destination;
  const match = destinationMatch(d, dna);
  const month = new Date().getMonth() + 1;
  const forecast = Array.from({ length: 5 }, (_, i) => forecastFor(d.id, addDays(todayISO(), i)));
  const acts = data.activities.filter((a) => interest === "all" || a.interests.includes(interest));
  const build = () => {
    setAnswers({ destinationId: d.id, fromCity: d.fromCity });
    setStep(2);
    router.push(`/onboarding?destination=${d.id}`);
  };

  return (
    <div className="pb-24">
      <div className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-[40px] sm:border-2 sm:border-ink sm:shadow-pop-lg">
        <div className="h-72 sm:h-96">
          <DestinationArt kind={d.art} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex justify-between">
          <Link href="/discover" className="grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-clay-sm" aria-label="Back to Discover">
            <ArrowLeftIcon size={18} weight="bold" />
          </Link>
          <button onClick={() => toggleSaved(d.id)} className="grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-clay-sm" aria-pressed={saved} aria-label={saved ? "Unsave" : "Save"}>
            <HeartIcon size={20} weight={saved ? "fill" : "regular"} className={saved ? "text-coral" : ""} />
          </button>
        </div>
        <div className="absolute bottom-5 left-5 right-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 text-xs font-extrabold text-ink">{match.score}% match</span>
            <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-ink">
              <Stars value={d.rating} reviews={d.reviews} source="Google Maps ratings of its experiences and stays" />
            </span>
          </div>
          <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">{d.name}</h1>
          <p className="text-sm opacity-90 sm:text-base">
            {d.state} · {d.tagline}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section>
            <p className="text-base leading-relaxed text-ink-soft">{d.description}</p>
            <p className="mt-3 rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-purple-deep">
              <SparkleIcon size={14} weight="fill" className="mr-1 inline" />
              <b>Why this matches you:</b> Because you love {match.because.join(" + ")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [CalendarCheckIcon, "Ideal trip", d.idealDays],
                [MapPinIcon, "Gateway", d.gateway.split(",")[0]],
                [TranslateIcon, "Languages", d.languages.join(", ")],
                [ClockIcon, "From", `${d.fromCity}`],
              ].map(([I, k, v]) => {
                const Icon = I as typeof ClockIcon;
                return (
                  <div key={k as string} className="rounded-2xl bg-white p-3 shadow-clay-sm">
                    <Icon size={18} weight="duotone" className="text-purple" />
                    <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{k as string}</p>
                    <p className="text-sm font-bold">{v as string}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SectionTitle title="Weather & best time" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Card pad="md">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Next 5 days</p>
                <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
                  {forecast.map((f, i) => {
                    const Icon = f.condition === "rain" ? CloudRainIcon : f.condition === "cloudy" ? CloudIcon : SunIcon;
                    return (
                      <div key={i} className={cn("rounded-2xl py-2", f.condition === "rain" ? "bg-sky-soft" : "bg-canvas")}>
                        <p className="text-[10px] font-bold text-muted">{i === 0 ? "Today" : dayDate(todayISO(), i + 1, { weekday: "short" })}</p>
                        <Icon size={22} weight="duotone" className={cn("mx-auto my-1", f.condition === "rain" ? "text-sky-deep" : "text-sun-deep")} />
                        <p className="text-sm font-bold">{f.tempC}°</p>
                        <p className="text-[10px] text-muted">{f.rainChance}%</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-muted">
                  {forecast.some((f) => f.source === "open-meteo") ? "Live forecast · Weather data by Open-Meteo.com" : "Climate estimate (live forecast unavailable)"}
                </p>
              </Card>
              <NearbyPlaces destinationId={d.id} />
              <Card pad="md">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Best months</p>
                <div className="mt-3 grid grid-cols-6 gap-1.5">
                  {monthNames.map((m, i) => {
                    const best = d.bestMonths.includes(i + 1);
                    const rainy = d.rainyMonths.includes(i + 1);
                    return (
                      <span
                        key={m}
                        className={cn(
                          "rounded-xl py-1.5 text-center text-[11px] font-bold",
                          best ? "bg-mint text-ink" : rainy ? "bg-sky-soft text-sky-deep" : "bg-canvas text-muted",
                          i + 1 === month && "ring-2 ring-ink",
                        )}
                      >
                        {m}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-mint" /> Best time
                  <span className="ml-3 mr-2 inline-block h-2.5 w-2.5 rounded-full bg-sky" /> Monsoon
                </p>
              </Card>
            </div>
          </section>

          <section id="experiences">
            <SectionTitle title={`Experiences in ${d.name}`} kicker={`${data.activities.length} curated`} />
            <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
              <Chip size="sm" selected={interest === "all"} onClick={() => setInterest("all")}>
                All
              </Chip>
              {[...new Set(data.activities.flatMap((a) => a.interests))].map((i) => (
                <Chip key={i} size="sm" selected={interest === i} onClick={() => setInterest(i)} className="capitalize">
                  {i}
                </Chip>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {acts.map((a) => (
                <ActivityCard key={a.id} a={a} match={sample ? matchPercent(a, sample.prefs) : undefined} />
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="Where to stay" />
            <div className="grid gap-3 sm:grid-cols-2">
              {data.stays.map((s) => (
                <HotelCard key={s.id} s={s} />
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="Getting there" />
            <div className="space-y-3">
              {data.transport.map((t) => (
                <TransportRow key={t.id} t={t} />
              ))}
            </div>
          </section>

          {sample && (
            <section>
              <SectionTitle title="A sample 4-day plan" kicker="Built by our planner for you" />
              <div className="space-y-3">
                {Array.from({ length: sample.prefs.nights + 1 }, (_, i) => i + 1).map((day) => (
                  <Card key={day} pad="md">
                    <p className="font-display text-sm font-bold">Day {day}</p>
                    <ul className="mt-2 space-y-1.5">
                      {dayItems(sample.trip.items, day)
                        .filter((it) => it.kind === "activity" || it.kind === "meal")
                        .map((it) => (
                          <li key={it.id} className="flex items-center gap-2.5 text-sm">
                            <ArtTile icon={it.icon} tone={it.tone} size={28} />
                            <span className="w-16 shrink-0 text-xs font-semibold text-muted">{minToTime(it.startMin)}</span>
                            <span className="truncate">{it.title}</span>
                          </li>
                        ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle title="On the map" />
            <MapView points={data.activities.map((a, i) => ({ id: a.id, lat: a.lat, lng: a.lng, label: a.title, n: i + 1, tone: a.outdoor ? "mint" : "purple" }))} route={false} height={320} />
          </section>

          <section>
            <SectionTitle
              title="What travelers say"
              kicker={d.rating > 0 ? `${d.rating} ★ on Google Maps across ${d.reviews.toLocaleString("en-IN")} reviews of its places` : "Ratings are being looked up"}
            />
            {data.reviews.length === 0 && (
              <p className="rounded-2xl bg-white/70 p-4 text-sm text-muted">No Prayaana traveler has reviewed {d.name} yet. Reviews appear here after real trips.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {data.reviews.map((r) => (
                <Card key={r.name + r.when} pad="md">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">
                      {r.name} <span className="font-normal text-muted">· {r.city}</span>
                    </p>
                    <Stars value={r.stars} showValue={false} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {r.trip} · {r.when}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">“{r.text}”</p>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="Emergency contacts" />
            <div className="grid gap-2 sm:grid-cols-3">
              {d.emergency.map((e) => (
                <a key={e.label} href={`tel:${e.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 rounded-2xl bg-pink-soft p-3 text-sm">
                  <SirenIcon size={18} weight="duotone" className="shrink-0 text-pink-deep" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.label}</span>
                    <span className="text-xs text-muted">{e.phone}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border-2 border-ink bg-white p-5 shadow-pop-lg">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Estimated cost</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{rupees(estimatedPerPerson(d))}</p>
            <p className="text-xs text-muted">per person · 5 days · 2 travelers · boutique stay</p>
            {sample && (
              <dl className="mt-4 space-y-1.5 text-sm">
                {[
                  ["Stay", sample.price.stay],
                  ["Travel", sample.price.travel],
                  ["Local cab", sample.price.local],
                  ["Activities", sample.price.activities],
                  ["Meals", sample.price.meals],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between">
                    <dt className="text-muted">{k as string}</dt>
                    <dd className="font-semibold tabular">{rupees(v as number)}</dd>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-muted">Sample 4-day plan for 2 · fees & GST extra</p>
              </dl>
            )}
            <Button full size="lg" className="mt-5" onClick={build} icon={<ArrowRightIcon size={18} weight="bold" />}>
              Build my trip
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted">Free to plan · pay only when you book</p>
          </motion.div>
        </aside>
      </div>

      <div className="fixed inset-x-3 bottom-24 z-30 md:hidden">
        <Button full size="lg" onClick={build} icon={<ArrowRightIcon size={18} weight="bold" />}>
          Build my {d.name} trip
        </Button>
      </div>
    </div>
  );
}
