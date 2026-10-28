import mongoose from "mongoose";

const schema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, "Please enter the Coupon Code"],
    unique: true,
  },
  // "flat" = amount is rupees off; "percent" = amount is % off, capped by maxDiscount
  type: {
    type: String,
    enum: ["flat", "percent"],
    default: "flat",
  },
  amount: {
    type: Number,
    required: [true, "Please enter the Discount Amount"],
  },
  maxDiscount: {
    type: Number,
    default: null,
  },
});

export const Coupon = mongoose.model("Coupon", schema);
