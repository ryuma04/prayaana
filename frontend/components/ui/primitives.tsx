"use client";
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { MinusIcon, PlusIcon, StarIcon, CheckIcon } from "@phosphor-icons/react";
import { cn, initials } from "@/lib/format";
import type { Tone } from "@/types";
import { toneBg, toneSoft, toneText } from "./tone";

// ─── Chip ────────────────────────────────────────────────────────────────

export function Chip({
  selected,
  onClick,
  children,
  icon,
  tone = "lavender",
  size = "md",
  className,
  disabled,
  ariaLabel,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": selected, disabled } : {})}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        selected ? cn(toneBg[tone], "text-ink ring-2 ring-ink shadow-pop") : "bg-white text-ink-soft shadow-clay-sm hover:-translate-y-0.5",
        onClick && "active:scale-95",
        disabled && "opacity-40",
        className,
      )}
    >
      {selected && !icon && <CheckIcon size={14} weight="bold" aria-hidden />}
      {icon}
      {children}
    </Tag>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────

export function Badge({ children, tone = "lavender", className, solid }: { children: ReactNode; tone?: Tone; className?: string; solid?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        solid ? cn(toneBg[tone], "text-ink") : cn(toneSoft[tone], toneText[tone]),
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StatusKind = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

const statusCls: Record<StatusKind, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-ink/5 text-ink-soft",
  purple: "bg-lavender-soft text-purple-deep",
};

const dotCls: Record<StatusKind, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-faint",
  purple: "bg-purple",
};

export function StatusBadge({ kind, children, pulse, className, icon }: { kind: StatusKind; children: ReactNode; pulse?: boolean; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none", statusCls[kind], className)}>
      {icon ?? (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          {pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", dotCls[kind])} />}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dotCls[kind])} />
        </span>
      )}
      {children}
    </span>
  );
}

// ─── Switch / Slider / Progress ──────────────────────────────────────────

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-purple" : "bg-ink/15")}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  className?: string;
}) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-8 w-full touch-none select-none items-center", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
      aria-label={label}
    >
      <SliderPrimitive.Track className="relative h-3 grow overflow-hidden rounded-full bg-ink/10 shadow-inner">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gradient-to-r from-lavender to-purple" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-2 border-ink bg-white shadow-pop transition-transform hover:scale-110" aria-label={label} />
    </SliderPrimitive.Root>
  );
}

export function Progress({ value, className, barClassName, label }: { value: number; className?: string; barClassName?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-ink/8", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div className={cn("h-full rounded-full bg-purple", barClassName)} initial={false} animate={{ width: `${v}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
    </div>
  );
}

// ─── Loading / empty / error ─────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden />;
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-ink/15 border-t-purple", className)} />
  );
}

// ─── Stepper / Stars / Avatar ────────────────────────────────────────────

export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
        className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-clay-sm transition active:scale-90 disabled:opacity-40"
      >
        <MinusIcon size={16} weight="bold" />
      </button>
      <span className="tabular w-6 text-center text-base font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
        className="grid h-9 w-9 place-items-center rounded-full bg-pill text-white shadow-clay-sm transition active:scale-90 disabled:opacity-40"
      >
        <PlusIcon size={16} weight="bold" />
      </button>
    </div>
  );
}

/** A star rating. Catalog ratings are real Google Maps ratings; 0 means the place has not been rated yet. */
export function Stars({ value, size = 14, showValue = true, reviews, source }: { value: number; size?: number; showValue?: boolean; reviews?: number; source?: string }) {
  if (!value || value <= 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">Not rated yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft" aria-label={`Rated ${value} out of 5`} title={source}>
      <StarIcon size={size} weight="fill" className="text-star" aria-hidden />
      {showValue && <span className="tabular">{value.toFixed(1)}</span>}
      {reviews != null && <span className="font-normal text-muted">({reviews.toLocaleString("en-IN")})</span>}
    </span>
  );
}

export function StarInput({ value, onChange, label, size = 32 }: { value: number; onChange: (v: number) => void; label: string; size?: number }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="rounded-full p-0.5 transition active:scale-90"
        >
          <StarIcon size={size} weight={n <= value ? "fill" : "regular"} className={n <= value ? "text-star drop-shadow-sm" : "text-faint"} />
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, tone = "lavender", size = 40, className }: { name: string; tone?: Tone; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-ink shadow-clay-sm", toneBg[tone], className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

// ─── Animated number (live price) ────────────────────────────────────────

export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = format(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, format, reduce]);
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(value)}
    </span>
  );
}

// ─── Form fields ─────────────────────────────────────────────────────────

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border-2 border-transparent bg-white px-4 text-[15px] text-ink shadow-clay-sm outline-none transition placeholder:text-faint focus:border-purple aria-[invalid=true]:border-danger focus:aria-[invalid=true]:border-danger",
        className,
      )}
      {...rest}
    />
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-none rounded-2xl border-2 border-transparent bg-white px-4 py-3 text-[15px] text-ink shadow-clay-sm outline-none transition placeholder:text-faint focus:border-purple",
        className,
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-2xl border-2 border-transparent bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 256 256%22><path fill=%22%231c1b2b%22 d=%22M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z%22/></svg>')] bg-[length:12px] bg-[right_14px_center] bg-no-repeat px-4 pr-9 text-sm font-medium text-ink shadow-clay-sm outline-none focus:border-purple",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="z-[80] max-w-60 rounded-xl bg-ink px-3 py-2 text-xs font-medium text-white shadow-float">
            {content}
            <TooltipPrimitive.Arrow className="fill-ink" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ─── Misc ────────────────────────────────────────────────────────────────

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}
