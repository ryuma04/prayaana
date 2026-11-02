"use client";
import { get, post } from "./client";

export interface TelegramStatus {
  connected: boolean;
  chatId?: number;
  username?: string;
  connectedAt?: string;
  botUsername: string;
  mode: "telegram" | "mock";
  available: boolean;
}

export const getTelegramStatus = () => get<TelegramStatus>("/telegram/status");
export const connectTelegram = () => post<{ link: string; expiresAt: string }>("/telegram/connect");
export const linkTelegramChat = (chatId: string | number, username?: string) =>
  post<TelegramStatus>("/telegram/link", { chatId, username });
export const disconnectTelegram = () => post<TelegramStatus>("/telegram/disconnect");
export const sendTelegramTest = (chatId?: number | string) =>
  post<{ sent: boolean; mock: boolean; chatId?: number }>("/telegram/test", chatId ? { chatId } : {});

