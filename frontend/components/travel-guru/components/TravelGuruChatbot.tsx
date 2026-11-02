"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  MapPin,
  Compass,
  Star,
  Sparkles,
  Clock,
  ChevronDown,
  Ticket,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  Flame,
  Heart,
  Calendar,
  DollarSign,
  Sun,
  Languages,
  Info,
  X,
  Copy,
  Check,
  CheckCircle2,
  Trash2,
  Share2,
  PhoneCall,
  Search,
  Filter,
  Navigation,
  CloudSun,
  Maximize2,
  Minimize2,
  ArrowRight
} from "lucide-react";
import {
  travelGuruService,
  SUPPORTED_CITIES,
  DEFAULT_CITY
} from "../services/travelGuruService";
import { PlaceRecommendation, LocalGuruResponse, ItinerarySlot, CityInfo } from "../types";
import { useSpeech } from "../hooks/useSpeech";

export interface TravelGuruChatbotProps {
  initialCity?: string;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
  onAddPlaceToTrip?: (place: PlaceRecommendation) => void;
}

export function TravelGuruChatbot({
  initialCity = DEFAULT_CITY,
  className = "",
  isExpanded = false,
  onToggleExpand,
  onClose,
  onAddPlaceToTrip
}: TravelGuruChatbotProps) {
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [customCityInput, setCustomCityInput] = useState("");
  const [isCustomCityMode, setIsCustomCityMode] = useState(false);
  const [cityData, setCityData] = useState<CityInfo>(() => travelGuruService.getCityInfo(initialCity));
  const [isLoadingCity, setIsLoadingCity] = useState(false);
  const [messages, setMessages] = useState<LocalGuruResponse[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [addedPlaces, setAddedPlaces] = useState<Record<string, PlaceRecommendation>>({});
  
  // Navigation & Drawer states
  const [compactTab, setCompactTab] = useState<"chat" | "trip" | "city" | "safety">("chat");
  const [drawerTab, setDrawerTab] = useState<"trip" | "city" | "safety">("trip");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  const [selectedPlaceForModal, setSelectedPlaceForModal] = useState<PlaceRecommendation | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [activeItineraryDay, setActiveItineraryDay] = useState<number>(1);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    isSpeaking,
    speechSupported,
    voiceOutputEnabled,
    transcript,
    toggleListening,
    speakText,
    stopSpeaking,
    toggleVoiceOutput,
    error: speechError
  } = useSpeech();

  // Sync speech recognition input to text field
  useEffect(() => {
    if (transcript) {
      setInputQuery(transcript);
    }
  }, [transcript]);

  // Dynamically load city info & live real-time weather whenever selectedCity changes
  useEffect(() => {
    let cancelled = false;
    async function loadCityData() {
      setIsLoadingCity(true);
      try {
        const info = await travelGuruService.resolveCityInfo(selectedCity);
        if (!cancelled) {
          setCityData(info);

          const weatherText = info.weatherDetails
            ? ` Live weather right now: **${info.weatherDetails.conditionEmoji} ${info.weatherDetails.temp}, ${info.weatherDetails.condition}** (${info.weatherDetails.weatherAdvisory}).`
            : "";

          const welcomeMsg: LocalGuruResponse = {
            id: `welcome-${Date.now()}`,
            role: "assistant",
            content: `Namaste! 🙏 I am **Travel Guru AI**, your local companion & personal itinerary planner for **${info.name}** (${info.stateOrCountry}).\n\n${info.description}\n\n${weatherText}\n\nAsk me about famous sights, secret offbeat spots, mouth-watering local delicacies, or ask me to **plan a 1-day or weekend itinerary**!`,
            city: info.name,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            recommendations: info.places,
            audioText: `Namaste! I am Travel Guru, your personal travel guide for ${info.name}. Current weather is ${info.temp || "pleasant"}. Ask me about famous places, food spots, or speak directly using your microphone!`,
            weatherSnapshot: info.weatherDetails,
            suggestedFollowUps: [
              `🗓️ Plan 1-Day Itinerary for ${info.name}`,
              `🍲 Famous street food in ${info.name}`,
              `🌅 Best sunset views in ${info.name}`,
              `💰 Daily budget breakdown for ${info.name}`,
              `✨ Secret hidden gems in ${info.name}`
            ]
          };

          setMessages([welcomeMsg]);
          setActiveChip(null);
          setSelectedCategoryFilter("All");
          setPlaceSearchQuery("");
        }
      } catch (e) {
        console.error("Error loading city info:", e);
      } finally {
        if (!cancelled) setIsLoadingCity(false);
      }
    }

    loadCityData();
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (compactTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, compactTab]);

  // Manual refresh of live weather
  const handleRefreshWeather = async () => {
    setIsLoadingCity(true);
    try {
      const freshWeather = await travelGuruService.fetchLiveWeather(cityData.name, cityData.lat, cityData.lng);
      setCityData(prev => ({
        ...prev,
        temp: freshWeather.temp,
        weather: `${freshWeather.conditionEmoji} ${freshWeather.condition}`,
        weatherDetails: freshWeather
      }));
    } catch (_) {}
    setIsLoadingCity(false);
  };

  const handleSendMessage = async (textToSend?: string, chipLabel?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isThinking) return;

    if (chipLabel) {
      setActiveChip(chipLabel);
    }

    // Switch view back to chat if in compact mode
    setCompactTab("chat");

    const userMsg: LocalGuruResponse = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      city: selectedCity,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsThinking(true);

    try {
      const botResponse = await travelGuruService.queryLocalGuru(query, selectedCity);
      setMessages((prev) => [...prev, botResponse]);

      if (botResponse.categoryFilter) {
        setSelectedCategoryFilter(botResponse.categoryFilter);
      }

      if (voiceOutputEnabled && botResponse.audioText) {
        speakText(botResponse.audioText);
      }
    } catch (err) {
      console.error("Travel Guru error:", err);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCustomCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customCityInput.trim()) {
      setSelectedCity(customCityInput.trim());
      setIsCustomCityMode(false);
      setCustomCityInput("");
    }
  };

  const handleAddTrip = (place: PlaceRecommendation) => {
    setAddedPlaces((prev) => {
      const updated = { ...prev, [place.id]: place };
      return updated;
    });
    if (onAddPlaceToTrip) {
      onAddPlaceToTrip(place);
    }
  };

  const handleRemoveTrip = (placeId: string) => {
    setAddedPlaces((prev) => {
      const updated = { ...prev };
      delete updated[placeId];
      return updated;
    });
  };

  const handleAddAllItinerary = (slots: ItinerarySlot[]) => {
    const newAdded = { ...addedPlaces };
    slots.forEach((slot) => {
      const matched = cityData.places.find((p) => p.name.toLowerCase() === slot.placeName.toLowerCase());
      if (matched) {
        newAdded[matched.id] = matched;
        if (onAddPlaceToTrip) onAddPlaceToTrip(matched);
      } else {
        const customPlace: PlaceRecommendation = {
          id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: slot.placeName,
          category: (slot.category as any) || "Heritage & History",
          rating: 4.8,
          reviewCount: "10k+",
          description: slot.activity,
          bestTime: slot.timeSlot,
          timing: "Flexible",
          entryFee: slot.estimatedCost ? `₹${slot.estimatedCost}` : "Free",
          approxCost: slot.estimatedCost || 0,
          address: `${cityData.name}, India`,
          highlights: ["Itinerary Highlight"],
          tags: ["Trip Plan"],
          insiderTip: slot.tip,
          googleMapsUrl: slot.googleMapsUrl
        };
        newAdded[customPlace.id] = customPlace;
        if (onAddPlaceToTrip) onAddPlaceToTrip(customPlace);
      }
    });
    setAddedPlaces(newAdded);
    if (!isExpanded) {
      setCompactTab("trip");
    } else {
      setIsDrawerOpen(true);
      setDrawerTab("trip");
    }
  };

  const handleCopyItinerary = () => {
    const items = Object.values(addedPlaces);
    if (items.length === 0) return;

    let text = `🌍 Curated Travel Plan for ${selectedCity}:\n\n`;
    items.forEach((p, idx) => {
      text += `${idx + 1}. ${p.name} (${p.category})\n`;
      text += `   - Best Time: ${p.bestTime}\n`;
      text += `   - Entry: ${p.entryFee}\n`;
      text += `   - Address: ${p.address}\n`;
      if (p.insiderTip) text += `   - Tip: ${p.insiderTip}\n`;
      text += `\n`;
    });
    text += `Generated with Travel Guru AI`;
    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const items = Object.values(addedPlaces);
    if (items.length === 0) return;

    let text = `*🌍 My Travel Itinerary for ${selectedCity}*\n\n`;
    items.forEach((p, idx) => {
      text += `${idx + 1}. *${p.name}* (${p.category})\n`;
      text += `   ⏰ Best Time: ${p.bestTime}\n`;
      text += `   🎟️ Entry: ${p.entryFee}\n`;
      if (p.insiderTip) text += `   💡 Tip: ${p.insiderTip}\n`;
      text += `\n`;
    });
    text += `_Planned with Travel Guru AI_`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleOpenGoogleMapsRoute = () => {
    const items = Object.values(addedPlaces);
    if (items.length === 0) return;
    const destinations = items.map((p) => encodeURIComponent(`${p.name} ${selectedCity}`)).join("/");
    window.open(`https://www.google.com/maps/dir/${destinations}`, "_blank");
  };

  const handleClearChat = () => {
    const welcomeMsg: LocalGuruResponse = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: `Chat history refreshed! I'm ready to help you explore **${cityData.name}**. Ask me any question or pick a suggestion below.`,
      city: selectedCity,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      recommendations: cityData.places.slice(0, 3),
      suggestedFollowUps: [
        `🗓️ Plan 1-Day Itinerary for ${cityData.name}`,
        `🍲 Famous street food in ${cityData.name}`,
        `🌅 Best sunset views in ${cityData.name}`,
        `💰 Daily budget breakdown`
      ]
    };
    setMessages([welcomeMsg]);
  };

  const addedList = Object.values(addedPlaces);
  const totalEstimatedCost = addedList.reduce((acc, curr) => acc + (curr.approxCost || 0), 0);
  const totalEstimatedTime = addedList.reduce((acc, curr) => acc + (curr.durationHours || 2), 0);

  // Markdown Formatter function for clean text rendering matching Prayaana typography
  const renderMarkdownText = (text: string) => {
    return text.split("\n").map((line, i) => {
      const formatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-bold text-ink bg-sun/40 px-1 py-0.2 rounded-md">$1</strong>'
      );
      return (
        <span
          key={i}
          className="block my-1"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    });
  };

  // Helper renderers for Drawer Content (used both in Studio split view and Compact tab view)
  const renderTripPlanContent = () => (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas-cool">
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-ink/20">
        {addedList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-white border-2 border-ink flex items-center justify-center text-ink shadow-pop">
              <Calendar className="w-6 h-6 stroke-[2.2] text-coral-deep" />
            </div>
            <p className="text-sm text-ink font-bold font-display">Your itinerary is empty</p>
            <p className="text-xs text-muted leading-relaxed font-medium max-w-xs">
              Click <strong>"+ Add to Trip"</strong> on any sight card or ask Guru to generate an itinerary!
            </p>
            <button
              onClick={() => {
                if (!isExpanded) setCompactTab("chat");
                handleSendMessage(`Plan a 1-day itinerary for ${cityData.name}`);
              }}
              className="mt-2 text-xs bg-sun text-ink border-2 border-ink px-4 py-1.5 rounded-full font-bold shadow-pop hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            >
              🗓️ Auto-Plan 1 Day
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted px-1 font-semibold">
              <span className="font-bold text-ink">{addedList.length} stops planned (~{totalEstimatedTime} hrs)</span>
              <button
                onClick={() => setAddedPlaces({})}
                className="text-xs text-danger hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" /> Clear all
              </button>
            </div>

            {addedList.map((place, idx) => (
              <div
                key={place.id}
                className="bg-white border-2 border-ink rounded-2xl p-3 flex gap-3 items-center justify-between group shadow-pop hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-sun text-ink font-bold text-xs flex items-center justify-center shrink-0 border border-ink">
                    {idx + 1}
                  </span>
                  {place.imageUrl && (
                    <img
                      src={place.imageUrl}
                      alt={place.name}
                      className="w-11 h-11 rounded-xl object-cover shrink-0 border border-ink"
                    />
                  )}
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-ink truncate group-hover:text-purple">
                      {place.name}
                    </h5>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted font-medium mt-0.5">
                      <span className="text-coral-deep font-bold">{place.entryFee}</span>
                      <span>·</span>
                      <span className="truncate">{place.bestTime.split("(")[0]}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRemoveTrip(place.id)}
                  title="Remove stop"
                  className="p-1.5 text-muted hover:text-danger hover:bg-pink-soft rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* TRIP BUDGET ESTIMATION & EXPORT DOCK */}
      {addedList.length > 0 && (
        <div className="p-4 bg-white border-t-2 border-ink space-y-2.5 shrink-0 shadow-lg">
          <div className="bg-canvas rounded-2xl p-3 border-2 border-ink space-y-1.5 text-xs shadow-sm">
            <div className="flex items-center justify-between text-muted font-medium">
              <span>Total Stops:</span>
              <span className="text-ink font-bold">{addedList.length} places (~{totalEstimatedTime} hrs)</span>
            </div>
            <div className="flex items-center justify-between text-muted font-medium">
              <span>Est. Entry Tickets:</span>
              <span className="text-ink font-bold">
                {totalEstimatedCost > 0 ? `₹${totalEstimatedCost.toLocaleString()}` : "Free Entry"}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted text-[11px] pt-1.5 border-t border-ink/10 font-bold">
              <span>Est. Day Budget:</span>
              <span className="text-success font-display font-bold">
                ₹{(totalEstimatedCost + (addedList.length * 250) + 400).toLocaleString()} (incl. meals & cab)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="bg-mint text-ink border-2 border-ink py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-pop hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 stroke-[2.2]" /> WhatsApp
            </button>

            <button
              onClick={handleOpenGoogleMapsRoute}
              className="bg-sky text-ink border-2 border-ink py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-pop hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 stroke-[2.2]" /> Route Map
            </button>
          </div>

          <button
            onClick={handleCopyItinerary}
            className="w-full bg-sun text-ink border-2 border-ink py-2.5 rounded-xl text-xs font-bold shadow-pop hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {copiedToast ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" /> Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 stroke-[2.2]" /> Copy Full Plan
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  const renderCityGuideContent = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-ink/20 bg-canvas">
      <div className="bg-white rounded-[24px] p-4 border-2 border-ink shadow-pop space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-display font-bold text-ink">{cityData.name}</h4>
            <p className="text-[11px] text-muted font-medium">{cityData.stateOrCountry}</p>
          </div>
          <span className="text-[10px] bg-sun text-ink border border-ink px-2.5 py-0.5 rounded-full font-bold shadow-sm">
            {cityData.badge}
          </span>
        </div>

        <p className="text-xs text-ink-soft leading-relaxed font-medium">
          {cityData.description}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ink/10 text-xs">
          <div className="bg-canvas p-2.5 rounded-xl border border-ink/30">
            <span className="text-[10px] text-muted flex items-center gap-1 font-bold">
              <Sun className="w-3 h-3 text-sun-deep" /> Weather
            </span>
            <p className="text-xs font-bold text-ink mt-0.5">{cityData.temp || "28°C"}</p>
          </div>

          <div className="bg-canvas p-2.5 rounded-xl border border-ink/30">
            <span className="text-[10px] text-muted flex items-center gap-1 font-bold">
              <Calendar className="w-3 h-3 text-mint-deep" /> Best Season
            </span>
            <p className="text-xs font-bold text-ink mt-0.5 truncate">{cityData.bestSeason || "Oct - Mar"}</p>
          </div>

          <div className="bg-canvas p-2.5 rounded-xl border border-ink/30">
            <span className="text-[10px] text-muted flex items-center gap-1 font-bold">
              <Languages className="w-3 h-3 text-purple" /> Language
            </span>
            <p className="text-xs font-bold text-ink mt-0.5 truncate">{cityData.language || "Hindi, English"}</p>
          </div>

          <div className="bg-canvas p-2.5 rounded-xl border border-ink/30">
            <span className="text-[10px] text-muted flex items-center gap-1 font-bold">
              <DollarSign className="w-3 h-3 text-coral-deep" /> Avg. Budget
            </span>
            <p className="text-xs font-bold text-ink mt-0.5 truncate">{cityData.avgBudget || "₹2,000/day"}</p>
          </div>
        </div>
      </div>

      {cityData.famousFood && (
        <div className="bg-white rounded-[24px] p-3.5 border-2 border-ink shadow-pop space-y-2">
          <h5 className="text-xs font-display font-bold text-ink flex items-center gap-1.5">
            <span>🍲 Iconic Regional Foods</span>
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {cityData.famousFood.map((food, fIdx) => (
              <span
                key={fIdx}
                className="text-xs bg-cream text-ink border border-ink px-2.5 py-1 rounded-full font-bold shadow-sm"
              >
                • {food}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h5 className="text-xs font-display font-bold text-ink flex items-center justify-between">
          <span>Curated Sights ({cityData.places.length})</span>
          <span className="text-[10px] text-muted font-sans font-normal">Tap to inspect</span>
        </h5>
        <div className="space-y-2">
          {cityData.places.map((place) => (
            <div
              key={place.id}
              onClick={() => setSelectedPlaceForModal(place)}
              className="bg-white hover:bg-cream border-2 border-ink rounded-2xl p-2.5 flex items-center justify-between cursor-pointer transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                {place.imageUrl && (
                  <img
                    src={place.imageUrl}
                    alt={place.name}
                    className="w-9 h-9 rounded-xl object-cover shrink-0 border border-ink"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink truncate">{place.name}</p>
                  <p className="text-[10px] text-muted font-medium">{place.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-ink bg-sun px-2 py-0.5 rounded-full border border-ink shrink-0">
                <Star className="w-3 h-3 fill-ink text-ink" />
                <span>{place.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSafetyContent = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-ink/20 bg-canvas">
      <div className="bg-pink-soft border-2 border-ink rounded-2xl p-3.5 text-xs space-y-1.5 shadow-pop">
        <span className="font-bold font-display text-danger flex items-center gap-1.5 text-sm">
          <PhoneCall className="w-4 h-4 text-danger stroke-[2.2]" /> 24/7 Official Emergency Helplines
        </span>
        <p className="text-xs text-ink leading-relaxed font-medium">
          Dial <strong>112</strong> immediately for acute emergencies anywhere in India. Official tourist police helplines operate 24/7.
        </p>
      </div>

      <div className="space-y-2">
        {(cityData.emergencyContacts || [
          { name: "All Emergency Integrated", number: "112", type: "Police / Fire / Ambulance" },
          { name: "National Tourist Support", number: "1363", type: "Multilingual Assistance" },
          { name: "City Police Control Room", number: "100", type: "Law Enforcement" },
          { name: "Medical Ambulance Emergency", number: "108", type: "Immediate Medical" }
        ]).map((contact, idx) => (
          <div
            key={idx}
            className="bg-white border-2 border-ink rounded-2xl p-3 flex items-center justify-between shadow-pop"
          >
            <div>
              <h6 className="text-xs font-bold text-ink">{contact.name}</h6>
              <span className="text-[10px] text-muted font-medium">{contact.type}</span>
            </div>
            <a
              href={`tel:${contact.number.split("/")[0].trim()}`}
              className="bg-danger text-white border border-ink px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow hover:brightness-110 active:scale-95 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 stroke-[2.2]" /> {contact.number}
            </a>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-full bg-canvas border-2 border-ink rounded-[28px] overflow-hidden select-none ${className}`}>
      
      {/* 1. TOP HEADER (Clean Light Theme matching App aesthetics) */}
      <div className="bg-white border-b-2 border-ink/15 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          
          {/* Avatar & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-9 h-9 rounded-xl border-2 border-ink bg-sun text-ink flex items-center justify-center shadow-sm">
                <Compass className="w-5 h-5 stroke-[2.2] group-hover:rotate-45 transition-transform" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-display font-bold text-ink tracking-tight truncate">
                  Travel Concierge
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-lavender-soft text-purple-deep border border-purple/30 rounded-full flex items-center gap-1 shrink-0">
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              </div>

              {/* Weather & Season Info */}
              <div className="flex items-center gap-2 text-xs text-ink-soft mt-0.5">
                {cityData.temp && (
                  <button
                    onClick={handleRefreshWeather}
                    title="Click to refresh live weather"
                    className="inline-flex items-center gap-1 text-ink text-[11px] bg-canvas hover:bg-cream px-2 py-0.5 rounded-full border border-ink/20 font-semibold cursor-pointer shrink-0"
                  >
                    <CloudSun className={`w-3 h-3 text-sun-deep ${isLoadingCity ? "animate-spin" : ""}`} />
                    <span>{cityData.temp}</span>
                  </button>
                )}
                {cityData.bestSeason && (
                  <span className="text-[11px] text-ink-soft/80 truncate hidden sm:inline">
                    Best: {cityData.bestSeason}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Icons & Destination Picker */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Destination Selector Pill */}
            {!isCustomCityMode ? (
              <div className="relative">
                <div className="flex items-center bg-canvas border-2 border-ink rounded-full px-2.5 py-1 text-xs text-ink hover:bg-cream transition-all">
                  <MapPin className="w-3 h-3 text-coral-deep mr-1 shrink-0 stroke-[2.2]" />
                  <select
                    value={SUPPORTED_CITIES.includes(selectedCity) ? selectedCity : "custom"}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setIsCustomCityMode(true);
                      } else {
                        setSelectedCity(e.target.value);
                      }
                    }}
                    className="bg-transparent text-ink font-bold focus:outline-none cursor-pointer pr-4 appearance-none text-xs"
                  >
                    {SUPPORTED_CITIES.map((c) => (
                      <option key={c} value={c} className="bg-white text-ink font-medium">
                        📍 {c}
                      </option>
                    ))}
                    <option value="custom" className="bg-cream text-coral-deep font-bold">
                      🔍 Other...
                    </option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-ink absolute right-1.5 pointer-events-none stroke-[2.2]" />
                </div>
              </div>
            ) : (
              <form onSubmit={handleCustomCitySubmit} className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="City..."
                  value={customCityInput}
                  onChange={(e) => setCustomCityInput(e.target.value)}
                  autoFocus
                  className="bg-white border-2 border-ink rounded-full px-2.5 py-0.5 text-xs text-ink font-semibold focus:outline-none w-24 shadow-sm"
                />
                <button
                  type="submit"
                  className="bg-sun text-ink border-2 border-ink px-2 py-0.5 rounded-full text-xs font-bold shadow-sm cursor-pointer"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomCityMode(false)}
                  className="w-5 h-5 rounded-full bg-white border border-ink text-ink text-xs font-bold hover:bg-pink-soft flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </form>
            )}

            {/* Voice Audio Readout Toggle */}
            <button
              onClick={toggleVoiceOutput}
              title={voiceOutputEnabled ? "Mute Voice Narration" : "Enable Voice Narration"}
              className={`p-1.5 rounded-full border border-ink/20 transition-all cursor-pointer ${
                voiceOutputEnabled ? "bg-sky text-ink" : "bg-canvas text-ink-soft hover:bg-cream"
              }`}
            >
              {voiceOutputEnabled ? <Volume2 className="w-4 h-4 stroke-[2]" /> : <VolumeX className="w-4 h-4 stroke-[2]" />}
            </button>

            {/* Clear / Reset Chat */}
            <button
              onClick={handleClearChat}
              title="Reset conversation"
              className="p-1.5 rounded-full border border-ink/20 bg-canvas text-ink hover:bg-cream transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 stroke-[2]" />
            </button>

            {/* Expand / Minimize Window Mode Toggle */}
            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                title={isExpanded ? "Dock window" : "Expand window"}
                className="p-1.5 rounded-full border border-ink/20 bg-canvas text-ink hover:bg-cream transition-all cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4 stroke-[2]" /> : <Maximize2 className="w-4 h-4 stroke-[2]" />}
              </button>
            )}

            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close widget"
                className="p-1.5 rounded-full border border-ink/20 bg-canvas text-ink hover:bg-rose-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>

        {/* Audio Wave Bar when Speaking aloud */}
        {isSpeaking && (
          <div className="mt-2 bg-sun text-ink border border-ink rounded-2xl px-3 py-1 flex items-center justify-between text-xs font-bold shadow-sm animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ink opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ink"></span>
              </span>
              Speaking aloud...
            </span>
            <button
              onClick={stopSpeaking}
              className="bg-ink text-white px-2 py-0.5 rounded-full text-[10px] font-bold hover:bg-purple active:scale-95 cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* 2. SEGMENTED TAB BAR IN COMPACT MODE (Crucial for 460px mobile / dock view) */}
      {!isExpanded && (
        <div className="bg-canvas-cool border-b-2 border-ink px-3 py-2 flex items-center justify-between gap-1 shrink-0">
          <button
            onClick={() => setCompactTab("chat")}
            className={`flex-1 py-1 px-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              compactTab === "chat"
                ? "bg-ink text-white border-2 border-ink shadow-pop"
                : "bg-white text-ink border border-ink/30 hover:bg-cream"
            }`}
          >
            <span>💬 Chat</span>
          </button>

          <button
            onClick={() => setCompactTab("trip")}
            className={`flex-1 py-1 px-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              compactTab === "trip"
                ? "bg-ink text-white border-2 border-ink shadow-pop"
                : "bg-white text-ink border border-ink/30 hover:bg-cream"
            }`}
          >
            <Calendar className="w-3 h-3 stroke-[2.2]" />
            <span>Plan</span>
            {addedList.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-sun text-ink font-bold text-[9px] flex items-center justify-center">
                {addedList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCompactTab("city")}
            className={`flex-1 py-1 px-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              compactTab === "city"
                ? "bg-ink text-white border-2 border-ink shadow-pop"
                : "bg-white text-ink border border-ink/30 hover:bg-cream"
            }`}
          >
            <Compass className="w-3 h-3 stroke-[2.2]" />
            <span>Guide</span>
          </button>

          <button
            onClick={() => setCompactTab("safety")}
            className={`py-1 px-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              compactTab === "safety"
                ? "bg-danger text-white border-2 border-ink shadow-pop"
                : "bg-pink-soft text-danger border border-ink/30 hover:bg-pink"
            }`}
          >
            <PhoneCall className="w-3 h-3 stroke-[2.2]" />
            <span>SOS</span>
          </button>
        </div>
      )}

      {/* 3. DYNAMIC EXPLORE PROMPTS PILL ROW (When Chat is visible) */}
      {(isExpanded || compactTab === "chat") && (
        <div className="bg-cream/90 border-b-2 border-ink/15 px-3 py-2 overflow-x-auto flex items-center gap-2 no-scrollbar scrollbar-none shrink-0">
          <span className="text-[11px] font-bold text-ink uppercase tracking-wider shrink-0 flex items-center gap-1 font-display">
            <Flame className="w-3.5 h-3.5 text-coral-deep" /> Explore {cityData.name}:
          </span>
          {[
            { id: "top", label: `🏛️ Famous Sights`, prompt: `What are top famous sights and monuments to visit in ${cityData.name}?` },
            { id: "itinerary-1", label: `🗓️ 1-Day Itinerary`, prompt: `Plan a comprehensive 1-day itinerary for ${cityData.name} with morning to night timeline.` },
            { id: "itinerary-weekend", label: `🗓️ 2-Day Weekend`, prompt: `Plan a 2-day weekend trip itinerary for ${cityData.name}.` },
            { id: "food", label: `🍲 Iconic Street Food`, prompt: `What is famous street food and iconic local dishes to eat in ${cityData.name}?` },
            { id: "sunset", label: `🌅 Sunset & Views`, prompt: `Where are best sunset viewpoints and evening waterfronts in ${cityData.name}?` },
            { id: "budget", label: `💰 Budget Guide`, prompt: `Give me a budget breakdown and cost-saving tips for ${cityData.name}.` },
            { id: "gems", label: `✨ Hidden Gems`, prompt: `Tell me hidden gems and offbeat cultural spots in ${cityData.name}.` },
            { id: "weather", label: `🌤️ Weather & Packing`, prompt: `What is the current weather and what should I wear in ${cityData.name}?` }
          ].map((chip) => {
            const isActive = activeChip === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => handleSendMessage(chip.prompt, chip.id)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1 font-bold border-2 border-ink cursor-pointer ${
                  isActive
                    ? "bg-ink text-white shadow-pop"
                    : "bg-white hover:bg-sun text-ink shadow-[2px_2px_0_#1c1b2b] hover:shadow-pop hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. MAIN VIEWPORT */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* COMPACT MODE NON-CHAT TAB VIEWS */}
        {!isExpanded && compactTab === "trip" && renderTripPlanContent()}
        {!isExpanded && compactTab === "city" && renderCityGuideContent()}
        {!isExpanded && compactTab === "safety" && renderSafetyContent()}

        {/* CHAT STREAM (Shown when in Studio mode OR when compactTab is "chat") */}
        {(isExpanded || compactTab === "chat") && (
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-canvas bg-dots">
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-5 space-y-4 scrollbar-thin scrollbar-thumb-ink/20">
              {messages.map((msg) => {
                const isGuru = msg.role === "assistant";

                let displayedRecommendations = msg.recommendations || [];
                if (selectedCategoryFilter !== "All") {
                  displayedRecommendations = displayedRecommendations.filter(
                    (p) => p.category === selectedCategoryFilter
                  );
                }
                if (placeSearchQuery.trim()) {
                  const q = placeSearchQuery.toLowerCase();
                  displayedRecommendations = displayedRecommendations.filter(
                    (p) =>
                      p.name.toLowerCase().includes(q) ||
                      p.description.toLowerCase().includes(q) ||
                      p.tags.some((t) => t.toLowerCase().includes(q))
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${isGuru ? "justify-start" : "justify-end"} max-w-full`}
                  >
                    {isGuru && (
                      <div className="w-8 h-8 rounded-2xl border-2 border-ink bg-sun text-ink flex items-center justify-center shrink-0 shadow-[2px_2px_0_#1c1b2b] mt-1">
                        <Sparkles className="w-4 h-4 text-ink stroke-[2.2]" />
                      </div>
                    )}

                    <div className={`space-y-3 w-full ${isGuru ? "max-w-[96%] md:max-w-[94%]" : "max-w-[85%] md:max-w-[75%]"}`}>
                      
                      {/* Postcard Note Card Bubble */}
                      <div
                        className={`p-4 rounded-[24px] text-sm leading-relaxed border-2 border-ink shadow-pop ${
                          isGuru
                            ? "bg-white text-ink rounded-tl-sm font-medium"
                            : "bg-ink text-white rounded-tr-sm font-semibold"
                        }`}
                      >
                        {/* Bot Note Stamp Header */}
                        {isGuru && (
                          <div className="flex items-center justify-between text-[10px] font-bold text-muted uppercase tracking-wider border-b border-ink/10 pb-2 mb-2">
                            <span className="flex items-center gap-1 font-display text-ink">
                              🧭 Guru Dispatch · {msg.city || cityData.name}
                            </span>
                            <span className="font-mono">{msg.timestamp}</span>
                          </div>
                        )}

                        <div className="space-y-1">
                          {renderMarkdownText(msg.content)}
                        </div>
                        
                        {isGuru && msg.audioText && (
                          <div className="mt-3 pt-2 border-t border-ink/10 flex items-center justify-between text-[11px]">
                            <button
                              onClick={() => speakText(msg.audioText!)}
                              className="text-purple-deep hover:underline flex items-center gap-1 font-bold cursor-pointer"
                            >
                              <Volume2 className="w-3.5 h-3.5 stroke-[2.2]" /> Replay Voice
                            </button>
                            <span className="text-[10px] text-muted">Authentic AI Travel Guidance</span>
                          </div>
                        )}
                      </div>

                      {/* ITINERARY TIMELINE (IF RETURNED BY PLANNER) */}
                      {msg.itineraryPlan && msg.itineraryPlan.length > 0 && (
                        <div className="bg-white border-2 border-ink rounded-[26px] p-4 shadow-pop">
                          <div className="flex items-center justify-between mb-3 border-b-2 border-ink/10 pb-2.5 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-sun border-2 border-ink flex items-center justify-center text-xs">
                                🗓️
                              </span>
                              <h4 className="text-sm font-display font-bold text-ink">
                                {msg.daysPlanned ? `${msg.daysPlanned}-Day Travel Timeline` : "Curated Schedule"}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2">
                              {msg.daysPlanned && msg.daysPlanned > 1 && (
                                <div className="flex items-center gap-1 bg-canvas border-2 border-ink p-0.5 rounded-full text-xs">
                                  {Array.from({ length: msg.daysPlanned }, (_, i) => i + 1).map((d) => (
                                    <button
                                      key={d}
                                      onClick={() => setActiveItineraryDay(d)}
                                      className={`px-2.5 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                                        activeItineraryDay === d
                                          ? "bg-ink text-white shadow-sm"
                                          : "text-muted hover:text-ink"
                                      }`}
                                    >
                                      Day {d}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => handleAddAllItinerary(msg.itineraryPlan!)}
                                className="text-xs bg-mint text-ink border-2 border-ink shadow-[2px_2px_0_#1c1b2b] hover:bg-mint-soft px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                              >
                                <PlusCircle className="w-3.5 h-3.5 stroke-[2.2]" /> Add All to Trip
                              </button>
                            </div>
                          </div>

                          {/* Timeline Slot Cards */}
                          <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-ink">
                            {msg.itineraryPlan
                              .filter((s) => !s.day || !msg.daysPlanned || msg.daysPlanned === 1 || s.day === activeItineraryDay)
                              .map((slot, idx) => (
                                <div key={idx} className="relative group">
                                  <span className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-sun border-2 border-ink"></span>
                                  <div className="bg-canvas border-2 border-ink/40 hover:border-ink rounded-2xl p-3 transition-colors shadow-sm">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="font-bold text-coral-deep flex items-center gap-1">
                                        <Clock className="w-3 h-3 stroke-[2.2]" /> {slot.timeSlot}
                                      </span>
                                      <span className="text-ink font-bold text-xs">{slot.placeName}</span>
                                    </div>
                                    <p className="text-xs text-ink-soft leading-relaxed">{slot.activity}</p>
                                    {slot.tip && (
                                      <div className="mt-2 text-[11px] text-ink bg-sun-soft border border-ink/20 rounded-xl px-2.5 py-1 flex items-start gap-1.5 font-medium">
                                        <Sparkles className="w-3 h-3 shrink-0 text-sun-deep mt-0.5" />
                                        <span>{slot.tip}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* PLACE RECOMMENDATION CARDS (Collectible Travel Postcards) */}
                      {msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="mt-3 space-y-2.5">
                          {/* Filter bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2 rounded-2xl border-2 border-ink shadow-sm">
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                              <span className="text-xs font-bold text-ink mr-1 shrink-0 flex items-center gap-1 font-display">
                                <Filter className="w-3 h-3 text-ink" /> Filter:
                              </span>
                              {["All", "Heritage & History", "Food & Markets", "Nightlife & Views", "Cultural & Spiritual", "Hidden Gem"].map((cat) => {
                                const isSelected = selectedCategoryFilter === cat;
                                const label =
                                  cat === "All"
                                    ? "All Places"
                                    : cat === "Heritage & History"
                                    ? "🏛️ Heritage"
                                    : cat === "Food & Markets"
                                    ? "🍲 Food"
                                    : cat === "Nightlife & Views"
                                    ? "🌅 Views"
                                    : cat === "Cultural & Spiritual"
                                    ? "🕉️ Spiritual"
                                    : "✨ Offbeat";

                                return (
                                  <button
                                    key={cat}
                                    onClick={() => setSelectedCategoryFilter(cat)}
                                    className={`text-xs px-2.5 py-0.5 rounded-full shrink-0 transition-all font-bold border cursor-pointer ${
                                      isSelected
                                        ? "bg-ink text-white border-ink shadow-sm"
                                        : "bg-canvas border-ink/20 text-ink hover:border-ink hover:bg-cream"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="relative shrink-0">
                              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2 pointer-events-none" />
                              <input
                                type="text"
                                placeholder="Search sights..."
                                value={placeSearchQuery}
                                onChange={(e) => setPlaceSearchQuery(e.target.value)}
                                className="bg-canvas border-2 border-ink rounded-full pl-8 pr-3 py-1 text-xs text-ink font-semibold placeholder:text-muted focus:outline-none w-32 sm:w-36"
                              />
                            </div>
                          </div>

                          {/* Postcard Grid */}
                          <div className={`grid gap-3.5 ${
                            isExpanded ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                          }`}>
                            {displayedRecommendations.map((place) => {
                              const isAdded = Boolean(addedPlaces[place.id]);

                              return (
                                <div
                                  key={place.id}
                                  className="bg-white border-2 border-ink rounded-[24px] shadow-pop hover:-translate-y-1 hover:shadow-pop-lg transition-all duration-200 group flex flex-col justify-between overflow-hidden"
                                >
                                  {/* Photo Banner */}
                                  {place.imageUrl && (
                                    <div className="relative h-36 w-full overflow-hidden bg-canvas border-b-2 border-ink">
                                      <img
                                        src={place.imageUrl}
                                        alt={place.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                      />
                                      
                                      <div className="absolute top-2.5 left-2.5">
                                        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-mint text-ink border-2 border-ink shadow-[2px_2px_0_#1c1b2b]">
                                          {place.category}
                                        </span>
                                      </div>

                                      <div className="absolute top-2.5 right-2.5 bg-sun text-ink border-2 border-ink shadow-[2px_2px_0_#1c1b2b] px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-bold">
                                        <Star className="w-3.5 h-3.5 fill-ink text-ink stroke-[2.2]" />
                                        <span>{place.rating}</span>
                                        <span className="text-[10px] font-normal text-ink-soft">
                                          ({place.reviewCount})
                                        </span>
                                      </div>

                                      <button
                                        onClick={() => isAdded ? handleRemoveTrip(place.id) : handleAddTrip(place)}
                                        title={isAdded ? "Remove from Trip" : "Save to Trip"}
                                        className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-white border-2 border-ink text-ink hover:bg-pink-soft flex items-center justify-center shadow-sm cursor-pointer transition-transform active:scale-95"
                                      >
                                        <Heart className={`w-4 h-4 ${isAdded ? "fill-red-500 text-red-500 stroke-[2.2]" : "stroke-[2.2]"}`} />
                                      </button>
                                    </div>
                                  )}

                                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5">
                                    <div>
                                      {!place.imageUrl && (
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-mint text-ink border border-ink">
                                            {place.category}
                                          </span>
                                          <div className="flex items-center gap-1 text-xs font-bold text-ink bg-sun px-2 py-0.5 rounded-full border border-ink">
                                            <Star className="w-3.5 h-3.5 fill-ink text-ink" />
                                            <span>{place.rating}</span>
                                          </div>
                                        </div>
                                      )}

                                      <h4 className="text-base font-display font-bold text-ink group-hover:text-purple transition-colors">
                                        {place.name}
                                      </h4>

                                      <p className="text-xs text-ink-soft mt-1 line-clamp-2 leading-relaxed font-medium">
                                        {place.description}
                                      </p>

                                      {/* Perforated ticket divider */}
                                      <div className="my-2.5 border-b-2 border-dashed border-ink/15" />

                                      {/* Guru Insider Tip */}
                                      {place.insiderTip && (
                                        <div className="bg-sun-soft border border-ink/20 rounded-xl p-2 text-[11px] text-ink leading-snug flex items-start gap-1.5 font-medium">
                                          <Sparkles className="w-3.5 h-3.5 text-sun-deep shrink-0 mt-0.5" />
                                          <span><strong>Guru Tip:</strong> {place.insiderTip}</span>
                                        </div>
                                      )}

                                      {/* Logistics Badges */}
                                      <div className="mt-2.5 pt-2 border-t border-ink/10 text-[11px] text-muted space-y-1 font-medium">
                                        <div className="flex items-center gap-1.5 text-ink font-bold">
                                          <Clock className="w-3 h-3 text-coral-deep shrink-0 stroke-[2.2]" />
                                          <span className="truncate">Best: {place.bestTime}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <Ticket className="w-3 h-3 text-ink shrink-0 stroke-[2.2]" />
                                          <span>Entry: {place.entryFee}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2 border-t border-ink/10 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <a
                                          href={
                                            place.googleMapsUrl ||
                                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                              `${place.name} ${place.address}`
                                            )}`
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs font-bold text-ink bg-sky-soft hover:bg-sky border border-ink rounded-full px-2.5 py-1 flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                          <ExternalLink className="w-3 h-3 stroke-[2.2]" /> Map
                                        </a>
                                        <button
                                          onClick={() => setSelectedPlaceForModal(place)}
                                          className="text-xs font-bold text-ink bg-canvas hover:bg-cream border border-ink rounded-full px-2.5 py-1 flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                          <Info className="w-3 h-3 stroke-[2.2]" /> Details
                                        </button>
                                      </div>

                                      <button
                                        onClick={() => handleAddTrip(place)}
                                        disabled={isAdded}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all border-2 border-ink cursor-pointer ${
                                          isAdded
                                            ? "bg-mint text-ink cursor-default"
                                            : "bg-pill text-white hover:bg-purple shadow-[2px_2px_0_#7b5cf0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                        }`}
                                      >
                                        {isAdded ? (
                                          <>
                                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.2]" /> In Plan
                                          </>
                                        ) : (
                                          <>
                                            <PlusCircle className="w-3.5 h-3.5 stroke-[2.2]" /> + Add
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* FOLLOW-UP PROMPT CHIPS */}
                      {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.suggestedFollowUps.map((prompt, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => handleSendMessage(prompt)}
                              className="text-xs bg-white hover:bg-sun text-ink border-2 border-ink shadow-[2px_2px_0_#1c1b2b] hover:shadow-pop hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none px-3 py-1 rounded-full transition-all flex items-center gap-1 font-bold cursor-pointer"
                            >
                              <span>{prompt}</span>
                            </button>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

              {/* Thinking Indicator */}
              {isThinking && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-2xl border-2 border-ink bg-sun text-ink flex items-center justify-center shrink-0 shadow-[2px_2px_0_#1c1b2b] animate-bounce">
                    <Sparkles className="w-4 h-4 text-ink" />
                  </div>
                  <div className="bg-white text-ink p-3 rounded-2xl rounded-tl-none border-2 border-ink shadow-pop flex items-center gap-2 text-xs font-bold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple" />
                    <span>Travel Guru is exploring ideas for {cityData.name}...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* 5. FLOATING BOTTOM INPUT DOCK */}
            <div className="p-3 bg-white border-t-2 border-ink space-y-1.5 shrink-0">
              {isListening && (
                <div className="bg-coral-soft border-2 border-ink rounded-2xl px-3 py-1.5 flex items-center justify-between text-xs text-ink font-bold shadow-pop animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-deep opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-coral-deep"></span>
                    </span>
                    <span>Listening... Ask anything about {cityData.name}</span>
                  </div>
                  <button
                    onClick={toggleListening}
                    className="bg-ink text-white px-2 py-0.5 rounded-full text-xs font-bold shadow active:scale-95 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}

              {speechError && (
                <div className="text-xs text-danger font-bold bg-pink-soft border-2 border-ink px-3 py-1 rounded-xl shadow-sm">
                  ⚠️ {speechError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-1.5 bg-canvas border-2 border-ink rounded-full p-1 shadow-pop"
              >
                {/* Voice Microphone */}
                {speechSupported ? (
                  <button
                    type="button"
                    onClick={toggleListening}
                    title={isListening ? "Stop listening" : "Speak question"}
                    className={`w-10 h-10 rounded-full border-2 border-ink transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                      isListening
                        ? "bg-coral-deep text-white shadow-pop animate-spin"
                        : "bg-sun hover:bg-sun-deep hover:text-white text-ink shadow-[2px_2px_0_#1c1b2b] hover:shadow-pop active:translate-x-[1px] active:translate-y-[1px]"
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-4 h-4 stroke-[2.2]" />
                    ) : (
                      <Mic className="w-4 h-4 stroke-[2.2]" />
                    )}
                  </button>
                ) : (
                  <div title="Voice input not supported" className="w-10 h-10 rounded-full border border-ink/30 bg-canvas flex items-center justify-center text-muted">
                    <MicOff className="w-4 h-4 stroke-[2.2]" />
                  </div>
                )}

                {/* Text Input */}
                <input
                  type="text"
                  placeholder={
                    isListening
                      ? "Listening to voice prompt..."
                      : `Ask about sights, food, or sunset points in ${cityData.name}...`
                  }
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  disabled={isThinking}
                  className="flex-1 bg-transparent px-3 text-xs sm:text-sm text-ink placeholder:text-muted font-semibold focus:outline-none"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isThinking}
                  className="w-10 h-10 rounded-full border-2 border-ink bg-ink text-white hover:bg-purple flex items-center justify-center shrink-0 shadow-[2px_2px_0_#7b5cf0] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                >
                  <Send className="w-4 h-4 stroke-[2.2]" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 6. RIGHT COLUMN STUDIO DRAWER (Shown side-by-side ONLY in Studio/Expanded Mode) */}
        {isExpanded && isDrawerOpen && (
          <div className="w-80 md:w-92 border-l-2 border-ink bg-canvas-cool flex flex-col shrink-0 transition-all duration-300 overflow-hidden">
            
            {/* Drawer Tabs */}
            <div className="p-3 border-b-2 border-ink bg-white flex items-center justify-between">
              <div className="flex items-center gap-1 bg-canvas p-1 rounded-full border-2 border-ink">
                <button
                  onClick={() => setDrawerTab("trip")}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    drawerTab === "trip"
                      ? "bg-ink text-white shadow-sm"
                      : "text-ink hover:text-purple"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>My Plan</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sun text-ink font-bold">
                    {addedList.length}
                  </span>
                </button>

                <button
                  onClick={() => setDrawerTab("city")}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    drawerTab === "city"
                      ? "bg-ink text-white shadow-sm"
                      : "text-ink hover:text-purple"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Guide</span>
                </button>

                <button
                  onClick={() => setDrawerTab("safety")}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    drawerTab === "safety"
                      ? "bg-danger text-white shadow-sm"
                      : "text-danger hover:bg-pink-soft"
                  }`}
                >
                  <PhoneCall className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>SOS</span>
                </button>
              </div>

              <button
                onClick={() => setIsDrawerOpen(false)}
                className="w-7 h-7 rounded-full border border-ink/40 text-ink hover:bg-pink-soft flex items-center justify-center transition-colors cursor-pointer"
                title="Collapse drawer"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            {/* Render selected drawer content */}
            {drawerTab === "trip" && renderTripPlanContent()}
            {drawerTab === "city" && renderCityGuideContent()}
            {drawerTab === "safety" && renderSafetyContent()}
          </div>
        )}
      </div>

      {/* 7. QUICK DETAILS MODAL */}
      {selectedPlaceForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-2 border-ink rounded-[32px] max-w-lg w-full overflow-hidden shadow-[8px_8px_0_#1c1b2b] relative">
            
            <button
              onClick={() => setSelectedPlaceForModal(null)}
              className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full bg-white border-2 border-ink text-ink hover:bg-pink-soft flex items-center justify-center shadow-sm cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>

            {selectedPlaceForModal.imageUrl && (
              <div className="relative h-48 w-full bg-canvas border-b-2 border-ink">
                <img
                  src={selectedPlaceForModal.imageUrl}
                  alt={selectedPlaceForModal.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-4">
                  <span className="px-3 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-mint text-ink border-2 border-ink shadow-[2px_2px_0_#1c1b2b]">
                    {selectedPlaceForModal.category}
                  </span>
                </div>
              </div>
            )}

            <div className="p-5 space-y-3.5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-display font-bold text-ink">{selectedPlaceForModal.name}</h3>
                  <div className="flex items-center gap-1 text-xs font-bold text-ink bg-sun px-2.5 py-0.5 rounded-full border border-ink shrink-0">
                    <Star className="w-3.5 h-3.5 fill-ink text-ink" />
                    <span>{selectedPlaceForModal.rating}</span>
                  </div>
                </div>
                <p className="text-xs text-muted font-medium flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-coral-deep shrink-0 stroke-[2.2]" />
                  <span>{selectedPlaceForModal.address}</span>
                </p>
              </div>

              <p className="text-xs text-ink-soft leading-relaxed font-medium">
                {selectedPlaceForModal.description}
              </p>

              {selectedPlaceForModal.insiderTip && (
                <div className="bg-sun-soft border-2 border-ink/20 rounded-2xl p-2.5 text-xs text-ink flex items-start gap-2 font-medium">
                  <Sparkles className="w-4 h-4 text-sun-deep shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-ink">Guru Tip: </span>
                    {selectedPlaceForModal.insiderTip}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-canvas p-2.5 rounded-xl border-2 border-ink">
                  <span className="text-[10px] text-muted flex items-center gap-1 font-bold">
                    <Clock className="w-3 h-3 text-coral-deep stroke-[2.2]" /> Best Visiting Time
                  </span>
                  <p className="font-bold text-ink mt-0.5 truncate">{selectedPlaceForModal.bestTime}</p>
                </div>
                <div className="bg-canvas p-2.5 rounded-xl border-2 border-ink">
                  <span className="text-[10px] text-muted flex items-center gap-1 font-bold">
                    <Ticket className="w-3 h-3 text-ink stroke-[2.2]" /> Ticket / Entry
                  </span>
                  <p className="font-bold text-ink mt-0.5 truncate">{selectedPlaceForModal.entryFee}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <a
                  href={
                    selectedPlaceForModal.googleMapsUrl ||
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedPlaceForModal.name} ${selectedPlaceForModal.address}`
                    )}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-white hover:bg-canvas text-ink py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-2 border-ink shadow-pop cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 stroke-[2.2]" /> Maps
                </a>

                <button
                  onClick={() => {
                    handleAddTrip(selectedPlaceForModal);
                    setSelectedPlaceForModal(null);
                  }}
                  disabled={Boolean(addedPlaces[selectedPlaceForModal.id])}
                  className={`flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-2 border-ink cursor-pointer ${
                    addedPlaces[selectedPlaceForModal.id]
                      ? "bg-mint text-ink"
                      : "bg-pill text-white hover:bg-purple shadow-[2px_2px_0_#7b5cf0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  }`}
                >
                  {addedPlaces[selectedPlaceForModal.id] ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.2]" /> In Trip Plan
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4 stroke-[2.2]" /> Add to My Trip
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default TravelGuruChatbot;
