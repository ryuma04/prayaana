"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/primitives";
import { Glyph } from "@/lib/icons";

/** Shared frame for multi-step flows (onboarding + Travel DNA quiz). */
export function StepShell({
  step,
  total,
  label,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  onSkip,
  nextLabel = "Next",
  nextDisabled,
  exitHref,
  stepKey,
  nextLoading,
}: {
  step: number;
  total: number;
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  exitHref: string;
  stepKey: string | number;
  nextLoading?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col pt-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          disabled={!onBack}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-clay-sm transition active:scale-95 disabled:opacity-30"
          aria-label="Back"
        >
          <ArrowLeftIcon size={18} weight="bold" />
        </button>
        <div className="flex-1">
          <div className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
            <span>{label}</span>
            <span className="tabular">
              {step + 1} / {total}
            </span>
          </div>
          <Progress value={((step + 1) / total) * 100} label={`Step ${step + 1} of ${total}`} barClassName="bg-gradient-to-r from-coral to-purple" />
        </div>
        <Link href={exitHref} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-clay-sm" aria-label="Exit">
          <XIcon size={18} weight="bold" />
        </Link>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={stepKey}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex-1 pb-36 pt-8"
          aria-live="polite"
        >
          <h1 className="text-balance text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted sm:text-base">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </motion.section>
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-0">
          {onSkip ? (
            <button onClick={onSkip} className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
              Skip
            </button>
          ) : (
            <span />
          )}
          <Button className="ml-auto min-w-40" size="lg" onClick={onNext} disabled={nextDisabled} loading={nextLoading} icon={<ArrowRightIcon size={18} weight="bold" />}>
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OptionCard({
  selected,
  onClick,
  title,
  subtitle,
  emoji,
  tone = "bg-white",
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  emoji?: ReactNode;
  tone?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className={`group relative flex w-full items-start gap-3.5 rounded-[24px] p-4 text-left transition ${
        selected ? `${tone} ring-2 ring-ink shadow-pop` : "bg-white shadow-clay-sm hover:-translate-y-0.5"
      } ${className ?? ""}`}
    >
      {emoji && <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/70 shadow-clay-sm">{typeof emoji === "string" ? <Glyph emoji={emoji} size={26} /> : emoji}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        {subtitle && <span className="block text-sm text-ink-soft">{subtitle}</span>}
        {children}
      </span>
    </motion.button>
  );
}
