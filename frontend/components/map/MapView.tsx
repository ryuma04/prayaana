"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as LeafletType from "leaflet";
import { cn, minToTime, duration } from "@/lib/format";
import { renderToStaticMarkup } from "react-dom/server";
import { Glyph } from "@/lib/icons";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  n?: number | string;
  tone?: "purple" | "coral" | "mint" | "sun" | "ink";
  active?: boolean;
  kind?: string;
  place?: string;
  address?: string;
  description?: string;
  status?: string;
  day?: number;
  startMin?: number;
  durationMin?: number;
  unitCost?: number;
}

/** A non-road connection, e.g. a flight between airports or a rail link between stations. */
export interface MapLine {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  style: "air" | "rail" | "road";
}

type MarkerType = "stay" | "food" | "activity" | "airport" | "rail" | "bus" | "transfer" | "place";

const MARKER: Record<MarkerType, { emoji: string; label: string }> = {
  stay: { emoji: "🏨", label: "Stay" },
  food: { emoji: "🍽️", label: "Food" },
  activity: { emoji: "🎯", label: "Activity" },
  airport: { emoji: "✈️", label: "Airport" },
  rail: { emoji: "🚆", label: "Rail" },
  bus: { emoji: "🚌", label: "Bus" },
  transfer: { emoji: "🚗", label: "Transfer" },
  place: { emoji: "📍", label: "Place" },
};

// Map pins draw the same icons as the rest of the app (as SVG inside the marker HTML).
const PIN_SVG = Object.fromEntries(
  (Object.keys(MARKER) as MarkerType[]).map((k) => [k, renderToStaticMarkup(<Glyph emoji={MARKER[k].emoji} size={16} color="#1c1b2b" />)]),
) as Record<MarkerType, string>;

/** Trip item kinds and hub kinds → the marker type shown on the map and in the legend. */
export function markerType(kind?: string): MarkerType {
  switch (kind) {
    case "checkin":
    case "checkout":
    case "rest":
    case "stay":
      return "stay";
    case "meal":
    case "food":
      return "food";
    case "activity":
    case "attraction":
      return "activity";
    case "flight":
    case "airport":
      return "airport";
    case "train":
    case "railway":
      return "rail";
    case "bus":
      return "bus";
    case "car":
    case "transfer":
    case "transport":
      return "transfer";
    default:
      return "place";
  }
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const isValid = (p: { lat: number; lng: number }) =>
  typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export interface MapMover {
  lat: number;
  lng: number;
  mode?: "car" | "flight" | "plane" | "train" | "bus" | "default" | "transfer" | "rail";
  angle?: number;
  label?: string;
}

/**
 * Leaflet map with OpenStreetMap tiles. Client-only (Leaflet is imported inside effects).
 * Every marker comes from `points`; with no points the map is not centred anywhere.
 */
export function MapView({
  points,
  route = true,
  geometry,
  lines,
  className,
  height = 360,
  mover,
  autoPan = false,
}: {
  points: MapPoint[];
  route?: boolean;
  geometry?: [number, number][];
  lines?: MapLine[];
  className?: string;
  height?: number;
  mover?: MapMover | { lat: number; lng: number };
  autoPan?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletType.Map | null>(null);
  const layersRef = useRef<LeafletType.Layer[]>([]);
  const moverRef = useRef<LeafletType.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);

  const validPoints = useMemo(() => points.filter(isValid), [points]);
  const validLines = useMemo(() => (lines ?? []).filter((l) => isValid(l.from) && isValid(l.to)), [lines]);
  const hasContent = validPoints.length > 0;

  const key = useMemo(
    () =>
      validPoints.map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${p.active ? 1 : 0}:${p.n ?? ""}`).join("|") +
      "#" +
      validLines.map((l) => `${l.id}:${l.style}`).join("|"),
    [validPoints, validLines],
  );
  const geoKey = geometry && geometry.length > 1 ? `${geometry.length}:${geometry[0].join(",")}:${geometry[geometry.length - 1].join(",")}` : "";

  // Create the map once there is something real to show.
  useEffect(() => {
    if (!hasContent || mapRef.current || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const first = validPoints[0];
      const map = L.map(containerRef.current, { center: [first.lat, first.lng], zoom: 12, zoomControl: true, attributionControl: true });
      let errors = 0;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      })
        .on("tileerror", () => {
          errors += 1;
          if (errors >= 6) setTileError(true);
        })
        .on("tileload", () => {
          errors = 0;
          setTileError(false);
        })
        .addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasContent, validPoints]);

  // Redraw markers and lines whenever the data changes; old layers are always removed first.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      layersRef.current.forEach((l) => l.remove());
      layersRef.current = [];
      if (!validPoints.length) return;

      validPoints.forEach((p) => {
        const t = MARKER[markerType(p.kind)];
        const size = p.active ? 36 : 30;
        const badge =
          p.n != null
            ? `<span style="position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;padding:0 3px;border-radius:999px;background:#1c1b2b;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;">${esc(p.n)}</span>`
            : "";
        const icon = L.divIcon({
          html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:999px;border:2px solid #1c1b2b;background:${p.active ? "#fad47f" : "#fff"};box-shadow:2px 2px 0 #1c1b2b;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;">${PIN_SVG[markerType(p.kind)]}${badge}</div>`,
          className: "trz-custom-marker",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2 - 4],
        });
        const meta = [
          p.startMin != null ? minToTime(p.startMin) : "",
          p.durationMin ? duration(p.durationMin) : "",
          p.unitCost ? `<span style="margin-left:auto;color:#23864b;font-weight:700;">₹${Math.round(p.unitCost).toLocaleString("en-IN")}</span>` : "",
        ]
          .filter(Boolean)
          .map((x) => (x.startsWith("<") ? x : `<span>${esc(x)}</span>`))
          .join("");
        const popup = `
          <div style="font-family:inherit;min-width:180px;max-width:240px;padding:2px;">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#7b5cf0;margin-bottom:2px;letter-spacing:.5px;">
              ${esc(t.label)}${p.day ? ` · Day ${esc(p.day)}` : ""}${p.status && p.status !== "planned" ? ` · ${esc(p.status)}` : ""}
            </div>
            <div style="font-size:13px;font-weight:700;color:#1c1b2b;margin-bottom:4px;line-height:1.25;">${esc(p.label)}</div>
            ${p.place ? `<div style="font-size:11px;color:#625f78;margin-bottom:2px;">${esc(p.place)}</div>` : ""}
            ${p.address && p.address !== p.place ? `<div style="font-size:11px;color:#625f78;margin-bottom:2px;">${esc(p.address)}</div>` : ""}
            ${p.description ? `<div style="font-size:11px;color:#3a3850;margin:4px 0;">${esc(p.description)}</div>` : ""}
            ${meta ? `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#3a3850;font-weight:600;border-top:1px solid #e8e2d6;padding-top:4px;margin-top:4px;">${meta}</div>` : ""}
          </div>`;
        layersRef.current.push(
          L.marker([p.lat, p.lng], { icon, keyboard: true, title: p.label })
            .bindPopup(popup, { maxWidth: 260, className: "trz-clay-popup" })
            .addTo(map),
        );
      });

      if (route) {
        if (geometry && geometry.length > 1) {
          layersRef.current.push(
            L.polyline(
              geometry.map(([lng, lat]) => [lat, lng] as [number, number]),
              { color: "#7b5cf0", weight: 4, opacity: 0.85, lineCap: "round", lineJoin: "round" },
            ).addTo(map),
          );
        } else {
          const stops = validPoints.filter((p) => !["airport", "rail", "bus"].includes(markerType(p.kind)));
          if (stops.length > 1)
            layersRef.current.push(
              L.polyline(stops.map((p) => [p.lat, p.lng] as [number, number]), { color: "#7b5cf0", weight: 3, dashArray: "6, 8", opacity: 0.8 }).addTo(map),
            );
        }
      }

      validLines.forEach((l) => {
        const style =
          l.style === "air"
            ? { color: "#1f7ae0", weight: 2.5, dashArray: "2, 8", opacity: 0.9 }
            : l.style === "rail"
              ? { color: "#1c1b2b", weight: 3, dashArray: "10, 6", opacity: 0.8 }
              : { color: "#e0692b", weight: 3, dashArray: "6, 6", opacity: 0.8 };
        layersRef.current.push(L.polyline([[l.from.lat, l.from.lng], [l.to.lat, l.to.lng]], style).addTo(map));
      });

      if (validPoints.length === 1) {
        map.setView([validPoints[0].lat, validPoints[0].lng], 14);
      } else {
        const bounds = L.latLngBounds(validPoints.map((p) => [p.lat, p.lng] as [number, number]));
        if (route && geometry && geometry.length > 1) geometry.forEach(([lng, lat]) => bounds.extend([lat, lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
      map.invalidateSize();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key/geoKey capture the data
  }, [ready, key, geoKey, route]);

  // Keep tiles correct when the container resizes (tabs, sidebars, window).
  useEffect(() => {
    if (!ready || !containerRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !mover || !isValid(mover)) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      const m = mover as MapMover;
      const mode = m.mode;
      const angle = Math.round(m.angle ?? 0);
      const label = m.label ? esc(m.label) : "";

      let iconHtml = `<div style="position:relative;width:20px;height:20px;"><div style="position:absolute;inset:0;border-radius:999px;background:#7b5cf0;opacity:.3;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;"></div><div style="position:absolute;inset:2px;border-radius:999px;background:#7b5cf0;border:2.5px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3);"></div></div>`;
      let iconSize: [number, number] = [20, 20];
      let iconAnchor: [number, number] = [10, 10];

      if (mode === "flight" || mode === "plane") {
        iconHtml = `
          <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-6px;border-radius:999px;background:rgba(31,122,224,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:42px;height:42px;border-radius:999px;background:linear-gradient(135deg, #2563eb, #1d4ed8);border:2.5px solid #ffffff;box-shadow:0 4px 16px rgba(37,99,235,0.5), 0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;transform:rotate(${angle}deg);transition:transform 0.15s ease;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style="display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
            ${label ? `<span style="position:absolute;top:-24px;white-space:nowrap;background:#1c1b2b;color:#ffffff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);pointer-events:none;">✈️ ${label}</span>` : ""}
          </div>`;
        iconSize = [52, 52];
        iconAnchor = [26, 26];
      } else if (mode === "car" || mode === "transfer") {
        iconHtml = `
          <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-6px;border-radius:999px;background:rgba(123,92,240,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:42px;height:42px;border-radius:999px;background:linear-gradient(135deg, #7b5cf0, #5c35df);border:2.5px solid #ffffff;box-shadow:0 4px 16px rgba(123,92,240,0.5), 0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;transform:rotate(${angle}deg);transition:transform 0.15s ease;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style="display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
            </div>
            ${label ? `<span style="position:absolute;top:-24px;white-space:nowrap;background:#1c1b2b;color:#ffffff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);pointer-events:none;">🚗 ${label}</span>` : ""}
          </div>`;
        iconSize = [52, 52];
        iconAnchor = [26, 26];
      } else if (mode === "train" || mode === "rail") {
        iconHtml = `
          <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-6px;border-radius:999px;background:rgba(234,88,12,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:42px;height:42px;border-radius:999px;background:linear-gradient(135deg, #ea580c, #c2410c);border:2.5px solid #ffffff;box-shadow:0 4px 16px rgba(234,88,12,0.5), 0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style="display:block;"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3.5-6H4V6c0-.85 1.76-2 8-2s8 1.15 8 2v5z"/></svg>
            </div>
            ${label ? `<span style="position:absolute;top:-24px;white-space:nowrap;background:#1c1b2b;color:#ffffff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);pointer-events:none;">🚆 ${label}</span>` : ""}
          </div>`;
        iconSize = [52, 52];
        iconAnchor = [26, 26];
      }

      const icon = L.divIcon({
        html: iconHtml,
        className: "trz-mover-pin",
        iconSize,
        iconAnchor,
      });

      if (!moverRef.current) {
        moverRef.current = L.marker([mover.lat, mover.lng], { icon, zIndexOffset: 1000 }).addTo(mapRef.current);
      } else {
        moverRef.current.setIcon(icon);
        moverRef.current.setLatLng([mover.lat, mover.lng]);
      }

      if (autoPan && mapRef.current) {
        const bounds = mapRef.current.getBounds();
        if (!bounds.contains([mover.lat, mover.lng])) {
          mapRef.current.panTo([mover.lat, mover.lng], { animate: true, duration: 0.5 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, mover, autoPan]);

  useEffect(
    () => () => {
      moverRef.current?.remove();
      moverRef.current = null;
      layersRef.current.forEach((l) => l.remove());
      layersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  const legend = useMemo(() => {
    const seen = new Set<MarkerType>();
    validPoints.forEach((p) => seen.add(markerType(p.kind)));
    return [...seen];
  }, [validPoints]);

  return (
    <div className={cn("relative overflow-hidden rounded-[26px] border-2 border-ink bg-sky-soft shadow-pop", className)} style={{ height }}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Trip map" role="region" />

      {hasContent && !ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm font-semibold text-muted">Loading map…</div>
      )}

      {!hasContent && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-canvas/80 p-4 text-center">
          <span className="mb-1 text-2xl">🗺️</span>
          <p className="font-display text-sm font-bold text-ink">No mapped locations for this selection</p>
          <p className="mt-0.5 text-xs text-muted">Switch days or check trip details</p>
        </div>
      )}

      {tileError && (
        <div role="alert" className="absolute inset-x-2 top-2 z-[500] rounded-xl bg-coral-soft px-3 py-1.5 text-center text-xs font-semibold text-ink shadow-clay-sm">
          Map tiles couldn&apos;t load. Check your connection. Markers are still accurate.
        </div>
      )}

      {legend.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[400] flex flex-wrap items-center justify-center gap-2 rounded-xl border border-ink/20 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-ink shadow-clay-sm backdrop-blur-sm">
          {legend.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <Glyph emoji={MARKER[t].emoji} size={12} /> {MARKER[t].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
