"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircleIcon, InfoIcon, RobotIcon, WarningCircleIcon, XIcon, XCircleIcon } from "@phosphor-icons/react";
import { useToastStore, type ToastTone } from "@/stores/notificationStore";
import { cn } from "@/lib/format";

const toneStyle: Record<ToastTone, { cls: string; Icon: typeof InfoIcon }> = {
  success: { cls: "bg-mint", Icon: CheckCircleIcon },
  error: { cls: "bg-pink", Icon: XCircleIcon },
  info: { cls: "bg-sky", Icon: InfoIcon },
  warning: { cls: "bg-sun", Icon: WarningCircleIcon },
  agent: { cls: "bg-lavender", Icon: RobotIcon },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-3 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { cls, Icon } = toneStyle[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[22px] border-2 border-ink bg-white p-3 pr-2 shadow-pop-lg"
              role={t.tone === "error" ? "alert" : "status"}
            >
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink", cls)}>
                <Icon size={18} weight="bold" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 line-clamp-3 text-xs text-ink-soft">{t.body}</p>}
                {t.action && (
                  <Link href={t.action.href} onClick={() => dismiss(t.id)} className="mt-1.5 inline-block text-xs font-bold text-purple-deep underline underline-offset-2">
                    {t.action.label}
                  </Link>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-ink/5">
                <XIcon size={14} weight="bold" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
