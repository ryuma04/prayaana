"use client";
import { useId } from "react";

export type ZippyMood = "happy" | "thinking" | "worried" | "celebrate" | "sleepy" | "wink";

/** Zippy — the happy suitcase mascot, drawn in clay style. */
export function Zippy({ mood = "happy", size = 96, className }: { mood?: ZippyMood; size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label={`Zippy the suitcase, ${mood}`}>
      <defs>
        <radialGradient id={`${id}-body`} cx="35%" cy="25%" r="85%">
          <stop offset="0%" stopColor="#ffb79f" />
          <stop offset="55%" stopColor="#f08a6c" />
          <stop offset="100%" stopColor="#d9694b" />
        </radialGradient>
        <radialGradient id={`${id}-sheen`} cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="#1c1b2b" opacity="0.12" />
      {/* handle */}
      <path d="M44 32 V22 a8 8 0 0 1 8 -8 h16 a8 8 0 0 1 8 8 V32" fill="none" stroke="#1c1b2b" strokeWidth="6" strokeLinecap="round" />
      {/* wheels */}
      <circle cx="36" cy="104" r="6" fill="#1c1b2b" />
      <circle cx="84" cy="104" r="6" fill="#1c1b2b" />
      {/* body */}
      <rect x="16" y="28" width="88" height="74" rx="20" fill={`url(#${id}-body)`} stroke="#1c1b2b" strokeWidth="3" />
      <rect x="22" y="31" width="76" height="26" rx="13" fill={`url(#${id}-sheen)`} />
      {/* straps */}
      <rect x="30" y="29" width="9" height="72" rx="3" fill="#c6b5f6" opacity="0.95" />
      <rect x="81" y="29" width="9" height="72" rx="3" fill="#c6b5f6" opacity="0.95" />
      {/* sticker */}
      <circle cx="92" cy="86" r="9" fill="#d0e8ba" stroke="#1c1b2b" strokeWidth="2" />
      <path d="M92 81 l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="#1c1b2b" />
      {/* cheeks */}
      <ellipse cx="44" cy="72" rx="6" ry="3.6" fill="#f9cbc9" opacity="0.9" />
      <ellipse cx="76" cy="72" rx="6" ry="3.6" fill="#f9cbc9" opacity="0.9" />
      <Face mood={mood} />
    </svg>
  );
}

function Face({ mood }: { mood: ZippyMood }) {
  const ink = "#1c1b2b";
  switch (mood) {
    case "sleepy":
      return (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M44 62 q5 4 10 0" />
          <path d="M66 62 q5 4 10 0" />
          <path d="M55 78 q5 3 10 0" />
          <text x="92" y="30" fontSize="12" fontWeight="800" fill={ink} stroke="none" fontFamily="sans-serif">z</text>
          <text x="100" y="20" fontSize="9" fontWeight="800" fill={ink} stroke="none" fontFamily="sans-serif">z</text>
        </g>
      );
    case "worried":
      return (
        <g>
          <path d="M42 54 l10 3" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M78 54 l-10 3" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <circle cx="49" cy="63" r="4.5" fill={ink} />
          <circle cx="71" cy="63" r="4.5" fill={ink} />
          <path d="M52 80 q4 -4 8 0 t8 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M96 44 q4 7 0 9 q-4 -2 0 -9z" fill="#c4def8" stroke={ink} strokeWidth="1.5" />
        </g>
      );
    case "thinking":
      return (
        <g>
          <circle cx="51" cy="60" r="4.5" fill={ink} />
          <circle cx="73" cy="60" r="4.5" fill={ink} />
          <circle cx="52.5" cy="58.5" r="1.4" fill="#fff" />
          <circle cx="74.5" cy="58.5" r="1.4" fill="#fff" />
          <circle cx="62" cy="79" r="3.5" fill="none" stroke={ink} strokeWidth="3" />
          <circle cx="98" cy="22" r="3" fill="#fff" stroke={ink} strokeWidth="1.5" />
          <circle cx="106" cy="12" r="4.5" fill="#fff" stroke={ink} strokeWidth="1.5" />
        </g>
      );
    case "celebrate":
      return (
        <g>
          <path d="M44 62 q5 -6 10 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M66 62 q5 -6 10 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M48 74 q12 16 24 0 z" fill={ink} />
          <path d="M53 78 q7 6 14 0" fill="#f9cbc9" />
          <rect x="8" y="16" width="6" height="6" rx="1" fill="#fad47f" transform="rotate(20 11 19)" />
          <rect x="104" y="30" width="6" height="6" rx="1" fill="#7b5cf0" transform="rotate(-15 107 33)" />
          <circle cx="14" cy="40" r="3" fill="#d0e8ba" />
          <circle cx="110" cy="10" r="3" fill="#f9cbc9" />
        </g>
      );
    case "wink":
      return (
        <g>
          <circle cx="50" cy="62" r="4.5" fill={ink} />
          <circle cx="51.5" cy="60.5" r="1.4" fill="#fff" />
          <path d="M66 63 q5 -5 10 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M50 75 q10 10 20 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="50" cy="62" r="4.5" fill={ink} />
          <circle cx="70" cy="62" r="4.5" fill={ink} />
          <circle cx="51.5" cy="60.5" r="1.4" fill="#fff" />
          <circle cx="71.5" cy="60.5" r="1.4" fill="#fff" />
          <path d="M50 75 q10 10 20 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}
