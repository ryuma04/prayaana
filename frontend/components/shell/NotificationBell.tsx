"use client";
import Link from "next/link";
import { useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  AirplaneTiltIcon,
  BellIcon,
  BellSlashIcon,
  CloudRainIcon,
  CreditCardIcon,
  MapTrifoldIcon,
  RobotIcon,
  StorefrontIcon,
  WarningIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { useNotificationStore } from "@/stores/notificationStore";
import type { AppNotification, NotificationKind } from "@/types";
import { cn, timeAgo } from "@/lib/format";

export const NOTIFICATION_ICON: Record<NotificationKind, { Icon: typeof BellIcon; cls: string }> = {
  weather: { Icon: CloudRainIcon, cls: "bg-sky" },
  flight: { Icon: AirplaneTiltIcon, cls: "bg-lavender" },
  vendor: { Icon: StorefrontIcon, cls: "bg-cream" },
  agent: { Icon: RobotIcon, cls: "bg-lavender" },
  payment: { Icon: CreditCardIcon, cls: "bg-mint" },
  risk: { Icon: WarningIcon, cls: "bg-pink" },
  trip: { Icon: MapTrifoldIcon, cls: "bg-sun" },
  system: { Icon: InfoIcon, cls: "bg-sky-soft" },
};

export function NotificationItem({ n, onClick }: { n: AppNotification; onClick?: () => void }) {
  const { Icon, cls } = NOTIFICATION_ICON[n.kind];
  const body = (
    <div className={cn("flex gap-3 rounded-2xl p-3 transition hover:bg-ink/[0.04]", !n.read && "bg-lavender-soft/60")}>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", cls)}>
        <Icon size={18} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-ink">{n.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.body}</p>
        <p className="mt-1 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple" aria-label="Unread" />}
    </div>
  );
  return n.href ? (
    <Link href={n.href} onClick={onClick} className="block">
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {body}
    </button>
  );
}

export function NotificationBell({ audience, allHref, dark }: { audience: "traveler" | "operator"; allHref: string; dark?: boolean }) {
  const items = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const mine = useMemo(() => items.filter((n) => n.audience === audience), [items, audience]);
  const unread = mine.filter((n) => !n.read).length;
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "relative grid h-11 w-11 place-items-center rounded-full transition active:scale-95",
          dark ? "bg-white/10 text-white hover:bg-white/15" : "bg-white shadow-clay-sm hover:-translate-y-0.5",
        )}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <BellIcon size={20} weight={unread ? "fill" : "regular"} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-coral px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          className="z-[70] w-[min(92vw,380px)] rounded-[28px] border-2 border-ink bg-white p-2 shadow-pop-lg"
        >
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <p className="font-display text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <button onClick={() => markAllRead(audience)} className="text-xs font-semibold text-purple-deep hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {mine.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellSlashIcon size={32} weight="duotone" className="text-faint" />
                <p className="text-sm font-semibold">No notifications</p>
                <p className="text-xs text-muted">Weather alerts, vendor replies and agent fixes will show up here.</p>
              </div>
            ) : (
              mine.slice(0, 8).map((n) => <NotificationItem key={n.id} n={n} onClick={() => markRead(n.id)} />)
            )}
          </div>
          <Popover.Close asChild>
            <Link href={allHref} className="mt-1 block rounded-2xl py-2.5 text-center text-sm font-semibold text-ink hover:bg-ink/5">
              See all
            </Link>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
