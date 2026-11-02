export interface PlaceRecommendation {
  id: string;
  name: string;
  category: "Heritage & History" | "Food & Markets" | "Nature & Parks" | "Cultural & Spiritual" | "Hidden Gem" | "Nightlife & Views";
  rating: number;
  reviewCount: string;
  description: string;
  bestTime: string;
  timing: string;
  entryFee: string;
  address: string;
  highlights: string[];
  imageUrl?: string;
  tags: string[];
  insiderTip?: string;
  approxCost?: number;
  googleMapsUrl?: string;
  lat?: number;
  lng?: number;
  durationHours?: number;
}

export interface ItinerarySlot {
  day?: number;
  timeSlot: string;
  placeName: string;
  activity: string;
  category?: string;
  tip?: string;
  estimatedCost?: number;
  googleMapsUrl?: string;
}

export interface LiveWeatherInfo {
  temp: string;
  tempNum: number;
  condition: string;
  conditionEmoji: string;
  humidity?: string;
  windSpeed?: string;
  weatherAdvisory?: string;
  isLive: boolean;
  lastUpdated?: string;
}

export interface LocalGuruResponse {
  id: string;
  role: "assistant" | "user";
  content: string;
  city: string;
  timestamp: string;
  recommendations?: PlaceRecommendation[];
  audioText?: string;
  suggestedFollowUps?: string[];
  itineraryPlan?: ItinerarySlot[];
  weatherSnapshot?: LiveWeatherInfo;
  categoryFilter?: string;
  daysPlanned?: number;
}

export interface CityInfo {
  name: string;
  stateOrCountry: string;
  tagline: string;
  badge: string;
  description: string;
  places: PlaceRecommendation[];
  weather?: string;
  temp?: string;
  weatherDetails?: LiveWeatherInfo;
  bestSeason?: string;
  language?: string;
  avgBudget?: string;
  lat?: number;
  lng?: number;
  famousFood?: string[];
  emergencyContacts?: { name: string; number: string; type: string }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  proposedChanges?: { description: string };
  recommendations?: PlaceRecommendation[];
  itineraryPlan?: ItinerarySlot[];
}
