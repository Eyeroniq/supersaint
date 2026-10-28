import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { UserReducerInitialState } from "../../types/reducer-types";
import { User } from "../../types/types";
import { TOKEN_KEY, getToken } from "../api/baseQuery";

const initialState: UserReducerInitialState = {
  user: null,
  token: getToken(),
  loading: true,
};

const storeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode); session still works in memory
  }
};

export const userReducer = createSlice({
  name: "userReducer",
  initialState,
  reducers: {
    userExist: (state, action: PayloadAction<User>) => {
      state.loading = false;
      state.user = action.payload;
    },
    userNotExist: (state) => {
      state.loading = false;
      state.user = null;
      state.token = null;
      storeToken(null);
    },
    loggedIn: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      storeToken(action.payload.token);
    },
  },
});

export const { userExist, userNotExist, loggedIn } = userReducer.actions;
