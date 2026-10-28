import { Coupon } from "../models/coupon.js";
import { Product } from "../models/product.js";
import { OrderItemType } from "../types/types.js";
import ErrorHandler from "./utility-class.js";

// Keep in sync with Front-End/src/redux/reducer/cartReducer.ts
export const FREE_SHIPPING_THRESHOLD = 999;
export const SHIPPING_FEE = 99;

// Rupees off for a coupon on a given subtotal (never more than the subtotal)
export const couponDiscount = (
  coupon: { type?: string | null; amount: number; maxDiscount?: number | null },
  subtotal: number
) => {
  const raw =
    coupon.type === "percent" ? Math.round((subtotal * coupon.amount) / 100) : coupon.amount;
  const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
};

// Prices an order from database prices so the client can't change the amount.
// Prepaid (online) orders always ship free.
export const priceOrder = async (
  items: OrderItemType[],
  couponCode?: string,
  prepaid = false,
  // Free-shipping threshold; only the shipping experiment changes it
  freeShippingThreshold = FREE_SHIPPING_THRESHOLD
) => {
  if (!items?.length) throw new ErrorHandler("Your cart is empty", 400);

  const orderItems: OrderItemType[] = [];
  let subtotal = 0;

  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity));
    if (!quantity || quantity < 1) throw new ErrorHandler("Invalid quantity", 400);

    const product = await Product.findById(item.productId);
    if (!product) throw new ErrorHandler(`${item.name || "An item"} is no longer available`, 400);
    if (product.stock < quantity)
      throw new ErrorHandler(`Only ${product.stock} left of ${product.name}`, 400);

    subtotal += product.price * quantity;
    orderItems.push({
      productId: String(product._id),
      name: product.name,
      photo: product.photo,
      price: product.price,
      quantity,
      size: item.size,
    });
  }

  let discount = 0;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon) throw new ErrorHandler("Invalid Coupon Code", 400);
    discount = couponDiscount(coupon, subtotal);
  }

  const shippingCharges = prepaid || subtotal >= freeShippingThreshold ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingCharges - discount;

  return { orderItems, subtotal, tax: 0, shippingCharges, discount, total };
};
