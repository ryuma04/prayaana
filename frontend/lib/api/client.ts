"use client";
import { useAuthStore } from "@/stores/authStore";

/**
 * HTTP transport to the Go backend (allaboutourproject.md §19). Every function in
 * lib/api/* goes through `api()`. Errors always arrive as
 * {"error": {"code", "message", "fields"?}} and become an `ApiError`.
 */
export type ApiErrorCode =
  | "network"
  | "not_found"
  | "unavailable"
  | "payment"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "email_not_verified"
  | "invalid_code"
  | "too_many_attempts"
  | "too_soon"
  | "locked"
  | "timeout"
  | "internal"
  | (string & {});

export class ApiError extends Error {
  constructor(
    message: string,
    public code: ApiErrorCode = "network",
    public status = 0,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");
export const API_MODE = "live" as const;

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface Options {
  body?: unknown;
  /** Send without the session token (public endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(method: Method, path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const token = useAuthStore.getState().token;
  if (token && !opts.anonymous) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body, signal: opts.signal, cache: "no-store" });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("We can't reach Prayaana right now. Check your connection and try again.", "network");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    if ((res.status === 401 || (res.status === 403 && err?.code === "unauthorized")) && token && !opts.anonymous) {
      // Session expired or revoked: sign out so AuthGate sends the user to login.
      useAuthStore.getState().logout();
    }
    throw new ApiError(err?.message ?? `Request failed (${res.status}).`, err?.code ?? (res.status === 404 ? "not_found" : "internal"), res.status, err?.fields);
  }
  return data as T;
}

export const get = <T>(path: string, opts?: Options) => api<T>("GET", path, opts);
export const post = <T>(path: string, body?: unknown, opts?: Options) => api<T>("POST", path, { ...opts, body });
export const patch = <T>(path: string, body?: unknown, opts?: Options) => api<T>("PATCH", path, { ...opts, body });
export const del = <T>(path: string, opts?: Options) => api<T>("DELETE", path, opts);

/** Wraps local (pure) computations so callers keep one async interface. */
export async function request<T>(fn: () => T | Promise<T>): Promise<T> {
  return fn();
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const errorMessage = (e: unknown, fallback = "Something went wrong. Please try again.") =>
  e instanceof Error && e.message ? e.message : fallback;
