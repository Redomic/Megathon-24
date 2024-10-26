import { configureStore } from "@reduxjs/toolkit";

import commonReducer from "./slices/common";
// import blockchainReducer from './slices/blockchain';

export const store = configureStore({
  reducer: {
    common: commonReducer,
  },
});
