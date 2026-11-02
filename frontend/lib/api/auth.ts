"use client";
import type { SessionUser } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { get, post } from "./client";

export interface Session {
  token: string;
  expiresAt: string;
  user: SessionUser & { emailVerified: boolean; phone?: string };
}

export interface SignupResult {
  session?: Session;
  verificationRequired: boolean;
  email: string;
  emailSent: boolean;
}

export interface ResendResult {
  message: string;
}

function start(s: Session) {
  useAuthStore.getState().login(s.user, s.token, s.expiresAt);
  return s;
}

export const login = async (email: string, password: string, portal?: SessionUser["role"]) =>
  start(await post<Session>("/auth/login", { email, password, portal }, { anonymous: true }));

export async function signup(input: { name: string; email: string; password: string; phone?: string }) {
  const res = await post<SignupResult>("/auth/signup", input, { anonymous: true });
  if (res.session) start(res.session);
  else useAuthStore.getState().setPendingEmail(res.email);
  return res;
}

export const verifyEmail = async (email: string, code: string) => start(await post<Session>("/auth/verify-email", { email, code }, { anonymous: true }));

export const resendCode = (email: string) => post<ResendResult>("/auth/resend-verification", { email }, { anonymous: true });

export const me = () => get<Session["user"]>("/auth/me");

export function logout() {
  useAuthStore.getState().logout();
}

