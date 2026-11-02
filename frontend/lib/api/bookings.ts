"use client";
import type { Booking } from "@/types";
import { useTripStore } from "@/stores/tripStore";
import { ApiError, post, sleep } from "./client";
import { loadTripBookings, type TripView } from "./trips";

export type PayMethod = "upi" | "card" | "netbanking";

export interface Order {
  orderId: string;
  amount: number;
  currency: string;
  provider: "razorpay" | "simulated";
  keyId?: string;
  tripCode: string;
}

interface Confirmed extends TripView {
  bookings: Booking[];
  payment: { orderId: string; paymentRef?: string };
}

export interface CheckoutContact {
  name?: string;
  email?: string;
  phone?: string;
  telegramUpdates?: boolean;
  whatsappUpdates?: boolean;
}

/** POST /trips/{id}/book: saves the lead traveler's contact and opens a payment order for the current price. */
export const createOrder = (tripId: string, contact?: CheckoutContact) => post<Order>(`/trips/${encodeURIComponent(tripId)}/book`, contact);

/**
 * POST /trips/{id}/pay/verify: the server checks the payment and books the trip exactly once.
 * Simulated orders need no gateway; `fail` makes the test bank decline.
 */
export async function confirmPayment(tripId: string, order: Order, method: PayMethod | "", extra: { fail?: boolean; paymentId?: string; signature?: string } = {}) {
  const res = await post<Confirmed>(`/trips/${encodeURIComponent(tripId)}/pay/verify`, { orderId: order.orderId, method, ...extra });
  useTripStore.getState().upsert(res.trip);
  useTripStore.getState().addMine(tripId);
  if (useTripStore.getState().draftId === tripId) useTripStore.getState().setDraft(null);
  return res;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string; source?: string };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: RazorpayFailure) => void) => void };
  }
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new ApiError("Couldn't load the payment window. Check your connection.", "payment"));
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout (the traveler picks UPI, card, netbanking or a wallet there). */
export async function payWithRazorpay(tripId: string, order: Order, prefill: { name: string; email: string; contact: string }) {
  await loadRazorpay();
  const response = await new Promise<RazorpayResponse>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount * 100,
      currency: order.currency,
      name: "Prayaana",
      description: order.tripCode,
      prefill,
      theme: { color: "#7B5CF0" },
      handler: resolve,
      // Razorpay keeps the window open after a failed attempt so the traveler can retry; the
      // last failure reason is shown if they close it (e.g. a UPI or account amount limit).
      modal: { ondismiss: () => reject(new ApiError(lastFailure ? `Payment failed: ${lastFailure}. No money was taken.` : "Payment cancelled. No money was taken.", "payment")) },
    });
    let lastFailure = "";
    rzp.on("payment.failed", (r) => {
      lastFailure = r.error?.description || r.error?.reason || "the bank declined it";
    });
    rzp.open();
  });
  return confirmPayment(tripId, order, "", { paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
}

/** Watches the trip's vendor bookings until every vendor has answered (or the wait runs out). */
export async function waitForVendorConfirmations(tripId: string, onUpdate?: (bookings: Booking[]) => void, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const list = await loadTripBookings(tripId).catch(() => null);
    if (list) {
      onUpdate?.(list);
      if (list.length && list.every((b) => b.status !== "requested")) return list;
    }
    await sleep(1200);
  }
  return null;
}
