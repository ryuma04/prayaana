"use client";
import { useMemo } from "react";
import { useNotificationStore } from "@/stores/notificationStore";
import { NotificationItem } from "@/components/shell/NotificationBell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export default function NotificationsPage() {
  const items = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clear = useNotificationStore((s) => s.clear);
  const mine = useMemo(() => items.filter((n) => n.audience === "traveler"), [items]);
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Notifications</h1>
        {mine.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => markAllRead("traveler")}>
              Mark all read
            </Button>
            <Button size="sm" variant="ghost" onClick={() => clear("traveler")}>
              Clear
            </Button>
          </div>
        )}
      </div>
      {mine.length === 0 ? (
        <EmptyState title="No notifications" body="Weather alerts, vendor confirmations and agent fixes will appear here." mood="sleepy" />
      ) : (
        <div className="space-y-1 rounded-[28px] bg-white p-2 shadow-clay">
          {mine.map((n) => (
            <NotificationItem key={n.id} n={n} onClick={() => markRead(n.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
