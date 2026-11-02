"use client";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "success" | "outline" | "purple";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-pill text-white border-2 border-pill shadow-[3px_3px_0_#7b5cf0] hover:shadow-[4px_4px_0_#7b5cf0] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  purple:
    "bg-purple text-white border-2 border-ink shadow-pop hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  secondary: "bg-white text-ink shadow-clay-sm hover:-translate-y-0.5 active:scale-[0.97]",
  outline: "bg-white text-ink border-2 border-ink shadow-pop hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  ghost: "bg-transparent text-ink hover:bg-ink/5 active:scale-[0.97]",
  soft: "bg-lavender-soft text-purple-deep hover:bg-lavender/60 active:scale-[0.97]",
  danger: "bg-danger text-white hover:brightness-110 active:scale-[0.97]",
  success: "bg-success text-white hover:brightness-110 active:scale-[0.97]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-14 px-7 text-base gap-2.5",
  icon: "h-11 w-11 justify-center",
  "icon-sm": "h-9 w-9 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  href?: string;
  full?: boolean;
}

const base =
  "relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, href, full, className, children, disabled, ...rest },
  ref,
) {
  const cls = cn(base, variants[variant], sizes[size], full && "w-full", className);
  const content = (
    <>
      {loading ? <CircleNotchIcon className="animate-spin" size={18} weight="bold" aria-hidden /> : icon}
      {children}
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} aria-disabled={loading || undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});
