"use client";
import { useId } from "react";
import { cn } from "@/lib/format";

/**
 * AirplaneArt — Hand-drawn clay-style airliner with contrail loops,
 * matching the Prayaana comic-clay design aesthetic.
 */
export function AirplaneArt({
  size = 140,
  className,
  trail = true,
}: {
  size?: number;
  className?: string;
  trail?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={cn("relative inline-block select-none", className)}>
      {trail && (
        <svg
          className="pointer-events-none absolute -left-28 -top-6 h-28 w-36 overflow-visible opacity-70"
          viewBox="0 0 140 80"
          fill="none"
          aria-hidden="true"
        >
          {/* Looping dashed vapor contrail */}
          <path
            d="M 10 70 C 35 72, 52 46, 58 24 C 64 6, 84 8, 85 26 C 86 48, 62 54, 76 66 C 92 76, 116 54, 138 42"
            stroke="#1c1b2b"
            strokeWidth="2.5"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
          {/* Cloud puff at the start of trail */}
          <ellipse cx="14" cy="70" rx="9" ry="5" fill="#fff" stroke="#1c1b2b" strokeWidth="2" />
          <ellipse cx="22" cy="67" rx="7" ry="5" fill="#fff" />
          {/* Mini sparkle */}
          <path
            d="M 98 16 L 100 10 L 102 16 L 108 18 L 102 20 L 100 26 L 98 20 L 92 18 Z"
            fill="#fad47f"
            stroke="#1c1b2b"
            strokeWidth="1"
          />
        </svg>
      )}
      <svg
        width={size}
        height={size * 0.72}
        viewBox="0 0 160 115"
        role="img"
        aria-label="Travel airplane illustration"
        className="overflow-visible drop-shadow-[0_12px_22px_rgba(28,27,43,0.22)]"
      >
        <defs>
          <linearGradient id={`${id}-body`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f5f7fc" />
            <stop offset="100%" stopColor="#d5dff0" />
          </linearGradient>
          <linearGradient id={`${id}-stripe`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7b5cf0" />
            <stop offset="100%" stopColor="#5a3dd4" />
          </linearGradient>
          <linearGradient id={`${id}-wing`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cad6e8" />
          </linearGradient>
          <linearGradient id={`${id}-glass`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c4def8" />
            <stop offset="100%" stopColor="#7cc4e8" />
          </linearGradient>
        </defs>

        {/* Back wing */}
        <path
          d="M 68 38 L 86 10 Q 94 8 98 12 L 86 38 Z"
          fill="#cad6e8"
          stroke="#1c1b2b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Tail horizontal stabilizer */}
        <path
          d="M 18 36 L 4 28 Q 0 30 2 34 L 14 44 Z"
          fill="#cad6e8"
          stroke="#1c1b2b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Tail fin vertical */}
        <path
          d="M 22 45 L 8 16 Q 10 10 18 12 L 38 42 Z"
          fill={`url(#${id}-stripe)`}
          stroke="#1c1b2b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Tail fin accent sticker/star */}
        <circle cx="21" cy="22" r="3.5" fill="#fad47f" stroke="#1c1b2b" strokeWidth="1.2" />

        {/* Fuselage main body */}
        <path
          d="M 12 56 C 12 36, 42 34, 114 36 C 142 37, 154 50, 154 58 C 154 68, 140 76, 112 76 C 44 76, 12 72, 12 56 Z"
          fill={`url(#${id}-body)`}
          stroke="#1c1b2b"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Fuselage decorative coral speed stripe */}
        <path
          d="M 32 60 C 60 59, 110 59, 148 60 C 144 64, 136 67, 120 67 C 65 67, 30 65, 30 65 Z"
          fill="#f08a6c"
          opacity="0.95"
        />

        {/* Cockpit window */}
        <path
          d="M 124 43 Q 138 43, 146 51 L 126 53 Z"
          fill={`url(#${id}-glass)`}
          stroke="#1c1b2b"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M 128 45 L 140 48" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />

        {/* Cabin passenger windows */}
        {[52, 68, 84, 100].map((x) => (
          <rect key={x} x={x} y={46} width={7} height={9} rx={3} fill="#1c1b2b" />
        ))}

        {/* Front main wing */}
        <path
          d="M 64 62 L 92 98 Q 98 102 104 98 L 102 62 Z"
          fill={`url(#${id}-wing)`}
          stroke="#1c1b2b"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Wing glossy shine */}
        <path d="M 72 65 L 94 92" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />

        {/* Jet engine pod under wing */}
        <rect
          x="78"
          y="74"
          width="26"
          height="12"
          rx="6"
          fill="#f9cbc9"
          stroke="#1c1b2b"
          strokeWidth="2.2"
        />
        <ellipse cx="102" cy="80" rx="3" ry="5.5" fill="#fad47f" stroke="#1c1b2b" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/**
 * CarArt — Hand-drawn clay-style road trip car / cab with luggage on roof,
 * matching the Prayaana comic-clay design aesthetic.
 */
export function CarArt({
  size = 150,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={cn("relative inline-block select-none", className)}>
      <svg
        width={size}
        height={size * 0.72}
        viewBox="0 0 170 120"
        role="img"
        aria-label="Travel car illustration"
        className="overflow-visible drop-shadow-[0_12px_22px_rgba(28,27,43,0.22)]"
      >
        <defs>
          <linearGradient id={`${id}-carBody`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe7a0" />
            <stop offset="45%" stopColor="#fad47f" />
            <stop offset="100%" stopColor="#f5b328" />
          </linearGradient>
          <linearGradient id={`${id}-carGlass`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e3f0fc" />
            <stop offset="100%" stopColor="#a5d4f8" />
          </linearGradient>
          <radialGradient id={`${id}-wheel`} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#4a485c" />
            <stop offset="70%" stopColor="#1c1b2b" />
          </radialGradient>
        </defs>

        {/* Luggage on Roof */}
        {/* Suitcase 1 (pink clay) */}
        <rect
          x="58"
          y="16"
          width="42"
          height="16"
          rx="4"
          fill="#f9cbc9"
          stroke="#1c1b2b"
          strokeWidth="2.2"
        />
        <line x1="72" y1="16" x2="72" y2="32" stroke="#1c1b2b" strokeWidth="1.5" />
        <line x1="86" y1="16" x2="86" y2="32" stroke="#1c1b2b" strokeWidth="1.5" />

        {/* Suitcase 2 / Duffel (mint clay) */}
        <rect
          x="70"
          y="6"
          width="32"
          height="12"
          rx="5"
          fill="#d0e8ba"
          stroke="#1c1b2b"
          strokeWidth="2.2"
        />
        {/* Roof rack bars */}
        <line x1="46" y1="32" x2="114" y2="32" stroke="#1c1b2b" strokeWidth="3" strokeLinecap="round" />
        <line x1="54" y1="32" x2="54" y2="38" stroke="#1c1b2b" strokeWidth="2.5" />
        <line x1="106" y1="32" x2="106" y2="38" stroke="#1c1b2b" strokeWidth="2.5" />
        {/* Tie-down straps */}
        <path d="M 52 34 Q 80 4 108 34" fill="none" stroke="#1c1b2b" strokeWidth="1.5" strokeDasharray="3 2" />

        {/* Drop shadow on ground */}
        <ellipse cx="85" cy="106" rx="72" ry="6" fill="#1c1b2b" opacity="0.18" />

        {/* Car Cabin & Hood Path */}
        <path
          d="M 16 86 
             L 24 64 
             Q 34 62 48 62 
             L 60 38 
             Q 66 34 76 34 
             L 112 34 
             Q 122 34 130 46 
             L 142 62 
             L 156 64 
             Q 162 66 162 76 
             L 160 88 
             Q 158 92 148 92 
             L 138 92 
             A 18 18 0 0 0 102 92 
             L 66 92 
             A 18 18 0 0 0 30 92 
             L 20 92 
             Q 16 92 16 86 Z"
          fill={`url(#${id}-carBody)`}
          stroke="#1c1b2b"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Front Windshield */}
        <path
          d="M 122 46 L 136 62 H 106 V 42 H 116 Q 120 42 122 46 Z"
          fill={`url(#${id}-carGlass)`}
          stroke="#1c1b2b"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Windshield glare */}
        <line x1="126" y1="46" x2="114" y2="60" stroke="#fff" strokeWidth="2" strokeLinecap="round" />

        {/* Rear/Side Window */}
        <path
          d="M 68 42 H 98 V 62 H 60 L 66 45 Q 67 42 68 42 Z"
          fill={`url(#${id}-carGlass)`}
          stroke="#1c1b2b"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Side window glare */}
        <line x1="82" y1="45" x2="72" y2="59" stroke="#fff" strokeWidth="2" strokeLinecap="round" />

        {/* Door line */}
        <path d="M 102 42 V 88" stroke="#1c1b2b" strokeWidth="2" />
        {/* Door handle */}
        <rect x="94" y="68" width="6" height="3" rx="1.5" fill="#1c1b2b" />

        {/* Headlight */}
        <circle cx="158" cy="74" r="6" fill="#fff" stroke="#1c1b2b" strokeWidth="2" />
        <circle cx="158" cy="74" r="3.5" fill="#fef3d6" />
        {/* Headlight beam */}
        <path d="M 166 70 L 194 62 L 198 84 L 166 78 Z" fill="#ffe08a" opacity="0.35" />

        {/* Tail light */}
        <rect x="15" y="70" width="5" height="10" rx="2" fill="#c9544f" stroke="#1c1b2b" strokeWidth="1.8" />

        {/* Front Bumper */}
        <rect x="154" y="86" width="12" height="6" rx="3" fill="#ffffff" stroke="#1c1b2b" strokeWidth="2" />
        {/* Rear Bumper */}
        <rect x="10" y="86" width="10" height="6" rx="3" fill="#ffffff" stroke="#1c1b2b" strokeWidth="2" />

        {/* Front Wheel */}
        <g transform="translate(120, 92)">
          <circle cx="0" cy="0" r="15" fill={`url(#${id}-wheel)`} stroke="#1c1b2b" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="7" fill="#ffffff" stroke="#1c1b2b" strokeWidth="2" />
          <circle cx="0" cy="0" r="2.5" fill="#fad47f" />
        </g>

        {/* Rear Wheel */}
        <g transform="translate(48, 92)">
          <circle cx="0" cy="0" r="15" fill={`url(#${id}-wheel)`} stroke="#1c1b2b" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="7" fill="#ffffff" stroke="#1c1b2b" strokeWidth="2" />
          <circle cx="0" cy="0" r="2.5" fill="#fad47f" />
        </g>

        {/* Speed / motion dust puffs behind car */}
        <circle cx="6" cy="94" r="3.5" fill="#fff" stroke="#1c1b2b" strokeWidth="1.2" />
        <circle cx="-3" cy="91" r="2.5" fill="#fff" stroke="#1c1b2b" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

/**
 * TravelTag — Pop-comic travel badge / sticker ("and all").
 */
export function TravelTag({
  text = "TRIP READY",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-ink shadow-pop",
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      {text}
    </div>
  );
}

/**
 * ManWalkingArt — Hand-drawn clay-style traveler walking with backpack.
 */
export function ManWalkingArt({
  size = 64,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={cn("relative inline-block select-none", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label="Traveler walking illustration"
        className="overflow-visible drop-shadow-[0_8px_16px_rgba(28,27,43,0.18)]"
      >
        <defs>
          <linearGradient id={`${id}-skin`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffdfc9" />
            <stop offset="100%" stopColor="#f5be9b" />
          </linearGradient>
          <linearGradient id={`${id}-shirt`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d5f2be" />
            <stop offset="100%" stopColor="#9ed472" />
          </linearGradient>
          <linearGradient id={`${id}-pack`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffb5ab" />
            <stop offset="100%" stopColor="#f08a6c" />
          </linearGradient>
        </defs>

        {/* Shadow on ground */}
        <ellipse cx="48" cy="94" rx="28" ry="4" fill="#1c1b2b" opacity="0.18" />

        {/* Backpack behind back */}
        <rect
          x="18"
          y="34"
          width="18"
          height="28"
          rx="6"
          fill={`url(#${id}-pack)`}
          stroke="#1c1b2b"
          strokeWidth="2.5"
        />
        {/* Backpack top roll */}
        <rect
          x="16"
          y="26"
          width="22"
          height="9"
          rx="4.5"
          fill="#c6b5f6"
          stroke="#1c1b2b"
          strokeWidth="2"
        />
        <line x1="23" y1="26" x2="23" y2="35" stroke="#1c1b2b" strokeWidth="1.5" />
        <line x1="31" y1="26" x2="31" y2="35" stroke="#1c1b2b" strokeWidth="1.5" />

        {/* Back Leg (swung back) */}
        <path
          d="M 44 64 L 32 80 L 22 84"
          fill="none"
          stroke="#1c1b2b"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Back shoe */}
        <ellipse cx="20" cy="85" rx="6" ry="4" fill="#fff" stroke="#1c1b2b" strokeWidth="2" />

        {/* Front Leg (stepping forward) */}
        <path
          d="M 52 64 L 62 78 L 74 88"
          fill="none"
          stroke="#1c1b2b"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Front shoe */}
        <ellipse cx="76" cy="88" rx="7" ry="4.5" fill="#fad47f" stroke="#1c1b2b" strokeWidth="2" />

        {/* Torso / Jacket */}
        <path
          d="M 34 36 L 58 36 Q 64 36 64 42 L 58 66 Q 58 68 52 68 L 38 68 Q 32 68 32 62 L 30 42 Q 30 36 34 36 Z"
          fill={`url(#${id}-shirt)`}
          stroke="#1c1b2b"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Jacket zipper */}
        <line x1="48" y1="36" x2="48" y2="68" stroke="#1c1b2b" strokeWidth="1.8" />
        {/* Backpack strap */}
        <path d="M 38 36 Q 44 48 42 66" fill="none" stroke="#f08a6c" strokeWidth="3" />

        {/* Head */}
        <circle
          cx="52"
          cy="22"
          r="13"
          fill={`url(#${id}-skin)`}
          stroke="#1c1b2b"
          strokeWidth="2.5"
        />
        {/* Eye */}
        <circle cx="58" cy="20" r="1.8" fill="#1c1b2b" />
        {/* Smile */}
        <path d="M 56 25 Q 60 28 62 25" fill="none" stroke="#1c1b2b" strokeWidth="1.6" strokeLinecap="round" />
        {/* Cheek blush */}
        <ellipse cx="54" cy="24" rx="2.5" ry="1.5" fill="#f9cbc9" />

        {/* Bucket Hat */}
        <path
          d="M 38 16 Q 52 6 66 16"
          fill="#fad47f"
          stroke="#1c1b2b"
          strokeWidth="2.5"
        />
        <ellipse cx="52" cy="16" rx="18" ry="4" fill="#fad47f" stroke="#1c1b2b" strokeWidth="2.2" />

        {/* Back Arm */}
        <path
          d="M 36 40 L 26 52 L 20 48"
          fill="none"
          stroke="#1c1b2b"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Front Arm */}
        <path
          d="M 54 40 L 64 50 L 58 58"
          fill="none"
          stroke="#1c1b2b"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="58" cy="58" r="3.5" fill={`url(#${id}-skin)`} stroke="#1c1b2b" strokeWidth="1.8" />

        {/* Walking motion puffs */}
        <circle cx="14" cy="88" r="2.5" fill="#fff" stroke="#1c1b2b" strokeWidth="1" />
        <circle cx="8" cy="85" r="1.8" fill="#fff" stroke="#1c1b2b" strokeWidth="1" />
      </svg>
    </div>
  );
}

/**
 * JourneySequence — Visual travel journey progression:
 * 1. Man walking -> 2. Car -> 3. Plane in sequence!
 */
export function JourneySequence({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative mt-6 flex max-w-md items-center justify-between gap-1.5 rounded-[24px] border-2 border-ink bg-white/90 p-3 shadow-pop backdrop-blur-xs sm:gap-2 sm:p-3.5",
        className
      )}
    >
      {/* 1. Man Walking */}
      <div className="flex flex-col items-center text-center">
        <div className="grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-2xl border-2 border-ink bg-mint-soft shadow-clay-sm transition hover:-translate-y-1">
          <ManWalkingArt size={50} />
        </div>
        <span className="mt-1 text-[11px] font-black uppercase tracking-wider text-ink">
          1. Walk
        </span>
      </div>

      {/* Trail 1: Walking to Car */}
      <div className="flex flex-1 flex-col items-center px-1">
        <svg viewBox="0 0 50 16" className="h-4 w-full overflow-visible" fill="none">
          <path
            d="M 2 8 Q 25 2 48 8"
            stroke="#1c1b2b"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <path d="M 42 4 L 48 8 L 42 12" stroke="#1c1b2b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[10px] font-bold text-muted">Drive</span>
      </div>

      {/* 2. Car */}
      <div className="flex flex-col items-center text-center">
        <div className="grid h-14 w-18 sm:h-16 sm:w-20 place-items-center rounded-2xl border-2 border-ink bg-sun-soft shadow-clay-sm transition hover:-translate-y-1">
          <CarArt size={62} />
        </div>
        <span className="mt-1 text-[11px] font-black uppercase tracking-wider text-ink">
          2. Car
        </span>
      </div>

      {/* Trail 2: Car to Plane */}
      <div className="flex flex-1 flex-col items-center px-1">
        <svg viewBox="0 0 50 16" className="h-4 w-full overflow-visible" fill="none">
          <path
            d="M 2 12 Q 25 16 48 4"
            stroke="#1c1b2b"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <path d="M 42 2 L 48 4 L 44 9" stroke="#1c1b2b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[10px] font-bold text-muted">Fly</span>
      </div>

      {/* 3. Plane */}
      <div className="flex flex-col items-center text-center">
        <div className="grid h-14 w-18 sm:h-16 sm:w-20 place-items-center rounded-2xl border-2 border-ink bg-sky-soft shadow-clay-sm transition hover:-translate-y-1">
          <AirplaneArt size={64} trail={false} />
        </div>
        <span className="mt-1 text-[11px] font-black uppercase tracking-wider text-ink">
          3. Plane
        </span>
      </div>
    </div>
  );
}

