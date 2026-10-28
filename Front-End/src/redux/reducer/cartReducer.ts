import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CartReducerInitialState } from "../../types/reducer-types";
import { CartItem, ShippingInfo } from "../../types/types";

export const FREE_SHIPPING_THRESHOLD = 999;
export const SHIPPING_FEE = 99;
const CART_KEY = "supersaint-cart";

const emptyShipping: ShippingInfo = {
  name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  pinCode: "",
};

const initialState: CartReducerInitialState = {
  loading: false,
  cartItems: [],
  subtotal: 0,
  tax: 0,
  shippingCharges: 0,
  discount: 0,
  couponCode: "",
  total: 0,
  shippingInfo: emptyShipping,
};

const loadState = (): CartReducerInitialState => {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "null");
    if (saved?.cartItems) return { ...initialState, ...saved, loading: false };
  } catch {
    // ignore corrupt or unavailable storage
  }
  return initialState;
};

export const persistCart = (state: CartReducerInitialState) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable
  }
};

const sameLine = (a: CartItem, productId: string, size?: string) =>
  a.productId === productId && (a.size || "") === (size || "");

const recalc = (state: CartReducerInitialState) => {
  const subtotal = state.cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  state.subtotal = subtotal;
  state.shippingCharges =
    subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  // Prices are inclusive of GST
  state.tax = 0;
  state.discount = Math.min(state.discount, subtotal);
  state.total = Math.max(
    state.subtotal + state.tax + state.shippingCharges - state.discount,
    0
  );
};

export const cartReducer = createSlice({
  name: "cartReducer",
  initialState: loadState(),
  reducers: {
    // Adds to an existing line (same product + size) or creates a new one
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const item = action.payload;
      const line = state.cartItems.find((i) =>
        sameLine(i, item.productId, item.size)
      );
      if (line) line.quantity = Math.min(line.quantity + item.quantity, item.stock);
      else state.cartItems.push(item);
      recalc(state);
    },
    setQuantity: (
      state,
      action: PayloadAction<{ productId: string; size?: string; quantity: number }>
    ) => {
      const { productId, size, quantity } = action.payload;
      const line = state.cartItems.find((i) => sameLine(i, productId, size));
      if (!line) return;
      if (quantity < 1)
        state.cartItems = state.cartItems.filter(
          (i) => !sameLine(i, productId, size)
        );
      else line.quantity = Math.min(quantity, line.stock);
      recalc(state);
    },
    removeCartItem: (
      state,
      action: PayloadAction<{ productId: string; size?: string } | string>
    ) => {
      const { productId, size } =
        typeof action.payload === "string"
          ? { productId: action.payload, size: undefined }
          : action.payload;
      state.cartItems = state.cartItems.filter((i) =>
        size === undefined ? i.productId !== productId : !sameLine(i, productId, size)
      );
      recalc(state);
    },
    calculatePrice: (state) => recalc(state),
    discountApplied: (state, action: PayloadAction<{ code: string; amount: number }>) => {
      state.couponCode = action.payload.code;
      state.discount = action.payload.amount;
      recalc(state);
    },
    saveShippingInfo: (state, action: PayloadAction<ShippingInfo>) => {
      state.shippingInfo = action.payload;
    },
    resetCart: (state) => ({ ...initialState, shippingInfo: state.shippingInfo }),
  },
});

export const {
  addToCart,
  setQuantity,
  removeCartItem,
  calculatePrice,
  discountApplied,
  saveShippingInfo,
  resetCart,
} = cartReducer.actions;
