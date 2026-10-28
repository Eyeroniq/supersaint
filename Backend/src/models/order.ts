import mongoose from "mongoose";
import { DEVICES, ORDER_STATUSES } from "../analytics/constants.js";

//Order Schema
const schema = new mongoose.Schema(
  {
    shippingInfo: {
      name: String,
      phone: String,
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      pinCode: {
        type: Number,
        required: true,
      },
    },
    user: {
      type: String,
      //Here in ref, we define the collection_name for User_id of the order which comes from that collection.
      ref: "User",
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    shippingCharges: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: Number,
      required: true,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "Processing",
    },
    // Every status change with its time; drives delivery-time analytics
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: ORDER_STATUSES },
        at: Date,
      },
    ],
    couponCode: { type: String, default: null },
    // Analytics context captured at checkout
    sessionId: { type: String, default: null },
    anonId: { type: String, default: null },
    device: { type: String, enum: DEVICES, default: "desktop" },
    experiments: { type: Map, of: String, default: {} },
    simulated: { type: Boolean, default: false },
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      default: "COD",
    },
    paymentId: String,
    // Set for Razorpay payments; unique so one payment can't pay for two orders
    razorpayOrderId: { type: String, unique: true, sparse: true },
    orderItems: [
      {
        name: String,
        photo: String,
        price: Number,
        quantity: Number,
        size: String,
        productId: {
          type: mongoose.Types.ObjectId,
          ref: "Product",
        },
      },
    ],
  },
  { timestamps: true }
);

schema.index({ createdAt: 1 });
schema.index({ user: 1, createdAt: 1 });
schema.index({ status: 1 });

export const Order = mongoose.model("Order", schema);
