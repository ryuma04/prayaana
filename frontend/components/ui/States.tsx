"use client";
import type { ReactNode } from "react";
import { ArrowClockwiseIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/format";
import { Zippy, type ZippyMood } from "@/components/art/Zippy";
import { Button } from "./Button";
import { Skeleton } from "./primitives";

export function EmptyState({
  title,
  body,
  action,
  mood = "sleepy",
  className,
  compact,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  mood?: ZippyMood;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[28px] bg-white/60 text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <Zippy mood={mood} size={compact ? 72 : 104} />
      <h3 className="mt-4 font-display text-base font-bold text-ink sm:text-lg">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  error,
  onRetry,
  className,
  action,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
  action?: ReactNode;
}) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Please try again in a moment.";
  const network = /network/i.test(message);
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-[28px] border-2 border-dashed border-danger/30 bg-danger-soft/40 px-6 py-10 text-center", className)}>
      {network ? (
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-clay-sm">
          <WifiSlashIcon size={30} weight="duotone" className="text-danger" />
        </span>
      ) : (
        <Zippy mood="worried" size={88} />
      )}
      <h3 className="mt-4 font-display text-base font-bold text-ink">{network ? "Network disconnected" : title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry} icon={<ArrowClockwiseIcon size={16} weight="bold" />}>
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

export function CardSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="animate-float">
        <Zippy mood="happy" size={96} />
      </div>
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
