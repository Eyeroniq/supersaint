import mongoose from "mongoose";

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
      enum: ["Processing", "Shipped", "Delivered"],
      default: "Processing",
    },
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

export const Order = mongoose.model("Order", schema);
