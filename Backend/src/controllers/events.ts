import mongoose from "mongoose";
import { EVENT_TYPES, EventType, parseDevice } from "../analytics/constants.js";
import { TryCatch } from "../middlewares/error.js";
import { Event } from "../models/event.js";
import { Order } from "../models/order.js";
import ErrorHandler from "../utils/utility-class.js";

const MAX_BATCH = 50;
const MAX_METADATA_CHARS = 2000;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

type IncomingEvent = {
  type?: unknown;
  product_id?: unknown;
  metadata?: unknown;
  experiment?: unknown;
  variant?: unknown;
  ts?: unknown;
};

type IncomingBatch = {
  session_id?: unknown;
  anon_id?: unknown;
  user_id?: unknown;
  events?: unknown;
};

const shortString = (v: unknown, max = 64) =>
  typeof v === "string" && v.length > 0 && v.length <= max ? v : null;

const isEventType = (v: unknown): v is EventType =>
  typeof v === "string" && (EVENT_TYPES as readonly string[]).includes(v);

// Accepts a batch from navigator.sendBeacon / fetch(keepalive). Beacons arrive as text/plain
// so the request stays a "simple" CORS request; we parse the JSON ourselves.
export const ingestEvents = TryCatch(async (req, res, next) => {
  let body: IncomingBatch;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return next(new ErrorHandler("Invalid JSON", 400));
  }

  const sessionId = shortString(body?.session_id);
  const anonId = shortString(body?.anon_id);
  if (!sessionId || !anonId || !Array.isArray(body.events))
    return next(new ErrorHandler("session_id, anon_id and events are required", 400));
  if (body.events.length > MAX_BATCH)
    return next(new ErrorHandler(`At most ${MAX_BATCH} events per batch`, 400));

  const userId = shortString(body.user_id);
  const now = Date.now();
  const device = parseDevice(req.headers["user-agent"]);

  // Returning = this user already had an order before the batch
  const isReturning = userId ? Boolean(await Order.exists({ user: userId })) : false;

  const docs = (body.events as IncomingEvent[]).flatMap((e) => {
    if (!isEventType(e?.type)) return [];
    const productId =
      typeof e.product_id === "string" && mongoose.isValidObjectId(e.product_id)
        ? new mongoose.Types.ObjectId(e.product_id)
        : null;
    const metadata =
      e.metadata && typeof e.metadata === "object" && JSON.stringify(e.metadata).length <= MAX_METADATA_CHARS
        ? e.metadata
        : {};
    const ts = typeof e.ts === "number" && Math.abs(e.ts - now) < MAX_CLOCK_SKEW_MS ? e.ts : now;
    return [
      {
        session_id: sessionId,
        anon_id: anonId,
        user_id: userId,
        type: e.type,
        product_id: productId,
        metadata,
        experiment: shortString(e.experiment),
        variant: shortString(e.variant, 16),
        device,
        is_returning: isReturning,
        timestamp: new Date(ts),
      },
    ];
  });

  if (docs.length) await Event.insertMany(docs, { ordered: false });

  return res.status(202).json({ success: true, accepted: docs.length });
});
