import { createApi } from "@reduxjs/toolkit/query/react";
import axios from "axios";
import {
  AllUsersResponse,
  AuthResponse,
  DeleteUserRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  UserResponse,
} from "../../types/api-types";
import { authBaseQuery, authHeaders } from "./baseQuery";

export const userAPI = createApi({
  reducerPath: "userApi",
  baseQuery: authBaseQuery("user"),
  tagTypes: ["users"],
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: "login",
        method: "POST",
        body,
      }),
    }),

    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({
        url: "register",
        method: "POST",
        body,
      }),
      invalidatesTags: ["users"],
    }),

    deleteUser: builder.mutation<MessageResponse, DeleteUserRequest>({
      query: ({ userId }) => ({
        url: userId,
        method: "DELETE",
      }),
      invalidatesTags: ["users"],
    }),

    allUsers: builder.query<AllUsersResponse, string>({
      query: () => "all",
      providesTags: ["users"],
    }),
  }),
});

export const getMe = async () => {
  const { data }: { data: UserResponse } = await axios.get(
    `${import.meta.env.VITE_SERVER}/api/v1/user/me`,
    { headers: authHeaders() }
  );
  return data;
};

export const {
  useLoginMutation,
  useRegisterMutation,
  useAllUsersQuery,
  useDeleteUserMutation,
} = userAPI;
