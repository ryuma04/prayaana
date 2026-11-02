// Components
export { TravelGuruChatbot } from "./components/TravelGuruChatbot";
export type { TravelGuruChatbotProps } from "./components/TravelGuruChatbot";

export { TravelGuruFloatingWidget } from "./components/TravelGuruFloatingWidget";
export type { TravelGuruFloatingWidgetProps } from "./components/TravelGuruFloatingWidget";

export { TravelGuruQuickAssistant } from "./components/TravelGuruQuickAssistant";
export type { TravelGuruQuickAssistantProps } from "./components/TravelGuruQuickAssistant";

// Services
export { travelGuruService, SUPPORTED_CITIES, DEFAULT_CITY } from "./services/travelGuruService";
export { quickAiService } from "./services/quickAiService";

// Hooks
export { useSpeech } from "./hooks/useSpeech";
export type { UseSpeechReturn } from "./hooks/useSpeech";

// Types
export type {
  PlaceRecommendation,
  LocalGuruResponse,
  CityInfo,
  ChatMessage,
  ItinerarySlot,
  LiveWeatherInfo
} from "./types";
