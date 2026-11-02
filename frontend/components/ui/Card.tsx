import type { HTMLAttributes } from "react";
import { cn } from "@/lib/format";
import type { Tone } from "@/types";
import { toneSoft } from "./tone";

type Variant = "clay" | "bento" | "sticker" | "soft" | "flat";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  tone?: Tone;
  pad?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const variants: Record<Variant, string> = {
  clay: "bg-white shadow-clay rounded-[28px]",
  bento: "bg-white border border-line-cool shadow-soft rounded-2xl",
  sticker: "bg-white border-2 border-ink shadow-pop-lg rounded-[24px]",
  soft: "rounded-[24px]",
  flat: "bg-white rounded-2xl border border-line",
};

const pads = { none: "", sm: "p-3", md: "p-5", lg: "p-6 sm:p-7" };

export function Card({ variant = "clay", tone, pad = "md", interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        variants[variant],
        tone && toneSoft[tone],
        pads[pad],
        interactive && "transition-all duration-200 hover:-translate-y-1 hover:shadow-clay-lg",
        className,
      )}
      {...rest}
    />
  );
}

export function SectionTitle({
  title,
  kicker,
  action,
  className,
  as: Tag = "h2",
}: {
  title: React.ReactNode;
  kicker?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {kicker && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{kicker}</p>}
        <Tag className="truncate text-lg font-bold text-ink sm:text-xl">{title}</Tag>
      </div>
      {action}
    </div>
  );
}
