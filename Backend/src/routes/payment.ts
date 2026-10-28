import express from "express";
import { adminOnly, isAuthenticated } from "../middlewares/auth.js";
import {
  allCoupons,
  applyDiscount,
  createRazorpayPayment,
  deleteCoupon,
  newCoupon,
  paymentConfig,
} from "../controllers/payment.js";

const app = express.Router();

// route - /api/v1/payment/config
app.get("/config", paymentConfig);

// route - /api/v1/payment/razorpay/order
app.post("/razorpay/order", isAuthenticated, createRazorpayPayment);

// route - /api/v1/payment/discount
app.get("/discount", applyDiscount);

// route - /api/v1/payment/coupon/new
app.post("/coupon/new", adminOnly, newCoupon);

// route - /api/v1/payment/coupon/all
app.get("/coupon/all", adminOnly, allCoupons);

// route - /api/v1/payment/coupon/:id
app.delete("/coupon/:id", adminOnly, deleteCoupon);

export default app;
