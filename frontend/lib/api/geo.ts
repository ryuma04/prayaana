"use client";
import type { DayForecast, DestinationId } from "@/types";
import { get } from "./client";

// Outside data through the Go API (keys never reach the browser): Open-Meteo weather,
// OSRM road routes, Aviationstack flight status and Google Places.

export interface WeatherFeed {
  source: "open-meteo" | "climate";
  updatedAt?: string;
  error?: string;
  attribution: string;
  destinations: Record<string, (DayForecast & { date: string })[]>;
}

export const getWeather = () => get<WeatherFeed>("/weather", { anonymous: true });

export interface RouteLeg {
  distanceKm: number;
  durationMin: number;
}

export interface TripRoute {
  source: "osrm" | "estimate";
  day: number;
  distanceKm: number;
  durationMin: number;
  /** [lng, lat] pairs for MapLibre. */
  geometry: [number, number][];
  legs: RouteLeg[];
  /** Trip item ids, in route order (one per leg start). */
  stops: string[];
}

export const getTripRoute = (tripId: string, day: number) => get<TripRoute>(`/trips/${encodeURIComponent(tripId)}/route?day=${day}`);

export interface FlightPoint {
  airport: string;
  iata: string;
  scheduled?: string;
  estimated?: string;
  actual?: string;
  terminal?: string;
  gate?: string;
  delayMin: number;
}

export interface FlightLeg {
  itemId: string;
  leg: "outbound" | "return";
  flight: string;
  airline: string;
  date: string;
  status: string;
  delayMin: number;
  departure: FlightPoint;
  arrival: FlightPoint;
  source: "aviationstack" | "timetable";
  live: boolean;
  fetchedAt: string;
  note?: string;
}

export const getTripFlights = (tripId: string) => get<{ provider: string; flights: FlightLeg[] }>(`/trips/${encodeURIComponent(tripId)}/flights`);

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  reviews?: number;
  type?: string;
  openNow?: boolean;
  mapsUrl?: string;
  distanceKm?: number;
}

export type PlaceCategory = "sights" | "food" | "cafe" | "medical" | "atm" | "fuel";

export function getPlaces(destinationId: DestinationId, category: PlaceCategory, near?: { lat: number; lng: number }) {
  const q = new URLSearchParams({ destination: destinationId, category });
  if (near) {
    q.set("lat", near.lat.toFixed(5));
    q.set("lng", near.lng.toFixed(5));
  }
  return get<{ source: "google-places" | "catalog"; query: string; places: Place[] }>(`/places?${q}`);
}

export interface PlaceAutocompleteResult {
  placeId: string;
  text: string;
  primaryText: string;
  secondaryText: string;
}

export const getPlaceAutocomplete = async (input: string): Promise<PlaceAutocompleteResult[]> => {
  type Raw = Partial<PlaceAutocompleteResult> & { id?: string; description?: string; name?: string; mainText?: string; secondary?: string };
  const res = await get<{ predictions?: Raw[] } | Raw[]>(
    `/places/autocomplete?q=${encodeURIComponent(input)}&input=${encodeURIComponent(input)}`,
    { anonymous: true }
  );
  const list = Array.isArray(res) ? res : res?.predictions || [];
  return list.map((item: Raw) => ({
    placeId: item.placeId || item.id || "",
    text: item.text || item.description || item.name || "",
    primaryText: item.primaryText || item.mainText || item.name || "",
    secondaryText: item.secondaryText || item.secondary || "",
  }));
};

export interface PlaceDetailsResult {
  id: string;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
  rating?: number;
  userRatingCount?: number;
  mapsUrl?: string;
}

export const getPlaceDetails = (id: string) =>
  get<PlaceDetailsResult>(`/places/details?id=${encodeURIComponent(id)}`, { anonymous: true });

export interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  resolved: boolean;
  city: string;
  state?: string;
  country?: string;
  placeId?: string;
  formattedAddress?: string;
  source?: string;
  error?: string;
}

/** The real locality at a coordinate. resolved=false means it could not be named — show the coordinates. */
export const getReverseGeocode = (lat: number, lng: number) =>
  get<ReverseGeocodeResult>(`/places/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { anonymous: true });

export interface TransportHub {
  type: "airport" | "railway" | "bus";
  placeId: string;
  name: string;
  distanceKm: number;
  address?: string;
  lat: number;
  lng: number;
  reviews?: number;
  mapsUrl?: string;
  source: string;
}

export interface HubSide {
  lat: number;
  lng: number;
  hubs: TransportHub[];
  error?: string;
}

export interface ModeHubsResponse {
  mode: "flight" | "train" | "bus";
  type: TransportHub["type"];
  origin: HubSide;
  destination: HubSide;
  straightLineKm: number;
  hubDistanceKm?: number;
  source: string;
}

/** Real hubs (Google Places, via the API) near origin and destination for one public mode. */
export function getModeHubs(mode: "flight" | "train" | "bus", from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const q = new URLSearchParams({
    mode,
    fromLat: from.lat.toFixed(5),
    fromLng: from.lng.toFixed(5),
    toLat: to.lat.toFixed(5),
    toLng: to.lng.toFixed(5),
  });
  return get<ModeHubsResponse>(`/transport/hubs?${q}`, { anonymous: true });
}

export function getWeatherCoords(lat: number, lng: number, days = 7) {
  return get<{ source: string; attribution: string; forecast: (DayForecast & { date: string })[] }>(
    `/weather?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&days=${days}`,
    { anonymous: true }
  );
}
