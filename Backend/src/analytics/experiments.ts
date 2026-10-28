import { Experiment } from "../models/experiment.js";

export type Variant = "control" | "treatment";

export type ExperimentConfig = {
  key: string;
  name: string;
  hypothesis: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  guardrail: string;
  variants: Record<Variant, { label: string; freeShippingThreshold?: number; couponCode?: string }>;
};

export const EXPERIMENTS: Record<string, ExperimentConfig> = {
  free_shipping_threshold: {
    key: "free_shipping_threshold",
    name: "Free-shipping threshold ₹999 vs ₹1,499",
    hypothesis:
      "Raising the free-shipping threshold nudges shoppers to add more to reach it (higher AOV) without hurting conversion much.",
    primaryMetric: "Conversion rate (exposed sessions that order)",
    secondaryMetrics: ["AOV", "Revenue per exposed session"],
    guardrail: "Cancellation rate",
    variants: {
      control: { label: "Free shipping over ₹999", freeShippingThreshold: 999 },
      treatment: { label: "Free shipping over ₹1,499", freeShippingThreshold: 1499 },
    },
  },
  coupon_offer: {
    key: "coupon_offer",
    name: "Cart offer: 10% off vs flat ₹150 off",
    hypothesis: "A flat rupee discount is easier to understand than a percentage and is redeemed more often.",
    primaryMetric: "Conversion rate (exposed sessions that order)",
    secondaryMetrics: ["AOV", "Revenue per exposed session"],
    guardrail: "Cancellation rate",
    variants: {
      control: { label: "SAINT10 · 10% off (max ₹300)", couponCode: "SAINT10" },
      treatment: { label: "FLAT150 · ₹150 off", couponCode: "FLAT150" },
    },
  },
};

// Coupons the coupon experiment relies on; created when it starts
export const EXPERIMENT_COUPONS = [
  { code: "SAINT10", type: "percent" as const, amount: 10, maxDiscount: 300 },
  { code: "FLAT150", type: "flat" as const, amount: 150 },
];

export const DEFAULT_FREE_SHIPPING_THRESHOLD = 999;

// FNV-1a 32-bit: fast, deterministic and identical in the simulator and the API
export const fnv1a = (input: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// 50/50 split; salting with the key keeps experiments independent of each other
export const assignVariant = (experimentKey: string, unitId: string): Variant =>
  fnv1a(`${experimentKey}:${unitId}`) % 100 < 50 ? "control" : "treatment";

export const runningExperimentKeys = async () => {
  const running = await Experiment.find({ status: "running" }).select("key").lean();
  return new Set(running.map((e) => e.key));
};

export const variantFor = async (experimentKey: string, anonId?: string) => {
  if (!anonId) return null;
  const running = await runningExperimentKeys();
  return running.has(experimentKey) ? assignVariant(experimentKey, anonId) : null;
};

// Server-side threshold so the price shown in the cart equals the price charged
export const freeShippingThresholdFor = async (anonId?: string) => {
  const variant = await variantFor("free_shipping_threshold", anonId);
  return variant
    ? EXPERIMENTS.free_shipping_threshold.variants[variant].freeShippingThreshold!
    : DEFAULT_FREE_SHIPPING_THRESHOLD;
};
