# 🌍 Travel Guru AI Chatbot (Karnataka Travel Companion)

A production-grade, voice-enabled AI travel companion for discovering Karnataka destinations, planning multi-day itineraries, finding iconic regional delicacies, and getting real-time weather advisories.

---

## ✨ Dynamic Features & Enhancements

1. **⚡ Live Real-Time Weather Integration (Zero API Keys)**:
   - Queries live temperature, humidity, wind, and conditions via free Open-Meteo API.
   - Provides dynamic AI travel advisories based on current conditions (e.g. warm midday recommendations vs cool morning viewpoints vs rain preparations).

2. **🌐 Karnataka Curated Destinations**:
   - Supports **16 pre-indexed iconic destinations** across Karnataka (Bengaluru, Mysuru, Hampi, Coorg, Chikmagalur, Gokarna, Badami, Udupi, Mangalore, Dandeli, Kabini, Bandipur, Jog Falls, Sakleshpur, Belur-Halebidu, Murdeshwar).
   - Plus dynamic geocoding for **ANY custom city** entered by the user (e.g., Pune, Shimla, Srinagar, Bangalore, or international cities) with automatic coordinates, live weather, and contextual landmark generation!

3. **🗓️ Dynamic Multi-Day Itinerary Engine**:
   - Intelligently generates structured 1-Day, 2-Day (Weekend), or 3-Day trip schedules.
   - Organizes stops chronologically: Morning Heritage Walks, Midday Regional Feasts, Golden Hour Sunsets, and Night Bazaars.
   - Calculates estimated activity and meal budgets per person.

4. **🎙️ Voice Speech-to-Text & Text-to-Speech**:
   - Browser Web Speech API (`useSpeech`) for hands-free voice search.
   - Text-to-Speech audio reader with animated waveform and mute/replay controls.

5. **🔍 Dynamic Category Filtering & Instant Search**:
   - Filter sights on-the-fly: `🏛️ Heritage`, `🍲 Food & Markets`, `🌅 Views & Sunset`, `✨ Hidden Gems`, `🕉️ Spiritual`.
   - Real-time search bar to search places by name, tag, or description.

6. **📱 "My Trip Plan" Drawer & Export Tools**:
   - Add/remove places with one click.
   - Live budget calculator (Entry tickets + Food estimates + Cab transit estimate).
   - **Share via WhatsApp** (one-click formatted itinerary sharing).
   - **Open Route in Google Maps** (automatic multi-stop navigation link).
   - **Copy to Clipboard** formatted text plan.

7. **🚨 24/7 Official Emergency SOS Directory**:
   - Dedicated SOS panel with official helpline numbers (Police 112/100, Tourist Helpline 1363, Medical Ambulance 108) with one-tap dialing.

---

## 📁 Package Structure

```
travel-guru-chatbot-export/
├── index.ts                           # Single entry barrel export
├── components/
│   ├── TravelGuruChatbot.tsx          # Full-featured voice, weather & city guide chatbot
│   ├── TravelGuruFloatingWidget.tsx   # Floating launcher button + modal dialog
│   └── TravelGuruQuickAssistant.tsx   # Dynamic lightweight assistant popover
├── services/
│   ├── travelGuruService.ts           # Dynamic weather, geocoding & AI heuristic engine
│   └── quickAiService.ts              # Dynamic quick assistant intent responses
├── hooks/
│   └── useSpeech.ts                   # Speech recognition & synthesis hook
└── types/
    └── index.ts                       # TypeScript interfaces
```

---

## 🚀 Quick Setup in Any React / Next.js Project

### 1. Install Icon Dependency
```bash
npm install lucide-react
```

### 2. Full-Screen Page Usage
```tsx
import { TravelGuruChatbot } from "@/components/travel-guru";

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-6 flex items-center justify-center">
      <div className="w-full max-w-5xl">
        <TravelGuruChatbot 
          initialCity="Ahmedabad" 
          onAddPlaceToTrip={(place) => console.log("Added:", place)}
        />
      </div>
    </main>
  );
}
```

### 3. Floating Global Widget Usage
Place globally in `layout.tsx` so users can open Travel Guru from any screen:
```tsx
import { TravelGuruFloatingWidget } from "@/components/travel-guru";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <TravelGuruFloatingWidget initialCity="Bengaluru" />
      </body>
    </html>
  );
}
```
