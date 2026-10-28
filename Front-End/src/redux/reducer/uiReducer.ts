import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { UiReducerInitialState } from "../../types/reducer-types";

const initialState: UiReducerInitialState = {
  cartOpen: false,
  menuOpen: false,
  searchOpen: false,
};

export const uiReducer = createSlice({
  name: "uiReducer",
  initialState,
  reducers: {
    setCartOpen: (state, action: PayloadAction<boolean>) => {
      state.cartOpen = action.payload;
    },
    setMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.menuOpen = action.payload;
    },
    setSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.searchOpen = action.payload;
    },
    closeAll: () => initialState,
  },
});

export const { setCartOpen, setMenuOpen, setSearchOpen, closeAll } =
  uiReducer.actions;
