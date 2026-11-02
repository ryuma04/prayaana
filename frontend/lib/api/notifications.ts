"use client";
import type { AppNotification } from "@/types";
import { get, post } from "./client";

/** GET /notifications */
export const listNotifications = () => get<AppNotification[]>("/notifications?limit=80");
/** POST /notifications/{id}/read */
export const markNotificationRead = (id: string) => post<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`);
/** POST /notifications/read-all */
export const markAllNotificationsRead = () => post<{ ok: boolean }>("/notifications/read-all");
