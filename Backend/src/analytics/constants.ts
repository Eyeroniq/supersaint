// Shared definitions for tracking, experiments and analytics.

export const EVENT_TYPES = [
  "product_view",
  "search",
  "search_zero_results",
  "add_to_cart",
  "remove_from_cart",
  "checkout_started",
  "payment_attempted",
  "order_placed",
  "coupon_applied",
  "experiment_exposure",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const DEVICES = ["mobile", "desktop", "tablet"] as const;
export type Device = (typeof DEVICES)[number];

// Funnel steps in order; a session "reaches" a step only if it hit every earlier step
export const FUNNEL_STEPS = [
  "product_view",
  "add_to_cart",
  "checkout_started",
  "payment_attempted",
  "order_placed",
] as const satisfies readonly EventType[];

export const ORDER_STATUSES = [
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
  "RTO",
  "Returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Orders that never turned into kept revenue
export const LOST_STATUSES: readonly OrderStatus[] = ["Cancelled", "RTO", "Returned"];

// India has no DST, so IST is a fixed UTC+05:30 offset
export const IST_TZ = "Asia/Kolkata";
export const IST_OFFSET_MS = 330 * 60 * 1000;

export const parseDevice = (userAgent = ""): Device => {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
};
