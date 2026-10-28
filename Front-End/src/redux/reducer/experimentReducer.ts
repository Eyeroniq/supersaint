import { PayloadAction, createSlice } from "@reduxjs/toolkit";

export type Assignment = {
  key: string;
  variant: "control" | "treatment";
  label: string;
  freeShippingThreshold?: number;
  couponCode?: string;
};

export type ExperimentState = {
  assignments: Assignment[];
  couponOffer: { code: string; label: string } | null;
};

const initialState: ExperimentState = { assignments: [], couponOffer: null };

export const experimentReducer = createSlice({
  name: "experimentReducer",
  initialState,
  reducers: {
    setAssignments: (_state, action: PayloadAction<ExperimentState>) => action.payload,
  },
});

export const { setAssignments } = experimentReducer.actions;
