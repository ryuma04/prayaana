"use client";
import type { ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { cn } from "@/lib/format";

export function Tabs({
  value,
  onValueChange,
  items,
  children,
  className,
  listClassName,
  layoutId = "tab-pill",
  variant = "clay",
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: ReactNode; badge?: ReactNode }[];
  children?: ReactNode;
  className?: string;
  listClassName?: string;
  layoutId?: string;
  variant?: "clay" | "bento";
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      <TabsPrimitive.List
        className={cn(
          "scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1",
          variant === "clay" ? "bg-white shadow-clay-sm" : "border border-line-cool bg-white",
          listClassName,
        )}
      >
        {items.map((it) => (
          <TabsPrimitive.Trigger
            key={it.value}
            value={it.value}
            className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-muted transition-colors data-[state=active]:text-white"
          >
            {value === it.value && (
              <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-pill" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {it.label}
              {it.badge}
            </span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export const TabPanel = TabsPrimitive.Content;
