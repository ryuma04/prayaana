"use client";

import React, { useState } from "react";
import { Compass, X } from "lucide-react";
import { TravelGuruChatbot } from "./TravelGuruChatbot";
import { PlaceRecommendation } from "../types";

export interface TravelGuruFloatingWidgetProps {
  initialCity?: string;
  onAddPlaceToTrip?: (place: PlaceRecommendation) => void;
}

export function TravelGuruFloatingWidget({
  initialCity = "Ahmedabad",
  onAddPlaceToTrip
}: TravelGuruFloatingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tripCount, setTripCount] = useState(0);

  const handlePlaceAdded = (place: PlaceRecommendation) => {
    setTripCount((prev) => prev + 1);
    if (onAddPlaceToTrip) {
      onAddPlaceToTrip(place);
    }
  };

  return (
    <>
      {/* FLOATING TRIGGER BUTTON (Docked bottom-right at bottom-6 right-6) */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 select-none">
        {/* Circular Clay Launcher Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close Travel Guru AI" : "Open Travel Guru AI"}
          className="relative group w-14 h-14 rounded-full border-2 border-ink bg-sun text-ink flex items-center justify-center shadow-pop hover:-translate-y-1 hover:shadow-pop-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
        >
          {isOpen ? (
            <X className="w-6 h-6 stroke-[2.5]" />
          ) : (
            <>
              <Compass className="w-7 h-7 stroke-[2.2] group-hover:rotate-45 transition-transform duration-300" />
              
              {/* Online Green Pulsing Beacon */}
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sun opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-ink"></span>
              </span>

              {/* Trip Count Pill Badge if user has planned items */}
              {tripCount > 0 && (
                <span className="absolute -bottom-1 -left-1 px-1.5 py-0.2 rounded-full bg-pill text-white text-[10px] font-bold border-2 border-ink shadow-sm">
                  {tripCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* CHATBOT WINDOW: DUAL MODES (COMPACT DOCKED CONCIERGE vs EXPANDED STUDIO) */}
      {isOpen && (
        <>
          {/* MODE A: EXPANDED STUDIO OVERLAY (Centered 2-Column Power Planner) */}
          {isExpanded ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-5xl h-[88vh] max-h-[860px] bg-canvas border-2 border-ink rounded-[32px] shadow-[10px_10px_0_#1c1b2b] overflow-hidden flex flex-col">
                <TravelGuruChatbot
                  initialCity={initialCity}
                  className="h-full border-none rounded-none shadow-none"
                  isExpanded={true}
                  onToggleExpand={() => setIsExpanded(false)}
                  onClose={() => setIsOpen(false)}
                  onAddPlaceToTrip={handlePlaceAdded}
                />
              </div>
            </div>
          ) : (
            /* MODE B: COMPACT DOCKED CONCIERGE (Floating bottom-right popover) */
            <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[460px] md:w-[480px] h-[640px] max-h-[calc(100vh-7.5rem)] bg-canvas border-2 border-ink rounded-[32px] shadow-[8px_8px_0_#1c1b2b] overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-200">
              <TravelGuruChatbot
                initialCity={initialCity}
                className="h-full border-none rounded-none shadow-none"
                isExpanded={false}
                onToggleExpand={() => setIsExpanded(true)}
                onClose={() => setIsOpen(false)}
                onAddPlaceToTrip={handlePlaceAdded}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

export default TravelGuruFloatingWidget;
