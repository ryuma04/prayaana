"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AnimatePresence, motion } from "motion/react";
import {
  ChatCircleDotsIcon,
  WarningIcon,
  MegaphoneIcon,
  MicrophoneIcon,
  CarIcon,
  ArrowRightIcon,
  SunIcon,
  CloudRainIcon,
  PaperPlaneRightIcon,
  PlayIcon,
  PauseIcon,
  SparkleIcon,
  AirplaneTiltIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import { useActiveTrip } from "@/stores/tripStore";
import { useOpenIncidentFor } from "@/stores/incidentStore";
import { ArtTile } from "@/components/art/ArtTile";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { Chip, Progress } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { MapView } from "@/components/map/MapView";
import { TripSimulationView } from "@/components/traveler/TripSimulationView";
import { useTripRoute } from "@/hooks/queries";
import { FlightStatusCard, NearbyPlaces } from "@/components/traveler/LiveInfo";
import { useWeatherVersion } from "@/stores/weatherStore";
import { DayCard, ItemDetailsSheet } from "@/components/traveler/Itinerary";
import { MoodButtons, MoodSheet } from "@/components/traveler/MoodFlow";
import { destinationMap } from "@/data/destinations";

import { dayItems, isTransport } from "@/lib/engine/schedule";
import { tripDayWeather, conditionLabel } from "@/lib/engine/weather";
import { reportAtPlace, sendTravelerMessage, sendTravelerVoice, type TravelerMessage } from "@/lib/api/trips";
import { errorMessage } from "@/lib/api/client";
import { useRecorder } from "@/hooks/useRecorder";
import { dayDate, daysBetween, duration, haversineKm, minToTime, roadMinutes, todayISO } from "@/lib/format";
import { toast } from "@/stores/notificationStore";
import type { CrowdReport, Mood, TripItem } from "@/types";
import { Glyph } from "@/lib/icons";

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export default function LivePage() {
  const trip = useActiveTrip();
  const incident = useOpenIncidentFor(trip?.id);

  const [realNow, setRealNow] = useState(nowMinutes);
  const [mood, setMood] = useState<Mood | null>(null);
  const [details, setDetails] = useState<TripItem | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showSim, setShowSim] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setRealNow(nowMinutes()), 30000);
    return () => clearInterval(t);
  }, []);

  const day = trip?.currentDay ?? 1;
  const items = useMemo(() => (trip ? dayItems(trip.items, day).filter((i) => !isTransport(i) || i.day === 1) : []), [trip, day]);
  // The current time, or just before the first activity when the day hasn't started yet.
  const defaultClock = useMemo(() => {
    const firstAct = items.find((i) => i.kind === "activity");
    if (realNow >= 7 * 60 && realNow <= 21 * 60 && items.some((i) => i.startMin + i.durationMin > realNow)) return realNow;
    return firstAct ? firstAct.startMin + 20 : 10 * 60;
  }, [items, realNow]);
  const now = defaultClock;
  const routeKey = items.map((i) => `${i.id}:${i.lat ?? ""},${i.lng ?? ""}`).join(";");
  useWeatherVersion();
  const { data: route } = useTripRoute(trip?.status === "live" ? trip.id : undefined, day, routeKey);

  if (!trip) {
    return (
      <div className="py-10">
        <EmptyState title="No live trip" body="Book a trip and live mode switches on the day you leave." mood="sleepy" action={<Button href="/onboarding">Plan a trip</Button>} />
      </div>
    );
  }
  if (trip.status !== "live") {
    const toGo = daysBetween(todayISO(), trip.prefs.startDate);
    return (
      <div className="space-y-6 py-6">
        <EmptyState
          title={`${trip.title} starts ${toGo <= 0 ? "today" : `in ${toGo} day${toGo > 1 ? "s" : ""}`}`}
          body="On the day you leave, this shows today's plan, the map and one-tap help."
          mood="happy"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" href={`/my-trip/${trip.id}`}>
                Open My Trip
              </Button>
              <Button
                variant={showSim ? "primary" : "outline"}
                onClick={() => setShowSim((v) => !v)}
                icon={showSim ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
              >
                {showSim ? "Pause Simulation" : "Simulate Trip Journey"}
              </Button>
            </div>
          }
        />

        {showSim && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
                <h2 className="font-display text-base font-extrabold text-ink">Journey Route & Live Simulation</h2>
              </div>
              <span className="text-xs text-muted">Car routes on road · Airplane connects airport to airport</span>
            </div>
            <TripSimulationView trip={trip} autoPlay={true} height={420} />
          </div>
        )}
      </div>
    );
  }

  const dest = destinationMap[trip.destinationId];
  const weather = tripDayWeather(trip, day);
  const current = items.find((i) => i.startMin <= now && i.startMin + i.durationMin > now && i.status !== "cancelled");
  const next = items.find((i) => i.startMin > now && i.status !== "cancelled");
  const doneCount = items.filter((i) => i.startMin + i.durationMin <= now).length;
  const from = current ?? [...items].reverse().find((i) => i.startMin + i.durationMin <= now) ?? items[0];
  // Real road time between the stops (OSRM legs), else the straight-line estimate.
  const iFrom = route && from ? route.stops.indexOf(from.id) : -1;
  const iNext = route && next ? route.stops.indexOf(next.id) : -1;
  const osrmTravel = route && iFrom >= 0 && iNext > iFrom ? route.legs.slice(iFrom, iNext).reduce((t, l) => t + l.durationMin, 0) : null;
  const travel =
    osrmTravel ??
    (from && next && from.lat != null && next.lat != null && from.lng != null && next.lng != null ? roadMinutes(haversineKm({ lat: from.lat, lng: from.lng }, { lat: next.lat, lng: next.lng })) : 15);
  const leaveIn = next ? next.startMin - travel - now : 0;
  // Group position: somewhere between the last stop and the next.
  const progress = from && next ? Math.max(0, Math.min(1, (now - (from.startMin + from.durationMin)) / Math.max(1, next.startMin - (from.startMin + from.durationMin)))) : 0;
  const mover =
    from?.lat != null && from.lng != null
      ? next?.lat != null && next.lng != null && !current
        ? { lat: from.lat + (next.lat - from.lat) * progress, lng: from.lng + (next.lng - from.lng) * progress }
        : { lat: from.lat, lng: from.lng }
      : undefined;
  const highlight: Record<string, "now" | "next" | "risk"> = {};
  if (current) highlight[current.id] = "now";
  if (next) highlight[next.id] = "next";
  const points = items.filter((i) => i.lat != null && i.lng != null).map((i, idx) => ({ id: i.id, lat: i.lat as number, lng: i.lng as number, label: `${minToTime(i.startMin)} · ${i.title}`, n: idx + 1, active: i.id === current?.id || i.id === next?.id }));
  const liveTrip = { ...trip, items: trip.items.map((i) => (i.day === day && i.startMin + i.durationMin <= now && i.status !== "cancelled" ? { ...i, status: "done" as const } : i.id === current?.id ? { ...i, status: "live" as const } : i)) };
  const lastDay = trip.prefs.nights + 1;

  const report = (type: CrowdReport["type"], label: string) => {
    const place = (current ?? next)?.place ?? dest.name;
    setReportOpen(false);
    reportAtPlace(trip.id, { place, type, text: `${label}, reported by traveler` })
      .then((r) =>
        toast({ tone: "success", title: r.verified ? "Report verified" : "Thanks! Report sent", body: r.verified ? `Other tours near ${place} are being warned now.` : `Other tours near ${place} will be warned once it's verified.` }),
      )
      .catch((e) => toast({ tone: "error", title: errorMessage(e) }));
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live · {dest.name}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">Today</h1>
          <p className="text-sm text-muted">
            Day {day} of {lastDay} · {dayDate(trip.prefs.startDate, day, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-clay-sm">
          {weather.condition === "rain" || weather.condition === "storm" ? <CloudRainIcon size={20} weight="fill" className="text-sky-deep" /> : <SunIcon size={20} weight="fill" className="text-sun-deep" />}
          <span className="text-sm font-bold">{weather.tempC}°C</span>
          <span className="text-xs text-muted">{conditionLabel[weather.condition]} · {weather.rainChance}% rain</span>
        </div>
      </div>

      {incident && (
        <Link href="/my-trip/adapt" className="flex items-center gap-3 rounded-[24px] border-2 border-ink bg-sky p-4 shadow-pop">
          <WarningIcon size={24} weight="duotone" />
          <div className="flex-1">
            <p className="font-bold">{incident.title} · Day {incident.day}</p>
            <p className="text-sm text-ink-soft">{incident.status === "awaiting_vendors" ? "Vendors are confirming a fix now…" : "Tap to see 3 fix plans"}</p>
          </div>
          <ArrowRightIcon size={18} weight="bold" />
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <motion.div layout className="rounded-[28px] border-2 border-ink bg-lavender p-4 shadow-pop">
              <p className="text-[11px] font-extrabold uppercase tracking-wider">Now</p>
              {current ? (
                <div className="mt-2 flex items-center gap-3">
                  <ArtTile icon={current.icon} tone={current.tone} size={52} />
                  <div className="min-w-0">
                    <p className="font-display font-bold leading-tight">{current.title}</p>
                    <p className="text-xs text-ink-soft">
                      until {minToTime(current.startMin + current.durationMin)} · {current.place}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-2 font-semibold">
                  <CarIcon size={20} weight="duotone" /> {next ? `On the way · ${Math.round(progress * 100)}% there` : "Free time, enjoy!"}
                </p>
              )}
            </motion.div>
            <motion.div layout className="rounded-[28px] bg-white p-4 shadow-clay">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Next</p>
              {next ? (
                <div className="mt-2 flex items-center gap-3">
                  <ArtTile icon={next.icon} tone={next.tone} size={52} />
                  <div className="min-w-0">
                    <p className="font-display font-bold leading-tight">{next.title}</p>
                    <p className="text-xs text-muted">
                      {minToTime(next.startMin)} · {duration(travel)} drive · {leaveIn > 0 ? `leave in ${duration(leaveIn)}` : leaveIn > -10 ? "leave now" : <span className="font-bold text-danger">running {duration(-leaveIn)} late</span>}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">That&apos;s everything for today</p>
              )}
            </motion.div>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted">
              <span>Trip progress</span>
              <span>
                {doneCount}/{items.length} today · Day {day}/{lastDay}
              </span>
            </div>
            <Progress value={(((day - 1) + doneCount / Math.max(1, items.length)) / lastDay) * 100} label="Trip progress" barClassName="bg-gradient-to-r from-mint-deep to-purple" />
          </div>

          <section>
            <SectionTitle title="How are you feeling?" kicker="One tap re-plans the rest of today" />
            <MoodButtons onPick={setMood} />
          </section>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Trip Map & Route</span>
            <button
              type="button"
              onClick={() => setShowSim((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-purple shadow-sm transition hover:bg-lavender-soft"
            >
              {showSim ? <MapPinIcon size={13} weight="bold" /> : <PlayIcon size={13} weight="fill" />}
              {showSim ? "View Real-time Map" : "Simulate Journey"}
            </button>
          </div>

          {showSim ? (
            <TripSimulationView trip={trip} autoPlay={true} height={340} />
          ) : (
            <>
              {points.length > 0 && <MapView points={points} height={300} mover={mover} geometry={route?.geometry} />}
              {route && (
                <p className="-mt-3 text-[11px] text-muted">
                  Today: {route.distanceKm} km · {route.durationMin} min on the road · {route.source === "osrm" ? "live road route (OSRM)" : "estimated"}
                  {osrmTravel != null && next ? ` · ${osrmTravel} min to ${next.title}` : ""}
                </p>
              )}
            </>
          )}

          <DayCard trip={liveTrip} day={day} readOnly highlight={highlight} onOpen={setDetails} titleSuffix={<span className="text-xs font-semibold text-muted">{items.length} stops</span>} />
          {(day === 1 || day === lastDay) && <FlightStatusCard trip={trip} />}
          <NearbyPlaces destinationId={trip.destinationId} near={from?.lat != null && from.lng != null ? { lat: from.lat, lng: from.lng } : undefined} initial="food" />
          {day < lastDay && (
            <Link href={`/my-trip/${trip.id}`} className="block rounded-[24px] bg-white/70 p-4 text-sm font-semibold text-ink-soft hover:bg-white">
              Tomorrow: {dayItems(trip.items, day + 1).filter((i) => i.kind === "activity").map((i) => i.title).join(" · ") || "Free day"} →
            </Link>
          )}
        </div>

        <aside className="space-y-4">
          <Card pad="md">
            <p className="text-sm font-bold">Need help?</p>
            <p className="mt-1 text-xs text-muted">Ask anything about today. We reply right away.</p>
            <Button className="mt-3" full variant="outline" onClick={() => setChatOpen(true)} icon={<ChatCircleDotsIcon size={16} weight="fill" />}>
              Chat with us
            </Button>
          </Card>
          <Card pad="md">
            <p className="text-sm font-bold">Something wrong nearby?</p>
            <p className="mt-1 text-xs text-muted">Your report helps every other tour heading there.</p>
            <Button className="mt-3" full variant="secondary" onClick={() => setReportOpen(true)} icon={<MegaphoneIcon size={16} weight="bold" />}>
              Report a problem
            </Button>
          </Card>
        </aside>
      </div>

      <MoodSheet trip={trip} mood={mood} onClose={() => setMood(null)} day={day} nowMin={now} />
      <ItemDetailsSheet trip={trip} item={details} onClose={() => setDetails(null)} />
      <Sheet open={reportOpen} onOpenChange={setReportOpen} title="Report a problem" description="Verified after 2 reports within 2 hours, or 1 from a trusted guide." side="center" size="sm">
        <div className="grid gap-2">
          {([
            ["closed", "Place is closed", "🚫"],
            ["road_blocked", "Road blocked", "🚧"],
            ["crowded", "Too crowded", "👥"],
            ["unsafe", "Feels unsafe", "⚠️"],
          ] as const).map(([t, l, e]) => (
            <button key={t} onClick={() => report(t, l)} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left font-semibold shadow-clay-sm hover:bg-sun-soft">
              <Glyph emoji={e} size={24} /> {l}
            </button>
          ))}
        </div>
      </Sheet>
      <GuideChat tripId={trip.id} open={chatOpen} onOpenChange={setChatOpen} coordName="Trip help" onMood={(m) => { setChatOpen(false); setMood(m); }} />
    </div>
  );
}

const MOOD_FOR: Partial<Record<TravelerMessage["kind"], Mood>> = { late: "late", tired: "tired", hungry: "hungry", money: "over_budget", weather: "raining" };

function GuideChat({ tripId, open, onOpenChange, coordName, onMood }: { tripId: string; open: boolean; onOpenChange: (v: boolean) => void; coordName: string; onMood: (m: Mood) => void }) {
  const [msgs, setMsgs] = useState<{ from: "me" | "them"; text: string; voice?: boolean }[]>([{ from: "them", text: "Hi! Ask anything about your trip, or send a voice note." }]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const recorder = useRecorder();

  const answer = (res: TravelerMessage) => {
    setMsgs((m) => [...m, { from: "them", text: `${res.reply}
· AI read this as “${res.kind}” (${Math.round(res.confidence * 100)}%)` }]);
    const mood = MOOD_FOR[res.kind];
    if (mood) setTimeout(() => onMood(mood), 1200);
  };

  const send = async (t: string) => {
    if (!t.trim() || thinking) return;
    setMsgs((m) => [...m, { from: "me", text: t }]);
    setText("");
    setThinking(true);
    try {
      answer(await sendTravelerMessage(tripId, t));
    } catch (e) {
      setMsgs((m) => [...m, { from: "them", text: `Sorry, that didn't go through. ${errorMessage(e)}` }]);
    } finally {
      setThinking(false);
    }
  };

  const sendVoice = async () => {
    const blob = await recorder.stop();
    if (!blob) return;
    setThinking(true);
    try {
      const res = await sendTravelerVoice(tripId, blob);
      setMsgs((m) => [...m, { from: "me", text: res.transcript, voice: true }]);
      answer(res.understood);
    } catch (e) {
      setMsgs((m) => [...m, { from: "them", text: errorMessage(e, "We couldn't hear that. Please type it instead.") }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={coordName} description="Ask anything about your trip">
      <div className="flex min-h-72 flex-col gap-2">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${m.from === "me" ? "ml-auto rounded-br-sm bg-[#d9fdd3]" : "rounded-bl-sm bg-white shadow-clay-sm"}`}>
              {m.voice && <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-success"><MicrophoneIcon size={12} weight="fill" /> Voice note · transcribed</span>}
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {thinking && <p className="flex items-center gap-2 text-xs text-muted"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lavender border-t-purple" /> Reading your message…</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["We're stuck in traffic", "I'm really tired", "Where can we eat?"].map((s) => (
          <Chip key={s} size="sm" onClick={() => send(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" aria-label="Message" className="h-11 flex-1 rounded-full bg-white px-4 text-sm shadow-clay-sm outline-none focus:ring-2 focus:ring-purple" />
        <button
          type="button"
          onClick={() => void (recorder.recording ? sendVoice() : recorder.start())}
          disabled={thinking}
          className={`grid h-11 w-11 place-items-center rounded-full disabled:opacity-60 ${recorder.recording ? "animate-pulse bg-danger text-white" : "bg-mint"}`}
          aria-label={recorder.recording ? "Stop and send voice note" : "Record a voice note"}
        >
          <MicrophoneIcon size={18} weight="fill" />
        </button>
        <button type="submit" className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white" aria-label="Send">
          <PaperPlaneRightIcon size={18} weight="fill" />
        </button>
      </form>
      {recorder.recording && <p className="mt-2 text-center text-xs text-danger">Recording… tap the mic again to send</p>}
      {recorder.error && <p className="mt-2 text-center text-xs text-danger">{recorder.error}</p>}
    </Sheet>
  );
}

