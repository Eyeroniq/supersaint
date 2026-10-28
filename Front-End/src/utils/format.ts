const server = import.meta.env.VITE_SERVER;
import { Product } from "../types/types";

const rupees = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatPrice = (amount: number) => `Rs. ${rupees.format(amount)}`;

export const savePercent = (price: number, comparePrice?: number) =>
  comparePrice && comparePrice > price
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;

export const photoUrl = (photo: string) =>
  /^https?:\/\//.test(photo) ? photo : `${server}/${photo}`;

// "Everyday Fitted Tee - Navy" -> "Everyday Fitted Tee"
export const baseName = (product: Pick<Product, "name">) =>
  product.name.split(" - ")[0].trim();
