import { createApi } from "@reduxjs/toolkit/query/react";
import {
  ApiResponse,
  Coupons,
  Customers,
  ExperimentInfo,
  ExperimentResults,
  Funnel,
  KpiDailyRow,
  Kpis,
  Meta,
  Payments,
  Products,
  Range,
  Search,
} from "../../types/analytics";
import { MessageResponse } from "../../types/api-types";
import { authBaseQuery } from "./baseQuery";

const rangeQuery = (r: Range) => `from=${r.from}&to=${r.to}`;

export type FunnelArgs = Range & { category?: string; device?: string; customerType?: string };

export const analyticsApi = createApi({
  reducerPath: "analyticsApi",
  baseQuery: authBaseQuery("analytics"),
  tagTypes: ["experiments"],
  keepUnusedDataFor: 300,
  endpoints: (builder) => ({
    meta: builder.query<Meta, void>({
      query: () => "meta",
      transformResponse: (r: ApiResponse<Meta>) => r.data,
    }),
    kpis: builder.query<Kpis, Range>({
      query: (r) => `kpis?${rangeQuery(r)}`,
      transformResponse: (r: ApiResponse<Kpis>) => r.data,
    }),
    kpiDaily: builder.query<KpiDailyRow[], Range>({
      query: (r) => `kpi-daily?${rangeQuery(r)}`,
      transformResponse: (r: ApiResponse<KpiDailyRow[]>) => r.data,
    }),
    funnel: builder.query<Funnel, FunnelArgs>({
      query: ({ from, to, category, device, customerType }) => {
        const params = new URLSearchParams({ from, to });
        if (category) params.set("category", category);
        if (device) params.set("device", device);
        if (customerType) params.set("customerType", customerType);
        return `funnel?${params}`;
      },
      transformResponse: (r: ApiResponse<Funnel>) => r.data,
    }),
    customers: builder.query<Customers, void>({
      query: () => "customers",
      transformResponse: (r: ApiResponse<Customers>) => r.data,
    }),
    products: builder.query<Products, Range>({
      query: (r) => `products?${rangeQuery(r)}`,
      transformResponse: (r: ApiResponse<Products>) => r.data,
    }),
    payments: builder.query<Payments, Range>({
      query: (r) => `payments?${rangeQuery(r)}`,
      transformResponse: (r: ApiResponse<Payments>) => r.data,
    }),
    search: builder.query<Search, Range>({
      query: (r) => `search?${rangeQuery(r)}`,
      transformResponse: (r: ApiResponse<Search>) => r.data,
    }),
    coupons: builder.query<Coupons, Range>({
      query: (r) => `coupons?${rangeQuery(r)}`,
      transformResponse: (r: ApiResponse<Coupons>) => r.data,
    }),
    experimentResults: builder.query<ExperimentResults, { key: string; mde: number }>({
      query: ({ key, mde }) => `experiments/${key}?mde=${mde}`,
      transformResponse: (r: ApiResponse<ExperimentResults>) => r.data,
      providesTags: ["experiments"],
    }),
    experiments: builder.query<ExperimentInfo[], void>({
      query: () => ({ url: `${import.meta.env.VITE_SERVER}/api/v1/experiments` }),
      transformResponse: (r: { experiments: ExperimentInfo[] }) => r.experiments,
      providesTags: ["experiments"],
    }),
    setExperimentStatus: builder.mutation<MessageResponse, { key: string; status: "running" | "stopped" }>({
      query: ({ key, status }) => ({
        url: `${import.meta.env.VITE_SERVER}/api/v1/experiments/${key}/status`,
        method: "PUT",
        body: { status },
      }),
      invalidatesTags: ["experiments"],
    }),
  }),
});

export const {
  useMetaQuery,
  useKpisQuery,
  useKpiDailyQuery,
  useFunnelQuery,
  useCustomersQuery,
  useProductsQuery,
  usePaymentsQuery,
  useSearchQuery,
  useCouponsQuery,
  useExperimentResultsQuery,
  useExperimentsQuery,
  useSetExperimentStatusMutation,
} = analyticsApi;
