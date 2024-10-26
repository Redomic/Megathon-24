import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  nodes: [],
  links: [],
  chat: {
    overlay: false,
    messages: [],
  },
};

export const blockchainSlice = createSlice({
  name: "blockchain",
  initialState,
  reducers: {
    setNodes: (state, action) => {
      console.log(action.payload);
      return {
        ...state,
        nodes: action.payload.nodes,
        links: action.payload.links,
      };
    },
    setMessages: (state, action) => {
      state.chat.messages = action.payload;
    },
    setOverlay: (state, action) => {
      state.chat.overlay = action.payload;
    },
  },
});

export const { setNodes, setMessages, setOverlay } = blockchainSlice.actions;

export default blockchainSlice.reducer;
