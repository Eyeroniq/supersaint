import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import { NewOrderRequestBody } from "../types/types.js";
import { Order } from "../models/order.js";
import { invalidateCache, reduceStock } from "../utils/features.js";
import ErrorHandler from "../utils/utility-class.js";
import { myCache } from "../app.js";
import { priceOrder } from "../utils/pricing.js";
import {
  fetchRazorpayOrder,
  razorpayEnabled,
  verifyRazorpaySignature,
} from "../utils/razorpay.js";

export const myOrders = TryCatch(async (req, res, next) => {
  const user = req.user!._id;
  const key = `my-orders-${user}`;

  let orders = [];
  if (myCache.has(key)) orders = JSON.parse(myCache.get(key) as string);
  else {
    orders = await Order.find({ user });
    myCache.set(key, JSON.stringify(orders));
  }

  return res.status(200).json({
    success: true,
    orders,
  });
});

export const allOrders = TryCatch(async (req, res, next) => {
  const key = `all-orders`;

  let orders = [];
  if (myCache.has(key)) orders = JSON.parse(myCache.get(key) as string);
  else {
    orders = await Order.find().populate("user", "name");
    myCache.set(key, JSON.stringify(orders));
  }

  return res.status(200).json({
    success: true,
    orders,
  });
});

export const getSingleOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const key = `order-${id}`;
  let order;

  if (myCache.has(key)) order = JSON.parse(myCache.get(key) as string);
  else {
    order = await Order.findById(id).populate("user", "name");

    if (!order) return next(new ErrorHandler("Order Not Found", 404));

    myCache.set(key, JSON.stringify(order));
  }

  const ownerId = typeof order.user === "string" ? order.user : order.user?._id;
  if (req.user!.role !== "admin" && ownerId !== req.user!._id)
    return next(new ErrorHandler("Order Not Found", 404));

  return res.status(200).json({
    success: true,
    order,
  });
});

export const newOrder = TryCatch(
  async (req: Request<{}, {}, NewOrderRequestBody>, res, next) => {
    const { shippingInfo, orderItems, coupon, paymentMethod = "COD", razorpay } = req.body;
    const user = req.user!._id;

    const s = shippingInfo;
    if (!s?.address || !s.city || !s.state || !s.country || !s.pinCode)
      return next(new ErrorHandler("Please enter your full delivery address", 400));

    // Totals always come from the database, never from the client
    const priced = await priceOrder(orderItems, coupon, paymentMethod === "ONLINE");

    let paymentId: string | undefined;
    let razorpayOrderId: string | undefined;

    if (paymentMethod === "ONLINE") {
      if (!razorpayEnabled())
        return next(new ErrorHandler("Online payment is not configured", 503));
      if (!razorpay?.orderId || !razorpay.paymentId || !razorpay.signature)
        return next(new ErrorHandler("Payment details missing", 400));
      if (!verifyRazorpaySignature(razorpay.orderId, razorpay.paymentId, razorpay.signature))
        return next(new ErrorHandler("Payment verification failed", 400));

      const rzpOrder = await fetchRazorpayOrder(razorpay.orderId);
      if (rzpOrder.amount_paid !== Math.round(priced.total * 100))
        return next(
          new ErrorHandler("Paid amount doesn't match your order. Please contact support.", 400)
        );
      if (await Order.exists({ razorpayOrderId: razorpay.orderId }))
        return next(new ErrorHandler("This payment was already used for an order", 409));

      paymentId = razorpay.paymentId;
      razorpayOrderId = razorpay.orderId;
    } else if (paymentMethod !== "COD") {
      return next(new ErrorHandler("Invalid payment method", 400));
    }

    const order = await Order.create({
      shippingInfo,
      user,
      paymentMethod,
      paymentId,
      razorpayOrderId,
      ...priced,
    });

    //Now, when a order is placed, we need to reduce the stock of the ordered product..
    await reduceStock(priced.orderItems);
    invalidateCache({
      product: true,
      order: true,
      admin: true,
      userId: user,
      productId: order.orderItems.map((i) => String(i.productId)),
    });

    return res.status(201).json({
      success: true,
      message: "Order Placed Successfully",
      orderId: String(order._id),
    });
  }
);

export const processOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const order = await Order.findById(id);
  if (!order) return next(new ErrorHandler("Order Not Found", 404));

  switch (order.status) {
    case "Processing":
      order.status = "Shipped";
      break;
    case "Shipped":
      order.status = "Delivered";
      break;
    default:
      order.status = "Delivered";
      break;
  }

  await order.save();

  invalidateCache({
    product: false,
    order: true,
    admin: true,
    userId: order.user,
    orderId: String(order._id),
  });

  return res.status(200).json({
    success: true,
    message: "Order Processed Successfully",
  });
});

export const deleteOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const order = await Order.findById(id);
  if (!order) return next(new ErrorHandler("Order Not Found", 404));

  await order.deleteOne();

  invalidateCache({
    product: false,
    order: true,
    admin: true,
    userId: order.user,
    orderId: String(order._id),
  });

  return res.status(200).json({
    success: true,
    message: "Order Deleted Successfully",
  });
});
