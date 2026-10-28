import { createApi } from "@reduxjs/toolkit/query/react";
import { authBaseQuery } from "./baseQuery";
import {
  AllOrdersResponse,
  MessageResponse,
  NewOrderRequest,
  NewOrderResponse,
  OrderDetailsResponse,
  UpdateOrderRequest,
} from "../../types/api-types";

export const orderApi = createApi({
  reducerPath: "orderApi",
  baseQuery: authBaseQuery("order"),
  tagTypes: ["orders"],
  endpoints: (builder) => ({
    newOrder: builder.mutation<NewOrderResponse, NewOrderRequest>({
      query: (order) => ({
        url: "new",
        method: "POST",
        body: order,
      }),
      invalidatesTags: ["orders"],
    }),
    updateOrder: builder.mutation<MessageResponse, UpdateOrderRequest>({
      query: ({ userId, orderId }) => ({
        url: `${orderId}?id=${userId}`,
        method: "PUT",
      }),
      invalidatesTags: ["orders"],
    }),
    deleteOrder: builder.mutation<MessageResponse, UpdateOrderRequest>({
      query: ({ userId, orderId }) => ({
        url: `${orderId}?id=${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["orders"],
    }),
    myOrders: builder.query<AllOrdersResponse, string>({
      query: () => "my",
      providesTags: ["orders"],
    }),
    allOrders: builder.query<AllOrdersResponse, string>({
      query: (id) => `all?id=${id}`,
      providesTags: ["orders"],
    }),
    orderDetails: builder.query<OrderDetailsResponse, string>({
      query: (id) => id,
      providesTags: ["orders"],
    }),
  }),
});

export const {
  useNewOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useMyOrdersQuery,
  useAllOrdersQuery,
  useOrderDetailsQuery,
} = orderApi;
