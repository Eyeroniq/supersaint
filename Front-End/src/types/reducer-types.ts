import { CartItem, ShippingInfo, User } from "./types";

export interface UserReducerInitialState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

export interface CartReducerInitialState {
  loading: boolean;
  cartItems: CartItem[];
  subtotal: number;
  tax: number;
  shippingCharges: number;
  discount: number;
  couponCode: string;
  total: number;
  shippingInfo: ShippingInfo;
}

export interface UiReducerInitialState {
  cartOpen: boolean;
  menuOpen: boolean;
  searchOpen: boolean;
}
