import { cn } from "@/lib/format";

/** Comic-style sticker burst (from the reference design), used sparingly for big moments. */
export function Burst({ text, color = "#fad47f", className, rotate = -8, size = 120 }: { text: string; color?: string; className?: string; rotate?: number; size?: number }) {
  const points = 14;
  const pts = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 38;
    const a = (Math.PI * i) / points;
    return `${60 + r * Math.cos(a)},${60 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={cn("select-none", className)} style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <polygon points={pts} fill="#1c1b2b" transform="translate(3 3)" />
      <polygon points={pts} fill={color} stroke="#1c1b2b" strokeWidth="3" strokeLinejoin="round" />
      <text x="60" y="67" textAnchor="middle" fontFamily="var(--font-unbounded), sans-serif" fontWeight="800" fontSize={text.length > 5 ? 15 : 19} fill="#1c1b2b">
        {text}
      </text>
    </svg>
  );
}
