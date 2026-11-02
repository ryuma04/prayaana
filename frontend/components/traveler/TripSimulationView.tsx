"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  PlayIcon,
  PauseIcon,
  ArrowCounterClockwiseIcon,
  CarIcon,
  AirplaneTiltIcon,
  TrainIcon,
  SparkleIcon,
  ClockIcon,
  MapPinIcon,
  NavigationArrowIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { MapView, type MapLine, type MapMover, type MapPoint } from "@/components/map/MapView";
import { destinationMap } from "@/data/destinations";
import { activityMap, stayMap } from "@/data/catalog";
import { minToTime, haversineKm, cn } from "@/lib/format";
import type { Trip, TripItem } from "@/types";

interface GatewayAirport {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

const GATEWAY_AIRPORTS: Record<string, GatewayAirport> = {
  udaipur: { code: "UDR", name: "Maharana Pratap Airport (UDR)", lat: 24.6177, lng: 73.8961 },
  darjeeling: { code: "IXB", name: "Bagdogra Airport (IXB)", lat: 26.6812, lng: 88.3286 },
  goa: { code: "GOX", name: "Manohar International Airport (GOX)", lat: 15.7667, lng: 73.8667 },
  jaipur: { code: "JAI", name: "Jaipur International Airport (JAI)", lat: 26.8242, lng: 75.8122 },
  manali: { code: "KUU", name: "Kullu-Manali Airport (KUU)", lat: 31.8763, lng: 77.1542 },
  munnar: { code: "COK", name: "Cochin International Airport (COK)", lat: 10.1556, lng: 76.3908 },
  kochi: { code: "COK", name: "Cochin International Airport (COK)", lat: 10.1556, lng: 76.3908 },
  varanasi: { code: "VNS", name: "Lal Bahadur Shastri Airport (VNS)", lat: 25.4497, lng: 82.8587 },
  rishikesh: { code: "DED", name: "Jolly Grant Airport (DED)", lat: 30.1897, lng: 78.1803 },
  leh: { code: "IXL", name: "Kushok Bakula Rimpochee Airport (IXL)", lat: 34.1359, lng: 77.5465 },
  delhi: { code: "DEL", name: "Indira Gandhi International Airport (DEL)", lat: 28.5562, lng: 77.1000 },
  mumbai: { code: "BOM", name: "Chhatrapati Shivaji Maharaj Airport (BOM)", lat: 19.0896, lng: 72.8656 },
  bengaluru: { code: "BLR", name: "Kempegowda International Airport (BLR)", lat: 13.1986, lng: 77.7066 },
  kolkata: { code: "CCU", name: "Netaji Subhash Chandra Bose Airport (CCU)", lat: 22.6547, lng: 88.4467 },
  shillong: { code: "GAU", name: "Guwahati Airport (GAU)", lat: 26.1061, lng: 91.5859 },
  hampi: { code: "VDY", name: "Jindal Vijaynagar Airport (VDY)", lat: 15.1633, lng: 76.6433 },
};

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export interface SimWaypoint {
  lat: number;
  lng: number;
  angle: number;
  mode: "car" | "flight" | "train" | "bus";
  title: string;
  detail: string;
  day: number;
  progressPercent: number;
}

export function TripSimulationView({
  trip,
  className,
  height = 420,
  autoPlay = false,
}: {
  trip: Trip;
  className?: string;
  height?: number;
  autoPlay?: boolean;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [stepIdx, setStepIdx] = useState(0);

  // 1. Build Journey Legs and Waypoints
  const { waypoints, mapPoints, mapLines } = useMemo(() => {
    const rawItems = [...(trip.items || [])]
      .filter((i) => i.status !== "cancelled")
      .sort((a, b) => a.day - b.day || a.startMin - b.startMin);

    // Identify destinations involved
    const dIds: string[] = trip.destinations?.length
      ? trip.destinations
      : [trip.destinationId].filter(Boolean);

    // Coordinate resolution helper
    const resolveCoords = (item: TripItem): { lat: number; lng: number } => {
      if (typeof item.lat === "number" && typeof item.lng === "number" && item.lat !== 0 && item.lng !== 0) {
        return { lat: item.lat, lng: item.lng };
      }
      if (item.refId && activityMap[item.refId]?.lat) {
        const a = activityMap[item.refId];
        return { lat: a.lat, lng: a.lng };
      }
      if (item.refId && stayMap[item.refId]?.lat) {
        const s = stayMap[item.refId];
        return { lat: s.lat, lng: s.lng };
      }
      const d = destinationMap[trip.destinationId] || destinationMap[dIds[0]];
      return d ? { lat: d.lat, lng: d.lng } : { lat: 24.5854, lng: 73.7125 };
    };

    const pts: MapPoint[] = [];
    const lines: MapLine[] = [];

    // Distinct segments to traverse
    interface RawSegment {
      from: { lat: number; lng: number; title: string };
      to: { lat: number; lng: number; title: string };
      mode: "car" | "flight" | "train" | "bus";
      title: string;
      detail: string;
      day: number;
    }
    const segments: RawSegment[] = [];

    // Case A: Multi-destination trip (e.g. Udaipur -> Darjeeling)
    const isMultiDest = dIds.length >= 2;
    const dest1 = dIds[0];
    const dest2 = dIds[1];
    const apt1 = GATEWAY_AIRPORTS[dest1] || { code: "UDR", name: `${destinationMap[dest1]?.name || dest1} Airport`, lat: destinationMap[dest1]?.lat ? destinationMap[dest1].lat + 0.05 : 24.6177, lng: destinationMap[dest1]?.lng ? destinationMap[dest1].lng + 0.1 : 73.8961 };
    const apt2 = isMultiDest ? (GATEWAY_AIRPORTS[dest2] || { code: "IXB", name: `${destinationMap[dest2]?.name || dest2} Airport`, lat: destinationMap[dest2]?.lat ? destinationMap[dest2].lat - 0.2 : 26.6812, lng: destinationMap[dest2]?.lng ? destinationMap[dest2].lng + 0.05 : 88.3286 }) : null;

    // Filter items with valid locations
    const validItems = rawItems.map((item) => ({ item, coords: resolveCoords(item) }));

    if (isMultiDest && apt1 && apt2) {
      // Split items by destination
      const midDay = Math.ceil((trip.prefs?.nights ? trip.prefs.nights + 1 : 7) / 2);
      const itemsDest1 = validItems.filter((x) => x.item.day <= midDay);
      const itemsDest2 = validItems.filter((x) => x.item.day > midDay);

      // Add map points for Dest 1
      itemsDest1.forEach(({ item, coords }, i) => {
        pts.push({
          id: item.id,
          lat: coords.lat,
          lng: coords.lng,
          label: item.title,
          n: i + 1,
          kind: item.kind,
          day: item.day,
        });
      });

      // Airport 1 marker
      pts.push({
        id: "apt-1",
        lat: apt1.lat,
        lng: apt1.lng,
        label: apt1.name,
        n: "✈️",
        kind: "airport",
      });

      // Airport 2 marker
      pts.push({
        id: "apt-2",
        lat: apt2.lat,
        lng: apt2.lng,
        label: apt2.name,
        n: "✈️",
        kind: "airport",
      });

      // Add map points for Dest 2
      itemsDest2.forEach(({ item, coords }, i) => {
        pts.push({
          id: item.id,
          lat: coords.lat,
          lng: coords.lng,
          label: item.title,
          n: itemsDest1.length + i + 1,
          kind: item.kind,
          day: item.day,
        });
      });

      // Build Leg 1: Dest 1 local drives (Car 🚗)
      for (let i = 0; i < itemsDest1.length - 1; i++) {
        const a = itemsDest1[i];
        const b = itemsDest1[i + 1];
        segments.push({
          from: { lat: a.coords.lat, lng: a.coords.lng, title: a.item.title },
          to: { lat: b.coords.lat, lng: b.coords.lng, title: b.item.title },
          mode: "car",
          title: `Drive to ${b.item.title}`,
          detail: `Local transfer in ${destinationMap[dest1]?.name || "Destination"} · Day ${b.item.day}`,
          day: b.item.day,
        });
      }

      // Leg 2: Drive from last Dest 1 item to Airport 1 (Car 🚗)
      const last1 = itemsDest1[itemsDest1.length - 1] || { coords: { lat: 24.5854, lng: 73.7125 }, item: { title: "Udaipur Center", day: midDay } };
      segments.push({
        from: { lat: last1.coords.lat, lng: last1.coords.lng, title: last1.item.title },
        to: { lat: apt1.lat, lng: apt1.lng, title: apt1.name },
        mode: "car",
        title: `Transfer to ${apt1.name}`,
        detail: `Highway drive to airport for flight departure`,
        day: midDay,
      });

      // Leg 3: FLIGHT from Airport 1 to Airport 2 (Airplane ✈️)
      const flightDistance = Math.round(haversineKm({ lat: apt1.lat, lng: apt1.lng }, { lat: apt2.lat, lng: apt2.lng }));
      segments.push({
        from: { lat: apt1.lat, lng: apt1.lng, title: apt1.name },
        to: { lat: apt2.lat, lng: apt2.lng, title: apt2.name },
        mode: "flight",
        title: `Flight: ${apt1.code} → ${apt2.code}`,
        detail: `Cruising altitude 32,000 ft · ${flightDistance} km direct aerial link`,
        day: midDay + 1,
      });

      // Flight route dashed line
      lines.push({
        id: "intercity-flight",
        from: { lat: apt1.lat, lng: apt1.lng },
        to: { lat: apt2.lat, lng: apt2.lng },
        style: "air",
      });

      // Leg 4: Drive from Airport 2 into Dest 2 (Car 🚗)
      const first2 = itemsDest2[0] || { coords: { lat: 27.0410, lng: 88.2663 }, item: { title: "Darjeeling Hotel", day: midDay + 1 } };
      segments.push({
        from: { lat: apt2.lat, lng: apt2.lng, title: apt2.name },
        to: { lat: first2.coords.lat, lng: first2.coords.lng, title: first2.item.title },
        mode: "car",
        title: `Scenic Transfer to ${first2.item.title}`,
        detail: `Mountain road transit into ${destinationMap[dest2]?.name || "Darjeeling"}`,
        day: midDay + 1,
      });

      // Leg 5: Dest 2 local drives (Car 🚗)
      for (let i = 0; i < itemsDest2.length - 1; i++) {
        const a = itemsDest2[i];
        const b = itemsDest2[i + 1];
        segments.push({
          from: { lat: a.coords.lat, lng: a.coords.lng, title: a.item.title },
          to: { lat: b.coords.lat, lng: b.coords.lng, title: b.item.title },
          mode: "car",
          title: `Drive to ${b.item.title}`,
          detail: `Local sightseeing · Day ${b.item.day}`,
          day: b.item.day,
        });
      }
    } else {
      // Single Destination with optional flight transfer
      const originCity = trip.prefs?.fromCity || "Delhi";
      const originApt = GATEWAY_AIRPORTS[originCity.toLowerCase()] || { code: "DEL", name: `${originCity} Gateway`, lat: 28.5562, lng: 77.1000 };
      const destApt = GATEWAY_AIRPORTS[trip.destinationId] || { code: "DST", name: `${destinationMap[trip.destinationId]?.name || "Destination"} Airport`, lat: (destinationMap[trip.destinationId]?.lat || 24.58) + 0.1, lng: (destinationMap[trip.destinationId]?.lng || 73.71) + 0.1 };

      pts.push({
        id: "origin-apt",
        lat: originApt.lat,
        lng: originApt.lng,
        label: originApt.name,
        n: "🛫",
        kind: "airport",
      });

      pts.push({
        id: "dest-apt",
        lat: destApt.lat,
        lng: destApt.lng,
        label: destApt.name,
        n: "🛬",
        kind: "airport",
      });

      validItems.forEach(({ item, coords }, i) => {
        pts.push({
          id: item.id,
          lat: coords.lat,
          lng: coords.lng,
          label: item.title,
          n: i + 1,
          kind: item.kind,
          day: item.day,
        });
      });

      // Leg 1: Flight from Origin to Destination (Plane ✈️)
      segments.push({
        from: { lat: originApt.lat, lng: originApt.lng, title: originApt.name },
        to: { lat: destApt.lat, lng: destApt.lng, title: destApt.name },
        mode: "flight",
        title: `Outbound Flight: ${originApt.code} → ${destApt.code}`,
        detail: `Journey starts with an air flight into ${destinationMap[trip.destinationId]?.name || "Destination"}`,
        day: 1,
      });

      lines.push({
        id: "flight-inbound",
        from: { lat: originApt.lat, lng: originApt.lng },
        to: { lat: destApt.lat, lng: destApt.lng },
        style: "air",
      });

      // Leg 2: Airport Cab into first activity (Car 🚗)
      if (validItems.length > 0) {
        segments.push({
          from: { lat: destApt.lat, lng: destApt.lng, title: destApt.name },
          to: { lat: validItems[0].coords.lat, lng: validItems[0].coords.lng, title: validItems[0].item.title },
          mode: "car",
          title: `Airport Transfer to ${validItems[0].item.title}`,
          detail: `Private cab pickup from terminal`,
          day: 1,
        });
      }

      // Leg 3: Local activities (Car 🚗)
      for (let i = 0; i < validItems.length - 1; i++) {
        const a = validItems[i];
        const b = validItems[i + 1];
        segments.push({
          from: { lat: a.coords.lat, lng: a.coords.lng, title: a.item.title },
          to: { lat: b.coords.lat, lng: b.coords.lng, title: b.item.title },
          mode: b.item.kind === "flight" ? "flight" : b.item.kind === "train" ? "train" : "car",
          title: `Transfer to ${b.item.title}`,
          detail: `Day ${b.item.day} · ${minToTime(b.item.startMin)}`,
          day: b.item.day,
        });
      }
    }

    // Now interpolate dense waypoints along each segment
    const allWp: SimWaypoint[] = [];
    const totalSegs = Math.max(1, segments.length);

    segments.forEach((seg, segIdx) => {
      const steps = seg.mode === "flight" ? 60 : 35; // more steps for flight arc
      const isFlight = seg.mode === "flight";

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let lat = seg.from.lat + (seg.to.lat - seg.from.lat) * t;
        let lng = seg.from.lng + (seg.to.lng - seg.from.lng) * t;

        // Flight great-circle curve arc
        if (isFlight) {
          const arcLift = Math.sin(t * Math.PI) * 1.6;
          lat += arcLift;
        }

        allWp.push({
          lat,
          lng,
          angle: 0, // computed below
          mode: seg.mode,
          title: seg.title,
          detail: seg.detail,
          day: seg.day,
          progressPercent: Math.round(((segIdx + t) / totalSegs) * 100),
        });
      }
    });

    // Compute smooth bearing angles
    for (let i = 0; i < allWp.length; i++) {
      const next = allWp[i + 1] ?? allWp[i];
      const prev = allWp[i - 1] ?? allWp[i];
      if (allWp[i].lat !== next.lat || allWp[i].lng !== next.lng) {
        allWp[i].angle = calculateBearing(allWp[i].lat, allWp[i].lng, next.lat, next.lng);
      } else if (prev.lat !== allWp[i].lat || prev.lng !== allWp[i].lng) {
        allWp[i].angle = calculateBearing(prev.lat, prev.lng, allWp[i].lat, allWp[i].lng);
      }
    }

    return {
      waypoints: allWp,
      mapPoints: pts,
      mapLines: lines,
    };
  }, [trip]);

  // 2. Animation loop
  useEffect(() => {
    if (!playing || waypoints.length === 0) return;
    const intervalMs = Math.round(55 / speed);
    const timer = setInterval(() => {
      setStepIdx((prev) => {
        if (prev + 1 >= waypoints.length) {
          return 0; // loop back seamlessly
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [playing, speed, waypoints.length]);

  const currentWp = waypoints[stepIdx] || waypoints[0];

  // Current mover object for Leaflet
  const mover: MapMover | undefined = currentWp
    ? {
        lat: currentWp.lat,
        lng: currentWp.lng,
        mode: currentWp.mode,
        angle: currentWp.angle,
        label: currentWp.mode === "flight" ? "In Flight ✈️" : "On the road 🚗",
      }
    : undefined;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setStepIdx(Math.max(0, Math.min(waypoints.length - 1, val)));
  };

  const handleReset = () => {
    setStepIdx(0);
    setPlaying(false);
  };

  return (
    <div className={cn("overflow-hidden rounded-[28px] border-2 border-ink bg-white shadow-clay", className)}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-line bg-lavender-soft/40 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple text-white shadow-pop">
            <SparkleIcon size={18} weight="fill" />
          </span>
          <div>
            <h3 className="font-display text-base font-extrabold text-ink">Trip Journey Simulation</h3>
            <p className="text-xs text-muted">
              Live car & airplane movement across your {trip.title || "trip itinerary"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed pills */}
          <div className="flex items-center rounded-full border border-line bg-white p-0.5 shadow-sm">
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold transition",
                  speed === s ? "bg-purple text-white shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:bg-line"
            title="Reset to beginning"
            aria-label="Reset simulation"
          >
            <ArrowCounterClockwiseIcon size={15} weight="bold" />
          </button>

          {/* Play / Pause toggle */}
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold shadow-pop transition",
              playing
                ? "bg-amber-400 text-ink hover:bg-amber-300"
                : "bg-purple text-white hover:bg-purple-deep",
            )}
          >
            {playing ? (
              <>
                <PauseIcon size={14} weight="fill" /> Pause
              </>
            ) : (
              <>
                <PlayIcon size={14} weight="fill" /> Simulate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Map display */}
      <div className="relative">
        <MapView
          points={mapPoints}
          lines={mapLines}
          mover={mover}
          height={height}
          autoPan={playing}
        />

        {/* Live floating overlay card */}
        <AnimatePresence mode="wait">
          {currentWp && (
            <motion.div
              key={`${currentWp.mode}-${currentWp.title}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-4 left-4 right-4 z-[500] max-w-md rounded-2xl border-2 border-ink bg-white/95 p-3.5 shadow-pop backdrop-blur sm:left-6"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm",
                      currentWp.mode === "flight"
                        ? "bg-blue-600"
                        : currentWp.mode === "train"
                          ? "bg-orange-600"
                          : "bg-purple",
                    )}
                  >
                    {currentWp.mode === "flight" ? (
                      <AirplaneTiltIcon size={16} weight="fill" />
                    ) : currentWp.mode === "train" ? (
                      <TrainIcon size={16} weight="fill" />
                    ) : (
                      <CarIcon size={16} weight="fill" />
                    )}
                  </span>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
                    {currentWp.mode === "flight" ? "In Flight Segment" : "Road Transit"} · Day {currentWp.day}
                  </span>
                </div>
                <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink">
                  {currentWp.progressPercent}%
                </span>
              </div>

              <div className="mt-2">
                <p className="font-display text-sm font-black text-ink">{currentWp.title}</p>
                <p className="truncate text-xs text-muted">{currentWp.detail}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scrubber & Controls Footer */}
      <div className="space-y-3 bg-white p-4">
        {/* Progress track */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-muted">
            <span className="flex items-center gap-1">
              <MapPinIcon size={12} weight="bold" /> Start Point
            </span>
            <span>{currentWp?.progressPercent ?? 0}% completed</span>
            <span className="flex items-center gap-1">
              <CheckCircleIcon size={12} weight="bold" /> Final Destination
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, waypoints.length - 1)}
            value={stepIdx}
            onChange={handleSeek}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-line accent-purple transition focus:outline-none"
            aria-label="Simulation progress scrub"
          />
        </div>

        {/* Legend pills */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-purple-deep">
            <span className="h-3 w-3 rounded-full bg-purple" />
            🚗 Car Transfer
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-blue-600">
            <span className="h-3 w-3 rounded-full bg-blue-600" />
            ✈️ Flight Link
          </span>
          <span className="ml-auto text-[11px] text-muted">
            {mapPoints.length} stops & airports connected
          </span>
        </div>
      </div>
    </div>
  );
}
