import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter Name"],
    },
    photo: {
      type: String,
      required: [true, "Please enter Photo"],
    },
    price: {
      type: Number,
      required: [true, "Please enter Price"],
    },
    stock: {
      type: Number,
      required: [true, "Please enter Stock"],
    },
    category: {
      type: String,
      required: [true, "Please enter Category"],
      trim: true,
    },
    // Original price shown struck-through; a "SAVE x%" badge is derived from it
    comparePrice: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    sizes: {
      type: [String],
      default: [],
    },
    color: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      default: 0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", schema);
