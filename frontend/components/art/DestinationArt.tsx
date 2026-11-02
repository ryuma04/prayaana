"use client";
import { useId, type ReactNode } from "react";
import type { ArtKind } from "@/types";
import { cn } from "@/lib/format";

/**
 * Hand-drawn clay-style scenes for each destination (no stock photos).
 * viewBox 320×200, scales to any card.
 */
export function DestinationArt({ kind, className, rain }: { kind: ArtKind; className?: string; rain?: boolean }) {
  const id = useId().replace(/:/g, "");
  const g = (name: string) => `url(#${id}-${name})`;
  const Scene = SCENES[kind];
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className={cn("h-full w-full", className)} role="img" aria-label={`${kind} illustration`}>
      <defs>
        <linearGradient id={`${id}-skyBlue`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fc8f3" />
          <stop offset="1" stopColor="#e3effc" />
        </linearGradient>
        <linearGradient id={`${id}-skyPink`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6b3ae" />
          <stop offset="1" stopColor="#fde4e2" />
        </linearGradient>
        <linearGradient id={`${id}-skySun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbc76a" />
          <stop offset="1" stopColor="#fef3d6" />
        </linearGradient>
        <linearGradient id={`${id}-skyLav`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b7a4f3" />
          <stop offset="1" stopColor="#ece5fe" />
        </linearGradient>
        <linearGradient id={`${id}-skyMint`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b8dfa0" />
          <stop offset="1" stopColor="#f1f8e9" />
        </linearGradient>
        <linearGradient id={`${id}-skyCoral`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f39a7f" />
          <stop offset="0.6" stopColor="#fbd0a8" />
          <stop offset="1" stopColor="#fdeedc" />
        </linearGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4e8" />
          <stop offset="1" stopColor="#4a9fd0" />
        </linearGradient>
        <linearGradient id={`${id}-turq`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fd6d0" />
          <stop offset="1" stopColor="#2fa5b7" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="1" stopColor="#ffc23d" />
        </radialGradient>
        <radialGradient id={`${id}-shine`} cx="50%" cy="0%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Scene g={g} />
      {rain && <Rain />}
    </svg>
  );
}

type SceneFn = (p: { g: (n: string) => string }) => ReactNode;

const Cloud = ({ x, y, s = 1, o = 0.95 }: { x: number; y: number; s?: number; o?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <ellipse cx="0" cy="0" rx="22" ry="12" fill="#fff" />
    <ellipse cx="18" cy="-6" rx="16" ry="12" fill="#fff" />
    <ellipse cx="34" cy="2" rx="16" ry="10" fill="#fff" />
  </g>
);

const Pine = ({ x, y, s = 1, c = "#4f9a4a" }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-2" y="18" width="4" height="8" rx="1" fill="#7a5436" />
    <path d="M0 -14 L12 6 H-12 Z" fill={c} />
    <path d="M0 -4 L15 18 H-15 Z" fill={c} />
    <path d="M0 -14 L6 -4 H-3 Z" fill="#fff" opacity="0.25" />
  </g>
);

const Palm = ({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
    <path d="M0 0 C 4 -20, 2 -40, 8 -60" stroke="#8a5a36" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M8 -60 C -10 -66,-24 -58,-30 -48 C -16 -56,-4 -56,8 -60Z" fill="#3f9a4d" />
    <path d="M8 -60 C 26 -70, 40 -62, 44 -50 C 30 -58, 18 -58, 8 -60Z" fill="#4fae5c" />
    <path d="M8 -60 C 0 -80, 16 -88, 26 -84 C 16 -80, 10 -72, 8 -60Z" fill="#3f9a4d" />
    <path d="M8 -60 C -8 -74,-22 -74,-26 -68 C -14 -70,-4 -66, 8 -60Z" fill="#58b765" />
    <circle cx="6" cy="-56" r="3.5" fill="#7a5436" />
    <circle cx="11" cy="-55" r="3.5" fill="#7a5436" />
  </g>
);

const Sun = ({ g, x, y, r = 22 }: { g: (n: string) => string; x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r + 10} fill="#ffe08a" opacity="0.35" />
    <circle cx={x} cy={y} r={r} fill={g("sun")} />
  </g>
);

const Rain = () => (
  <g opacity="0.85">
    <rect width="320" height="200" fill="#1c1b2b" opacity="0.18" />
    {Array.from({ length: 34 }).map((_, i) => {
      const x = (i * 37) % 330;
      const y = (i * 53) % 180;
      return <path key={i} d={`M${x} ${y} l-6 14`} stroke="#e3effc" strokeWidth="2.2" strokeLinecap="round" />;
    })}
    <g transform="translate(40 26)">
      <ellipse cx="0" cy="0" rx="30" ry="14" fill="#8f9bb3" />
      <ellipse cx="26" cy="-6" rx="22" ry="15" fill="#9aa6be" />
      <ellipse cx="50" cy="2" rx="22" ry="12" fill="#8f9bb3" />
    </g>
    <g transform="translate(210 36)">
      <ellipse cx="0" cy="0" rx="30" ry="14" fill="#8f9bb3" />
      <ellipse cx="26" cy="-6" rx="22" ry="15" fill="#9aa6be" />
      <ellipse cx="50" cy="2" rx="22" ry="12" fill="#8f9bb3" />
    </g>
  </g>
);

const SCENES: Record<ArtKind, SceneFn> = {
  mountain: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skyBlue")} />
      <Sun g={g} x={252} y={46} r={18} />
      <Cloud x={50} y={40} s={0.9} />
      <Cloud x={170} y={62} s={0.7} o={0.8} />
      <path d="M-10 150 L60 60 L110 120 L160 52 L230 130 L280 70 L340 140 V200 H-10Z" fill="#a592e6" />
      <path d="M60 60 L74 78 L64 76 L54 84 L48 76Z M160 52 L176 72 L164 70 L152 80 L146 70Z M280 70 L294 88 L284 86 L274 92 L268 84Z" fill="#fff" />
      <path d="M-10 170 L50 110 L100 150 L150 104 L210 160 L260 118 L340 168 V200 H-10Z" fill="#7fb86e" />
      <path d="M-10 185 Q80 160 160 180 T340 176 V200 H-10Z" fill="#5ea354" />
      <Pine x={40} y={160} s={1.1} />
      <Pine x={62} y={168} s={0.9} c="#3f8a3d" />
      <Pine x={250} y={162} s={1.2} c="#3f8a3d" />
      <Pine x={276} y={170} s={0.9} />
      <g transform="translate(140 158)">
        <rect x="0" y="0" width="36" height="24" rx="3" fill="#f7d9b5" stroke="#1c1b2b" strokeWidth="2" />
        <path d="M-6 2 L18 -16 L42 2Z" fill="#c9544f" stroke="#1c1b2b" strokeWidth="2" strokeLinejoin="round" />
        <rect x="14" y="10" width="9" height="14" rx="2" fill="#7a5436" />
      </g>
      {/* Scenic mountain road */}
      <path d="M-10 190 Q90 174 180 188 T340 182" stroke="#dcd6c8" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M-10 190 Q90 174 180 188 T340 182" stroke="#fff" strokeWidth="1.6" strokeDasharray="6 6" fill="none" />
      {/* Mini travel cab on mountain road */}
      <g transform="translate(95 174) scale(0.18)">
        <ellipse cx="60" cy="74" rx="50" ry="4" fill="#1c1b2b" opacity="0.25" />
        <path d="M12 55 L20 40 Q28 38 38 38 L48 24 Q54 22 62 22 L86 22 Q94 22 100 30 L110 40 L120 42 Q125 44 125 50 L123 58 Q122 62 114 62 L106 62 A13 13 0 0 0 80 62 L48 62 A13 13 0 0 0 22 62 L15 62 Q12 62 12 55 Z" fill="#fad47f" stroke="#1c1b2b" strokeWidth="2.5" />
        <path d="M88 30 L98 40 H76 V26 H84 Q86 26 88 30 Z" fill="#c4def8" stroke="#1c1b2b" strokeWidth="1.8" />
        <path d="M52 26 H72 V40 H46 L50 28 Q51 26 52 26 Z" fill="#c4def8" stroke="#1c1b2b" strokeWidth="1.8" />
        <circle cx="35" cy="62" r="10" fill="#1c1b2b" />
        <circle cx="35" cy="62" r="4" fill="#fff" />
        <circle cx="93" cy="62" r="10" fill="#1c1b2b" />
        <circle cx="93" cy="62" r="4" fill="#fff" />
      </g>
      {/* Tiny plane in mountain sky */}
      <g transform="translate(108 32) scale(0.24) rotate(-6)">
        <path d="M-30 20 Q-10 15 15 17" stroke="#1c1b2b" strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.6" />
        <path d="M8 30 L22 10 Q28 9 30 12 L22 30 Z" fill="#cad6e8" stroke="#1c1b2b" strokeWidth="2" />
        <path d="M-8 28 L-18 22 Q-21 24 -19 27 L-10 34 Z" fill="#cad6e8" stroke="#1c1b2b" strokeWidth="2" />
        <path d="M-5 34 L-15 12 Q-14 8 -8 9 L6 32 Z" fill="#7b5cf0" stroke="#1c1b2b" strokeWidth="2" />
        <path d="M-12 40 C-12 26 10 24 55 26 C72 27 80 36 80 41 C80 48 70 54 53 54 C10 54 -12 51 -12 40 Z" fill="#fff" stroke="#1c1b2b" strokeWidth="2.5" />
        <path d="M60 31 Q70 31 75 36 L62 38 Z" fill="#c4def8" stroke="#1c1b2b" strokeWidth="1.8" />
        <path d="M22 44 L40 68 Q44 71 48 68 L46 44 Z" fill="#cad6e8" stroke="#1c1b2b" strokeWidth="2" />
      </g>
    </g>
  ),
  beach: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skySun")} />
      <Sun g={g} x={220} y={70} r={26} />
      <Cloud x={40} y={36} s={0.8} />
      <rect y="112" width="320" height="50" fill={g("water")} />
      <path d="M0 120 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#fff" strokeWidth="3" fill="none" opacity="0.6" />
      <path d="M0 150 Q80 138 170 150 T320 146 V200 H0Z" fill="#f7deb4" />
      <path d="M0 160 Q90 150 180 162 T320 158 V200 H0Z" fill="#f2cf98" />
      <Palm x={62} y={168} s={1.05} />
      <Palm x={280} y={172} s={0.9} flip />
      <g transform="translate(170 172)">
        <path d="M0 0 V-40" stroke="#1c1b2b" strokeWidth="3" />
        <path d="M-30 -36 Q0 -60 30 -36Z" fill="#f08a6c" stroke="#1c1b2b" strokeWidth="2" />
        <path d="M-10 -40 Q0 -58 10 -40" fill="#fff" />
      </g>
      <g transform="translate(120 128)">
        <path d="M0 0 L40 0 L34 8 L6 8Z" fill="#fff" stroke="#1c1b2b" strokeWidth="1.5" />
        <path d="M20 0 V-22 L34 -4Z" fill="#f9cbc9" stroke="#1c1b2b" strokeWidth="1.5" />
      </g>
    </g>
  ),
  fort: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skyPink")} />
      <Sun g={g} x={70} y={56} r={20} />
      <Cloud x={200} y={40} s={0.8} />
      <path d="M-10 140 Q60 110 140 130 T340 118 V200 H-10Z" fill="#e7a9a4" />
      <g stroke="#1c1b2b" strokeWidth="2" strokeLinejoin="round">
        <path d="M70 170 V110 h14 v-8 h10 v8 h12 v-8 h10 v8 h12 v-8 h10 v8 h12 v-8 h10 v8 h12 v-8 h10 v8 h14 V170Z" fill="#f0908b" />
        <rect x="112" y="84" width="46" height="36" fill="#f5a8a1" />
        <path d="M108 86 Q135 54 162 86Z" fill="#fbc9c3" />
        <path d="M135 62 V52" />
        <rect x="186" y="96" width="30" height="26" fill="#f5a8a1" />
        <path d="M182 98 Q201 74 220 98Z" fill="#fbc9c3" />
        <path d="M128 170 V140 Q135 128 142 140 V170Z" fill="#7a3a36" />
        <rect x="90" y="130" width="10" height="14" rx="5" fill="#fde4e2" />
        <rect x="170" y="130" width="10" height="14" rx="5" fill="#fde4e2" />
        <rect x="224" y="130" width="10" height="14" rx="5" fill="#fde4e2" />
      </g>
      <path d="M135 52 l12 4 -12 4z" fill="#f08a6c" />
      <path d="M-10 172 Q160 160 330 174 V200 H-10Z" fill="#e2b77f" />
    </g>
  ),
  houseboat: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skyMint")} />
      <Sun g={g} x={260} y={50} r={18} />
      <Cloud x={70} y={42} s={0.8} />
      <path d="M-10 118 Q80 104 160 116 T340 110 V130 H-10Z" fill="#6aa65a" />
      <Palm x={40} y={122} s={0.8} />
      <Palm x={90} y={120} s={0.65} flip />
      <Palm x={290} y={118} s={0.75} />
      <rect y="124" width="320" height="76" fill={g("water")} />
      <path d="M20 150 q14 -5 28 0 M200 176 q14 -5 28 0 M120 188 q14 -5 28 0" stroke="#fff" strokeWidth="2.5" fill="none" opacity="0.6" strokeLinecap="round" />
      <g transform="translate(96 108)" stroke="#1c1b2b" strokeWidth="2" strokeLinejoin="round">
        <path d="M-6 46 Q60 70 136 46 L128 58 Q60 78 4 58Z" fill="#8a5a36" />
        <path d="M6 46 V24 H122 V46Z" fill="#f7deb4" />
        <path d="M0 26 Q20 -2 64 -4 Q108 -2 128 26Z" fill="#d9a55b" />
        <path d="M20 22 Q40 4 64 2" fill="none" stroke="#b8833d" />
        <rect x="24" y="30" width="14" height="10" rx="2" fill="#c4def8" />
        <rect x="56" y="30" width="14" height="10" rx="2" fill="#c4def8" />
        <rect x="88" y="30" width="14" height="10" rx="2" fill="#c4def8" />
      </g>
    </g>
  ),
  river: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skyMint")} />
      <Sun g={g} x={60} y={46} r={18} />
      <path d="M-10 120 L50 70 L100 100 L170 56 L240 104 L300 74 L340 100 V200 H-10Z" fill="#8fc37a" />
      <path d="M-10 150 L60 108 L130 140 L200 104 L270 142 L340 118 V200 H-10Z" fill="#62a652" />
      <path d="M120 200 C140 170 110 150 160 130 C200 116 230 124 260 110 L300 110 C270 130 230 140 210 150 C180 164 200 180 190 200Z" fill={g("water")} />
      <path d="M40 92 Q160 128 280 92" stroke="#1c1b2b" strokeWidth="2" fill="none" />
      <path d="M40 92 V120 M280 92 V120" stroke="#1c1b2b" strokeWidth="3" />
      {Array.from({ length: 11 }).map((_, i) => {
        const x = 60 + i * 20;
        const y = 92 + Math.sin((i / 10) * Math.PI) * 18;
        return <path key={i} d={`M${x} ${y} V${y + 10}`} stroke="#1c1b2b" strokeWidth="1.2" />;
      })}
      <path d="M40 104 Q160 140 280 104" stroke="#c9544f" strokeWidth="3" fill="none" />
      <g transform="translate(160 150)">
        <ellipse cx="0" cy="0" rx="22" ry="7" fill="#f08a6c" stroke="#1c1b2b" strokeWidth="2" />
        <circle cx="-9" cy="-8" r="4" fill="#fad47f" stroke="#1c1b2b" strokeWidth="1.5" />
        <circle cx="3" cy="-8" r="4" fill="#c6b5f6" stroke="#1c1b2b" strokeWidth="1.5" />
        <circle cx="14" cy="-7" r="4" fill="#d0e8ba" stroke="#1c1b2b" strokeWidth="1.5" />
      </g>
    </g>
  ),
  lake: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skyLav")} />
      <Sun g={g} x={250} y={44} r={16} />
      <path d="M-10 130 L40 70 L80 110 L140 50 L200 112 L250 64 L340 124 V200 H-10Z" fill="#b38f7c" />
      <path d="M140 50 L154 66 L146 64 L138 72 L130 62Z M250 64 L262 78 L254 76 L246 82 L240 74Z" fill="#fff" />
      <path d="M-10 146 L60 104 L120 138 L190 100 L260 140 L340 110 V200 H-10Z" fill="#9c7462" />
      <rect y="146" width="320" height="54" fill={g("turq")} />
      <path d="M30 164 q14 -5 28 0 M210 182 q14 -5 28 0 M110 190 q14 -5 28 0" stroke="#fff" strokeWidth="2.5" fill="none" opacity="0.55" strokeLinecap="round" />
      <path d="M10 24 Q90 44 170 26" stroke="#1c1b2b" strokeWidth="1.2" fill="none" />
      {["#f08a6c", "#fad47f", "#d0e8ba", "#c4def8", "#fff", "#f08a6c", "#fad47f", "#d0e8ba"].map((c, i) => {
        const x = 20 + i * 19;
        const y = 27 + Math.sin(((i + 0.5) / 8) * Math.PI) * 9;
        return <rect key={i} x={x} y={y} width="11" height="13" fill={c} stroke="#1c1b2b" strokeWidth="0.8" />;
      })}
      <g transform="translate(70 148)" stroke="#1c1b2b" strokeWidth="2" strokeLinejoin="round">
        <rect x="-16" y="-10" width="32" height="10" fill="#fff" />
        <path d="M-12 -10 Q0 -34 12 -10Z" fill="#fff" />
        <path d="M0 -30 V-40" />
        <circle cx="0" cy="-42" r="3" fill="#fad47f" />
      </g>
    </g>
  ),
  island: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skyBlue")} />
      <Sun g={g} x={70} y={50} r={20} />
      <Cloud x={200} y={36} s={0.8} />
      <rect y="100" width="320" height="100" fill={g("turq")} />
      <path d="M0 110 q20 -5 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#fff" strokeWidth="2.5" fill="none" opacity="0.5" />
      <ellipse cx="200" cy="118" rx="80" ry="16" fill="#f7deb4" />
      <ellipse cx="200" cy="112" rx="56" ry="10" fill="#7fbf6a" />
      <Palm x={184} y={112} s={0.85} />
      <Palm x={222} y={114} s={0.7} flip />
      <g transform="translate(70 162)">
        <path d="M0 0 q14 -10 28 0 q-14 10 -28 0z" fill="#f08a6c" stroke="#1c1b2b" strokeWidth="1.5" />
        <path d="M28 0 l8 -6 v12z" fill="#f08a6c" stroke="#1c1b2b" strokeWidth="1.5" />
        <circle cx="7" cy="-1" r="1.6" fill="#1c1b2b" />
      </g>
      <g transform="translate(250 178)">
        <path d="M0 0 q10 -8 20 0 q-10 8 -20 0z" fill="#fad47f" stroke="#1c1b2b" strokeWidth="1.5" />
        <path d="M20 0 l6 -5 v10z" fill="#fad47f" stroke="#1c1b2b" strokeWidth="1.5" />
      </g>
      <path d="M120 200 q6 -24 0 -40 M128 200 q10 -20 6 -32 M136 200 q-2 -18 8 -26" stroke="#f08a6c" strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  ),
  desert: ({ g }) => (
    <g>
      <rect width="320" height="200" fill={g("skyCoral")} />
      <Sun g={g} x={240} y={70} r={24} />
      <path d="M-10 128 Q50 96 110 116 T230 108 T340 116 V140 H-10Z" fill="#c98a73" />
      <rect y="134" width="320" height="66" fill={g("water")} />
      <path d="M200 150 h80 M210 160 h60" stroke="#ffe08a" strokeWidth="3" opacity="0.6" strokeLinecap="round" />
      <g transform="translate(70 104)" stroke="#1c1b2b" strokeWidth="2" strokeLinejoin="round">
        <rect x="0" y="16" width="120" height="34" fill="#fdeedc" />
        <rect x="18" y="0" width="30" height="18" fill="#fdeedc" />
        <path d="M14 2 Q33 -20 52 2Z" fill="#fff" />
        <rect x="72" y="4" width="30" height="14" fill="#fdeedc" />
        <path d="M68 6 Q87 -14 106 6Z" fill="#fff" />
        {[10, 30, 50, 70, 90].map((x) => (
          <path key={x} d={`M${x} 50 V32 Q${x + 5} 24 ${x + 10} 32 V50`} fill="#f5c6a8" />
        ))}
      </g>
      <path d="M70 154 h120" stroke="#fdeedc" strokeWidth="3" opacity="0.5" />
      <g transform="translate(236 172)">
        <path d="M-24 0 Q0 12 24 0 L18 8 Q0 16 -18 8Z" fill="#8a5a36" stroke="#1c1b2b" strokeWidth="1.5" />
        <path d="M-12 0 V-14 H12 V0" fill="#f08a6c" stroke="#1c1b2b" strokeWidth="1.5" />
      </g>
    </g>
  ),
};
