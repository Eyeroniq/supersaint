import mongoose from "mongoose";
import { DEVICES, EVENT_TYPES } from "../analytics/constants.js";

// One row per storefront interaction. Field names are snake_case to match the warehouse.
const schema = new mongoose.Schema(
  {
    // Rolls over after 30 minutes of inactivity
    session_id: { type: String, required: true },
    // Persistent anonymous visitor id; experiment assignment unit
    anon_id: { type: String, required: true },
    user_id: { type: String, default: null },
    type: { type: String, enum: EVENT_TYPES, required: true },
    product_id: { type: mongoose.Types.ObjectId, ref: "Product", default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    experiment: { type: String, default: null },
    variant: { type: String, default: null },
    device: { type: String, enum: DEVICES, default: "desktop" },
    // Logged-in user with an order placed before this event
    is_returning: { type: Boolean, default: false },
    simulated: { type: Boolean, default: false },
    timestamp: { type: Date, required: true },
  },
  { versionKey: false }
);

schema.index({ timestamp: 1 });
schema.index({ type: 1, timestamp: 1 });
schema.index({ session_id: 1, timestamp: 1 });
schema.index({ product_id: 1, type: 1 });
schema.index({ experiment: 1, variant: 1, type: 1 });
schema.index({ anon_id: 1 });

export const Event = mongoose.model("Event", schema);
