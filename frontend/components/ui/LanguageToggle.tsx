"use client";

import React from "react";
import { TranslateIcon } from "@phosphor-icons/react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/format";

interface LanguageToggleProps {
  className?: string;
  variant?: "pill" | "badge" | "compact";
}

export function LanguageToggle({ className = "", variant = "pill" }: LanguageToggleProps) {
  const { isKannada, toggleLanguage, setLanguage } = useTranslation();

  if (variant === "compact") {
    return (
      <button
        onClick={toggleLanguage}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 text-xs font-bold shadow-pop transition hover:bg-lavender-soft active:scale-95",
          className
        )}
        title={isKannada ? "Switch to English" : "ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಿ"}
        aria-label="Toggle language"
      >
        <TranslateIcon size={14} weight="bold" className="text-purple" />
        <span>{isKannada ? "EN" : "ಕನ್ನಡ"}</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border-2 border-ink bg-white p-0.5 shadow-pop transition",
        className
      )}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-bold transition",
          !isKannada
            ? "bg-ink text-white shadow-sm"
            : "text-ink-soft hover:text-ink"
        )}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLanguage("kn")}
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-bold transition",
          isKannada
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-ink-soft hover:text-ink"
        )}
      >
        ಕನ್ನಡ
      </button>
    </div>
  );
}
