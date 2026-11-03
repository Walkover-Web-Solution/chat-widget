import { createSlice } from "@reduxjs/toolkit";
import { initialState, reducers } from "./helloReducer";

const helloSlice = createSlice({
  name: "Hello",
  initialState,
  reducers,
});

export const {
  setChannel,
  setHelloConfig,
  setWidgetInfo,
  setChannelListData,
  setJwtToken,
  setHelloKeysData,
  changeChannelAssigned,
  setGreeting,
  setUnReadCount,
  setAgentTeams,
  setHelloClientInfo,
  moveChannelToTop,
  setChannelClosedStatus,
  setChannelBlockedStatus,
  addChannel
} = helloSlice.actions;
export default helloSlice.reducer;
