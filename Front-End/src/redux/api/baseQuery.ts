import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const TOKEN_KEY = "supersaint-token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// fetchBaseQuery that sends the JWT on every request
export const authBaseQuery = (path: string) =>
  fetchBaseQuery({
    baseUrl: `${import.meta.env.VITE_SERVER}/api/v1/${path}/`,
    prepareHeaders: (headers) => {
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  });
