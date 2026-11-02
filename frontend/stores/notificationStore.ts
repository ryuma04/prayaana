"use client";
import { create } from "zustand";
import type { AppNotification, NotificationKind } from "@/types";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/api/notifications";

interface NotificationState {
  items: AppNotification[];
  setAll: (items: AppNotification[]) => void;
  /** A notice streamed over the WebSocket (`notice.new`). */
  receive: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: (audience: AppNotification["audience"]) => void;
  clear: (audience: AppNotification["audience"]) => void;
  reset: () => void;
}

/** Server notifications (GET /notifications); read state is written back to the API. */
export const useNotificationStore = create<NotificationState>()((set, get) => ({
  items: [],
  setAll: (items) => set({ items }),
  receive: (n) => {
    if (get().items.some((x) => x.id === n.id)) return;
    set({ items: [n, ...get().items].slice(0, 80) });
  },
  markRead: (id) => {
    set({ items: get().items.map((n) => (n.id === id ? { ...n, read: true } : n)) });
    markNotificationRead(id).catch(() => undefined);
  },
  markAllRead: (audience) => {
    set({ items: get().items.map((n) => (n.audience === audience ? { ...n, read: true } : n)) });
    markAllNotificationsRead().catch(() => undefined);
  },
  clear: (audience) => set({ items: get().items.filter((n) => n.audience !== audience) }),
  reset: () => set({ items: [] }),
}));

// ─── Toasts (ephemeral) ───────────────────────────────────────────────────

export type ToastTone = "success" | "error" | "info" | "warning" | "agent";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
  action?: { label: string; href: string };
  kind?: NotificationKind;
}

interface ToastState {
  toasts: Toast[];
  show: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (t) => {
    const id = `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-4) });
    setTimeout(() => get().dismiss(id), t.tone === "error" ? 6500 : 4500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (t: Omit<Toast, "id">) => useToastStore.getState().show(t);
