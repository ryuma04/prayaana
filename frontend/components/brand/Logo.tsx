import Link from "next/link";
import { cn } from "@/lib/format";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="2" y="2" width="36" height="36" rx="12" fill="#1c1b2b" />
      <path d="M11 27 C 15 14, 22 12, 29 13" stroke="#fad47f" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeDasharray="1 5.5" />
      <circle cx="11" cy="27" r="3.4" fill="#f08a6c" />
      <path d="M29 9.5 l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#c6b5f6" />
    </svg>
  );
}

export function Logo({ href = "/", className, light, tag }: { href?: string; className?: string; light?: boolean; tag?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Prayaana home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span className={cn("font-display text-xl font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>
        Prayaana
      </span>
      {tag && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">{tag}</span>}
    </Link>
  );
}
