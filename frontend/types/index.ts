// Core domain types for Trizpyy. These mirror the backend tables described in
// allaboutourproject.md §18 so the mock service layer can be swapped for the Go API.

export type DestinationId = string;

export type Interest =
  | "nature"
  | "adventure"
  | "culture"
  | "food"
  | "luxury"
  | "social"
  | "relax"
  | "photo";

export type Tone = "pink" | "lavender" | "mint" | "sun" | "sky" | "coral" | "cream";

export type ArtKind =
  | "beach"
  | "mountain"
  | "fort"
  | "houseboat"
  | "river"
  | "desert"
  | "island"
  | "lake";

export type Pace = "relaxed" | "balanced" | "packed";
export type StayType = "hostel" | "budget" | "boutique" | "homestay" | "luxury";
export type TransportMode = "flight" | "train" | "bus" | "car";
export type Slot = "morning" | "afternoon" | "evening";
export type Walking = "low" | "medium" | "high";

export interface DayForecast {
  day: number; // offset from today (0 = today)
  tempC: number;
  condition: "sunny" | "cloudy" | "rain" | "storm" | "snow" | "clear";
  rainChance: number;
  /** "open-meteo" for a live forecast; absent means the climate model. */
  source?: "open-meteo";
}

export interface ActivityCluster {
  id: string;
  name: string;
  lunch: { name: string; pricePerPerson: number };
  dinner?: { name: string; pricePerPerson: number };
}

export interface Destination {
  id: DestinationId;
  name: string;
  state: string;
  tagline: string;
  description: string;
  art: ArtKind;
  tone: Tone;
  lat: number;
  lng: number;
  rating: number;
  reviews: number;
  moods: string[];
  interests: Interest[];
  bestMonths: number[];
  rainyMonths: number[];
  idealDays: string;
  gateway: string;
  fromCity: string;
  climate: { tempC: number; condition: DayForecast["condition"]; rainChance: number };
  highlights: string[];
  clusters: ActivityCluster[];
  localCabPerDay: number;
  airportTransfer: number;
  languages: string[];
  emergency: { label: string; phone: string }[];
}

export interface Activity {
  id: string;
  destinationId: DestinationId;
  cluster: string;
  title: string;
  description: string;
  interests: Interest[];
  durationMin: number;
  price: number; // per person
  energy: 1 | 2 | 3 | 4 | 5;
  outdoor: boolean;
  slot: Slot;
  rating: number;
  reviews: number;
  vendorId: string;
  lat: number;
  lng: number;
  kidFriendly: boolean;
  walking: Walking;
  icon: string; // key into icon map
  tone: Tone;
  backupId?: string;
  altVendorId?: string;
  /** Google Maps listing: rating/reviews above are real Google numbers once looked up (0 = not rated yet). */
  placeId?: string;
  mapsUrl?: string;
}

export interface Stay {
  id: string;
  destinationId: DestinationId;
  name: string;
  type: StayType;
  nightlyPrice: number; // per room
  rating: number;
  reviews: number;
  vendorId: string;
  area: string;
  amenities: string[];
  tone: Tone;
  placeId?: string;
  mapsUrl?: string;
  lat: number;
  lng: number;
}

export interface TransportOption {
  id: string;
  destinationId: DestinationId;
  mode: TransportMode;
  label: string;
  from: string;
  pricePerPerson: number; // one way
  durationMin: number;
  departs: string; // "06:10"
  vendorId: string;
}

export type VendorKind = "stay" | "activity" | "transport" | "local";

/**
 * A partner. The public catalog carries id, name, kind, destination, language, availability and trust;
 * contacts and request stats come from the operator console (GET /ops/vendors). Every stat is computed
 * from real requests: a new partner has `requests: 0` and a neutral trust score of 80.
 */
export interface Vendor {
  id: string;
  name: string;
  kind: VendorKind;
  destinationId: DestinationId;
  language: string;
  available: boolean;
  trustScore: number; // 0-100
  contactName?: string;
  phone?: string;
  email?: string;
  requests?: number;
  responseRate?: number; // 0-100
  avgReplyMin?: number;
  cancellationRate?: number; // 0-100, declined or unanswered
  rating?: number; // average traveler stars on trips with this partner, 0 = none yet
  activeBookings?: number;
  pendingConfirmations?: number;
  history: { month: string; bookings: number; declines: number; replyMin: number }[];
}

/** A review a real traveler left after a trip (GET /destinations/{id}). */
export interface DestinationReview {
  name: string;
  city: string;
  stars: number;
  when: string;
  text: string;
  trip: string;
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export type TripItemKind =
  | "flight"
  | "train"
  | "bus"
  | "car"
  | "transfer"
  | "checkin"
  | "checkout"
  | "activity"
  | "meal"
  | "rest";

export type ItemStatus = "planned" | "confirmed" | "done" | "live" | "changed" | "cancelled";

export interface TripItem {
  id: string;
  day: number; // 1-based
  date?: string; // YYYY-MM-DD
  kind: TripItemKind;
  refId?: string; // activity/stay/transport id
  title: string;
  subtitle: string;
  place: string;
  location?: string;
  startMin: number; // minutes from midnight
  durationMin: number;
  startTime?: string; // "14:30"
  endTime?: string; // "16:00"
  unitCost: number;
  qty: number;
  costMode: "per-person" | "flat";
  hearted: boolean;
  vendorId?: string;
  outdoor: boolean;
  energy: number;
  status: ItemStatus;
  dependsOn: string[];
  bufferMin: number;
  lat?: number;
  lng?: number;
  icon: string;
  tone: Tone;
  note?: string;
}

export type TripStatus = "draft" | "booked" | "live" | "completed";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "partial";

export interface PlaceIdentity {
  placeId?: string;
  name: string;
  formattedAddress?: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface DestinationAllocation {
  destinationId: DestinationId;
  destinationName?: string;
  days: number;
  startDate?: string;
  endDate?: string;
  startDay: number;
  endDay: number;
}

export interface TripPreferences {
  destinationId: DestinationId;
  destinations?: DestinationId[];
  destinationDays?: Record<string, number>;
  destinationAllocations?: DestinationAllocation[];
  destinationPlaces?: PlaceIdentity[];
  originPlace?: PlaceIdentity | null;
  startDate: string; // ISO date
  nights: number;
  adults: number;
  kids: number;
  budgetPerPerson: number;
  stayType: StayType;
  transport: TransportMode;
  interests: Interest[];
  pace: Pace;
  rhythm: "early-bird" | "night-owl";
  special: string[];
  ownWords: string;
  fromCity: string;
  /** Full address or locality the traveler entered. */
  fromAddress?: string;
  /** Latitude of the traveler's origin. */
  fromLat?: number | null;
  /** Longitude of the traveler's origin. */
  fromLng?: number | null;
}

export interface ChangeReceipt {
  id: string;
  tripId: string;
  title: string;
  reason: string;
  changes: { before: string; after: string }[];
  approvedBy: string[];
  costDelta: number;
  createdAt: string;
  planStrategy?: FixStrategy;
}

export interface Trip {
  id: string;
  code: string;
  title: string;
  destinationId: DestinationId;
  destinations?: DestinationId[];
  destinationAllocations?: DestinationAllocation[];
  originPlace?: PlaceIdentity | null;
  prefs: TripPreferences;
  stayId: string;
  transportId: string;
  items: TripItem[];
  status: TripStatus;
  paymentStatus: PaymentStatus;
  promoCode?: string;
  createdAt: string;
  bookedAt?: string;
  receipts: ChangeReceipt[];
  coordinatorId: string;
  customerId: string;
  customerName: string;
  groupName: string;
  currentDay?: number;
  weatherOverrides?: Record<number, DayForecast["condition"]>;
  review?: TripReview;
  optimized?: { savedMin: number; movedOutdoor: number };
}

export interface TripReview {
  stars: number;
  aspects: Record<string, number>;
  text: string;
  createdAt: string;
}

export type DNADimension = "adventure" | "nature" | "culture" | "food" | "luxury" | "social";

/** End-of-trip questionnaire: teaches the Travel DNA (loved/disliked are trip item ids). */
export interface TripFeedback {
  loved: string[];
  disliked: string[];
  pace: "" | "too_slow" | "right" | "too_fast";
  more: DNADimension[];
  less: DNADimension[];
  note: string;
}

/** One recorded change of the Travel DNA (dimension "pace" uses 0 relaxed · 1 balanced · 2 packed). */
export interface DNAChange {
  id: string;
  dimension: DNADimension | "pace";
  old: number;
  new: number;
  reason: string;
  source: "behaviour" | "feedback";
  eventId?: string;
  createdAt: string;
}

export interface DNARecommendation {
  activity: Activity;
  fit: number;
  score: number;
  because: string;
}

export interface PriceBreakdown {
  stay: number;
  travel: number;
  local: number;
  activities: number;
  meals: number;
  subtotal: number;
  teamUp: number;
  promo: number;
  serviceFee: number;
  tax: number;
  total: number;
  perPerson: number;
  budget: number;
  budgetStatus: "roomy" | "on-budget" | "over";
  travelers: number;
  rooms: number;
}

// ─── Disruptions ─────────────────────────────────────────────────────────────

export type IncidentKind =
  | "weather"
  | "flight_delay"
  | "vendor_unavailable"
  | "traveler_request"
  | "closure"
  | "running_late"
  | "crowd_report"
  | "health";

export type IncidentStatus =
  | "open"
  | "analyzing"
  | "plans_ready"
  | "awaiting_vendors"
  | "resolved"
  | "escalated";

export interface Incident {
  id: string;
  tripId: string;
  kind: IncidentKind;
  title: string;
  detail: string;
  day: number;
  severity: 1 | 2 | 3 | 4 | 5;
  source: "weather-job" | "flight-job" | "telegram" | "operator" | "crowd" | "traveler" | "simulator" | "vendor";
  status: IncidentStatus;
  createdAt: string;
  delayMin?: number;
  vendorId?: string;
  place?: string;
  mood?: Mood;
  selectedPlanId?: string;
  agentRunId?: string;
  receiptId?: string;
}

export type ImpactLevel = "safe" | "moves" | "at_risk" | "cannot_happen";

export interface ImpactItem {
  itemId: string;
  level: ImpactLevel;
  reason: string;
  costAtRisk: number;
  newStartMin?: number;
  order: number; // position in the dependency chain
  causeId?: string;
}

export interface ImpactSummary {
  items: ImpactItem[];
  moneyAtRisk: number;
  minutesLost: number;
  heartsAtRisk: number;
  vendorsTouched: string[];
  root: string;
}

export type SwapType = "day_swap" | "route_swap" | "activity_swap";
export type FixStrategy = "cheapest" | "fastest" | "favourites" | SwapType;

export interface FixAction {
  type: "swap" | "move" | "shift" | "cancel" | "rebook";
  itemId: string;
  label: string;
  fromLabel: string;
  toLabel: string;
  toRefId?: string;
  toDay?: number;
  toStartMin?: number;
  costDelta: number;
  vendorId?: string;
  newVendorId?: string;
}

export interface FixPlan {
  id: string;
  incidentId: string;
  strategy: FixStrategy;
  title: string;
  tagline: string;
  costDelta: number; // negative = saved/refund
  timeDeltaMin: number;
  heartsKept: number;
  heartsTotal: number;
  swaps: number;
  actions: FixAction[];
  vendors: string[];
  confidence: number;
  weatherOk: boolean;
  score: { cost: number; time: number; happiness: number };
  recommended?: boolean;
}

// ─── Adaptive swaps (extend the Trip Fixer; applied through the same agent flow) ─────

export interface SwapCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface SwapComparison {
  original: string;
  proposed: string;
  priceBefore: number;
  priceAfter: number;
  priceDelta: number;
  timeDeltaMin: number;
  distanceDeltaKm: number;
  weatherBefore: string;
  weatherAfter: string;
  dnaMatchBefore: number;
  dnaMatchAfter: number;
  affectedItems: string[];
  affectedBookings: string[];
  affectedVendors: string[];
  risks: string[];
}

export interface RouteStop {
  day: number;
  area: string;
  km: number;
  minutes: number;
}

export interface SwapCandidate {
  id: string; // pass as planId to startAgentRun
  type: SwapType;
  forItemId: string;
  title: string;
  summary: string;
  plan: FixPlan;
  comparison: SwapComparison;
  route?: { original: RouteStop[]; proposed: RouteStop[]; kmBefore: number; kmAfter: number; minutesBefore: number; minutesAfter: number; hotel: string; dependencies: string[] };
  hardChecks: SwapCheck[];
  safety: SafetyCheck[];
  score: number;
  reasons: string[];
  needsApproval: boolean;
  approvalReason?: string;
  requiresAcceptance: boolean;
}

export interface SwapReport {
  day: SwapCandidate[];
  route: SwapCandidate[];
  activity: SwapCandidate[];
  rejected: { type: SwapType; forItemId: string; label: string; reasons: string[] }[];
  dnaSource: "travel-dna" | "trip-preferences";
  similaritySource?: "semantic" | "tags";
  notes: string[];
}

export interface SafetyCheck {
  id: string;
  label: string;
  engine: "jev" | "code";
  passed: boolean;
  tookMs: number;
  detail: string;
}

// ─── Agent + confirmations ───────────────────────────────────────────────────

export type StepStatus = "pending" | "running" | "done" | "failed" | "warning" | "waiting";

export interface AgentStep {
  id: string;
  tool: string;
  label: string;
  status: StepStatus;
  result?: string;
  detail?: string[];
  ts: string;
  tookMs?: number;
  kind?: "normal" | "rollback" | "voice" | "vendor" | "success" | "safety";
}

export interface AgentRun {
  id: string;
  incidentId: string;
  tripId: string;
  status: "running" | "waiting" | "succeeded" | "failed" | "needs_human";
  startedAt: string;
  finishedAt?: string;
  steps: AgentStep[];
  attempt: number;
  planId?: string;
  mode: "auto" | "manual";
  excludedVendors: string[];
  scope: "operator" | "traveler";
  heartbeat?: number;
  plans?: FixPlan[];
  impact?: ImpactSummary;
  summary?: string;
}

export type VendorAnswer = "pending" | "yes" | "no" | "other_time" | "timeout" | "cancelled";

export interface VendorRequest {
  token: string;
  /** One all-or-nothing round; a retry opens a new round. */
  confirmationId?: string;
  runId?: string;
  incidentId?: string;
  tripId: string;
  vendorId: string;
  travelerName: string;
  dateLabel: string;
  original: string;
  proposed: string;
  itemTitle: string;
  status: VendorAnswer;
  channel?: "button" | "voice" | "web" | "phone";
  respondedAt?: string;
  altTime?: string;
  voice?: VoiceInterpretation;
  createdAt: string;
  kind: "change" | "booking";
}

export interface VoiceInterpretation {
  audioLabel: string;
  durationSec: number;
  transcript: string;
  translation?: string;
  decision: "confirmed" | "declined" | "other_time" | "needs_call";
  time?: string;
  confidence: number;
  language: string;
}

// ─── Operator side ───────────────────────────────────────────────────────────

export type TourStatus = "planning" | "confirmed" | "live" | "at_risk" | "completed";

export interface Customer {
  id: string;
  name: string;
  city: string;
  email: string;
  phone: string;
  since: string;
  dnaName: string;
  trips: number;
  ltv: number;
  tone: Tone;
  tags: string[];
}

export type BookingStatus = "requested" | "confirmed" | "declined" | "cancelled";

export interface Booking {
  id: string;
  tripId: string;
  itemId: string;
  itemTitle: string;
  vendorId: string;
  customerName: string;
  status: BookingStatus;
  amount: number;
  day: number;
  date: string;
  channel: "telegram" | "web" | "phone";
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  kind: "payment" | "payout" | "refund" | "adjustment";
  party: string;
  tripId: string;
  amount: number;
  status: "settled" | "pending" | "failed";
  date: string;
  method: string;
  note: string;
}

export interface InboxMessage {
  id: string;
  from: "them" | "us" | "agent";
  type: "text" | "voice" | "button" | "template" | "attachment";
  body: string;
  transcript?: string;
  decision?: string;
  confidence?: number;
  attachment?: { name: string; size: string; docId?: string };
  at: string;
  status?: "sent" | "delivered" | "read";
}

export interface InboxThread {
  id: string;
  party: "vendor" | "traveler" | "agent" | "system";
  name: string;
  subtitle: string;
  tripId?: string;
  vendorId?: string;
  unread: number;
  windowOpenUntil?: string;
  messages: InboxMessage[];
  tone: Tone;
}

export interface TeamMember {
  id: string;
  name: string;
  role: "coordinator" | "ops" | "admin";
  region: string;
  phone: string;
  languages: string[];
  status: "on-trip" | "available" | "off-duty";
  rating: number;
  tone: Tone;
}

export interface CrowdReport {
  id: string;
  place: string;
  destinationId: DestinationId;
  type: "closed" | "road_blocked" | "crowded" | "unsafe" | "other";
  text: string;
  reporter: string;
  reporterRole: "traveler" | "guide" | "vendor";
  createdAt: string;
  verified: boolean;
  confirmations: number;
  affectedTrips: string[];
}

export interface EarlyWarning {
  id: string;
  tripId: string;
  title: string;
  detail: string;
  etaLateMin: number;
  createdAt: string;
  status: "watching" | "handed-to-agent" | "resolved";
}

// ─── Notifications / auth ────────────────────────────────────────────────────

export type NotificationKind =
  | "weather"
  | "flight"
  | "vendor"
  | "agent"
  | "payment"
  | "risk"
  | "trip"
  | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
  audience: "traveler" | "operator";
}

export type Role = "traveler" | "operator" | "super_admin";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarTone: Tone;
}

export type Mood = "tired" | "hungry" | "raining" | "late" | "over_budget" | "bored";

export interface DNATraits {
  adventure: number;
  nature: number;
  culture: number;
  food: number;
  luxury: number;
  social: number;
}

export interface TravelDNA {
  traits: DNATraits;
  name: string;
  emoji: string;
  summary: string;
  pace: Pace;
  rhythm: "early-bird" | "night-owl";
}

/** An issued trip PDF (GET /trips/{id}/documents). */
export interface TripDocument {
  id: string;
  tripId: string;
  kind: "confirmation" | "invoice" | "itinerary" | "voucher";
  title: string;
  fileName: string;
  version: number;
  reason: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  latest: boolean;
}
