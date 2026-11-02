"use client";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/format";

/**
 * Bottom sheet on phones, right-side drawer (or centered modal) on larger screens.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  size = "md",
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "center";
  size?: "sm" | "md" | "lg" | "xl";
  hideTitle?: boolean;
}) {
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "sheet-content fixed z-[61] flex max-h-[92dvh] w-full flex-col overflow-hidden bg-canvas shadow-float outline-none",
            "inset-x-0 bottom-0 rounded-t-[32px]",
            side === "right"
              ? cn("sm:top-3 sm:bottom-3 sm:right-3 sm:left-auto sm:max-h-none sm:rounded-[32px]", widths[size])
              : cn("sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px]", widths[size]),
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-ink/15 sm:hidden" aria-hidden />
          <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-6", hideTitle && "sr-only")}>
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-bold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-clay-sm transition hover:rotate-90" aria-label="Close">
              <XIcon size={18} weight="bold" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
          {footer && <div className="border-t border-line bg-white/70 px-5 py-4 backdrop-blur sm:px-6">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
