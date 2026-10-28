import { DEFAULT_FREE_SHIPPING_THRESHOLD, EXPERIMENTS, EXPERIMENT_COUPONS, assignVariant, runningExperimentKeys } from "../analytics/experiments.js";
import { TryCatch } from "../middlewares/error.js";
import { Coupon } from "../models/coupon.js";
import { Experiment } from "../models/experiment.js";
import ErrorHandler from "../utils/utility-class.js";

// Public: which variant this visitor sees for each running experiment
export const getAssignments = TryCatch(async (req, res) => {
  const anonId = typeof req.query.anonId === "string" ? req.query.anonId.slice(0, 64) : "";
  const running = anonId ? await runningExperimentKeys() : new Set<string>();

  const assignments = Object.values(EXPERIMENTS)
    .filter((e) => running.has(e.key))
    .map((e) => {
      const variant = assignVariant(e.key, anonId);
      return { key: e.key, variant, ...e.variants[variant] };
    });

  const shipping = assignments.find((a) => a.key === "free_shipping_threshold");
  const coupon = assignments.find((a) => a.key === "coupon_offer");

  return res.status(200).json({
    success: true,
    assignments,
    freeShippingThreshold: shipping?.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD,
    couponOffer: coupon ? { code: coupon.couponCode, label: coupon.label } : null,
  });
});

export const listExperiments = TryCatch(async (req, res) => {
  const states = await Experiment.find({}).lean();
  const experiments = Object.values(EXPERIMENTS).map((config) => {
    const state = states.find((s) => s.key === config.key);
    return {
      ...config,
      status: state?.status ?? "stopped",
      startedAt: state?.startedAt ?? null,
      stoppedAt: state?.stoppedAt ?? null,
    };
  });
  return res.status(200).json({ success: true, experiments });
});

export const setExperimentStatus = TryCatch(async (req, res, next) => {
  const { key } = req.params;
  const status = req.body?.status;
  if (!EXPERIMENTS[key]) return next(new ErrorHandler("Unknown experiment", 404));
  if (status !== "running" && status !== "stopped")
    return next(new ErrorHandler('status must be "running" or "stopped"', 400));

  // The coupon test needs its codes to exist before shoppers see them
  if (key === "coupon_offer" && status === "running")
    for (const c of EXPERIMENT_COUPONS)
      await Coupon.updateOne({ code: c.code }, { $setOnInsert: c }, { upsert: true });

  const now = new Date();
  await Experiment.updateOne(
    { key },
    status === "running"
      ? { status, startedAt: now, $unset: { stoppedAt: 1 } }
      : { status, stoppedAt: now },
    { upsert: true }
  );

  return res.status(200).json({ success: true, message: `${EXPERIMENTS[key].name} ${status}` });
});
