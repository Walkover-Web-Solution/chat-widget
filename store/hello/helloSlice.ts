import { createSlice } from "@reduxjs/toolkit";
import { initialState, reducers } from "./helloReducer";

const interfaceSlice = createSlice({
  name: "Hello",
  initialState,
  reducers,
});

export const {
  setChannel,
  getHelloDetailsStart,
  getHelloDetailsSuccess,
  setIsVision,
  setHelloConfig,
  setInitialHelloConfig,
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
  setChannelClosedStatus
} = interfaceSlice.actions;
export default interfaceSlice.reducer;
