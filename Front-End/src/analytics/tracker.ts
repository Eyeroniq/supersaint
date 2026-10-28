import { getAnonId, getSessionId } from "./identity";

export type TrackEventType =
  | "product_view"
  | "search"
  | "search_zero_results"
  | "add_to_cart"
  | "remove_from_cart"
  | "checkout_started"
  | "payment_attempted"
  | "coupon_applied"
  | "experiment_exposure";

export type TrackPayload = {
  product_id?: string;
  metadata?: Record<string, string | number | boolean | null>;
  experiment?: string;
  variant?: string;
};

type QueuedEvent = TrackPayload & { type: TrackEventType; ts: number };

const ENDPOINT = `${import.meta.env.VITE_SERVER}/api/v1/events`;
const FLUSH_MS = 4000;
const MAX_BATCH = 25;

let queue: QueuedEvent[] = [];
let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export const setTrackingUser = (id: string | null) => {
  userId = id;
};

// text/plain keeps this a simple CORS request (no preflight), which beacons require
const send = (events: QueuedEvent[], useBeacon: boolean) => {
  const body = JSON.stringify({
    session_id: getSessionId(),
    anon_id: getAnonId(),
    user_id: userId,
    events,
  });
  const blob = new Blob([body], { type: "text/plain" });
  if (useBeacon && navigator.sendBeacon?.(ENDPOINT, blob)) return;
  fetch(ENDPOINT, { method: "POST", body: blob, keepalive: true }).catch(() => {
    // analytics must never break the page
  });
};

export const flush = (useBeacon = false) => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length) send(queue.splice(0, MAX_BATCH), useBeacon);
};

export const track = (type: TrackEventType, payload: TrackPayload = {}) => {
  queue.push({ type, ...payload, ts: Date.now() });
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(() => flush(), FLUSH_MS);
};

// Beacons survive tab close and navigation away
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}

// Fire each exposure once per session so assignment counts stay clean
const exposed = new Set<string>();
export const trackExposure = (experiment: string, variant: string) => {
  const key = `${getSessionId()}:${experiment}`;
  if (exposed.has(key)) return;
  exposed.add(key);
  track("experiment_exposure", { experiment, variant });
};
