import { createSlice } from "@reduxjs/toolkit";
import { initialState, reducers } from "./appInfoReducer";

const appInfoSlice = createSlice({
  name: "appInfo",
  initialState: initialState,
  reducers: reducers
});

export const {
  setDataInAppInfoReducer,
  resetAppInfoReducer
} = appInfoSlice.actions;

export default appInfoSlice.reducer;
