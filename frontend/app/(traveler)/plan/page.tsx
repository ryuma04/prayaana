"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MagicWandIcon, PencilSimpleIcon, ArrowRightIcon, ListBulletsIcon, MapTrifoldIcon, BedIcon, XIcon, CaretUpIcon, UsersIcon, CalendarBlankIcon, InfoIcon, AirplaneTiltIcon, TrainIcon, BusIcon, CarIcon } from "@phosphor-icons/react";
import { useTripStore } from "@/stores/tripStore";
import { useTripEditor } from "@/hooks/useTripEditor";
import { DestinationArt } from "@/components/art/DestinationArt";
import { Zippy } from "@/components/art/Zippy";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs } from "@/components/ui/Tabs";
import { AnimatedNumber } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/States";
import { RoutedMap } from "@/components/map/RoutedMap";
import { BudgetMeter, PriceSummary, PriceTicker } from "@/components/traveler/PriceBreakdown";
import type { MapLine, MapPoint } from "@/components/map/MapView";
import { useModeHubs, validPoint } from "@/hooks/useModeHubs";
import { AddSheet, DayCard, HeartCounter, ItemDetailsSheet, MoveSheet, TimeSheet, useItinerarySheets } from "@/components/traveler/Itinerary";
import { HotelCard, TransportRow } from "@/components/traveler/Cards";
import { destinationMap } from "@/data/destinations";
import { stayMap, transportMap } from "@/data/stays";
import { priceTrip, tripPriceRange } from "@/lib/engine/pricing";
import { dayItems } from "@/lib/engine/schedule";
import { getTrip, optimize, optimizeBudget } from "@/lib/api/trips";
import { toast } from "@/stores/notificationStore";
import { addDays, duration, formatDate, rupees } from "@/lib/format";

function PlanInner() {
  const router = useRouter();
  const params = useSearchParams();
  const fresh = params.get("fresh") === "1";
  const qTrip = params.get("trip");
  const draftId = useTripStore((s) => s.draftId);
  const tripId = qTrip ?? draftId ?? undefined;
  const trip = useTripStore((s) => (tripId ? s.trips[tripId] : undefined));
  const editor = useTripEditor(tripId);
  const sheets = useItinerarySheets();
  const [tab, setTab] = useState("itinerary");
  // The selected map day belongs to one trip; another trip starts on All Days.
  const [mapSel, setMapSel] = useState<{ tripId?: string; day: number }>({ day: 0 });
  const [optimizing, setOptimizing] = useState(false);
  const [showIntro, setShowIntro] = useState(fresh);
  const [priceOpen, setPriceOpen] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Authoritative server fetch when tripId exists but trip is not yet in store (e.g. on page refresh)
  useEffect(() => {
    if (tripId && (!trip || trip.id !== tripId)) {
      setLoadingTrip(true);
      setLoadError(null);
      getTrip(tripId)
        .then((loaded) => {
          if (loaded && loaded.status === "draft") {
            useTripStore.getState().setDraft(loaded.id);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch trip from backend:", err);
          setLoadError(err instanceof Error ? err.message : "Trip not found");
        })
        .finally(() => {
          setLoadingTrip(false);
        });
    }
  }, [tripId, trip]);

  const price = useMemo(() => (trip ? priceTrip(trip) : null), [trip]);
  const priceRange = useMemo(() => (trip ? tripPriceRange(trip) : null), [trip]);

  const mapDay = mapSel.tripId === tripId ? mapSel.day : 0;
  const setMapDay = (day: number) => setMapSel({ tripId, day });

  // Real hubs (Google Places) for the trip's own origin, first destination and transport mode.
  const tripOrigin = trip?.originPlace ?? trip?.prefs.originPlace ?? null;
  const originPt = validPoint(tripOrigin) ? { lat: tripOrigin.lat, lng: tripOrigin.lng } : null;
  const firstDest = trip ? destinationMap[trip.destinationId] ?? trip.prefs.destinationPlaces?.[0] : undefined;
  const destPt = validPoint(firstDest) ? { lat: firstDest.lat, lng: firstDest.lng } : null;
  const hubs = useModeHubs(trip?.prefs.transport, originPt, destPt);

  if (loadingTrip && !trip) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple border-t-transparent" />
        <p className="font-display font-bold text-ink">Loading your trip plan…</p>
        <p className="text-xs text-muted">Retrieving verified itinerary and route data from server</p>
      </div>
    );
  }

  if (loadError && !trip) {
    return (
      <div className="py-10">
        <EmptyState
          title="Couldn't load trip"
          body={loadError}
          mood="thinking"
          action={
            <Button href="/onboarding" icon={<ArrowRightIcon size={16} weight="bold" />}>
              Start a new trip
            </Button>
          }
        />
      </div>
    );
  }

  if (!trip || !price) {
    return (
      <div className="py-10">
        <EmptyState title="No trip in progress" body="Answer a few questions and we'll build a complete custom trip in seconds." mood="thinking" action={<Button href="/onboarding" icon={<ArrowRightIcon size={16} weight="bold" />}>Plan a trip</Button>} />
      </div>
    );
  }
  const booked = trip.status !== "draft";
  const dest = destinationMap[trip.destinationId];
  const destTitle =
    trip.destinations?.length && trip.destinations.length > 1
      ? trip.destinations
          .map((d) => destinationMap[d]?.name ?? trip.prefs.destinationPlaces?.find((p) => p.placeId === d || p.name.toLowerCase().replace(/\s+/g, "-") === d)?.name ?? d)
          .join(" → ")
      : dest?.name ?? trip.prefs.destinationPlaces?.[0]?.name ?? trip.destinationId ?? "Trip Plan";
  const days = Array.from({ length: trip.prefs.nights + 1 }, (_, i) => i + 1);
  const stay = stayMap[trip.stayId];
  const transport = transportMap[trip.transportId];
  const endDate = addDays(trip.prefs.startDate, trip.prefs.nights);
  const travelers = trip.prefs.adults + trip.prefs.kids;
  // Day filter comes straight from each item's day number; All Days = every active item.
  const targetItems = mapDay === 0 ? days.flatMap((d) => dayItems(trip.items, d)) : dayItems(trip.items, mapDay);
  const mapPoints: MapPoint[] = targetItems
    .filter((i) => validPoint({ lat: i.lat, lng: i.lng }))
    .map((i, idx) => ({
      id: i.id,
      lat: i.lat as number,
      lng: i.lng as number,
      label: i.title,
      n: mapDay === 0 ? `D${i.day}` : idx + 1,
      kind: i.kind,
      day: i.day,
      startMin: i.startMin,
      durationMin: i.durationMin,
      unitCost: i.unitCost,
      place: i.place,
      address: i.location,
      description: i.subtitle,
      status: i.status,
    }));
  // Transport hubs belong to the arrival and departure days (and All Days).
  const lastDay = days[days.length - 1];
  const hubFrom = hubs.data?.origin.hubs[0];
  const hubTo = hubs.data?.destination.hubs[0];
  const showHubs = mapDay === 0 || mapDay === 1 || mapDay === lastDay;
  const hubKind = hubs.data?.type;
  const hubPoints: MapPoint[] =
    showHubs && hubKind
      ? [hubFrom && { ...hubFrom, role: `Departure ${hubKind}`, id: `hub-o-${hubFrom.placeId}` }, hubTo && { ...hubTo, role: `Arrival ${hubKind}`, id: `hub-d-${hubTo.placeId}` }]
          .filter((h): h is NonNullable<typeof h> => !!h)
          .map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, label: h.name, kind: hubKind, address: h.address, description: `${h.role} · ${h.distanceKm.toFixed(1)} km away · Google Places` }))
      : [];
  const hubLines: MapLine[] =
    showHubs && hubFrom && hubTo && trip.prefs.transport !== "bus"
      ? [{ id: "hub-link", from: hubFrom, to: hubTo, style: trip.prefs.transport === "flight" ? "air" : "rail" }]
      : [];

  const runOptimize = async () => {
    setOptimizing(true);
    try {
      const before = priceTrip(trip).total;
      const res = await optimize(trip.id);
      toast({
        tone: "success",
        title: res.savedMin > 0 || res.movedOutdoor > 0 ? `Saved ${duration(res.savedMin)} of travel` : "Your plan is already optimal",
        body: res.movedOutdoor ? `Moved ${res.movedOutdoor} outdoor plan${res.movedOutdoor > 1 ? "s" : ""} off a rainy day.` : `Route checked across ${days.length} days · price ${rupees(priceTrip(useTripStore.getState().trips[trip.id]!).total - before, { sign: true })}`,
      });
    } catch (e) {
      toast({ tone: "error", title: "Optimizer unavailable", body: e instanceof Error ? e.message : undefined });
    } finally {
      setOptimizing(false);
    }
  };

  const budgetOptimize = async () => {
    try {
      const before = priceTrip(trip).total;
      const res = await optimizeBudget(trip.id);
      const after = priceTrip(useTripStore.getState().trips[trip.id]!).total;
      const saved = before - after;
      const changesText = res.changes?.length ? res.changes.join(". ") : "Swapped stay and transport to fit your budget.";
      toast({
        tone: saved > 0 ? "success" : "info",
        title: saved > 0 ? `Saved ${rupees(saved)}` : "Already at best budget price",
        body: saved > 0 ? `New total: ${rupees(after)}. ${changesText}` : "Try manually swapping a stay or activity to reduce the price.",
      });
    } catch (e) {
      toast({ tone: "error", title: "Budget optimizer unavailable", body: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <div className="pb-24 lg:pb-8">
      <AnimatePresence>
        {showIntro && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="mb-5 flex items-center gap-4 overflow-hidden rounded-[28px] border-2 border-ink bg-mint p-4 shadow-pop">
            <Zippy mood="celebrate" size={64} className="shrink-0" />
            <div className="flex-1">
              <p className="font-display text-base font-extrabold">Your trip is ready!</p>
              <p className="text-sm text-ink-soft">Heart up to 5 Must-Dos, swap anything, move things around, the price updates live.</p>
            </div>
            <button onClick={() => setShowIntro(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/50" aria-label="Dismiss">
              <XIcon size={16} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <div className="relative overflow-hidden rounded-[32px] border-2 border-ink bg-white shadow-pop-lg">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 sm:block">
              <DestinationArt kind={dest?.art ?? "monument"} />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
            </div>
            <div className="relative p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">My trip · {trip.code}</p>
              <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{destTitle}</h1>
              <p className="mt-1 font-semibold text-ink-soft">
                {trip.prefs.nights + 1} Days • {trip.prefs.nights} Nights
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1">
                  <CalendarBlankIcon size={13} /> {formatDate(trip.prefs.startDate)} to {formatDate(endDate)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1">
                  <UsersIcon size={13} /> {travelers} traveler{travelers > 1 ? "s" : ""}
                </span>
              </div>
              <p className="mt-4 font-display text-2xl font-extrabold">
                <AnimatedNumber value={price.perPerson} format={(n) => rupees(n)} />
                <span className="text-sm font-semibold text-muted"> / person</span>
              </p>
              {!booked && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" href={`/plan/edit?trip=${trip.id}`} icon={<PencilSimpleIcon size={14} weight="bold" />}>
                    Edit trip
                  </Button>
                  <Button size="sm" variant="purple" onClick={runOptimize} loading={optimizing} icon={<MagicWandIcon size={14} weight="bold" />}>
                    {optimizing ? "Optimizing route…" : "Optimize"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {booked && (
            <div className="flex flex-wrap items-center gap-3 rounded-[24px] bg-sky-soft p-4 text-sm">
              <InfoIcon size={20} weight="duotone" className="text-sky-deep" />
              <p className="flex-1">This trip is booked, changes now go through vendor confirmation so nothing is half-updated.</p>
              <Button size="sm" href={`/my-trip/${trip.id}`}>Open My Trip</Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={tab}
              onValueChange={setTab}
              layoutId="plan-tabs"
              items={[
                { value: "itinerary", label: <><ListBulletsIcon size={16} /> Itinerary</> },
                { value: "map", label: <><MapTrifoldIcon size={16} /> Map</> },
                { value: "stay", label: <><BedIcon size={16} /> Stay & travel</> },
              ]}
            />
            <HeartCounter trip={trip} />
          </div>

          {tab === "itinerary" && (
            <div className="space-y-4">
              {days.map((d) => (
                <DayCard
                  key={d}
                  trip={trip}
                  day={d}
                  editor={booked ? undefined : editor}
                  readOnly={booked}
                  onAdd={(day) => sheets.setAdding(day)}
                  onOpen={sheets.setDetails}
                  onMove={sheets.setMoving}
                  onTime={sheets.setTiming}
                />
              ))}
            </div>
          )}

          {tab === "map" && (
            <Card pad="md">
              <div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setMapDay(0)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${mapDay === 0 ? "bg-ink text-white shadow-pop" : "bg-canvas hover:bg-line"}`}
                >
                  All Days
                </button>
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setMapDay(d)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${mapDay === d ? "bg-ink text-white shadow-pop" : "bg-canvas hover:bg-line"}`}
                  >
                    Day {d}
                  </button>
                ))}
              </div>
              {mapPoints.length || hubPoints.length ? (
                <RoutedMap key={trip.id} tripId={trip.id} day={mapDay} points={mapPoints} extraPoints={hubPoints} lines={hubLines} height={380} />
              ) : (
                <p className="py-10 text-center text-sm text-muted">No mapped stops on this day.</p>
              )}
              {showHubs && trip.prefs.transport !== "car" && originPt && (
                <p className="mt-2 text-[11px] text-muted" aria-live="polite">
                  {hubs.loading
                      ? "Finding nearby transport…"
                      : hubs.error
                        ? (
                          <>
                            {hubs.error}{" "}
                            <button type="button" onClick={hubs.retry} className="font-bold text-purple-deep underline">Retry</button>
                          </>
                        )
                        : hubFrom && hubTo
                          ? `${hubFrom.name} → ${hubTo.name}${hubs.data?.hubDistanceKm !== undefined ? ` · ${hubs.data.hubDistanceKm} km straight-line` : ""}`
                          : "No matching hub found near the origin or destination."}
                </p>
              )}
            </Card>
          )}

          {tab === "stay" && (
            <div className="space-y-4">
              {stay ? (
                <HotelCard s={stay} nights={trip.prefs.nights} rooms={price.rooms} />
              ) : (
                (() => {
                  const stayItem = trip.items.find((i) => i.kind === "checkin");
                  return stayItem ? (
                    <Card pad="md" className="flex items-center gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lavender"><BedIcon size={24} weight="duotone" /></div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple">Hotel · Stay</span>
                        <h4 className="text-base font-bold text-ink truncate">{stayItem.title}</h4>
                        <p className="text-xs text-muted truncate">{stayItem.location || stayItem.subtitle || destTitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-extrabold text-ink">{rupees(stayItem.unitCost)}</p>
                        <p className="text-[11px] text-muted">{trip.prefs.nights} nights</p>
                      </div>
                    </Card>
                  ) : null;
                })()
              )}
              {transport ? (
                <TransportRow t={transport} travelers={travelers} />
              ) : (
                (() => {
                  const trItem = trip.items.find((i) => ["flight", "train", "bus", "car"].includes(i.kind));
                  return trItem ? (
                    <Card pad="md" className="flex items-center gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint-soft">
                        {trItem.kind === "flight" ? <AirplaneTiltIcon size={24} weight="duotone" /> : trItem.kind === "train" ? <TrainIcon size={24} weight="duotone" /> : trItem.kind === "bus" ? <BusIcon size={24} weight="duotone" /> : <CarIcon size={24} weight="duotone" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-mint-deep">Travel</span>
                        <h4 className="text-base font-bold text-ink truncate">{trItem.title}</h4>
                        <p className="text-xs text-muted truncate">{trItem.location || trItem.subtitle || `${trip.prefs.fromCity} → ${destTitle}`}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-extrabold text-ink">{rupees(trItem.unitCost)}</p>
                        <p className="text-[11px] text-muted">per person</p>
                      </div>
                    </Card>
                  ) : null;
                })()
              )}
              {!booked && (
                <Button variant="outline" href={`/plan/edit?trip=${trip.id}`} icon={<PencilSimpleIcon size={16} weight="bold" />}>
                  Change stay, transport or travelers
                </Button>
              )}
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <Card variant="sticker" pad="lg">
              <p className="mb-2 font-display text-sm font-bold">Estimated Trip Cost</p>
              <PriceSummary price={price} range={priceRange} />
              <BudgetMeter price={price} className="mt-5" tripId={trip.id} onOptimize={booked ? undefined : budgetOptimize} />
              {!booked ? (
                <Button full size="lg" className="mt-5" onClick={() => router.push(`/checkout?trip=${trip.id}`)} icon={<ArrowRightIcon size={18} weight="bold" />}>
                  Review & book
                </Button>
              ) : (
                <Button full size="lg" className="mt-5" href={`/my-trip/${trip.id}`}>
                  View booking
                </Button>
              )}
            </Card>
          </div>
        </aside>
      </div>

      {/* Mobile price bar */}
      <div className="fixed inset-x-3 bottom-[5.5rem] z-30 flex items-center gap-3 rounded-[26px] border-2 border-ink bg-white p-2.5 pl-4 shadow-pop lg:hidden">
        <button onClick={() => setPriceOpen(true)} className="flex flex-1 items-center gap-2 text-left" aria-label="Show price breakdown">
          <div>
            <p className="font-display text-lg font-extrabold leading-none">
              <AnimatedNumber value={price.total} format={(n) => rupees(n)} />
            </p>
            <p className="text-[11px] text-muted">
              {rupees(price.perPerson)} / person · <span className={price.budgetStatus === "over" ? "text-danger" : "text-success"}>{price.budgetStatus === "over" ? "over budget" : "in budget"}</span>
            </p>
          </div>
          <CaretUpIcon size={16} className="text-muted" />
        </button>
        {!booked && (
          <Button onClick={() => router.push(`/checkout?trip=${trip.id}`)} icon={<ArrowRightIcon size={16} weight="bold" />}>
            Book
          </Button>
        )}
      </div>

      <Sheet open={priceOpen} onOpenChange={setPriceOpen} title="Price breakdown" description={`${trip.title} · ${travelers} travelers`}>
        <PriceSummary price={price} range={priceRange} />
        <BudgetMeter price={price} className="mt-5" tripId={trip.id} onOptimize={booked ? undefined : budgetOptimize} />
      </Sheet>

      <PriceTicker tripId={trip.id} />
      <ItemDetailsSheet trip={trip} item={sheets.details} onClose={() => sheets.setDetails(null)} editor={booked ? undefined : editor} />
      <MoveSheet trip={trip} item={sheets.moving} onClose={() => sheets.setMoving(null)} editor={editor} />
      <TimeSheet item={sheets.timing} onClose={() => sheets.setTiming(null)} editor={editor} />
      <AddSheet trip={trip} day={sheets.adding} onClose={() => sheets.setAdding(null)} editor={editor} />
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanInner />
    </Suspense>
  );
}
