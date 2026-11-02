"use client";
import { useQuery } from "@tanstack/react-query";
import { getDestination, listDestinations } from "@/lib/api/catalog";
import { getVendorDetail, listVendors } from "@/lib/api/vendors";
import { listCustomers, listTeam } from "@/lib/api/ops";
import { get } from "@/lib/api/client";
import { getPlaces, getTripFlights, getTripRoute, type PlaceCategory } from "@/lib/api/geo";
import type { DestinationId } from "@/types";

export const useDestinations = () => useQuery({ queryKey: ["destinations"], queryFn: listDestinations });
export const useDestinationDetail = (id: string) => useQuery({ queryKey: ["destination", id], queryFn: () => getDestination(id), enabled: !!id });
export const useVendors = () => useQuery({ queryKey: ["vendors"], queryFn: listVendors });
export const useVendor = (id: string) => useQuery({ queryKey: ["vendor", id], queryFn: () => getVendorDetail(id), enabled: !!id });
export const useCustomers = () => useQuery({ queryKey: ["customers"], queryFn: listCustomers, staleTime: 30_000 });

/** Real road route for a trip day (OSRM via the API); `key` changes when the day's stops change. */
export const useTripRoute = (tripId: string | undefined, day: number, key = "") =>
  useQuery({ queryKey: ["route", tripId, day, key], queryFn: () => getTripRoute(tripId!, day), enabled: !!tripId && day > 0 && !tripId.startsWith("sample"), staleTime: 10 * 60_000 });

/** Flight status for a trip (Aviationstack via the API, cached server-side; never polled). */
export const useTripFlights = (tripId: string | undefined, enabled = true) =>
  useQuery({ queryKey: ["flights", tripId], queryFn: () => getTripFlights(tripId!), enabled: !!tripId && enabled, staleTime: 30 * 60_000, retry: 0 });

/** Nearby places (Google Places via the API, catalog fallback). */
export const usePlaces = (destinationId: DestinationId | undefined, category: PlaceCategory, near?: { lat: number; lng: number }) =>
  useQuery({
    queryKey: ["places", destinationId, category, near?.lat.toFixed(3), near?.lng.toFixed(3)],
    queryFn: () => getPlaces(destinationId!, category, near),
    enabled: !!destinationId,
    staleTime: 60 * 60_000,
  });

/** The travel company's name (GET /meta). */
export const useOperatorName = () => useQuery({ queryKey: ["meta"], queryFn: () => get<{ operator?: string }>("/meta", { anonymous: true }), staleTime: Infinity }).data?.operator ?? "";

/** Guides and coordinators (GET /ops/team). */
export const useTeam = () => useQuery({ queryKey: ["team"], queryFn: listTeam, staleTime: 60_000 });
