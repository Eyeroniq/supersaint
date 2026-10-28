import { configureStore } from "@reduxjs/toolkit";
import { userAPI } from "./api/userAPI";
import { userReducer } from "./reducer/userReducer";
import { productAPI } from "./api/productAPI";
import { cartReducer, persistCart } from "./reducer/cartReducer";
import { uiReducer } from "./reducer/uiReducer";
import { experimentReducer } from "./reducer/experimentReducer";
import { orderApi } from "./api/orderAPI";
import { dashboardApi } from "./api/dashboardAPI";
import { analyticsApi } from "./api/analyticsAPI";

export const server = import.meta.env.VITE_SERVER;

//creating a store
export const store = configureStore({
  reducer: {
    [userAPI.reducerPath]: userAPI.reducer,
    [productAPI.reducerPath]: productAPI.reducer,
    [orderApi.reducerPath]: orderApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [analyticsApi.reducerPath]: analyticsApi.reducer,
    [userReducer.name]: userReducer.reducer,
    [cartReducer.name]: cartReducer.reducer,
    [uiReducer.name]: uiReducer.reducer,
    [experimentReducer.name]: experimentReducer.reducer,
  },
  // middleware: (mid) => [...mid(), userAPI.middleware],----> changed
  middleware: (mid) =>
    mid().concat(
      userAPI.middleware,
      productAPI.middleware,
      orderApi.middleware,
      dashboardApi.middleware,
      analyticsApi.middleware
    ),
  // Batch RTK Query notifications on a timer, not requestAnimationFrame, so
  // results still render in background/throttled tabs
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers({ autoBatch: { type: "tick" } }),
});

store.subscribe(() => persistCart(store.getState().cartReducer));

export type RootState = ReturnType<typeof store.getState>;
