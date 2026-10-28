import crypto from "crypto";
import ErrorHandler from "./utility-class.js";

// Razorpay (UPI, cards, netbanking, wallets) via its REST API
const API = "https://api.razorpay.com/v1";

const keyId = () => process.env.RAZORPAY_KEY_ID || "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET || "";

export const razorpayKeyId = keyId;
export const razorpayEnabled = () => Boolean(keyId() && keySecret());

type RazorpayOrder = {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: "created" | "attempted" | "paid";
};

const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!razorpayEnabled())
    throw new ErrorHandler("Online payment is not configured. Please use Cash on Delivery", 503);

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok)
    throw new ErrorHandler(data?.error?.description || "Payment gateway error", 502);
  return data as T;
};

export const createRazorpayOrder = (amountRupees: number, receipt: string) =>
  call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt }),
  });

export const fetchRazorpayOrder = (id: string) =>
  call<RazorpayOrder>(`/orders/${encodeURIComponent(id)}`);

// Checkout returns signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export const verifyRazorpaySignature = (orderId: string, paymentId: string, signature: string) => {
  const expected = crypto
    .createHmac("sha256", keySecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
