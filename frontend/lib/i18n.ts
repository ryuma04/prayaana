import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTravelerStore } from "@/stores/travelerStore";

export type SupportedLanguage = "en" | "kn";

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Brand & App
    appName: "Prayaana",
    appTagline: "AI-Powered Karnataka Travel Planner",
    karnatakaOnly: "Limited exclusively to Karnataka",

    // Navigation
    navDiscover: "Discover",
    navPlan: "Plan",
    navMyTrip: "My Trip",
    navTrip: "Trip",
    navProfile: "Profile",
    navLive: "Live",
    navTripLive: "Trip live",
    navHowItWorks: "How it works",
    navFeatures: "Features",
    navForOperators: "For operators",
    navDestinations: "Destinations",

    // Auth & Actions
    logIn: "Log in",
    signUp: "Sign up",
    logOut: "Log out",
    signOut: "Sign out",
    getStarted: "Get started",
    startPlanning: "Start planning",
    openApp: "Open app",
    switchAccount: "Switch account",
    retakeQuiz: "Retake quiz",
    profileAndDNA: "Profile & Travel DNA",

    // Landing Hero
    heroTitle: "Plan your own Karnataka journey.",
    heroSubtitle: "An autonomous AI travel operator exclusively for Karnataka — custom itineraries across 16 iconic destinations, instant weather & Ghat rerouting, and guaranteed bookings.",
    heroBadge: "🌿 Exclusively Karnataka",
    heroCtaStart: "Start planning your trip",
    heroCtaQuiz: "Take the 2-min DNA quiz",

    // Profile & Settings
    settings: "Settings",
    autoApproveLimit: "Auto-approve limit",
    autoApproveDesc: "If something goes wrong on your trip, we fix it for you automatically when the extra cost is under this amount. Anything more, we ask you first.",
    language: "Language",
    languageSelect: "Display language",
    notifications: "Notifications",
    badgesAndXp: "Badges & XP",
    savedPlaces: "Saved places",
    myBookings: "My Bookings",
    travelDnaTitle: "Your Travel DNA",

    // Discover & Circuits
    exploreKarnataka: "Explore Karnataka",
    exploreSubtitle: "From the misty coffee valleys of Coorg to the grand stone temples of Hampi",
    allRegions: "All 5 Regions",
    allDestinations: "16 Curated Destinations",
    curatedCircuits: "Curated Circuits",
    viewDetails: "View details",
    regionMalenadu: "Malenadu (Western Ghats)",
    regionKaravali: "Karavali (Coastal Karnataka)",
    regionAitihasika: "Aitihasika (Royal Heritage)",
    regionAranya: "Aranya (Wildlife & Rainforests)",
    regionRajadhani: "Rajadhani (Capital & Royal)",

    // Trip & Planning
    planTrip: "Plan a Trip",
    tripDuration: "Duration",
    tripBudget: "Budget per person",
    tripDates: "Travel dates",
    generateItinerary: "Generate Itinerary",
    customPace: "Trip Pace",
    interests: "Your Interests",
    travelers: "Travelers",
    viewItinerary: "View Itinerary",
    saveTrip: "Save trip",
    bookNow: "Book now",

    // General
    search: "Search",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    days: "Days",
    nights: "Nights",
    rupees: "₹",
    offlinePass: "Offline Trip Pass",
    weatherAlert: "Weather Alert",
    safeAndVerified: "100% Verified Karnataka Local Partners",
  },
  kn: {
    // Brand & App
    appName: "ಪ್ರಯಾಣ",
    appTagline: "ಎಐ ಆಧಾರಿತ ಕರ್ನಾಟಕ ಪ್ರವಾಸ ಯೋಜಕ",
    karnatakaOnly: "ಕೇವಲ ಕರ್ನಾಟಕಕ್ಕೆ ಮಾತ್ರ ಸೀಮಿತ",

    // Navigation
    navDiscover: "ಅನ್ವೇಷಿಸಿ",
    navPlan: "ಯೋಜನೆ",
    navMyTrip: "ನನ್ನ ಪ್ರವಾಸ",
    navTrip: "ಪ್ರವಾಸ",
    navProfile: "ಪ್ರೊಫೈಲ್",
    navLive: "ಲೈವ್",
    navTripLive: "ಪ್ರವಾಸ ಚಾಲನೆಯಲ್ಲಿದೆ",
    navHowItWorks: "ಕಾರ್ಯವಿಧಾನ",
    navFeatures: "ವೈಶಿಷ್ಟ್ಯಗಳು",
    navForOperators: "ಆಪರೇಟರ್‌ಗಳಿಗಾಗಿ",
    navDestinations: "ತಾಣಗಳು",

    // Auth & Actions
    logIn: "ಲಾಗಿನ್",
    signUp: "ಸೈನ್ ಅಪ್",
    logOut: "ನಿರ್ಗಮಿಸಿ",
    signOut: "ಸೈನ್ ಔಟ್",
    getStarted: "ಪ್ರಾರಂಭಿಸಿ",
    startPlanning: "ಯೋಜನೆ ಪ್ರಾರಂಭಿಸಿ",
    openApp: "ಆ್ಯಪ್ ತೆರೆಯಿರಿ",
    switchAccount: "ಖಾತೆ ಬದಲಾಯಿಸಿ",
    retakeQuiz: "ರಸಪ್ರಶ್ನೆ ಮರುಪ್ರಯತ್ನಿಸಿ",
    profileAndDNA: "ಪ್ರೊಫೈಲ್ & ಟ್ರಾವೆಲ್ ಡಿಎನ್‌ಎ",

    // Landing Hero
    heroTitle: "ನಿಮ್ಮದೇ ಕರ್ನಾಟಕ ಪ್ರವಾಸವನ್ನು ಯೋಜಿಸಿ.",
    heroSubtitle: "ಕರ್ನಾಟಕಕ್ಕೆ ಮಾತ್ರ ಮೀಸಲಾದ ಸ್ವಾಯತ್ತ ಎಐ ಪ್ರವಾಸ ನಿರ್ವಾಹಕ — 16 ಪ್ರಮುಖ ತಾಣಗಳಲ್ಲಿ ವೈಯಕ್ತಿಕ ಪ್ರವಾಸ ಪಟ್ಟಿ, ಹವಾಮಾನ ಮತ್ತು ಘಾಟ್ ರಸ್ತೆಗಳ ಬದಲಾವಣೆಗೆ ತಕ್ಷಣದ ಪರಿಹಾರ.",
    heroBadge: "🌿 ಸಂಪೂರ್ಣ ಕರ್ನಾಟಕ ಮಾತ್ರ",
    heroCtaStart: "ಪ್ರವಾಸ ಯೋಜನೆ ಪ್ರಾರಂಭಿಸಿ",
    heroCtaQuiz: "2 ನಿಮಿಷದ ಡಿಎನ್‌ಎ ರಸಪ್ರಶ್ನೆ",

    // Profile & Settings
    settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    autoApproveLimit: "ಸ್ವಯಂ ಅನುಮೋದನೆ ಮಿತಿ",
    autoApproveDesc: "ಪ್ರವಾಸದಲ್ಲಿ ಅಡಚಣೆಯುಂಟಾದರೆ, ಈ ಮಿತಿಗಿಂತ ಕಡಿಮೆ ವೆಚ್ಚವಿದ್ದರೆ ನಾವು ತಕ್ಷಣ ಸರಿಪಡಿಸುತ್ತೇವೆ. ಹೆಚ್ಚಿನ ವೆಚ್ಚವಿದ್ದರೆ ನಿಮ್ಮ ಅನುಮತಿ ಕೇಳುತ್ತೇವೆ.",
    language: "ಭಾಷೆ",
    languageSelect: "ಪ್ರದರ್ಶನ ಭಾಷೆ",
    notifications: "ಸೂಚನೆಗಳು",
    badgesAndXp: "ಬ್ಯಾಡ್ಜ್‌ಗಳು ಮತ್ತು ಎಕ್ಸ್‌ಪಿ",
    savedPlaces: "ಉಳಿಸಿದ ತಾಣಗಳು",
    myBookings: "ನನ್ನ ಬುಕಿಂಗ್‌ಗಳು",
    travelDnaTitle: "ನಿಮ್ಮ ಟ್ರಾವೆಲ್ ಡಿಎನ್‌ಎ",

    // Discover & Circuits
    exploreKarnataka: "ಕರ್ನಾಟಕವನ್ನು ಅನ್ವೇಷಿಸಿ",
    exploreSubtitle: "ಕೂರ್ಗ್‌ನ ಕಾಫಿ ತೋಟಗಳಿಂದ ಹಂಪಿಯ ವಿಶ್ವವಿಖ್ಯಾತ ಶಿಲ್ಪಕಲೆಯವರೆಗೆ",
    allRegions: "5 ಪ್ರಮುಖ ಪ್ರಾಂತಗಳು",
    allDestinations: "16 ಪ್ರವಾಸಿ ತಾಣಗಳು",
    curatedCircuits: "ವಿಶೇಷ ಪ್ರವಾಸ ಮಾರ್ಗಗಳು",
    viewDetails: "ವಿವರಗಳನ್ನು ನೋಡಿ",
    regionMalenadu: "ಮಲೆನಾಡು (ಪಶ್ಚಿಮ ಘಟ್ಟಗಳು)",
    regionKaravali: "ಕರಾವಳಿ (ಅರಬ್ಬಿ ಸಮುದ್ರ ತೀರ)",
    regionAitihasika: "ಐತಿಹಾಸಿಕ (ರಾಜಮನೆತನಗಳ ಪರಂಪರೆ)",
    regionAranya: "ಅರಣ್ಯ (ವನ್ಯಜೀವಿ ಅಭಯಾರಣ್ಯ)",
    regionRajadhani: "ರಾಜಧಾನಿ ಮತ್ತು ಅರಮನೆ ನಗರಿ",

    // Trip & Planning
    planTrip: "ಪ್ರವಾಸ ಯೋಜಿಸಿ",
    tripDuration: "ಅವಧಿ",
    tripBudget: "ಪ್ರತಿ ವ್ಯಕ್ತಿಗೆ ಬಜೆಟ್",
    tripDates: "ಪ್ರವಾಸದ ದಿನಾಂಕಗಳು",
    generateItinerary: "ಪ್ರವಾಸ ಪಟ್ಟಿ ರಚಿಸಿ",
    customPace: "ಪ್ರವಾಸದ ವೇಗ",
    interests: "ನಿಮ್ಮ ಆಸಕ್ತಿಗಳು",
    travelers: "ಪ್ರಯಾಣಿಕರು",
    viewItinerary: "ಪ್ರವಾಸ ಪಟ್ಟಿ ವೀಕ್ಷಿಸಿ",
    saveTrip: "ಪ್ರವಾಸ ಉಳಿಸಿ",
    bookNow: "ಈಗಲೇ ಬುಕ್ ಮಾಡಿ",

    // General
    search: "ಹುಡುಕಿ",
    cancel: "ರದ್ದುಮಾಡಿ",
    confirm: "ದೃಢೀಕರಿಸಿ",
    save: "ಉಳಿಸಿ",
    days: "ದಿನಗಳು",
    nights: "ರಾತ್ರಿಗಳು",
    rupees: "₹",
    offlinePass: "ಆಫ್‌ಲೈನ್ ಟ್ರಿಪ್ ಪಾಸ್",
    weatherAlert: "ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ",
    safeAndVerified: "100% ಅಧಿಕೃತ ಕರ್ನಾಟಕ ಸ್ಥಳೀಯ ಪಾಲುದಾರರು",
  },
};

/**
 * Normalizes user language string to supported "en" or "kn".
 */
export function normalizeLanguage(lang?: string | null): SupportedLanguage {
  if (!lang) return "en";
  const s = lang.toLowerCase();
  if (s.includes("kannada") || s.includes("karnataka") || s.includes("ಕನ್ನಡ") || s === "kn") {
    return "kn";
  }
  return "en";
}

/**
 * Hook to access current language and translations.
 */
export function useTranslation() {
  const currentLang = useTravelerStore((s) => s.language);
  const setTravelerLanguage = useTravelerStore((s) => s.setLanguage);

  const lang: SupportedLanguage = normalizeLanguage(currentLang);
  const isKannada = lang === "kn";

  const t = (key: string, fallback?: string): string => {
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? fallback ?? key;
  };

  const toggleLanguage = () => {
    const nextLang = isKannada ? "English" : "ಕನ್ನಡ (Kannada)";
    setTravelerLanguage(nextLang);
  };

  const setLanguage = (target: "en" | "kn" | string) => {
    if (target === "kn" || target.toLowerCase().includes("kannada") || target.includes("ಕನ್ನಡ")) {
      setTravelerLanguage("ಕನ್ನಡ (Kannada)");
    } else {
      setTravelerLanguage("English");
    }
  };

  return {
    t,
    lang,
    isKannada,
    toggleLanguage,
    setLanguage,
    languageLabel: isKannada ? "ಕನ್ನಡ" : "English",
  };
}
