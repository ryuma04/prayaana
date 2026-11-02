import type { Activity, Destination, Stay, TeamMember, TransportOption, Vendor } from "@/types";

/**
 * The operator's catalog, loaded from the Go API (GET /catalog) by <CatalogGate> before any
 * screen renders, and cached on the device for the Offline Trip Pass. There is no copy of the
 * catalog in the frontend: these bindings are empty until the API answers.
 */
export interface CatalogData {
  operator: string;
  destinations: Destination[];
  activities: Activity[];
  stays: Stay[];
  transport: TransportOption[];
  vendors: Vendor[];
  team: TeamMember[];
  coordinatorFor: Record<string, string>;
}

export let OPERATOR_COMPANY = "";
export let destinations: Destination[] = [];
export let destinationMap: Record<string, Destination> = {};
export let activities: Activity[] = [];
export let activityMap: Record<string, Activity> = {};
export let stays: Stay[] = [];
export let stayMap: Record<string, Stay> = {};
export let transportOptions: TransportOption[] = [];
export let transportMap: Record<string, TransportOption> = {};
export let vendors: Vendor[] = [];
export let vendorMap: Record<string, Vendor> = {};
export let team: TeamMember[] = [];
export let coordinatorFor: Record<string, string> = {};

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x])) as Record<string, T>;

export function hydrateCatalog(d: CatalogData) {
  OPERATOR_COMPANY = d.operator;
  destinations = d.destinations ?? [];
  destinationMap = byId(destinations);
  activities = d.activities ?? [];
  activityMap = byId(activities);
  stays = d.stays ?? [];
  stayMap = byId(stays);
  transportOptions = d.transport ?? [];
  transportMap = byId(transportOptions);
  vendors = (d.vendors ?? []).map((v) => ({ ...v, history: v.history ?? [] }));
  vendorMap = byId(vendors);
  team = d.team ?? [];
  coordinatorFor = d.coordinatorFor ?? {};
}

/** Merges operator-only vendor details (contacts, request stats) loaded in the console. */
export function mergeVendors(list: Vendor[]) {
  for (const v of list) vendorMap[v.id] = { ...vendorMap[v.id], ...v };
  vendors = vendors.map((v) => vendorMap[v.id] ?? v);
}

export const activitiesFor = (destinationId: string) => activities.filter((a) => a.destinationId === destinationId);
export const staysFor = (destinationId: string) => stays.filter((s) => s.destinationId === destinationId);
export const transportFor = (destinationId: string) => transportOptions.filter((t) => t.destinationId === destinationId);

/** The destination's local cab partner (airport pickups, day cabs). */
export const cabVendorFor = (destinationId: string) => vendors.find((v) => v.kind === "local" && v.destinationId === destinationId)?.id ?? "";

export const coordinatorOf = (destinationId: string) => team.find((m) => m.id === coordinatorFor[destinationId]);

/** Catalog rating for scoring: the real Google rating when known, a neutral 4.3 otherwise (same rule as the server). */
export const rated = (r: number | undefined) => (r && r > 0 ? r : 4.3);
