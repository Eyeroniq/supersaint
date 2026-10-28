import { TryCatch } from "../middlewares/error.js";
import { Coupon } from "../models/coupon.js";
import ErrorHandler from "../utils/utility-class.js";
import { priceOrder } from "../utils/pricing.js";
import { createRazorpayOrder, razorpayEnabled, razorpayKeyId } from "../utils/razorpay.js";

// Tells the storefront whether online payment is available
export const paymentConfig = TryCatch(async (req, res) => {
  return res.status(200).json({
    success: true,
    online: razorpayEnabled(),
    keyId: razorpayEnabled() ? razorpayKeyId() : null,
  });
});

// Creates a Razorpay order for the server-priced cart total
export const createRazorpayPayment = TryCatch(async (req, res, next) => {
  const { orderItems, coupon } = req.body;
  const priced = await priceOrder(orderItems, coupon, true);

  const rzpOrder = await createRazorpayOrder(
    priced.total,
    `ss_${req.user!._id.slice(0, 8)}_${Date.now()}`
  );

  return res.status(201).json({
    success: true,
    keyId: razorpayKeyId(),
    orderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    total: priced.total,
  });
});

export const newCoupon = TryCatch(async (req, res, next) => {
  const { coupon, amount } = req.body;

  if (!coupon || !amount)
    return next(new ErrorHandler("Please enter both coupon and amount", 400));

  await Coupon.create({ code: coupon, amount });

  return res.status(201).json({
    success: true,
    message: `Coupon ${coupon} Created Successfully`,
  });
});

export const applyDiscount = TryCatch(async (req, res, next) => {
  const { coupon } = req.query;

  if (typeof coupon !== "string" || !coupon)
    return next(new ErrorHandler("Please enter a coupon code", 400));

  const discount = await Coupon.findOne({ code: coupon });

  if (!discount) return next(new ErrorHandler("Invalid Coupon Code", 400));

  return res.status(200).json({
    success: true,
    discount: discount.amount,
  });
});

export const allCoupons = TryCatch(async (req, res, next) => {
  const coupons = await Coupon.find({});

  return res.status(200).json({
    success: true,
    coupons,
  });
});

export const deleteCoupon = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndDelete(id);

  if (!coupon) return next(new ErrorHandler("Coupon Not Found", 400));

  return res.status(200).json({
    success: true,
    message: `Coupon ${coupon?.code} Deleted Successfully`,
  });
});
